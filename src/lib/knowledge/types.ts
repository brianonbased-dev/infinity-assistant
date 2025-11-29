/**
 * Assistant Knowledge Base Types
 *
 * Types for the uAA2++ 8-Phase Protocol knowledge system.
 * These types support:
 * - Phase-aware conversation context
 * - Hierarchical memory with compression
 * - Wisdom/Pattern/Gotcha knowledge loading
 * - Long conversation support
 */

// ============================================================================
// uAA2++ 8-PHASE PROTOCOL
// ============================================================================

/**
 * The 8 phases of the uAA2++ protocol
 */
export type UAA2Phase =
  | 'intake'      // 0. Gather data and context
  | 'reflect'     // 1. Analyze and understand
  | 'execute'     // 2. Take action
  | 'compress'    // 3. Store knowledge efficiently
  | 'reintake'    // 4. Re-evaluate with compressed knowledge
  | 'grow'        // 5. Learn and improve
  | 'evolve'      // 6. Adapt and optimize
  | 'autonomize'; // 7. Operate independently

/**
 * Phase metadata for tracking
 */
export interface PhaseContext {
  currentPhase: UAA2Phase;
  phaseStartedAt: string;
  phaseHistory: Array<{
    phase: UAA2Phase;
    startedAt: string;
    completedAt: string;
    insights: string[];
  }>;
  cycleCount: number;
}

// ============================================================================
// KNOWLEDGE TYPES
// ============================================================================

/**
 * Wisdom entry - distilled knowledge from research
 */
export interface WisdomEntry {
  id: string;                    // e.g., "W.CONV.001"
  title: string;                 // Short title
  wisdom: string;                // Core wisdom statement
  evidence?: string;             // Supporting evidence
  application?: string;          // How to apply
  domain?: string;               // e.g., "conversational-ai", "core-concepts"
  createdAt?: string;
  score?: number;                // Relevance score
}

/**
 * Pattern entry - reusable solutions
 */
export interface PatternEntry {
  id: string;                    // e.g., "P.CONV.01"
  name: string;                  // Pattern name
  pattern: string;               // Pattern description
  why?: string;                  // Why this pattern works
  when?: string;                 // When to apply
  result?: string;               // Expected result
  domain?: string;
  score?: number;
}

/**
 * Gotcha entry - common pitfalls
 */
export interface GotchaEntry {
  id: string;                    // e.g., "G.CONV.01"
  title: string;                 // Short title
  symptom: string;               // How it manifests
  cause: string;                 // Root cause
  fix: string;                   // How to fix
  prevention?: string;           // How to prevent
  domain?: string;
  score?: number;
}

/**
 * Combined knowledge base
 */
export interface KnowledgeBase {
  wisdom: WisdomEntry[];
  patterns: PatternEntry[];
  gotchas: GotchaEntry[];
  lastUpdated: string;
  version: string;
}

// ============================================================================
// CONVERSATION MEMORY
// ============================================================================

/**
 * Memory importance levels for hierarchical storage
 */
export type MemoryImportance = 'critical' | 'high' | 'medium' | 'low';

/**
 * A single memory entry
 */
export interface MemoryEntry {
  id: string;
  content: string;
  type: 'user' | 'assistant' | 'system' | 'insight';
  importance: MemoryImportance;
  createdAt: string;
  compressedAt?: string;
  tags?: string[];
  phase?: UAA2Phase;
}

/**
 * Compressed memory summary
 */
export interface CompressedMemory {
  id: string;
  summary: string;                // Compressed content
  originalCount: number;          // Number of entries compressed
  timeRange: {
    start: string;
    end: string;
  };
  keyInsights: string[];
  importance: MemoryImportance;
  phase?: UAA2Phase;
}

/**
 * Hierarchical conversation memory
 */
export interface ConversationMemory {
  conversationId: string;
  userId: string;

  // Active memory (recent, uncompressed)
  activeMemory: MemoryEntry[];

  // Compressed memory (older, summarized)
  compressedMemory: CompressedMemory[];

  // Critical facts that should never be compressed
  criticalFacts: MemoryEntry[];

  // User preferences and context
  userContext: {
    role?: string;
    experienceLevel?: string;
    interests?: string[];
    workflowPhases?: string[];
    communicationStyle?: string;
  };

