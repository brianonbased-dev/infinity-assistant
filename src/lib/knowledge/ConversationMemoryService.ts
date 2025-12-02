/**
 * Conversation Memory Service
 *
 * Implements hierarchical memory with compression for long conversations.
 * Based on uAA2++ research on AI conversational abilities:
 *
 * - W.CONV.004: Extended Memory Requires Hierarchical Organization
 * - P.CONV.03: Hierarchical Memory Architecture Pattern
 * - G.CONV.02: Flat Memory Storage Fails at Scale
 *
 * Features:
 * - Active memory (recent, uncompressed messages)
 * - Compressed memory (older, summarized)
 * - Critical facts (never compressed)
 * - Phase-aware context tracking
 */

import type {
  ConversationMemory,
  MemoryEntry,
  CompressedMemory,
  MemoryImportance,
  CompressionOptions,
  CompressionResult,
  PhaseContext,
  UAA2Phase,
  AssistantContext,
  WorkflowPhase,
  IMemoryService,
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  maxActiveMemory: 20,         // Keep 20 recent messages active
  compressionRatio: 0.15,      // 85% compression
  preserveCritical: true,
  preservePhaseInsights: true,
};

const DEFAULT_PHASE_CONTEXT: PhaseContext = {
  currentPhase: 'intake',
  phaseStartedAt: new Date().toISOString(),
  phaseHistory: [],
  cycleCount: 0,
};

// ============================================================================
// STORAGE LAYER (Supabase Primary + Local File Cache Fallback)
// ============================================================================

/**
 * Tiered storage architecture:
 * 1. In-memory cache (fastest, volatile)
 * 2. Local file cache (fast, survives restarts in dev)
 * 3. Supabase database (persistent, primary store)
 *
 * When database is offline, local cache becomes primary.
 * Data syncs to database when connection is restored.
 */

