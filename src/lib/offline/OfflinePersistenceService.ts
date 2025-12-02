/**
 * Offline Persistence Service
 *
 * Provides 24/7 assistant availability with offline-first architecture.
 *
 * ARCHITECTURE:
 * 1. IndexedDB: Primary local storage (50MB+ capacity)
 *    - Conversations & messages
 *    - User memories (wisdom, patterns, gotchas, facts)
 *    - Cached knowledge base
 *    - Pending sync queue
 *
 * 2. Supabase: Cloud sync when online
 *    - Real-time sync for multi-device
 *    - Backup & restore
 *    - Cross-device continuity
 *
 * 3. Service Worker: Background sync
 *    - Queues requests when offline
 *    - Syncs when back online
 *    - Push notifications
 *
 * OFFLINE CAPABILITIES:
 * - Full conversation history
 * - User memories & preferences
 * - Embedded knowledge base search
 * - Queued messages for later sync
 */

// IndexedDB database name and version
const DB_NAME = 'infinity_assistant_offline';
const DB_VERSION = 1;

// Store names
const STORES = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  MEMORIES: 'memories',
  KNOWLEDGE: 'knowledge',
  SYNC_QUEUE: 'sync_queue',
  PREFERENCES: 'preferences',
  CACHE: 'cache',
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface OfflineConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  messageCount: number;
  currentPhase: string;
  summary?: string;
  synced: boolean;
  syncedAt?: string;
}

export interface OfflineMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  phase?: string;
  importance?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
  synced: boolean;
  syncedAt?: string;
  // For offline-generated assistant responses
  generatedOffline?: boolean;
}

export interface OfflineMemory {
  id: string;
  userId: string;
  type: 'wisdom' | 'pattern' | 'gotcha' | 'fact';
  content: string;
  title?: string;
  domain?: string;
  tags: string[];
  confidence: number;
  createdAt: string;
  updatedAt: string;
  source?: string;
  userEdited: boolean;
  synced: boolean;
  syncedAt?: string;
}

export interface OfflineKnowledge {
  id: string;
  type: 'wisdom' | 'pattern' | 'gotcha';
  content: string;
  title: string;
  domain: string;
  tags: string[];
  score?: number;
  cachedAt: string;
  expiresAt: string;
}

export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  store: (typeof STORES)[keyof typeof STORES];
  data: unknown;
  createdAt: string;
  attempts: number;
  lastAttempt?: string;
  error?: string;
}

export interface OfflinePreferences {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  communicationStyle: 'concise' | 'detailed' | 'conversational';
  preferredMode: 'search' | 'assist' | 'build';
  interests: string[];
  role?: string;
  experienceLevel?: string;
  updatedAt: string;
  synced: boolean;
}

export interface OfflineStatus {
  isOnline: boolean;
  lastOnline: string;
  pendingSyncCount: number;
  storageUsed: number;
  storageQuota: number;
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize IndexedDB database
 */
function initDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflinePersistence] Database error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[OfflinePersistence] Database initialized');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Conversations store
      if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
        const convStore = db.createObjectStore(STORES.CONVERSATIONS, { keyPath: 'id' });
        convStore.createIndex('userId', 'userId', { unique: false });
        convStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        convStore.createIndex('synced', 'synced', { unique: false });
      }

      // Messages store
      if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
        const msgStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
        msgStore.createIndex('conversationId', 'conversationId', { unique: false });
        msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        msgStore.createIndex('synced', 'synced', { unique: false });
      }

      // Memories store
      if (!db.objectStoreNames.contains(STORES.MEMORIES)) {
        const memStore = db.createObjectStore(STORES.MEMORIES, { keyPath: 'id' });
        memStore.createIndex('userId', 'userId', { unique: false });
        memStore.createIndex('type', 'type', { unique: false });
        memStore.createIndex('domain', 'domain', { unique: false });
        memStore.createIndex('synced', 'synced', { unique: false });
      }

      // Knowledge cache store
      if (!db.objectStoreNames.contains(STORES.KNOWLEDGE)) {
        const knowStore = db.createObjectStore(STORES.KNOWLEDGE, { keyPath: 'id' });
        knowStore.createIndex('type', 'type', { unique: false });
        knowStore.createIndex('domain', 'domain', { unique: false });
        knowStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }

      // Sync queue store
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        syncStore.createIndex('store', 'store', { unique: false });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Preferences store
      if (!db.objectStoreNames.contains(STORES.PREFERENCES)) {
        db.createObjectStore(STORES.PREFERENCES, { keyPath: 'userId' });
      }

      // General cache store
      if (!db.objectStoreNames.contains(STORES.CACHE)) {
        const cacheStore = db.createObjectStore(STORES.CACHE, { keyPath: 'key' });
        cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }

      console.log('[OfflinePersistence] Database schema created');
    };
  });

  return dbInitPromise;
}