  // Phase tracking
  phaseContext: PhaseContext;

  // Metadata
  createdAt: string;
  lastActiveAt: string;
  totalMessages: number;
}

// ============================================================================
// ASSISTANT CONTEXT
// ============================================================================

/**
 * User workflow phase preferences
 */
export type WorkflowPhase = 'research' | 'plan' | 'deliver';

/**
 * Complete context for assistant responses
 */
export interface AssistantContext {
  // Conversation state
  conversationId: string;
  userId: string;
  mode: 'search' | 'assist' | 'build';

  // User profile
  userProfile: {
    role: string;
    experienceLevel: string;
    interests: string[];
    customInterests: string[];
    workflowPhases: WorkflowPhase[];
    communicationStyle: 'concise' | 'detailed' | 'conversational';
  };

  // Active knowledge (relevant to current conversation)
  activeKnowledge: {
    relevantWisdom: WisdomEntry[];
    relevantPatterns: PatternEntry[];
    relevantGotchas: GotchaEntry[];
  };

  // Conversation memory
  memory: {
    recentMessages: MemoryEntry[];
    criticalFacts: MemoryEntry[];
    compressedHistory: CompressedMemory[];
  };

  // Phase tracking
  phase: PhaseContext;

  // Rate limiting
  rateLimit: {
    remaining: number;
    limit: number;
    resetAt?: string;
  };
}

// ============================================================================
// KNOWLEDGE LOADING
// ============================================================================

/**
 * Knowledge domain categories
 */
export type KnowledgeDomain =
  | 'conversational-ai'
  | 'core-concepts'
  | 'uncertainty-handling'
  | 'problem-scanning'
  | 'research-paradigms'
  | 'organization'
  | 'libraries'
  | 'idiom-learning'
  | 'ways-of-thinking'
  | 'general';

/**
 * Knowledge loading options
 */
export interface KnowledgeLoadOptions {
  domains?: KnowledgeDomain[];
  maxWisdom?: number;
  maxPatterns?: number;
  maxGotchas?: number;
  relevanceThreshold?: number;
}

/**
 * Knowledge search result
 */
export interface KnowledgeSearchResult {
  query: string;
  wisdom: WisdomEntry[];
  patterns: PatternEntry[];
  gotchas: GotchaEntry[];
  searchTime: number;
  totalResults: number;
}

// ============================================================================
// COMPRESSION
// ============================================================================

/**
 * Compression options
 */
export interface CompressionOptions {
  maxActiveMemory: number;        // Max entries before compression
  compressionRatio: number;       // Target compression (0.1 = 90% compression)
  preserveCritical: boolean;      // Never compress critical entries
  preservePhaseInsights: boolean; // Keep phase transition insights
}

/**
 * Compression result
 */
export interface CompressionResult {
  compressedCount: number;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  summary: CompressedMemory;
}

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

/**
 * Knowledge base service interface
 */
export interface IKnowledgeService {
  // Load knowledge
  loadKnowledge(options?: KnowledgeLoadOptions): Promise<KnowledgeBase>;

  // Search knowledge
  searchKnowledge(query: string, options?: KnowledgeLoadOptions): Promise<KnowledgeSearchResult>;

  // Get relevant knowledge for context
  getRelevantKnowledge(context: AssistantContext): Promise<{
    wisdom: WisdomEntry[];
    patterns: PatternEntry[];
    gotchas: GotchaEntry[];
  }>;
}

/**
 * Memory service interface
 */
export interface IMemoryService {
  // Get conversation memory (sync for quick access)
  getMemory(conversationId: string): ConversationMemory | null;

  // Add message to memory
  addMessage(conversationId: string, entry: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<void>;

  // Compress old messages
  compress(conversationId: string, options?: CompressionOptions): Promise<CompressionResult>;

  // Get context for response
  buildContext(conversationId: string, userId: string): Promise<AssistantContext>;
}

/**
 * Phase tracking service interface
 */
export interface IPhaseService {
  // Get current phase
  getCurrentPhase(conversationId: string): Promise<PhaseContext>;

  // Transition to new phase
  transitionPhase(conversationId: string, newPhase: UAA2Phase, insights?: string[]): Promise<PhaseContext>;

  // Get phase recommendations based on conversation
  recommendPhase(context: AssistantContext): UAA2Phase;
}