const memoryCache = new Map<string, { memory: ConversationMemory; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let isDbOnline = true;
let pendingSync: ConversationMemory[] = [];

// File-based cache for serverless environments (uses /tmp in Vercel)
const LOCAL_CACHE_DIR = process.env.VERCEL ? '/tmp/infinity-cache' : './.cache/conversations';

/**
 * Get local file path for conversation
 */
function getLocalCachePath(conversationId: string): string {
  return `${LOCAL_CACHE_DIR}/${conversationId}.json`;
}

/**
 * Save to local file cache
 */
async function saveToLocalCache(memory: ConversationMemory): Promise<void> {
  if (typeof window !== 'undefined') return; // Skip in browser

  try {
    const fs = await import('fs').then(m => m.promises);

    // Ensure directory exists
    await fs.mkdir(LOCAL_CACHE_DIR, { recursive: true }).catch(() => {});

    const filePath = getLocalCachePath(memory.conversationId);
    await fs.writeFile(filePath, JSON.stringify(memory, null, 2));
  } catch {
    // Silent fail - local cache is best-effort
  }
}

/**
 * Load from local file cache
 */
async function loadFromLocalCache(conversationId: string): Promise<ConversationMemory | null> {
  if (typeof window !== 'undefined') return null; // Skip in browser

  try {
    const fs = await import('fs').then(m => m.promises);
    const filePath = getLocalCachePath(conversationId);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as ConversationMemory;
  } catch {
    return null;
  }
}

/**
 * Get Supabase client for persistence
 */
async function getSupabase() {
  const { getSupabaseClient, TABLES } = await import('@/lib/supabase');
  return { supabase: getSupabaseClient(), TABLES };
}

/**
 * Sync pending changes to database when online
 */
async function syncPendingToDatabase(): Promise<void> {
  if (pendingSync.length === 0) return;

  try {
    const { supabase, TABLES } = await getSupabase();

    for (const memory of pendingSync) {
      const record = {
        conversation_id: memory.conversationId,
        user_id: memory.userId,
        active_memory: memory.activeMemory.slice(-30),
        compressed_memory: memory.compressedMemory.slice(-10),
        critical_facts: memory.criticalFacts,
        user_context: memory.userContext,
        phase_context: memory.phaseContext,
        total_messages: memory.totalMessages,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from(TABLES.CONVERSATIONS)
        .upsert(record, { onConflict: 'conversation_id' });
    }

    console.log(`[ConversationMemoryService] Synced ${pendingSync.length} pending conversations to database`);
    pendingSync = [];
    isDbOnline = true;
  } catch (e) {
    console.warn('[ConversationMemoryService] Database sync failed, will retry:', e);
  }
}

/**
 * Get memory from cache, local file, or database (in order of speed)
 */
async function getMemoryFromStore(conversationId: string): Promise<ConversationMemory | null> {
  // 1. Check in-memory cache first (fastest)
  const cached = memoryCache.get(conversationId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.memory;
  }

  // 2. Try Supabase if online
  if (isDbOnline) {
    try {
      const { supabase, TABLES } = await getSupabase();
      const { data, error } = await supabase
        .from(TABLES.CONVERSATIONS)
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      if (!error && data) {
        const memory: ConversationMemory = {
          conversationId: data.conversation_id,
          userId: data.user_id,
          activeMemory: data.active_memory || [],
          compressedMemory: data.compressed_memory || [],
          criticalFacts: data.critical_facts || [],
          userContext: data.user_context || {},
          phaseContext: data.phase_context || { ...DEFAULT_PHASE_CONTEXT },
          createdAt: data.created_at,
          lastActiveAt: data.updated_at,
          totalMessages: data.total_messages || 0,
        };

        // Update caches
        memoryCache.set(conversationId, { memory, cachedAt: Date.now() });
        saveToLocalCache(memory).catch(() => {}); // Background save to local

        return memory;
      }
    } catch (e) {
      console.warn('[ConversationMemoryService] Database offline, using local cache:', e);
      isDbOnline = false;
      // Schedule retry
      setTimeout(syncPendingToDatabase, 30000); // Retry in 30s
    }
  }

  // 3. Fall back to local file cache
  const localMemory = await loadFromLocalCache(conversationId);
  if (localMemory) {
    memoryCache.set(conversationId, { memory: localMemory, cachedAt: Date.now() });
    return localMemory;
  }

  return null;
}

/**
 * Save memory to all storage layers
 */
async function saveMemoryToStore(memory: ConversationMemory): Promise<void> {
  // 1. Always update in-memory cache
  memoryCache.set(memory.conversationId, { memory, cachedAt: Date.now() });

  // 2. Always save to local file cache (fast, reliable)
  saveToLocalCache(memory).catch(() => {});

  // 3. Try to persist to Supabase
  if (isDbOnline) {
    try {
      await persistToSupabase(memory);
    } catch (e) {
      console.warn('[ConversationMemoryService] Database save failed, queuing for sync:', e);
      isDbOnline = false;
      pendingSync.push(memory);
      setTimeout(syncPendingToDatabase, 30000); // Retry in 30s
    }
  } else {
    // Queue for later sync
    const existingIdx = pendingSync.findIndex(m => m.conversationId === memory.conversationId);
    if (existingIdx >= 0) {
      pendingSync[existingIdx] = memory;
    } else {
      pendingSync.push(memory);
    }
  }
}

/**
 * Persist memory to Supabase
 */
async function persistToSupabase(memory: ConversationMemory): Promise<void> {
  const { supabase, TABLES } = await getSupabase();

  const record = {
    conversation_id: memory.conversationId,
    user_id: memory.userId,
    active_memory: memory.activeMemory.slice(-30),
    compressed_memory: memory.compressedMemory.slice(-10),
    critical_facts: memory.criticalFacts,
    user_context: memory.userContext,
    phase_context: memory.phaseContext,
    total_messages: memory.totalMessages,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from(TABLES.CONVERSATIONS)
    .upsert(record, { onConflict: 'conversation_id' });

  if (error) throw error;
}

// Legacy in-memory store for backward compatibility
const memoryStore = new Map<string, ConversationMemory>();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique ID
 */
function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determine message importance based on content
 */
function determineImportance(content: string, type: string): MemoryImportance {
  const lowerContent = content.toLowerCase();

  // Critical: explicit preferences, corrections, key decisions
  if (
    lowerContent.includes('always remember') ||
    lowerContent.includes('important:') ||
    lowerContent.includes('my preference is') ||
    lowerContent.includes('never ') ||
    lowerContent.includes('critical:') ||
    lowerContent.includes('key decision')
  ) {
    return 'critical';
  }

  // High: goals, requirements, constraints
  if (
    lowerContent.includes('goal') ||
    lowerContent.includes('requirement') ||
    lowerContent.includes('constraint') ||
    lowerContent.includes('must have') ||
    lowerContent.includes('need to')
  ) {
    return 'high';
  }

  // Medium: questions, explanations, context
  if (
    lowerContent.includes('?') ||
    lowerContent.includes('explain') ||
    lowerContent.includes('how') ||
    lowerContent.includes('why') ||
    lowerContent.includes('what')
  ) {
    return 'medium';
  }

  // Low: acknowledgments, greetings, simple responses
  return 'low';
}

/**
 * uAA2++ Compression: Extract wisdom, patterns, and gotchas from messages
 *
 * Based on uAA2++ Protocol Phase 3.COMPRESS:
 * - Wisdom (W.XXX): Core insights and principles learned
 * - Patterns (P.XXX): Reusable approaches discovered
 * - Gotchas (G.XXX): Problems encountered and solutions
 *
 * Target: ~85-90% compression, 100% insight preservation
 */
function compressMessagesUAA2(entries: MemoryEntry[]): CompressedMemory {
  // Phase 3.COMPRESS: Extract knowledge from conversation

  // 1. Extract Wisdom - Core insights mentioned
  const wisdomInsights: string[] = [];
  const patternInsights: string[] = [];
  const gotchaInsights: string[] = [];
  const topicsDiscussed = new Set<string>();

  for (const entry of entries) {
    const content = entry.content.toLowerCase();
    const originalContent = entry.content;

    // Extract significant topics
    const words = content.split(/\s+/).filter(w =>
      w.length > 4 &&
      !['about', 'would', 'could', 'should', 'their', 'there', 'which', 'where', 'these', 'those', 'being', 'having'].includes(w)
    );
    words.slice(0, 5).forEach(w => topicsDiscussed.add(w));

    // Wisdom extraction: Key learnings, insights, realizations
    if (
      content.includes('learned') ||
      content.includes('realized') ||
      content.includes('understand now') ||
      content.includes('key insight') ||
      content.includes('important point') ||
      entry.importance === 'high' ||
      entry.importance === 'critical'
    ) {
      const wisdom = originalContent.length > 120
        ? originalContent.substring(0, 120) + '...'
        : originalContent;
      wisdomInsights.push(`W: ${wisdom}`);
    }

    // Pattern extraction: Approaches, methods, solutions that worked
    if (
      content.includes('approach') ||
      content.includes('pattern') ||
      content.includes('method') ||
      content.includes('solution') ||
      content.includes('works by') ||
      content.includes('the way to')
    ) {
      const pattern = originalContent.length > 100
        ? originalContent.substring(0, 100) + '...'
        : originalContent;
      patternInsights.push(`P: ${pattern}`);
    }

    // Gotcha extraction: Problems, errors, fixes
    if (
      content.includes('error') ||
      content.includes('problem') ||
      content.includes('issue') ||
      content.includes('fix') ||
      content.includes('solved by') ||
      content.includes('watch out')
    ) {
      const gotcha = originalContent.length > 100
        ? originalContent.substring(0, 100) + '...'
        : originalContent;
      gotchaInsights.push(`G: ${gotcha}`);
    }
  }

  // 2. Build compressed summary
  const topics = Array.from(topicsDiscussed).slice(0, 8);
  const userMessages = entries.filter(e => e.type === 'user').length;
  const assistantMessages = entries.filter(e => e.type === 'assistant').length;

  // Combine all insights
  const keyInsights = [
    ...wisdomInsights.slice(0, 3),
    ...patternInsights.slice(0, 2),
    ...gotchaInsights.slice(0, 2),
  ];

  // Build summary (user-facing, no internal terminology)
  const summary = [
    `[${entries.length} messages summarized]`,
    `Topics: ${topics.join(', ')}`,
    `Period: ${entries[0].createdAt.split('T')[0]} to ${entries[entries.length - 1].createdAt.split('T')[0]}`,
    wisdomInsights.length > 0 ? `${wisdomInsights.length} key insights` : '',
    patternInsights.length > 0 ? `${patternInsights.length} patterns` : '',
    gotchaInsights.length > 0 ? `${gotchaInsights.length} warnings` : '',
  ].filter(Boolean).join(' | ');

  return {
    id: generateId(),
    summary,
    originalCount: entries.length,
    timeRange: {
      start: entries[0].createdAt,
      end: entries[entries.length - 1].createdAt,
    },
    keyInsights,
    importance: entries.some(e => e.importance === 'critical') ? 'critical' : 'medium',
  };
}

// ============================================================================
// MEMORY SERVICE
// ============================================================================

/**
 * Conversation Memory Service
 */
class ConversationMemoryService implements IMemoryService {
  private static instance: ConversationMemoryService;

  private constructor() {}

  static getInstance(): ConversationMemoryService {
    if (!ConversationMemoryService.instance) {
      ConversationMemoryService.instance = new ConversationMemoryService();
    }
    return ConversationMemoryService.instance;
  }

  /**
   * Initialize conversation memory
   */
  async initializeMemory(
    conversationId: string,
    userId: string,
    userContext?: Partial<ConversationMemory['userContext']>
  ): Promise<ConversationMemory> {
    // Try to load from Supabase first
    const existing = await getMemoryFromStore(conversationId);
    if (existing) {
      // Update user context if provided
      if (userContext) {
        existing.userContext = { ...existing.userContext, ...userContext };
        existing.lastActiveAt = new Date().toISOString();
        await saveMemoryToStore(existing);
      }
      return existing;
    }

    // Also check legacy in-memory store
    const legacyMemory = memoryStore.get(conversationId);
    if (legacyMemory) {
      if (userContext) {
        legacyMemory.userContext = { ...legacyMemory.userContext, ...userContext };
        legacyMemory.lastActiveAt = new Date().toISOString();
      }
      // Migrate to Supabase
      await saveMemoryToStore(legacyMemory);
      return legacyMemory;
    }

    const memory: ConversationMemory = {
      conversationId,
      userId,
      activeMemory: [],
      compressedMemory: [],
      criticalFacts: [],
      userContext: userContext || {},
      phaseContext: { ...DEFAULT_PHASE_CONTEXT },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      totalMessages: 0,
    };

    // Save to both stores
    memoryStore.set(conversationId, memory);
    await saveMemoryToStore(memory);
    return memory;
  }

  /**
   * Add message to memory
   */
  async addMessage(
    conversationId: string,
    entry: Omit<MemoryEntry, 'id' | 'createdAt'>
  ): Promise<void> {
    // Try to get from Supabase first, then legacy store
    let memory = await getMemoryFromStore(conversationId) || memoryStore.get(conversationId);

    if (!memory) {
      // Create new memory for unknown conversation
      memory = await this.initializeMemory(conversationId, 'anonymous');
    }

    const fullEntry: MemoryEntry = {
      ...entry,
      id: generateId(),
      createdAt: new Date().toISOString(),
      importance: entry.importance || determineImportance(entry.content, entry.type),
    };

    // Add to appropriate memory tier
    if (fullEntry.importance === 'critical') {
      memory.criticalFacts.push(fullEntry);
    }

    memory.activeMemory.push(fullEntry);
    memory.totalMessages++;
    memory.lastActiveAt = new Date().toISOString();

    // Check if compression is needed
    if (memory.activeMemory.length > DEFAULT_COMPRESSION_OPTIONS.maxActiveMemory * 1.5) {
      await this.compress(conversationId);
    }

    // Save to both stores
    memoryStore.set(conversationId, memory);
    await saveMemoryToStore(memory);
  }

  /**
   * Compress old messages
   */
  async compress(
    conversationId: string,
    options: CompressionOptions = DEFAULT_COMPRESSION_OPTIONS
  ): Promise<CompressionResult> {
    const memory = memoryStore.get(conversationId);

    if (!memory || memory.activeMemory.length <= options.maxActiveMemory) {
      return {
        compressedCount: 0,
        originalSize: 0,
        compressedSize: 0,
        ratio: 1,
        summary: {
          id: '',
          summary: '',
          originalCount: 0,
          timeRange: { start: '', end: '' },
          keyInsights: [],
          importance: 'low',
        },
      };
    }

    // Keep recent messages, compress older ones
    const toKeep = memory.activeMemory.slice(-options.maxActiveMemory);
    const toCompress = memory.activeMemory.slice(0, -options.maxActiveMemory);

    // Filter out critical and phase insight entries if preservation is enabled
    const actuallyCompress: MemoryEntry[] = [];
    const preserve: MemoryEntry[] = [];

    for (const entry of toCompress) {
      if (options.preserveCritical && entry.importance === 'critical') {
        preserve.push(entry);
      } else if (options.preservePhaseInsights && entry.tags?.includes('phase-insight')) {
        preserve.push(entry);
      } else {
        actuallyCompress.push(entry);
      }
    }

    if (actuallyCompress.length === 0) {
      return {
        compressedCount: 0,
        originalSize: 0,
        compressedSize: 0,
        ratio: 1,
        summary: {
          id: '',
          summary: '',
          originalCount: 0,
          timeRange: { start: '', end: '' },
          keyInsights: [],
          importance: 'low',
        },
      };
    }

    // Compress messages using uAA2++ protocol
    const compressed = compressMessagesUAA2(actuallyCompress);
    memory.compressedMemory.push(compressed);

    // Update active memory
    memory.activeMemory = [...preserve, ...toKeep];

    // Calculate original size (rough estimate)
    const originalSize = actuallyCompress.reduce((sum, e) => sum + e.content.length, 0);
    const compressedSize = compressed.summary.length + compressed.keyInsights.join('').length;

    memoryStore.set(conversationId, memory);

    return {
      compressedCount: actuallyCompress.length,
      originalSize,
      compressedSize,
      ratio: compressedSize / originalSize,
      summary: compressed,
    };
  }

  /**
   * Build context for assistant response
   */
  async buildContext(
    conversationId: string,
    userId: string,
    userProfile?: Partial<AssistantContext['userProfile']>,
    mode: 'search' | 'assist' | 'build' = 'assist'
  ): Promise<AssistantContext> {
    let memory = memoryStore.get(conversationId);

    if (!memory) {
      memory = await this.initializeMemory(conversationId, userId);
    }

    // Default user profile
    const defaultProfile: AssistantContext['userProfile'] = {
      role: '',
      experienceLevel: '',
      interests: [],
      customInterests: [],
      workflowPhases: ['research', 'plan', 'deliver'] as WorkflowPhase[],
      communicationStyle: 'conversational',
    };

    return {
      conversationId,
      userId,
      mode,
      userProfile: {
        ...defaultProfile,
        ...memory.userContext,
        ...userProfile,
      } as AssistantContext['userProfile'],
      activeKnowledge: {
        relevantWisdom: [],
        relevantPatterns: [],
        relevantGotchas: [],
      },
      memory: {
        recentMessages: memory.activeMemory.slice(-10),
        criticalFacts: memory.criticalFacts,
        compressedHistory: memory.compressedMemory,
      },
      phase: memory.phaseContext,
      rateLimit: {
        remaining: 20,
        limit: 20,
      },
    };
  }

  /**
   * Format memory for system prompt
   */
  formatMemoryForPrompt(memory: ConversationMemory): string {
    const parts: string[] = [];

    // Critical facts
    if (memory.criticalFacts.length > 0) {
      parts.push('## Critical Facts (Never Forget)');
      for (const fact of memory.criticalFacts) {
        parts.push(`- ${fact.content}`);
      }
    }

    // Compressed history summary
    if (memory.compressedMemory.length > 0) {
      parts.push('\n## Conversation History Summary');
      for (const compressed of memory.compressedMemory.slice(-3)) {
        parts.push(`- ${compressed.summary}`);
        if (compressed.keyInsights.length > 0) {
          parts.push(`  Key points: ${compressed.keyInsights.slice(0, 3).join('; ')}`);
        }
      }
    }

    // Recent context
    if (memory.activeMemory.length > 0) {
      const highImportance = memory.activeMemory
        .filter(m => m.importance === 'high')
        .slice(-5);

      if (highImportance.length > 0) {
        parts.push('\n## Recent Important Points');
        for (const msg of highImportance) {
          const truncated = msg.content.length > 150
            ? msg.content.substring(0, 150) + '...'
            : msg.content;
          parts.push(`- [${msg.type}] ${truncated}`);
        }
      }
    }

    // User context
    if (Object.keys(memory.userContext).length > 0) {
      parts.push('\n## User Context');
      if (memory.userContext.role) {
        parts.push(`- Role: ${memory.userContext.role}`);
      }
      if (memory.userContext.experienceLevel) {
        parts.push(`- Experience: ${memory.userContext.experienceLevel}`);
      }
      if (memory.userContext.interests && memory.userContext.interests.length > 0) {
        parts.push(`- Interests: ${memory.userContext.interests.join(', ')}`);
      }
      if (memory.userContext.workflowPhases && memory.userContext.workflowPhases.length > 0) {
        parts.push(`- Workflow: ${memory.userContext.workflowPhases.join(' → ')}`);
      }
      if (memory.userContext.communicationStyle) {
        parts.push(`- Style: ${memory.userContext.communicationStyle}`);
      }
    }

    // Phase context
    parts.push(`\n## Current Phase: ${memory.phaseContext.currentPhase.toUpperCase()}`);
    parts.push(`Cycle: ${memory.phaseContext.cycleCount}`);

    return parts.join('\n');
  }

  /**
   * Update phase context
   */
  async updatePhase(
    conversationId: string,
    newPhase: UAA2Phase,
    insights?: string[]
  ): Promise<PhaseContext> {
    const memory = memoryStore.get(conversationId);

    if (!memory) {
      return { ...DEFAULT_PHASE_CONTEXT, currentPhase: newPhase };
    }

    // Record phase transition
    const now = new Date().toISOString();
    memory.phaseContext.phaseHistory.push({
      phase: memory.phaseContext.currentPhase,
      startedAt: memory.phaseContext.phaseStartedAt,
      completedAt: now,
      insights: insights || [],
    });

    // Update to new phase
    memory.phaseContext.currentPhase = newPhase;
    memory.phaseContext.phaseStartedAt = now;

    // Increment cycle if returning to intake
    if (newPhase === 'intake' && memory.phaseContext.phaseHistory.length > 0) {
      memory.phaseContext.cycleCount++;
    }

    memoryStore.set(conversationId, memory);

    return memory.phaseContext;
  }

  /**
   * Get recommended phase based on conversation
   */
  recommendPhase(context: AssistantContext): UAA2Phase {
    const recentMessages = context.memory.recentMessages;

    if (recentMessages.length === 0) {
      return 'intake';
    }

    // Analyze recent messages to recommend phase
    const combinedContent = recentMessages
      .map(m => m.content.toLowerCase())
      .join(' ');

    // Intake: gathering info, asking questions
    if (combinedContent.includes('what') || combinedContent.includes('tell me') || combinedContent.includes('explain')) {
      return 'intake';
    }

    // Reflect: analysis, understanding
    if (combinedContent.includes('understand') || combinedContent.includes('analyze') || combinedContent.includes('why')) {
      return 'reflect';
    }

    // Execute: implementing, doing
    if (combinedContent.includes('implement') || combinedContent.includes('create') || combinedContent.includes('build')) {
      return 'execute';
    }

    // Compress: summarizing, capturing
    if (combinedContent.includes('summarize') || combinedContent.includes('key points') || combinedContent.includes('takeaway')) {
      return 'compress';
    }

    // Grow: learning, expanding
    if (combinedContent.includes('learn') || combinedContent.includes('improve') || combinedContent.includes('better')) {
      return 'grow';
    }

    // Default to current phase or intake
    return context.phase.currentPhase || 'intake';
  }

  /**
   * Clear memory for conversation
   */
  clearMemory(conversationId: string): void {
    memoryStore.delete(conversationId);
    memoryCache.delete(conversationId);
    // Note: We don't delete from Supabase to preserve history
  }

  /**
   * Get memory (sync version for API - checks cache first)
   */
  getMemory(conversationId: string): ConversationMemory | null {
    // Check cache first (fast path)
    const cached = memoryCache.get(conversationId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return cached.memory;
    }
    // Fall back to legacy store
    return memoryStore.get(conversationId) || null;
  }

  /**
   * Get memory async (fetches from Supabase if needed)
   */
  async getMemoryAsync(conversationId: string): Promise<ConversationMemory | null> {
    return await getMemoryFromStore(conversationId) || memoryStore.get(conversationId) || null;
  }

  /**
   * Update memory directly (for API modifications)
   */
  updateMemory(conversationId: string, memory: ConversationMemory): void {
    memoryStore.set(conversationId, memory);
    // Also save to Supabase asynchronously
    saveMemoryToStore(memory).catch(() => {});
  }

  /**
   * Explicitly store a knowledge item (user-requested memory)
   * When user says "remember this" or "store this knowledge"
   */
  async storeExplicitKnowledge(
    conversationId: string,
    content: string,
    type: 'wisdom' | 'pattern' | 'gotcha' | 'fact' = 'fact'
  ): Promise<MemoryEntry> {
    let memory = memoryStore.get(conversationId);

    if (!memory) {
      memory = await this.initializeMemory(conversationId, 'anonymous');
    }

    const entry: MemoryEntry = {
      id: generateId(),
      content: content, // Store clean content, type is tracked in tags
      type: 'insight',
      importance: 'critical',
      tags: ['remembered', type], // Clean tags for UI display
      createdAt: new Date().toISOString(),
    };

    memory.criticalFacts.push(entry);
    memory.lastActiveAt = new Date().toISOString();
    memoryStore.set(conversationId, memory);

    return entry;
  }

  /**
   * Check if a message indicates the user wants something remembered
   */
  detectMemoryIntent(content: string): {
    shouldStore: boolean;
    shouldAsk: boolean;
    type: 'wisdom' | 'pattern' | 'gotcha' | 'fact';
    extractedContent?: string;
  } {
    const lowerContent = content.toLowerCase();

    // Explicit store commands
    if (
      lowerContent.includes('remember this') ||
      lowerContent.includes('store this') ||
      lowerContent.includes('save this') ||
      lowerContent.includes("don't forget") ||
      lowerContent.includes('keep in mind') ||
      lowerContent.includes('always remember')
    ) {
      // Extract what to remember (after the command phrase)
      const patterns = [
        /remember this[:\s]+(.+)/i,
        /store this[:\s]+(.+)/i,
        /save this[:\s]+(.+)/i,
        /don't forget[:\s]+(.+)/i,
        /keep in mind[:\s]+(.+)/i,
        /always remember[:\s]+(.+)/i,
      ];

      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          return {
            shouldStore: true,
            shouldAsk: false,
            type: 'fact',
            extractedContent: match[1].trim(),
          };
        }
      }

      return {
        shouldStore: true,
        shouldAsk: false,
        type: 'fact',
        extractedContent: content,
      };
    }

    // Explicit "forget this" commands
    if (
      lowerContent.includes("don't remember") ||
      lowerContent.includes('forget this') ||
      lowerContent.includes('ignore this')
    ) {
      return {
        shouldStore: false,
        shouldAsk: false,
        type: 'fact',
      };
    }

    // Detect potentially important information that might warrant asking
    const importantIndicators = [
      { pattern: /my name is (\w+)/i, type: 'fact' as const },
      { pattern: /i always prefer (\w+)/i, type: 'fact' as const },
      { pattern: /i work on (\w+)/i, type: 'fact' as const },
      { pattern: /my project is called (\w+)/i, type: 'fact' as const },
      { pattern: /i learned that (.+)/i, type: 'wisdom' as const },
      { pattern: /the trick is to (.+)/i, type: 'pattern' as const },
      { pattern: /watch out for (.+)/i, type: 'gotcha' as const },
    ];

    for (const { pattern, type } of importantIndicators) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return {
          shouldStore: false,
          shouldAsk: true, // Ask user if they want this remembered
          type,
          extractedContent: match[0],
        };
      }
    }

    return {
      shouldStore: false,
      shouldAsk: false,
      type: 'fact',
    };
  }

  /**
   * Get memory preferences for a conversation
   * Returns what types of things the user has asked to remember/forget
   */
  getMemoryPreferences(conversationId: string): {
    preferRemember: string[];
    preferForget: string[];
    autoStore: boolean;
  } {
    const memory = memoryStore.get(conversationId);

    if (!memory) {
      return {
        preferRemember: [],
        preferForget: [],
        autoStore: true, // Default: auto-store critical info
      };
    }

    // Extract from stored facts
    const preferRemember: string[] = [];
    const preferForget: string[] = [];

    for (const fact of memory.criticalFacts) {
      if (fact.tags?.includes('remembered')) {
        preferRemember.push(fact.content);
      }
    }

    return {
      preferRemember,
      preferForget,
      autoStore: true,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getConversationMemoryService = (): ConversationMemoryService => {
  return ConversationMemoryService.getInstance();
};

export { ConversationMemoryService };
