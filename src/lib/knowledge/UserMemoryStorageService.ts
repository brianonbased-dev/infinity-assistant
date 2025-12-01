/**
 * User Memory Storage Service
 *
 * Hybrid persistence for conversation memory:
 * - LOCAL FILES: User-specific compressed memories (editable by user)
 * - DATABASE: Conversation sessions, messages, phase transitions
 *
 * Why Local Files for Compressed Memories?
 * 1. Users can directly edit their memory files
 * 2. Full transparency - users see exactly what's stored
 * 3. Portable - users can export/backup their memories
 * 4. Privacy - sensitive compressions stay on device
 * 5. Integrates with uAA2++ file-based compression protocol
 *
 * Storage Structure:
 * ~/.infinity-assistant/memories/
 *   ├── {userId}/
 *   │   ├── compressed/
 *   │   │   ├── wisdom.json       # Wisdom insights (W.XXX)
 *   │   │   ├── patterns.json     # Patterns (P.XXX)
 *   │   │   ├── gotchas.json      # Gotchas (G.XXX)
 *   │   │   └── facts.json        # Critical facts
 *   │   ├── preferences.json      # User preferences & settings
 *   │   └── profile.json          # User profile (name, role, etc.)
 */

import { getSupabaseClient } from '@/lib/supabase';
import type {
  ConversationMemory,
  MemoryEntry,
  CompressedMemory,
  PhaseContext,
  UAA2Phase,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * User's local memory file structure
 */
export interface UserLocalMemory {
  userId: string;
  version: string;
  lastUpdated: string;

  // Editable sections
  wisdom: WisdomEntry[];
  patterns: PatternEntry[];
  gotchas: GotchaEntry[];
  facts: FactEntry[];

  // User preferences
  preferences: UserMemoryPreferences;

  // Profile info
  profile: UserProfile;
}

export interface WisdomEntry {
  id: string;
  content: string;
  source?: string;           // Where this was learned
  dateAdded: string;
  dateModified?: string;
  userEdited: boolean;       // Was this manually edited by user?
  tags: string[];
  confidence: number;        // 0-1, how confident in this wisdom
}

export interface PatternEntry {
  id: string;
  name: string;
  description: string;
  useCase: string;           // When to apply this pattern
  example?: string;
  dateAdded: string;
  dateModified?: string;
  userEdited: boolean;
  tags: string[];
  timesUsed: number;         // How often this pattern was applied
}

export interface GotchaEntry {
  id: string;
  problem: string;
  solution: string;
  context?: string;          // When this gotcha applies
  dateAdded: string;
  dateModified?: string;
  userEdited: boolean;
  tags: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface FactEntry {
  id: string;
  content: string;
  category: string;          // 'personal', 'project', 'preference', 'other'
  dateAdded: string;
  dateModified?: string;
  userEdited: boolean;
  neverForget: boolean;      // User marked as critical
}

export interface UserMemoryPreferences {
  autoCompressAfter: number;        // Messages before auto-compress
  compressionLevel: 'light' | 'medium' | 'aggressive';
  preservePersonalInfo: boolean;    // Keep names, projects, etc.
  preserveCodeSnippets: boolean;    // Keep code in memory
  notifyOnCompression: boolean;     // Tell user when compressing
  allowAutoLearn: boolean;          // Auto-detect wisdom/patterns
}

export interface UserProfile {
  name?: string;
  role?: string;
  experienceLevel?: string;
  interests: string[];
  preferredTopics: string[];
  communicationStyle: 'concise' | 'detailed' | 'conversational';
  timezone?: string;

  // Builder-specific profile (set when user subscribes to Builder)
  builder?: BuilderProfile;
}

/**
 * Builder-specific profile preferences
 * Stored when user completes Builder onboarding
 */
export interface BuilderProfile {
  /** Builder experience level: easy (companion), medium, experienced */
  experienceLevel: 'easy' | 'medium' | 'experienced';

  /** Autonomy level (0-1): 1.0 = full autonomy, 0.2 = minimal */
  autonomyLevel: number;

  /** Number of builds completed */
  buildCount: number;

  /** Preferred tech stack */
  preferredTechStack?: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    hosting?: string[];
  };

  /** Last used templates */
  recentTemplates?: string[];

  /** Build history for learning */
  buildHistory?: {
    templateId: string;
    projectName: string;
    completedAt: string;
    outcome: 'success' | 'partial' | 'abandoned';
    tokensUsed: number;
  }[];

  /** When builder profile was created */
  createdAt: string;

  /** Last builder activity */
  lastActiveAt: string;
}

/**
 * Database session record
 */
export interface ConversationSession {
  id: string;
  userId: string;
  startedAt: string;
  lastActiveAt: string;
  messageCount: number;
  currentPhase: UAA2Phase;
  cycleCount: number;
  metadata: Record<string, unknown>;
}

/**
 * Database message record (recent only, compressed stored locally)
 */
export interface SessionMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  phase: UAA2Phase;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PREFERENCES: UserMemoryPreferences = {
  autoCompressAfter: 25,
  compressionLevel: 'medium',
  preservePersonalInfo: true,
  preserveCodeSnippets: true,
  notifyOnCompression: true,
  allowAutoLearn: true,
};

const DEFAULT_PROFILE: UserProfile = {
  interests: [],
  preferredTopics: [],
  communicationStyle: 'conversational',
};

const MEMORY_VERSION = '1.0.0';

// ============================================================================
// LOCAL FILE OPERATIONS (Browser-compatible with localStorage)
// ============================================================================

/**
 * Get local storage key for user
 */
function getStorageKey(userId: string, type: string): string {
  return `infinity_memory_${userId}_${type}`;
}

/**
 * Read local memory from localStorage (browser) or file (server)
 */
async function readLocalMemory(userId: string): Promise<UserLocalMemory | null> {
  // Browser environment - use localStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(getStorageKey(userId, 'full'));
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      console.warn('[UserMemoryStorage] Failed to read localStorage');
    }
    return null;
  }

  // Server environment - use file system
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os = require('os');

    const memoryDir = path.join(os.homedir(), '.infinity-assistant', 'memories', userId);
    const memoryFile = path.join(memoryDir, 'memory.json');

    if (fs.existsSync(memoryFile)) {
      const content = fs.readFileSync(memoryFile, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('[UserMemoryStorage] Failed to read file:', error);
  }

  return null;
}