// ============================================================================
// GENERIC DATABASE OPERATIONS
// ============================================================================

async function getStore(
  storeName: string,
  mode: IDBTransactionMode = 'readonly'
): Promise<IDBObjectStore> {
  const db = await initDatabase();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

async function dbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut<T>(storeName: string, value: T): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function dbDelete(storeName: string, key: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const store = await getStore(storeName);
  const index = store.index(indexName);
  return new Promise((resolve, reject) => {
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// OFFLINE PERSISTENCE SERVICE
// ============================================================================

export class OfflinePersistenceService {
  private static instance: OfflinePersistenceService;
  private onlineStatus = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private syncInProgress = false;

  private constructor() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  static getInstance(): OfflinePersistenceService {
    if (!OfflinePersistenceService.instance) {
      OfflinePersistenceService.instance = new OfflinePersistenceService();
    }
    return OfflinePersistenceService.instance;
  }

  // ==========================================================================
  // STATUS
  // ==========================================================================

  isOnline(): boolean {
    return this.onlineStatus;
  }

  private handleOnline(): void {
    console.log('[OfflinePersistence] Back online');
    this.onlineStatus = true;
    this.syncPendingItems();
  }

  private handleOffline(): void {
    console.log('[OfflinePersistence] Gone offline');
    this.onlineStatus = false;
  }

  async getStatus(): Promise<OfflineStatus> {
    const pendingItems = await dbGetAll<SyncQueueItem>(STORES.SYNC_QUEUE);

    let storageUsed = 0;
    let storageQuota = 0;

    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      storageUsed = estimate.usage || 0;
      storageQuota = estimate.quota || 0;
    }

    return {
      isOnline: this.onlineStatus,
      lastOnline: new Date().toISOString(),
      pendingSyncCount: pendingItems.length,
      storageUsed,
      storageQuota,
    };
  }

  // ==========================================================================
  // CONVERSATIONS
  // ==========================================================================

  async saveConversation(conversation: OfflineConversation): Promise<void> {
    await dbPut(STORES.CONVERSATIONS, conversation);

    if (this.onlineStatus) {
      await this.queueSync('create', STORES.CONVERSATIONS, conversation);
    }
  }

  async getConversation(id: string): Promise<OfflineConversation | undefined> {
    return dbGet<OfflineConversation>(STORES.CONVERSATIONS, id);
  }

  async getUserConversations(userId: string): Promise<OfflineConversation[]> {
    const conversations = await dbGetByIndex<OfflineConversation>(
      STORES.CONVERSATIONS,
      'userId',
      userId
    );
    return conversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async deleteConversation(id: string): Promise<void> {
    // Delete all messages first
    const messages = await this.getConversationMessages(id);
    for (const msg of messages) {
      await dbDelete(STORES.MESSAGES, msg.id);
    }
    await dbDelete(STORES.CONVERSATIONS, id);

    if (this.onlineStatus) {
      await this.queueSync('delete', STORES.CONVERSATIONS, { id });
    }
  }

  // ==========================================================================
  // MESSAGES
  // ==========================================================================

  async saveMessage(message: OfflineMessage): Promise<void> {
    await dbPut(STORES.MESSAGES, message);

    // Update conversation
    const conversation = await this.getConversation(message.conversationId);
    if (conversation) {
      conversation.messageCount++;
      conversation.lastMessageAt = message.timestamp;
      conversation.updatedAt = message.timestamp;
      await dbPut(STORES.CONVERSATIONS, conversation);
    }

    if (this.onlineStatus && !message.generatedOffline) {
      await this.queueSync('create', STORES.MESSAGES, message);
    }
  }

  async getConversationMessages(conversationId: string): Promise<OfflineMessage[]> {
    const messages = await dbGetByIndex<OfflineMessage>(
      STORES.MESSAGES,
      'conversationId',
      conversationId
    );
    return messages.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  async getRecentMessages(conversationId: string, limit: number = 20): Promise<OfflineMessage[]> {
    const messages = await this.getConversationMessages(conversationId);
    return messages.slice(-limit);
  }

  // ==========================================================================
  // MEMORIES
  // ==========================================================================

  async saveMemory(memory: OfflineMemory): Promise<void> {
    await dbPut(STORES.MEMORIES, memory);

    if (this.onlineStatus) {
      await this.queueSync('create', STORES.MEMORIES, memory);
    }
  }

  async getUserMemories(
    userId: string,
    type?: 'wisdom' | 'pattern' | 'gotcha' | 'fact'
  ): Promise<OfflineMemory[]> {
    const allMemories = await dbGetByIndex<OfflineMemory>(STORES.MEMORIES, 'userId', userId);

    if (type) {
      return allMemories.filter((m) => m.type === type);
    }
    return allMemories;
  }

  async searchMemories(
    userId: string,
    query: string,
    options: { type?: string; domain?: string; limit?: number } = {}
  ): Promise<OfflineMemory[]> {
    const memories = await this.getUserMemories(userId, options.type as OfflineMemory['type']);
    const queryLower = query.toLowerCase();

    let results = memories.filter(
      (m) =>
        m.content.toLowerCase().includes(queryLower) ||
        m.title?.toLowerCase().includes(queryLower) ||
        m.tags.some((t) => t.toLowerCase().includes(queryLower))
    );

    if (options.domain) {
      results = results.filter((m) => m.domain === options.domain);
    }

    // Sort by relevance (simple scoring)
    results.sort((a, b) => {
      const aScore = (a.content.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
      const bScore = (b.content.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
      return bScore - aScore;
    });

    return results.slice(0, options.limit || 10);
  }

  async updateMemory(id: string, updates: Partial<OfflineMemory>): Promise<void> {
    const memory = await dbGet<OfflineMemory>(STORES.MEMORIES, id);
    if (memory) {
      const updated = {
        ...memory,
        ...updates,
        updatedAt: new Date().toISOString(),
        synced: false,
      };
      await dbPut(STORES.MEMORIES, updated);

      if (this.onlineStatus) {
        await this.queueSync('update', STORES.MEMORIES, updated);
      }
    }
  }

  async deleteMemory(id: string): Promise<void> {
    await dbDelete(STORES.MEMORIES, id);

    if (this.onlineStatus) {
      await this.queueSync('delete', STORES.MEMORIES, { id });
    }
  }

  // ==========================================================================
  // KNOWLEDGE CACHE
  // ==========================================================================

  async cacheKnowledge(items: OfflineKnowledge[]): Promise<void> {
    for (const item of items) {
      await dbPut(STORES.KNOWLEDGE, item);
    }
  }

  async searchCachedKnowledge(
    query: string,
    options: { type?: string; domain?: string; limit?: number } = {}
  ): Promise<OfflineKnowledge[]> {
    const allKnowledge = await dbGetAll<OfflineKnowledge>(STORES.KNOWLEDGE);
    const now = new Date().toISOString();
    const queryLower = query.toLowerCase();

    // Filter by expiry
    let results = allKnowledge.filter((k) => k.expiresAt > now);

    // Filter by query
    results = results.filter(
      (k) =>
        k.content.toLowerCase().includes(queryLower) ||
        k.title.toLowerCase().includes(queryLower) ||
        k.tags.some((t) => t.toLowerCase().includes(queryLower))
    );

    if (options.type) {
      results = results.filter((k) => k.type === options.type);
    }

    if (options.domain) {
      results = results.filter((k) => k.domain === options.domain);
    }

    // Sort by score
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    return results.slice(0, options.limit || 20);
  }

  async clearExpiredKnowledge(): Promise<number> {
    const allKnowledge = await dbGetAll<OfflineKnowledge>(STORES.KNOWLEDGE);
    const now = new Date().toISOString();
    let cleared = 0;

    for (const item of allKnowledge) {
      if (item.expiresAt < now) {
        await dbDelete(STORES.KNOWLEDGE, item.id);
        cleared++;
      }
    }

    return cleared;
  }

  // ==========================================================================
  // PREFERENCES
  // ==========================================================================

  async savePreferences(preferences: OfflinePreferences): Promise<void> {
    await dbPut(STORES.PREFERENCES, preferences);

    if (this.onlineStatus) {
      await this.queueSync('update', STORES.PREFERENCES, preferences);
    }
  }

  async getPreferences(userId: string): Promise<OfflinePreferences | undefined> {
    return dbGet<OfflinePreferences>(STORES.PREFERENCES, userId);
  }

  // ==========================================================================
  // SYNC QUEUE
  // ==========================================================================

  private async queueSync(
    operation: SyncQueueItem['operation'],
    store: (typeof STORES)[keyof typeof STORES],
    data: unknown
  ): Promise<void> {
    const item: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      operation,
      store,
      data,
      createdAt: new Date().toISOString(),
      attempts: 0,
    };

    await dbPut(STORES.SYNC_QUEUE, item);
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    return dbGetAll<SyncQueueItem>(STORES.SYNC_QUEUE);
  }

  async syncPendingItems(): Promise<{ synced: number; failed: number }> {
    if (this.syncInProgress || !this.onlineStatus) {
      return { synced: 0, failed: 0 };
    }

    this.syncInProgress = true;
    const items = await this.getPendingSyncItems();
    let synced = 0;
    let failed = 0;

    for (const item of items) {
      try {
        await this.processSyncItem(item);
        await dbDelete(STORES.SYNC_QUEUE, item.id);
        synced++;
      } catch (error) {
        console.error('[OfflinePersistence] Sync failed for item:', item.id, error);
        item.attempts++;
        item.lastAttempt = new Date().toISOString();
        item.error = error instanceof Error ? error.message : 'Unknown error';
        await dbPut(STORES.SYNC_QUEUE, item);
        failed++;

        // Remove items that have failed too many times
        if (item.attempts > 5) {
          await dbDelete(STORES.SYNC_QUEUE, item.id);
        }
      }
    }

    this.syncInProgress = false;
    return { synced, failed };
  }

  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    // This would call the appropriate API endpoint based on the item
    // For now, we'll implement a generic sync mechanism

    const endpoint = `/api/sync/${item.store.toLowerCase()}`;

    const response = await fetch(endpoint, {
      method: item.operation === 'delete' ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: item.operation,
        data: item.data,
      }),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }
  }

  // ==========================================================================
  // BULK OPERATIONS
  // ==========================================================================

  async exportAllData(userId: string): Promise<{
    conversations: OfflineConversation[];
    messages: OfflineMessage[];
    memories: OfflineMemory[];
    preferences: OfflinePreferences | undefined;
  }> {
    const conversations = await this.getUserConversations(userId);
    const messages: OfflineMessage[] = [];

    for (const conv of conversations) {
      const convMessages = await this.getConversationMessages(conv.id);
      messages.push(...convMessages);
    }

    const memories = await this.getUserMemories(userId);
    const preferences = await this.getPreferences(userId);

    return {
      conversations,
      messages,
      memories,
      preferences,
    };
  }

  async importData(data: {
    conversations: OfflineConversation[];
    messages: OfflineMessage[];
    memories: OfflineMemory[];
    preferences?: OfflinePreferences;
  }): Promise<void> {
    for (const conv of data.conversations) {
      await this.saveConversation(conv);
    }

    for (const msg of data.messages) {
      await dbPut(STORES.MESSAGES, msg); // Direct put to avoid updating conversation counts
    }

    for (const mem of data.memories) {
      await this.saveMemory(mem);
    }

    if (data.preferences) {
      await this.savePreferences(data.preferences);
    }
  }

  async clearAllData(): Promise<void> {
    const db = await initDatabase();

    for (const storeName of Object.values(STORES)) {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      store.clear();
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getOfflinePersistence = (): OfflinePersistenceService => {
  return OfflinePersistenceService.getInstance();
};

// Initialize database on module load in browser
if (typeof window !== 'undefined') {
  initDatabase().catch(console.error);
}
