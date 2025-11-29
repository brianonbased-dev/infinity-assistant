/**
 * Assistant Knowledge Base Package
 *
 * Unified knowledge management for Infinity Assistant using the uAA2++ 8-Phase Protocol.
 *
 * Components:
 * - Types: Core type definitions for knowledge, memory, and phases
 * - AssistantKnowledgeService: Knowledge loading and retrieval
 * - ConversationMemoryService: Hierarchical memory with uAA2++ compression
 * - AssistantContextBuilder: Unified context building for responses
 *
 * The uAA2++ 8-Phase Protocol:
 * 0. INTAKE - Gather data and context
 * 1. REFLECT - Analyze and understand
 * 2. EXECUTE - Take action
 * 3. COMPRESS - Store knowledge efficiently (W/P/G extraction)
 * 4. RE-INTAKE - Re-evaluate with compressed knowledge
 * 5. GROW - Learn and improve
 * 6. EVOLVE - Adapt and optimize
 * 7. AUTONOMIZE - Operate independently
 *
 * Knowledge Types (W/P/G):
 * - Wisdom (W.XXX.XXX): Core insights and principles
 * - Patterns (P.XXX.XX): Reusable solutions and approaches
 * - Gotchas (G.XXX.XX): Common pitfalls and fixes
 */

// Types
export type {
  // uAA2++ Protocol
  UAA2Phase,
  PhaseContext,

  // Knowledge Types
  WisdomEntry,
  PatternEntry,
  GotchaEntry,
  KnowledgeBase,
  KnowledgeDomain,
  KnowledgeLoadOptions,
  KnowledgeSearchResult,

  // Memory Types
  MemoryImportance,
  MemoryEntry,
  CompressedMemory,
  ConversationMemory,
  CompressionOptions,
  CompressionResult,

  // Context Types
  AssistantContext,
  WorkflowPhase,

  // Service Interfaces
  IKnowledgeService,
  IMemoryService,
  IPhaseService,
} from './types';

// Services
export {
  getAssistantKnowledgeService,
  AssistantKnowledgeService,
} from './AssistantKnowledgeService';

export {
  getConversationMemoryService,
  ConversationMemoryService,
} from './ConversationMemoryService';

export {
  getAssistantContextBuilder,
  AssistantContextBuilder,
} from './AssistantContextBuilder';

export type {
  UserPreferences,
  BuildContextOptions,
} from './AssistantContextBuilder';

// Phase Transition Service (Active Phase Detection)
export {
  getPhaseTransitionService,
  PhaseTransitionService,
} from './PhaseTransitionService';

export type {
  PhaseTransitionEvent,
  PhaseAnnotatedMessage,
  TrainingDataExport,
} from './PhaseTransitionService';

// Training Data Export Service (QLLM/Brittney Training)
export {
  getTrainingDataExportService,
  TrainingDataExportService,
} from './TrainingDataExportService';

export type {
  QLLMTrainingRecord,
  BrittneyTrainingBatch,
  ExportOptions,
} from './TrainingDataExportService';

// User Memory Storage Service (Hybrid: Local + Database)
export {
  getUserMemoryStorageService,
  UserMemoryStorageService,
} from './UserMemoryStorageService';

export type {
  UserLocalMemory,
  WisdomEntry as UserWisdomEntry,
  PatternEntry as UserPatternEntry,
  GotchaEntry as UserGotchaEntry,
  FactEntry,
  UserMemoryPreferences,
  UserProfile,
  ConversationSession,
  SessionMessage,
} from './UserMemoryStorageService';

// Dual Phase Architecture (Internal Thinking + External Delivery)
export {
  getDualPhaseOrchestrator,
  DualPhaseOrchestrator,
  INTERNAL_TO_EXTERNAL_MAP,
  PHASE_USER_STATUS,
} from './DualPhaseArchitecture';

export type {
  InternalCognitiveState,
  ExternalDeliveryState,
  KnowledgeExtractionResult,
  DualPhaseSnapshot,
} from './DualPhaseArchitecture';

// Cognitive Stream Service (QLLM Thoughts + User Conversations)
export {
  getCognitiveStreamService,
  CognitiveStreamService,
} from './CognitiveStreamService';

export type {
  QLLMThoughtRecord,
  UserConversationRecord,
  StreamBatch,
} from './CognitiveStreamService';

// Micro-Thought Service (Rapid Cognition)
export {
  getMicroThoughtService,
  MicroThoughtService,
  // Quick accessors for rapid thinking
  think,
  recognize,
  decide,
  uncertain,
  learn,
} from './MicroThoughtService';

export type {
  MicroThought,
  ThoughtType,
  ThoughtChain,
  ThoughtStream,
} from './MicroThoughtService';

// Thought-Knowledge Connector (Memory + Parallel Retrieval)
export {
  getThoughtKnowledgeConnector,
  ThoughtKnowledgeConnector,
  // Convenience functions
  thinkWithKnowledge,
  quickRecall,
  // Deep thinking helpers
  deepThinkWithKnowledge,
  connectConcepts,
  buildTopicContext,
} from './ThoughtKnowledgeConnector';

export type {
  ThoughtKnowledgeResult,
  KnowledgeRetrieval,
  KnowledgeAssociation,
} from './ThoughtKnowledgeConnector';

// World Knowledge Service (External/World Knowledge + Online/Offline)
export {
  getWorldKnowledgeService,
  WorldKnowledgeService,
} from './WorldKnowledgeService';

export type {
  NetworkStatus,
  ExternalSource,
  WorldKnowledgeQuery,
  WorldKnowledgeResult,
} from './WorldKnowledgeService';

// Research Master Service (Deep Multi-Source Research)
export {
  getResearchMasterService,
  ResearchMasterService,
  // Convenience functions
  quickResearch,
  researchTopic,
  deepResearch,
  comprehensiveResearch,
} from './ResearchMasterService';

export type {
  ResearchMode,
  ResearchQuery,
  ResearchFinding,
  KnowledgeSynthesis,
  ResearchResult,
} from './ResearchMasterService';

// Knowledge Helpers Service (Connecting Dots + Insights)
export {
  getKnowledgeHelpersService,
  KnowledgeHelpersService,
  // Convenience functions
  connectDots,
  crossReference,
  needsResearch,
  buildContext,
  explainConnection,
} from './KnowledgeHelpersService';

export type {
  ConceptConnection,
  CrossReferenceResult,
  GeneratedInsight,
  ResearchNeedAssessment,
  TopicContext,
  ResearchTrigger,
} from './KnowledgeHelpersService';