/**
 * Write local memory to localStorage (browser) or file (server)
 */
async function writeLocalMemory(userId: string, memory: UserLocalMemory): Promise<boolean> {
  // Browser environment
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(getStorageKey(userId, 'full'), JSON.stringify(memory));
      return true;
    } catch (error) {
      console.error('[UserMemoryStorage] Failed to write localStorage:', error);
      return false;
    }
  }

  // Server environment
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os = require('os');

    const memoryDir = path.join(os.homedir(), '.infinity-assistant', 'memories', userId);
    const memoryFile = path.join(memoryDir, 'memory.json');

    // Ensure directory exists
    fs.mkdirSync(memoryDir, { recursive: true });

    // Write pretty-printed JSON for user editability
    fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('[UserMemoryStorage] Failed to write file:', error);
    return false;
  }
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class UserMemoryStorageService {
  private static instance: UserMemoryStorageService;
  private supabase = getSupabaseClient();

  // In-memory cache of local memories (for performance)
  private memoryCache = new Map<string, UserLocalMemory>();

  private constructor() {}

  static getInstance(): UserMemoryStorageService {
    if (!UserMemoryStorageService.instance) {
      UserMemoryStorageService.instance = new UserMemoryStorageService();
    }
    return UserMemoryStorageService.instance;
  }

  // ==========================================================================
  // LOCAL MEMORY OPERATIONS (User-Editable)
  // ==========================================================================

  /**
   * Get or create user's local memory
   */
  async getLocalMemory(userId: string): Promise<UserLocalMemory> {
    // Check cache first
    const cached = this.memoryCache.get(userId);
    if (cached) {
      return cached;
    }

    // Try to load from storage
    const stored = await readLocalMemory(userId);
    if (stored) {
      this.memoryCache.set(userId, stored);
      return stored;
    }

    // Create new memory
    const newMemory: UserLocalMemory = {
      userId,
      version: MEMORY_VERSION,
      lastUpdated: new Date().toISOString(),
      wisdom: [],
      patterns: [],
      gotchas: [],
      facts: [],
      preferences: { ...DEFAULT_PREFERENCES },
      profile: { ...DEFAULT_PROFILE },
    };

    await writeLocalMemory(userId, newMemory);
    this.memoryCache.set(userId, newMemory);
    return newMemory;
  }

  /**
   * Save local memory changes
   */
  async saveLocalMemory(userId: string, memory: UserLocalMemory): Promise<boolean> {
    memory.lastUpdated = new Date().toISOString();
    this.memoryCache.set(userId, memory);
    return await writeLocalMemory(userId, memory);
  }

  /**
   * Add wisdom insight to local memory
   */
  async addWisdom(
    userId: string,
    content: string,
    options: { source?: string; tags?: string[]; confidence?: number } = {}
  ): Promise<WisdomEntry> {
    const memory = await this.getLocalMemory(userId);

    const entry: WisdomEntry = {
      id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      content,
      source: options.source,
      dateAdded: new Date().toISOString(),
      userEdited: false,
      tags: options.tags || [],
      confidence: options.confidence || 0.8,
    };

    memory.wisdom.push(entry);
    await this.saveLocalMemory(userId, memory);
    return entry;
  }

  /**
   * Add pattern to local memory
   */
  async addPattern(
    userId: string,
    name: string,
    description: string,
    options: { useCase?: string; example?: string; tags?: string[] } = {}
  ): Promise<PatternEntry> {
    const memory = await this.getLocalMemory(userId);

    const entry: PatternEntry = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      description,
      useCase: options.useCase || '',
      example: options.example,
      dateAdded: new Date().toISOString(),
      userEdited: false,
      tags: options.tags || [],
      timesUsed: 0,
    };

    memory.patterns.push(entry);
    await this.saveLocalMemory(userId, memory);
    return entry;
  }

  /**
   * Add gotcha to local memory
   */
  async addGotcha(
    userId: string,
    problem: string,
    solution: string,
    options: { context?: string; tags?: string[]; severity?: 'low' | 'medium' | 'high' | 'critical' } = {}
  ): Promise<GotchaEntry> {
    const memory = await this.getLocalMemory(userId);

    const entry: GotchaEntry = {
      id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      problem,
      solution,
      context: options.context,
      dateAdded: new Date().toISOString(),
      userEdited: false,
      tags: options.tags || [],
      severity: options.severity || 'medium',
    };

    memory.gotchas.push(entry);
    await this.saveLocalMemory(userId, memory);
    return entry;
  }

  /**
   * Add fact to local memory
   */
  async addFact(
    userId: string,
    content: string,
    options: { category?: string; neverForget?: boolean } = {}
  ): Promise<FactEntry> {
    const memory = await this.getLocalMemory(userId);

    const entry: FactEntry = {
      id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      content,
      category: options.category || 'other',
      dateAdded: new Date().toISOString(),
      userEdited: false,
      neverForget: options.neverForget || false,
    };

    memory.facts.push(entry);
    await this.saveLocalMemory(userId, memory);
    return entry;
  }

  /**
   * Update a memory entry (user editing)
   */
  async updateEntry(
    userId: string,
    type: 'wisdom' | 'patterns' | 'gotchas' | 'facts',
    entryId: string,
    updates: Partial<WisdomEntry | PatternEntry | GotchaEntry | FactEntry>
  ): Promise<boolean> {
    const memory = await this.getLocalMemory(userId);
    const list = memory[type] as Array<{ id: string; userEdited?: boolean; dateModified?: string }>;

    const index = list.findIndex(e => e.id === entryId);
    if (index === -1) {
      return false;
    }

    list[index] = {
      ...list[index],
      ...updates,
      userEdited: true,
      dateModified: new Date().toISOString(),
    };

    return await this.saveLocalMemory(userId, memory);
  }

  /**
   * Delete a memory entry
   */
  async deleteEntry(
    userId: string,
    type: 'wisdom' | 'patterns' | 'gotchas' | 'facts',
    entryId: string
  ): Promise<boolean> {
    const memory = await this.getLocalMemory(userId);
    const list = memory[type] as Array<{ id: string }>;

    const index = list.findIndex(e => e.id === entryId);
    if (index === -1) {
      return false;
    }

    list.splice(index, 1);
    return await this.saveLocalMemory(userId, memory);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<boolean> {
    const memory = await this.getLocalMemory(userId);
    memory.profile = { ...memory.profile, ...updates };
    return await this.saveLocalMemory(userId, memory);
  }

  /**
   * Update memory preferences
   */
  async updatePreferences(userId: string, updates: Partial<UserMemoryPreferences>): Promise<boolean> {
    const memory = await this.getLocalMemory(userId);
    memory.preferences = { ...memory.preferences, ...updates };
    return await this.saveLocalMemory(userId, memory);
  }

  /**
   * Export local memory as JSON (for user download)
   */
  async exportMemory(userId: string): Promise<string> {
    const memory = await this.getLocalMemory(userId);
    return JSON.stringify(memory, null, 2);
  }

  /**
   * Import memory from JSON (user upload)
   */
  async importMemory(userId: string, jsonData: string): Promise<boolean> {
    try {
      const imported = JSON.parse(jsonData) as UserLocalMemory;

      // Validate structure
      if (!imported.wisdom || !imported.patterns || !imported.gotchas || !imported.facts) {
        throw new Error('Invalid memory format');
      }

      // Merge with existing or replace
      imported.userId = userId;
      imported.lastUpdated = new Date().toISOString();

      return await this.saveLocalMemory(userId, imported);
    } catch (error) {
      console.error('[UserMemoryStorage] Import failed:', error);
      return false;
    }
  }

  // ==========================================================================
  // DATABASE OPERATIONS (Conversation Sessions)
  // ==========================================================================

  /**
   * Create or get conversation session
   */
  async getOrCreateSession(
    conversationId: string,
    userId: string
  ): Promise<ConversationSession> {
    // Try to get existing session
    const { data: existing } = await this.supabase
      .from('infinity_assistant_sessions')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (existing) {
      // Update last active
      await this.supabase
        .from('infinity_assistant_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', conversationId);

      return {
        id: existing.id,
        userId: existing.user_id,
        startedAt: existing.started_at,
        lastActiveAt: existing.last_active_at,
        messageCount: existing.message_count,
        currentPhase: existing.current_phase,
        cycleCount: existing.cycle_count,
        metadata: existing.metadata || {},
      };
    }

    // Create new session
    const session: ConversationSession = {
      id: conversationId,
      userId,
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      messageCount: 0,
      currentPhase: 'intake',
      cycleCount: 0,
      metadata: {},
    };

    await this.supabase
      .from('infinity_assistant_sessions')
      .insert({
        id: session.id,
        user_id: session.userId,
        started_at: session.startedAt,
        last_active_at: session.lastActiveAt,
        message_count: session.messageCount,
        current_phase: session.currentPhase,
        cycle_count: session.cycleCount,
        metadata: session.metadata,
      });

    return session;
  }

  /**
   * Add message to session (database)
   */
  async addSessionMessage(
    sessionId: string,
    message: Omit<SessionMessage, 'id' | 'sessionId' | 'timestamp'>
  ): Promise<SessionMessage> {
    const fullMessage: SessionMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sessionId,
      timestamp: new Date().toISOString(),
      ...message,
    };

    await this.supabase
      .from('infinity_assistant_messages')
      .insert({
        id: fullMessage.id,
        session_id: fullMessage.sessionId,
        role: fullMessage.role,
        content: fullMessage.content,
        importance: fullMessage.importance,
        phase: fullMessage.phase,
        timestamp: fullMessage.timestamp,
        metadata: fullMessage.metadata,
      });

    // Update session message count
    await this.supabase.rpc('increment_message_count', { session_id: sessionId });

    return fullMessage;
  }

  /**
   * Get recent messages for session
   */
  async getRecentMessages(
    sessionId: string,
    limit: number = 20
  ): Promise<SessionMessage[]> {
    const { data } = await this.supabase
      .from('infinity_assistant_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    return (data || []).map(m => ({
      id: m.id,
      sessionId: m.session_id,
      role: m.role,
      content: m.content,
      importance: m.importance,
      phase: m.phase,
      timestamp: m.timestamp,
      metadata: m.metadata,
    })).reverse();
  }

  /**
   * Update session phase
   */
  async updateSessionPhase(
    sessionId: string,
    phase: UAA2Phase,
    incrementCycle: boolean = false
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      current_phase: phase,
      last_active_at: new Date().toISOString(),
    };

    if (incrementCycle) {
      await this.supabase.rpc('increment_cycle_count', { session_id: sessionId });
    }

    await this.supabase
      .from('infinity_assistant_sessions')
      .update(updates)
      .eq('id', sessionId);
  }

  /**
   * Record phase transition (for training data)
   */
  async recordPhaseTransition(
    sessionId: string,
    fromPhase: UAA2Phase,
    toPhase: UAA2Phase,
    trigger: string,
    insights: string[]
  ): Promise<void> {
    await this.supabase
      .from('infinity_assistant_phase_transitions')
      .insert({
        session_id: sessionId,
        from_phase: fromPhase,
        to_phase: toPhase,
        trigger,
        insights,
        timestamp: new Date().toISOString(),
      });
  }

  // ==========================================================================
  // HYBRID OPERATIONS
  // ==========================================================================

  /**
   * Compress session messages and store locally
   * This is the key hybrid operation - takes DB messages and creates local compressed memory
   */
  async compressToLocal(
    userId: string,
    sessionId: string,
    messages: SessionMessage[]
  ): Promise<CompressedMemory> {
    const localMemory = await this.getLocalMemory(userId);

    // Extract wisdom, patterns, gotchas from messages
    for (const message of messages) {
      const content = message.content.toLowerCase();
      const originalContent = message.content;

      // Extract wisdom
      if (
        content.includes('learned') ||
        content.includes('realized') ||
        content.includes('understand now') ||
        content.includes('key insight') ||
        message.importance === 'critical'
      ) {
        const exists = localMemory.wisdom.some(w =>
          w.content.toLowerCase().includes(content.slice(0, 50))
        );
        if (!exists) {
          await this.addWisdom(userId, originalContent.slice(0, 200), {
            source: `session:${sessionId}`,
            tags: [message.phase],
          });
        }
      }

      // Extract patterns
      if (
        content.includes('approach') ||
        content.includes('pattern') ||
        content.includes('method') ||
        content.includes('solution')
      ) {
        const exists = localMemory.patterns.some(p =>
          p.description.toLowerCase().includes(content.slice(0, 50))
        );
        if (!exists) {
          await this.addPattern(
            userId,
            'Discovered Pattern',
            originalContent.slice(0, 200),
            { tags: [message.phase] }
          );
        }
      }

      // Extract gotchas
      if (
        content.includes('error') ||
        content.includes('problem') ||
        content.includes('issue') ||
        content.includes('fix')
      ) {
        const exists = localMemory.gotchas.some(g =>
          g.problem.toLowerCase().includes(content.slice(0, 50))
        );
        if (!exists) {
          await this.addGotcha(
            userId,
            originalContent.slice(0, 150),
            'See conversation for solution',
            { tags: [message.phase] }
          );
        }
      }
    }

    // Create compression summary
    const compressed: CompressedMemory = {
      id: `comp_${Date.now()}`,
      summary: `Compressed ${messages.length} messages from session`,
      originalCount: messages.length,
      timeRange: {
        start: messages[0]?.timestamp || new Date().toISOString(),
        end: messages[messages.length - 1]?.timestamp || new Date().toISOString(),
      },
      keyInsights: [],
      importance: messages.some(m => m.importance === 'critical') ? 'critical' : 'medium',
    };

    // Delete old messages from database (keep last N)
    const keepCount = localMemory.preferences.autoCompressAfter;
    if (messages.length > keepCount) {
      const toDelete = messages.slice(0, -keepCount).map(m => m.id);
      await this.supabase
        .from('infinity_assistant_messages')
        .delete()
        .in('id', toDelete);
    }

    return compressed;
  }

  /**
   * Build full context combining local memory + DB session
   */
  async buildFullContext(
    userId: string,
    sessionId: string
  ): Promise<{
    localMemory: UserLocalMemory;
    recentMessages: SessionMessage[];
    session: ConversationSession;
  }> {
    const [localMemory, session, recentMessages] = await Promise.all([
      this.getLocalMemory(userId),
      this.getOrCreateSession(sessionId, userId),
      this.getRecentMessages(sessionId, 15),
    ]);

    return {
      localMemory,
      recentMessages,
      session,
    };
  }

  /**
   * Format combined context for assistant prompt
   */
  formatContextForPrompt(context: {
    localMemory: UserLocalMemory;
    recentMessages: SessionMessage[];
    session: ConversationSession;
  }): string {
    const parts: string[] = [];
    const { localMemory, session } = context;

    // User profile
    if (localMemory.profile.name || localMemory.profile.role) {
      parts.push('## User');
      if (localMemory.profile.name) parts.push(`Name: ${localMemory.profile.name}`);
      if (localMemory.profile.role) parts.push(`Role: ${localMemory.profile.role}`);
      if (localMemory.profile.interests.length > 0) {
        parts.push(`Interests: ${localMemory.profile.interests.join(', ')}`);
      }
      parts.push(`Style: ${localMemory.profile.communicationStyle}`);
      parts.push('');
    }

    // Key wisdom (user-curated)
    if (localMemory.wisdom.length > 0) {
      parts.push('## What I Know (User\'s Wisdom)');
      for (const w of localMemory.wisdom.slice(-5)) {
        parts.push(`- ${w.content}`);
      }
      parts.push('');
    }

    // Key patterns
    if (localMemory.patterns.length > 0) {
      parts.push('## Preferred Patterns');
      for (const p of localMemory.patterns.slice(-3)) {
        parts.push(`- **${p.name}**: ${p.description}`);
      }
      parts.push('');
    }

    // Important gotchas
    const criticalGotchas = localMemory.gotchas.filter(g => g.severity === 'high' || g.severity === 'critical');
    if (criticalGotchas.length > 0) {
      parts.push('## Watch Out For');
      for (const g of criticalGotchas.slice(-3)) {
        parts.push(`- ${g.problem} → ${g.solution}`);
      }
      parts.push('');
    }

    // Critical facts (never forget)
    const neverForget = localMemory.facts.filter(f => f.neverForget);
    if (neverForget.length > 0) {
      parts.push('## Never Forget');
      for (const f of neverForget) {
        parts.push(`- ${f.content}`);
      }
      parts.push('');
    }

    // Current phase
    parts.push(`## Current Phase: ${session.currentPhase.toUpperCase()}`);
    parts.push(`Cycle: ${session.cycleCount}`);

    return parts.join('\n');
  }

  // ==========================================================================
  // BUILDER PROFILE OPERATIONS
  // ==========================================================================

  /**
   * Initialize builder profile when user subscribes to Builder
   * Sets experience level and autonomy configuration
   */
  async initializeBuilderProfile(
    userId: string,
    experienceLevel: 'easy' | 'medium' | 'experienced'
  ): Promise<BuilderProfile> {
    const memory = await this.getLocalMemory(userId);

    // Map experience level to autonomy
    const autonomyMap = {
      easy: 1.0,       // Full autonomy - companion handles everything
      medium: 0.6,     // Balanced - user has some control
      experienced: 0.2, // Minimal autonomy - user drives
    };

    const builderProfile: BuilderProfile = {
      experienceLevel,
      autonomyLevel: autonomyMap[experienceLevel],
      buildCount: 0,
      recentTemplates: [],
      buildHistory: [],
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    memory.profile.builder = builderProfile;
    await this.saveLocalMemory(userId, memory);

    return builderProfile;
  }

  /**
   * Get builder profile (returns null if not subscribed)
   */
  async getBuilderProfile(userId: string): Promise<BuilderProfile | null> {
    const memory = await this.getLocalMemory(userId);
    return memory.profile.builder || null;
  }

  /**
   * Update builder experience level (user can change their preference)
   */
  async updateBuilderExperienceLevel(
    userId: string,
    experienceLevel: 'easy' | 'medium' | 'experienced'
  ): Promise<BuilderProfile | null> {
    const memory = await this.getLocalMemory(userId);

    if (!memory.profile.builder) {
      // Initialize if not exists
      return this.initializeBuilderProfile(userId, experienceLevel);
    }

    // Update experience level and autonomy
    const autonomyMap = {
      easy: 1.0,
      medium: 0.6,
      experienced: 0.2,
    };

    memory.profile.builder.experienceLevel = experienceLevel;
    memory.profile.builder.autonomyLevel = autonomyMap[experienceLevel];
    memory.profile.builder.lastActiveAt = new Date().toISOString();

    await this.saveLocalMemory(userId, memory);
    return memory.profile.builder;
  }

  /**
   * Record a completed build in history
   */
  async recordBuildCompletion(
    userId: string,
    build: {
      templateId: string;
      projectName: string;
      outcome: 'success' | 'partial' | 'abandoned';
      tokensUsed: number;
    }
  ): Promise<void> {
    const memory = await this.getLocalMemory(userId);

    if (!memory.profile.builder) {
      // Initialize with default medium level
      await this.initializeBuilderProfile(userId, 'medium');
      return this.recordBuildCompletion(userId, build);
    }

    // Add to history
    const historyEntry = {
      ...build,
      completedAt: new Date().toISOString(),
    };

    memory.profile.builder.buildHistory = memory.profile.builder.buildHistory || [];
    memory.profile.builder.buildHistory.push(historyEntry);

    // Limit history to last 50 builds
    if (memory.profile.builder.buildHistory.length > 50) {
      memory.profile.builder.buildHistory = memory.profile.builder.buildHistory.slice(-50);
    }

    // Update build count and recent templates
    memory.profile.builder.buildCount++;
    memory.profile.builder.recentTemplates = memory.profile.builder.recentTemplates || [];

    if (!memory.profile.builder.recentTemplates.includes(build.templateId)) {
      memory.profile.builder.recentTemplates.unshift(build.templateId);
      memory.profile.builder.recentTemplates = memory.profile.builder.recentTemplates.slice(0, 10);
    }

    memory.profile.builder.lastActiveAt = new Date().toISOString();
    await this.saveLocalMemory(userId, memory);
  }

  /**
   * Update builder's preferred tech stack based on their builds
   */
  async updateBuilderTechStack(
    userId: string,
    techStack: {
      frontend?: string[];
      backend?: string[];
      database?: string[];
      hosting?: string[];
    }
  ): Promise<void> {
    const memory = await this.getLocalMemory(userId);

    if (!memory.profile.builder) {
      await this.initializeBuilderProfile(userId, 'medium');
      return this.updateBuilderTechStack(userId, techStack);
    }

    memory.profile.builder.preferredTechStack = {
      ...memory.profile.builder.preferredTechStack,
      ...techStack,
    };

    memory.profile.builder.lastActiveAt = new Date().toISOString();
    await this.saveLocalMemory(userId, memory);
  }

  /**
   * Check if user is subscribed to Builder
   */
  async hasBuilderSubscription(userId: string): Promise<boolean> {
    const profile = await this.getBuilderProfile(userId);
    return profile !== null;
  }

  /**
   * Get build statistics for user
   */
  async getBuilderStats(userId: string): Promise<{
    totalBuilds: number;
    successRate: number;
    averageTokens: number;
    favoriteTemplates: string[];
  } | null> {
    const profile = await this.getBuilderProfile(userId);
    if (!profile || !profile.buildHistory) {
      return null;
    }

    const history = profile.buildHistory;
    const successfulBuilds = history.filter(b => b.outcome === 'success').length;
    const totalTokens = history.reduce((sum, b) => sum + b.tokensUsed, 0);

    // Count template usage
    const templateCounts: Record<string, number> = {};
    for (const build of history) {
      templateCounts[build.templateId] = (templateCounts[build.templateId] || 0) + 1;
    }

    const favoriteTemplates = Object.entries(templateCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id);

    return {
      totalBuilds: profile.buildCount,
      successRate: history.length > 0 ? successfulBuilds / history.length : 0,
      averageTokens: history.length > 0 ? totalTokens / history.length : 0,
      favoriteTemplates,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getUserMemoryStorageService = (): UserMemoryStorageService => {
  return UserMemoryStorageService.getInstance();
};
