/**
 * Offline Persistence Hook
 *
 * React hook for using offline-first persistence with automatic sync.
 *
 * Features:
 * - Online/offline status tracking
 * - Automatic sync when back online
 * - Conversation management
 * - Memory management
 * - Export/import functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getOfflinePersistence,
  OfflineConversation,
  OfflineMessage,
  OfflineMemory,
  OfflineStatus,
  OfflinePreferences,
  OfflineKnowledge,
} from '@/lib/offline/OfflinePersistenceService';

// ============================================================================
// TYPES
// ============================================================================

interface UseOfflinePersistenceOptions {
  userId: string;
  autoSync?: boolean;
  syncInterval?: number; // ms
}

interface UseOfflinePersistenceReturn {
  // Status
  isOnline: boolean;
  status: OfflineStatus | null;
  isLoading: boolean;
  error: string | null;

  // Conversations
  conversations: OfflineConversation[];
  loadConversations: () => Promise<void>;
  createConversation: (title: string) => Promise<OfflineConversation>;
  updateConversation: (id: string, updates: Partial<OfflineConversation>) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;

  // Messages
  getMessages: (conversationId: string) => Promise<OfflineMessage[]>;
  addMessage: (message: Omit<OfflineMessage, 'id' | 'synced'>) => Promise<OfflineMessage>;

  // Memories
  memories: OfflineMemory[];
  loadMemories: (type?: 'wisdom' | 'pattern' | 'gotcha' | 'fact') => Promise<void>;
  addMemory: (memory: Omit<OfflineMemory, 'id' | 'synced' | 'createdAt' | 'updatedAt'>) => Promise<OfflineMemory>;
  updateMemory: (id: string, updates: Partial<OfflineMemory>) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  searchMemories: (query: string, options?: { type?: string; limit?: number }) => Promise<OfflineMemory[]>;

  // Knowledge
  searchKnowledge: (query: string, options?: { type?: string; domain?: string }) => Promise<OfflineKnowledge[]>;
  cacheKnowledge: (items: OfflineKnowledge[]) => Promise<void>;

  // Preferences
  preferences: OfflinePreferences | null;
  savePreferences: (prefs: Partial<OfflinePreferences>) => Promise<void>;

  // Sync
  syncNow: () => Promise<{ synced: number; failed: number }>;
  pendingSyncCount: number;

  // Export/Import
  exportData: () => Promise<string>;
  importData: (jsonData: string) => Promise<boolean>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useOfflinePersistence(
  options: UseOfflinePersistenceOptions
): UseOfflinePersistenceReturn {
  const { userId, autoSync = true, syncInterval = 30000 } = options;

  // State
  const [isOnline, setIsOnline] = useState(true);
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<OfflineConversation[]>([]);
  const [memories, setMemories] = useState<OfflineMemory[]>([]);
  const [preferences, setPreferences] = useState<OfflinePreferences | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Refs
  const persistence = useRef(getOfflinePersistence());
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);

        // Get initial status
        const initialStatus = await persistence.current.getStatus();
        setStatus(initialStatus);
        setIsOnline(initialStatus.isOnline);
        setPendingSyncCount(initialStatus.pendingSyncCount);

        // Load initial data
        const [convs, mems, prefs] = await Promise.all([
          persistence.current.getUserConversations(userId),
          persistence.current.getUserMemories(userId),
          persistence.current.getPreferences(userId),
        ]);

        setConversations(convs);
        setMemories(mems);
        setPreferences(prefs || null);
      } catch (err) {
        console.error('[useOfflinePersistence] Init error:', err);
        setError(err instanceof Error ? err.message : 'Initialization failed');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [userId]);

  // Online/offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (autoSync) {
        persistence.current.syncPendingItems().then((result) => {
          setPendingSyncCount((prev) => Math.max(0, prev - result.synced));
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [autoSync]);

  // Auto-sync interval
  useEffect(() => {
    if (autoSync && syncInterval > 0) {
      syncIntervalRef.current = setInterval(async () => {
        if (persistence.current.isOnline()) {
          const result = await persistence.current.syncPendingItems();
          if (result.synced > 0) {
            setPendingSyncCount((prev) => Math.max(0, prev - result.synced));
          }
        }
      }, syncInterval);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [autoSync, syncInterval]);

  // ==========================================================================
  // CONVERSATIONS
  // ==========================================================================

  const loadConversations = useCallback(async () => {
    const convs = await persistence.current.getUserConversations(userId);
    setConversations(convs);
  }, [userId]);

  const createConversation = useCallback(
    async (title: string): Promise<OfflineConversation> => {
      const now = new Date().toISOString();
      const conversation: OfflineConversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId,
        title,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        messageCount: 0,
        currentPhase: 'intake',
        synced: false,
      };

      await persistence.current.saveConversation(conversation);
      setConversations((prev) => [conversation, ...prev]);
      setPendingSyncCount((prev) => prev + 1);

      return conversation;
    },
    [userId]
  );

  const updateConversation = useCallback(
    async (id: string, updates: Partial<OfflineConversation>): Promise<void> => {
      const existing = await persistence.current.getConversation(id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          updatedAt: new Date().toISOString(),
          synced: false,
        };
        await persistence.current.saveConversation(updated);
        setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)));
        setPendingSyncCount((prev) => prev + 1);
      }
    },
    []
  );

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    await persistence.current.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ==========================================================================
  // MESSAGES
  // ==========================================================================

  const getMessages = useCallback(
    async (conversationId: string): Promise<OfflineMessage[]> => {
      return persistence.current.getConversationMessages(conversationId);
    },
    []
  );

  const addMessage = useCallback(
    async (message: Omit<OfflineMessage, 'id' | 'synced'>): Promise<OfflineMessage> => {
      const fullMessage: OfflineMessage = {
        ...message,
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        synced: false,
      };

      await persistence.current.saveMessage(fullMessage);
      setPendingSyncCount((prev) => prev + 1);

      // Update conversations list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === message.conversationId
            ? {
                ...c,
                messageCount: c.messageCount + 1,
                lastMessageAt: fullMessage.timestamp,
                updatedAt: fullMessage.timestamp,
              }
            : c
        )
      );

      return fullMessage;
    },
    []
  );

  // ==========================================================================
  // MEMORIES
  // ==========================================================================

  const loadMemories = useCallback(
    async (type?: 'wisdom' | 'pattern' | 'gotcha' | 'fact') => {
      const mems = await persistence.current.getUserMemories(userId, type);
      setMemories(mems);
    },
    [userId]
  );

  const addMemory = useCallback(
    async (
      memory: Omit<OfflineMemory, 'id' | 'synced' | 'createdAt' | 'updatedAt'>
    ): Promise<OfflineMemory> => {
      const now = new Date().toISOString();
      const fullMemory: OfflineMemory = {
        ...memory,
        id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
        synced: false,
      };

      await persistence.current.saveMemory(fullMemory);
      setMemories((prev) => [...prev, fullMemory]);
      setPendingSyncCount((prev) => prev + 1);

      return fullMemory;
    },
    []
  );

  const updateMemory = useCallback(async (id: string, updates: Partial<OfflineMemory>) => {
    await persistence.current.updateMemory(id, updates);
    setMemories((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, ...updates, updatedAt: new Date().toISOString(), synced: false }
          : m
      )
    );
    setPendingSyncCount((prev) => prev + 1);
  }, []);

  const deleteMemory = useCallback(async (id: string) => {
    await persistence.current.deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const searchMemories = useCallback(
    async (
      query: string,
      options?: { type?: string; limit?: number }
    ): Promise<OfflineMemory[]> => {
      return persistence.current.searchMemories(userId, query, options);
    },
    [userId]
  );

  // ==========================================================================
  // KNOWLEDGE
  // ==========================================================================

  const searchKnowledge = useCallback(
    async (
      query: string,
      options?: { type?: string; domain?: string }
    ): Promise<OfflineKnowledge[]> => {
      return persistence.current.searchCachedKnowledge(query, options);
    },
    []
  );

  const cacheKnowledge = useCallback(async (items: OfflineKnowledge[]) => {
    await persistence.current.cacheKnowledge(items);
  }, []);

  // ==========================================================================
  // PREFERENCES
  // ==========================================================================

  const savePreferences = useCallback(
    async (prefs: Partial<OfflinePreferences>) => {
      const updated: OfflinePreferences = {
        userId,
        theme: 'system',
        communicationStyle: 'conversational',
        preferredMode: 'assist',
        interests: [],
        updatedAt: new Date().toISOString(),
        synced: false,
        ...preferences,
        ...prefs,
      };

      await persistence.current.savePreferences(updated);
      setPreferences(updated);
      setPendingSyncCount((prev) => prev + 1);
    },
    [userId, preferences]
  );

  // ==========================================================================
  // SYNC
  // ==========================================================================

  const syncNow = useCallback(async () => {
    const result = await persistence.current.syncPendingItems();
    setPendingSyncCount((prev) => Math.max(0, prev - result.synced));
    return result;
  }, []);

  // ==========================================================================
  // EXPORT/IMPORT
  // ==========================================================================

  const exportData = useCallback(async (): Promise<string> => {
    const data = await persistence.current.exportAllData(userId);
    return JSON.stringify(data, null, 2);
  }, [userId]);

  const importData = useCallback(
    async (jsonData: string): Promise<boolean> => {
      try {
        const data = JSON.parse(jsonData);
        await persistence.current.importData(data);

        // Reload all data
        await Promise.all([loadConversations(), loadMemories()]);

        return true;
      } catch (err) {
        console.error('[useOfflinePersistence] Import error:', err);
        return false;
      }
    },
    [loadConversations, loadMemories]
  );

  return {
    // Status
    isOnline,
    status,
    isLoading,
    error,

    // Conversations
    conversations,
    loadConversations,
    createConversation,
    updateConversation,
    deleteConversation,

    // Messages
    getMessages,
    addMessage,

    // Memories
    memories,
    loadMemories,
    addMemory,
    updateMemory,
    deleteMemory,
    searchMemories,

    // Knowledge
    searchKnowledge,
    cacheKnowledge,

    // Preferences
    preferences,
    savePreferences,

    // Sync
    syncNow,
    pendingSyncCount,

    // Export/Import
    exportData,
    importData,
  };
}
