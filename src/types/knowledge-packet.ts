/**
 * Knowledge Packet System Types
 *
 * Revolutionary context injection system for LLM-powered code generation.
 * No competitor has this - we inject curated expertise directly into prompts.
 *
 * Competitive Advantages:
 * 1. Domain-specific expertise injection (beginner → expert paths)
 * 2. Anti-pattern prevention before code is written
 * 3. Research-backed best practices from academic sources
 * 4. Real-world gotcha prevention from production experience
 * 5. Progressive disclosure based on user skill level
 * 6. Cross-domain pattern recognition and application
 */

import type { KnowledgeItem, GroupedKnowledgeResults } from './knowledge';

// ============================================================================
// KNOWLEDGE PACKET CORE
// ============================================================================

/**
 * A Knowledge Packet is a curated bundle of expertise injected into LLM context
 * before code generation. This is our secret sauce.
 */
export interface KnowledgePacket {
  id: string;
  name: string;
  description: string;
  version: string;

  /** Domain this packet covers */
  domain: KnowledgeDomain;

  /** Sub-domains for more specific expertise */
  subDomains: string[];

  /** Skill level this packet is optimized for */
  targetSkillLevel: SkillLevel;

  /** The actual knowledge content */
  content: PacketContent;

  /** How this packet should be injected into prompts */
  injection: InjectionStrategy;

  /** Metrics on packet effectiveness */
  effectiveness: PacketEffectiveness;

  /** Dependencies on other packets */
  dependencies: string[];

  /** Conflicts with other packets (don't use together) */
  conflicts: string[];

  /** Token cost estimate */
  estimatedTokens: number;

  /** When to use this packet */
  triggers: PacketTrigger[];

  metadata: PacketMetadata;
}

export type KnowledgeDomain =
  | 'web_development'
  | 'mobile_development'
  | 'backend_systems'
  | 'database_design'
  | 'api_design'
  | 'authentication'
  | 'payments'
  | 'ai_ml'
  | 'devops'
  | 'security'
  | 'testing'
  | 'performance'
  | 'game_development'
  | 'blockchain'
  | 'data_engineering'
  | 'system_design'
  | 'ux_design'
  | 'integrations'
  | 'real_time'
  | 'productivity'
  | 'business'
  | 'finance'
  | 'health'
  | 'career'
  | 'learning'
  | 'communication'
  | 'general';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'all';

// ============================================================================
// PACKET CONTENT
// ============================================================================

export interface PacketContent {
  /** Core wisdom - fundamental truths */
  wisdom: WisdomEntry[];

  /** Patterns - proven solutions */
  patterns: PatternEntry[];

  /** Gotchas - common mistakes to avoid */
  gotchas: GotchaEntry[];

  /** Code examples - working implementations */
  examples: CodeExample[];

  /** Best practices - research-backed guidelines */
  bestPractices: BestPractice[];

  /** Anti-patterns - what NOT to do */
  antiPatterns: AntiPattern[];

  /** Architecture decisions - trade-offs and choices */
  architectureDecisions: ArchitectureDecision[];

  /** Performance considerations */
  performanceHints: PerformanceHint[];

  /** Security considerations */
  securityGuidelines: SecurityGuideline[];

  /** Research references - academic backing */
  researchRefs: ResearchReference[];
}

export interface WisdomEntry {
  id: string;
  title: string;
  content: string;
  /** Compressed format: W.XXXX */
  wisdomId: string;
  /** When this wisdom applies */
  applicableWhen: string[];
  /** Expected outcome when applied */
  expectedOutcome: string;
  /** Confidence score 0-1 */
  confidence: number;
}

export interface PatternEntry {
  id: string;
  name: string;
  /** P.XXX.XX format */
  patternId: string;
  problem: string;
  solution: string;
  context: string;
  consequences: string[];
  codeTemplate?: string;
  relatedPatterns: string[];
  /** From Gang of Four, Martin Fowler, etc. */
  source?: string;
}

export interface GotchaEntry {
  id: string;
  title: string;
  /** G.XXX.XX format */
  gotchaId: string;
  symptom: string;
  cause: string;
  fix: string;
  prevention: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  frequency: 'rare' | 'occasional' | 'common' | 'very_common';
  /** Regex or AST patterns to detect this gotcha */
  detectionPatterns?: string[];
}

export interface CodeExample {
  id: string;
  title: string;
  description: string;
  language: string;
  framework?: string;
  code: string;
  /** Line-by-line explanations */
  annotations?: { line: number; comment: string }[];
  /** What this example demonstrates */
  demonstrates: string[];
  /** Common variations */
  variations?: { name: string; code: string }[];
}

export interface BestPractice {
  id: string;
  title: string;
  description: string;
  rationale: string;
  /** Evidence supporting this practice */
  evidence: string[];
  /** Implementation guidance */
  howToImplement: string;
  /** When NOT to follow this practice */
  exceptions?: string[];
  /** Research paper or book reference */
  source?: string;
}

export interface AntiPattern {
  id: string;
  name: string;
  description: string;
  symptoms: string[];
  consequences: string[];
  refactoredSolution: string;
  /** Code smell detection */
  codeSmells?: string[];
}

export interface ArchitectureDecision {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string[];
  alternatives: { option: string; tradeOffs: string[] }[];
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
}

export interface PerformanceHint {
  id: string;
  area: string;
  issue: string;
  impact: 'minor' | 'moderate' | 'significant' | 'critical';
  solution: string;
  benchmark?: string;
}

export interface SecurityGuideline {
  id: string;
  title: string;
  threat: string;
  mitigation: string;
  owaspRef?: string;
  cweRef?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResearchReference {
  id: string;
  title: string;
  authors: string[];
  year: number;
  source: 'paper' | 'book' | 'conference' | 'thesis' | 'industry_report';
  url?: string;
  doi?: string;
  keyFindings: string[];
  applicability: string;
}

// ============================================================================
// INJECTION STRATEGY
// ============================================================================

export interface InjectionStrategy {
  /** Where in the prompt to inject */
  position: 'system' | 'context' | 'prefix' | 'suffix' | 'inline';

  /** How to format the injection */
  format: InjectionFormat;

  /** Priority when multiple packets compete */
  priority: number;

  /** Maximum tokens to use */
  maxTokens: number;

  /** Content selection strategy */
  selection: SelectionStrategy;

  /** Conditional injection rules */
  conditions?: InjectionCondition[];
}

export type InjectionFormat =
  | 'structured'     // XML-like tags
  | 'markdown'       // Markdown headers
  | 'json'          // JSON object
  | 'natural'       // Natural language
  | 'compressed';   // UAA2++ compressed format

export interface SelectionStrategy {
  /** How to pick content when space is limited */
  method: 'relevance' | 'recency' | 'frequency' | 'manual' | 'adaptive';

  /** Weights for different content types */
  weights: {
    wisdom: number;
    patterns: number;
    gotchas: number;
    examples: number;
    bestPractices: number;
  };

  /** Always include these items */
  mustInclude?: string[];

  /** Never include these items */
  exclude?: string[];
}

export interface InjectionCondition {
  type: 'task_type' | 'language' | 'framework' | 'skill_level' | 'error_present' | 'custom';
  operator: 'equals' | 'contains' | 'matches' | 'greater_than' | 'less_than';
  value: string | number | boolean;
  action: 'include' | 'exclude' | 'prioritize' | 'deprioritize';
}

// ============================================================================
// EFFECTIVENESS TRACKING
// ============================================================================

export interface PacketEffectiveness {
  /** Times this packet was used */
  usageCount: number;

  /** Times code worked first try */
  firstTrySuccessRate: number;

  /** Times gotchas were successfully prevented */
  gotchaPreventionRate: number;

  /** Average code quality score */
  codeQualityScore: number;

  /** User satisfaction rating */
  userSatisfaction: number;

  /** Time saved vs. without packet (estimated) */
  timeSavedMinutes: number;

  /** Feedback from users */
  feedback: PacketFeedback[];

  /** A/B test results */
  abTestResults?: ABTestResult[];
}

export interface PacketFeedback {
  id: string;
  userId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  helpful: boolean;
  comment?: string;
  context: string;
  timestamp: Date;
}

export interface ABTestResult {
  testId: string;
  variant: 'control' | 'treatment';
  metric: string;
  controlValue: number;
  treatmentValue: number;
  statisticalSignificance: number;
  sampleSize: number;
}

// ============================================================================
// PACKET TRIGGERS
// ============================================================================

export interface PacketTrigger {
  type: TriggerType;
  condition: string;
  priority: number;
  /** Auto-inject or suggest to user */
  autoInject: boolean;
}

export type TriggerType =
  | 'keyword'           // Keywords in user request
  | 'file_pattern'      // File types being edited
  | 'framework'         // Framework detected
  | 'error_pattern'     // Error message pattern
  | 'code_pattern'      // Code pattern detected
  | 'intent'            // User intent classification
  | 'task_type'         // Type of task (CRUD, auth, etc.)
  | 'complexity'        // Task complexity score
  | 'previous_failure'; // Previous attempt failed

// ============================================================================
// METADATA
// ============================================================================

export interface PacketMetadata {
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  contributors: string[];
  tags: string[];
  /** Academic/research sources count */
  researchBackedClaims: number;
  /** Production experience sources count */
  productionExperienceClaims: number;
  /** Master's degree research incorporated */
  academicLevel?: 'undergraduate' | 'graduate' | 'doctoral' | 'industry';
  license: string;
}

// ============================================================================
// SKILL PROGRESSION SYSTEM
// ============================================================================

/**
 * Tracks user skill level across domains for progressive disclosure
 */
export interface UserSkillProfile {
  userId: string;
  overallLevel: SkillLevel;
  domainSkills: Record<KnowledgeDomain, DomainSkill>;
  learningPath: LearningPathProgress[];
  achievements: SkillAchievement[];
  preferences: SkillPreferences;
}

export interface DomainSkill {
  domain: KnowledgeDomain;
  level: SkillLevel;
  experiencePoints: number;
  /** Topics mastered in this domain */
  masteredTopics: string[];
  /** Topics currently learning */
  inProgressTopics: string[];
  /** Gotchas user has encountered and learned from */
  encounteredGotchas: string[];
  lastActivity: Date;
}

export interface LearningPathProgress {
  pathId: string;
  pathName: string;
  currentStep: number;
  totalSteps: number;
  completedTopics: string[];
  startedAt: Date;
  estimatedCompletion: Date;
}

export interface SkillAchievement {
  id: string;
  name: string;
  description: string;
  earnedAt: Date;
  category: 'mastery' | 'exploration' | 'consistency' | 'quality' | 'speed';
}

export interface SkillPreferences {
  /** Prefer detailed explanations vs concise */
  verbosity: 'minimal' | 'balanced' | 'detailed';
  /** Show research references */
  showResearch: boolean;
  /** Include code examples */
  includeExamples: boolean;
  /** Warn about gotchas proactively */
  proactiveWarnings: boolean;
  /** Preferred learning style */
  learningStyle: 'visual' | 'textual' | 'example_based' | 'mixed';
}

// ============================================================================
// PACKET COMPOSITION
// ============================================================================

/**
 * A composed packet combining multiple packets for a specific task
 */
export interface ComposedPacket {
  id: string;
  name: string;
  /** Source packets */
  sources: string[];
  /** Combined and deduplicated content */
  content: PacketContent;
  /** Total token budget */
  tokenBudget: number;
  /** Actual tokens used */
  tokensUsed: number;
  /** Composition strategy used */
  strategy: CompositionStrategy;
  /** User context that influenced composition */
  userContext: UserContext;
}

export type CompositionStrategy =
  | 'merge_all'         // Include everything
  | 'priority_based'    // By priority score
  | 'relevance_based'   // By semantic similarity
  | 'skill_adapted'     // Based on user skill
  | 'task_optimized'    // Optimized for specific task
  | 'token_optimized';  // Minimize tokens

export interface UserContext {
  skillProfile: UserSkillProfile;
  currentTask: string;
  recentErrors: string[];
  projectContext: ProjectContext;
  sessionHistory: SessionHistoryItem[];
}

export interface ProjectContext {
  framework?: string;
  language: string;
  dependencies: string[];
  existingPatterns: string[];
  codebaseSize: 'small' | 'medium' | 'large';
  teamSize?: number;
}

export interface SessionHistoryItem {
  timestamp: Date;
  action: string;
  result: 'success' | 'failure' | 'partial';
  relevantPackets: string[];
}

// ============================================================================
// EXPERT KNOWLEDGE DOMAINS
// ============================================================================

/**
 * Pre-defined expert knowledge domains from your research
 */
export const EXPERT_DOMAINS: Record<KnowledgeDomain, ExpertDomainInfo> = {
  web_development: {
    domain: 'web_development',
    name: 'Web Development',
    description: 'Frontend and full-stack web development',
    subDomains: ['react', 'nextjs', 'vue', 'angular', 'html_css', 'javascript', 'typescript'],
    keyPatterns: ['component_architecture', 'state_management', 'routing', 'ssr_ssg'],
    commonGotchas: ['hydration_mismatch', 'memory_leaks', 'bundle_size', 'seo_issues'],
    researchAreas: ['web_performance', 'accessibility', 'progressive_enhancement'],
  },
  mobile_development: {
    domain: 'mobile_development',
    name: 'Mobile Development',
    description: 'iOS, Android, and cross-platform mobile apps',
    subDomains: ['react_native', 'flutter', 'swift', 'kotlin', 'expo'],
    keyPatterns: ['navigation', 'offline_first', 'push_notifications', 'deep_linking'],
    commonGotchas: ['memory_management', 'battery_drain', 'network_handling', 'app_size'],
    researchAreas: ['mobile_ux', 'performance_optimization', 'cross_platform'],
  },
  backend_systems: {
    domain: 'backend_systems',
    name: 'Backend Systems',
    description: 'Server-side development and architecture',
    subDomains: ['nodejs', 'python', 'go', 'rust', 'java', 'microservices'],
    keyPatterns: ['rest_api', 'graphql', 'event_driven', 'cqrs', 'domain_driven'],
    commonGotchas: ['n_plus_one', 'race_conditions', 'deadlocks', 'memory_leaks'],
    researchAreas: ['distributed_systems', 'scalability', 'fault_tolerance'],
  },
  database_design: {
    domain: 'database_design',
    name: 'Database Design',
    description: 'SQL, NoSQL, and data modeling',
    subDomains: ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch'],
    keyPatterns: ['normalization', 'indexing', 'sharding', 'replication', 'caching'],
    commonGotchas: ['slow_queries', 'index_bloat', 'connection_pooling', 'deadlocks'],
    researchAreas: ['query_optimization', 'data_modeling', 'cap_theorem'],
  },
  api_design: {
    domain: 'api_design',
    name: 'API Design',
    description: 'REST, GraphQL, and API best practices',
    subDomains: ['rest', 'graphql', 'grpc', 'websockets', 'openapi'],
    keyPatterns: ['versioning', 'pagination', 'rate_limiting', 'caching', 'error_handling'],
    commonGotchas: ['breaking_changes', 'over_fetching', 'under_fetching', 'n_plus_one'],
    researchAreas: ['api_evolution', 'developer_experience', 'documentation'],
  },
  authentication: {
    domain: 'authentication',
    name: 'Authentication & Authorization',
    description: 'Identity, access control, and security',
    subDomains: ['oauth', 'jwt', 'session', 'mfa', 'rbac', 'abac'],
    keyPatterns: ['token_refresh', 'secure_storage', 'permission_checks', 'audit_logging'],
    commonGotchas: ['token_leakage', 'session_fixation', 'privilege_escalation', 'timing_attacks'],
    researchAreas: ['zero_trust', 'passwordless', 'biometrics'],
  },
  payments: {
    domain: 'payments',
    name: 'Payment Systems',
    description: 'Stripe, subscriptions, and financial transactions',
    subDomains: ['stripe', 'paypal', 'subscriptions', 'invoicing', 'refunds'],
    keyPatterns: ['webhook_handling', 'idempotency', 'retry_logic', 'reconciliation'],
    commonGotchas: ['double_charges', 'webhook_failures', 'currency_handling', 'pci_compliance'],
    researchAreas: ['fraud_detection', 'payment_optimization', 'compliance'],
  },
  ai_ml: {
    domain: 'ai_ml',
    name: 'AI & Machine Learning',
    description: 'LLMs, embeddings, and AI integration',
    subDomains: ['llm', 'embeddings', 'rag', 'fine_tuning', 'agents', 'computer_vision'],
    keyPatterns: ['prompt_engineering', 'context_management', 'chunking', 'evaluation'],
    commonGotchas: ['hallucination', 'context_overflow', 'cost_explosion', 'latency'],
    researchAreas: ['alignment', 'interpretability', 'efficiency'],
  },
  devops: {
    domain: 'devops',
    name: 'DevOps & Infrastructure',
    description: 'CI/CD, containers, and cloud infrastructure',
    subDomains: ['docker', 'kubernetes', 'terraform', 'github_actions', 'aws', 'vercel'],
    keyPatterns: ['infrastructure_as_code', 'blue_green', 'canary', 'monitoring'],
    commonGotchas: ['secret_exposure', 'resource_limits', 'network_policies', 'drift'],
    researchAreas: ['gitops', 'observability', 'chaos_engineering'],
  },
  security: {
    domain: 'security',
    name: 'Security',
    description: 'Application security and secure coding',
    subDomains: ['owasp', 'encryption', 'input_validation', 'secure_headers'],
    keyPatterns: ['defense_in_depth', 'least_privilege', 'secure_defaults', 'audit_logging'],
    commonGotchas: ['sql_injection', 'xss', 'csrf', 'insecure_deserialization'],
    researchAreas: ['threat_modeling', 'penetration_testing', 'compliance'],
  },
  testing: {
    domain: 'testing',
    name: 'Testing',
    description: 'Unit, integration, and E2E testing',
    subDomains: ['jest', 'playwright', 'cypress', 'vitest', 'testing_library'],
    keyPatterns: ['test_pyramid', 'mocking', 'fixtures', 'snapshot_testing'],
    commonGotchas: ['flaky_tests', 'over_mocking', 'test_pollution', 'slow_tests'],
    researchAreas: ['mutation_testing', 'property_based', 'visual_regression'],
  },
  performance: {
    domain: 'performance',
    name: 'Performance',
    description: 'Optimization and profiling',
    subDomains: ['web_vitals', 'profiling', 'caching', 'lazy_loading', 'compression'],
    keyPatterns: ['code_splitting', 'prefetching', 'virtualization', 'debouncing'],
    commonGotchas: ['layout_thrashing', 'memory_leaks', 'blocking_main_thread', 'cache_invalidation'],
    researchAreas: ['perceived_performance', 'progressive_loading', 'edge_computing'],
  },
  game_development: {
    domain: 'game_development',
    name: 'Game Development',
    description: 'Game engines, mechanics, and interactive experiences',
    subDomains: ['unity', 'unreal', 'godot', 'phaser', 'three_js', 'game_design'],
    keyPatterns: ['game_loop', 'entity_component', 'state_machines', 'physics'],
    commonGotchas: ['frame_rate_issues', 'memory_fragmentation', 'input_lag', 'collision_detection'],
    researchAreas: ['procedural_generation', 'ai_in_games', 'networking'],
  },
  blockchain: {
    domain: 'blockchain',
    name: 'Blockchain & Web3',
    description: 'Smart contracts, DeFi, and decentralized apps',
    subDomains: ['solidity', 'ethereum', 'web3js', 'hardhat', 'nft'],
    keyPatterns: ['token_standards', 'access_control', 'upgradability', 'gas_optimization'],
    commonGotchas: ['reentrancy', 'overflow', 'front_running', 'oracle_manipulation'],
    researchAreas: ['formal_verification', 'layer2', 'cross_chain'],
  },
  data_engineering: {
    domain: 'data_engineering',
    name: 'Data Engineering',
    description: 'ETL, data pipelines, and analytics',
    subDomains: ['spark', 'airflow', 'dbt', 'snowflake', 'kafka'],
    keyPatterns: ['batch_processing', 'stream_processing', 'data_quality', 'lineage'],
    commonGotchas: ['data_skew', 'late_arrivals', 'schema_evolution', 'backpressure'],
    researchAreas: ['data_mesh', 'lakehouse', 'real_time_analytics'],
  },
  system_design: {
    domain: 'system_design',
    name: 'System Design',
    description: 'Architecture and scalable system design',
    subDomains: ['microservices', 'monolith', 'event_sourcing', 'cqrs'],
    keyPatterns: ['load_balancing', 'caching', 'message_queues', 'circuit_breaker'],
    commonGotchas: ['single_point_failure', 'distributed_transactions', 'cascading_failures'],
    researchAreas: ['cap_theorem', 'eventual_consistency', 'service_mesh'],
  },
  ux_design: {
    domain: 'ux_design',
    name: 'UX Design',
    description: 'User experience and interface design',
    subDomains: ['accessibility', 'responsive', 'animation', 'design_systems'],
    keyPatterns: ['progressive_disclosure', 'feedback_loops', 'affordances', 'consistency'],
    commonGotchas: ['cognitive_overload', 'dark_patterns', 'poor_contrast', 'motion_sickness'],
    researchAreas: ['inclusive_design', 'behavioral_design', 'microinteractions'],
  },
  integrations: {
    domain: 'integrations',
    name: 'Third-Party Integrations',
    description: 'APIs, webhooks, and external services',
    subDomains: ['stripe', 'twilio', 'sendgrid', 'slack', 'github'],
    keyPatterns: ['webhook_verification', 'rate_limiting', 'retry_logic', 'circuit_breaker'],
    commonGotchas: ['api_versioning', 'timeout_handling', 'idempotency', 'secret_rotation'],
    researchAreas: ['api_orchestration', 'event_driven', 'observability'],
  },
  real_time: {
    domain: 'real_time',
    name: 'Real-Time Systems',
    description: 'WebSockets, live updates, and collaboration',
    subDomains: ['websockets', 'sse', 'webrtc', 'supabase_realtime', 'pusher'],
    keyPatterns: ['presence', 'conflict_resolution', 'optimistic_updates', 'reconnection'],
    commonGotchas: ['connection_management', 'message_ordering', 'scalability', 'offline_sync'],
    researchAreas: ['crdts', 'operational_transformation', 'edge_computing'],
  },
  productivity: {
    domain: 'productivity',
    name: 'Productivity & Time Management',
    description: 'Personal effectiveness, habits, and focus',
    subDomains: ['time_blocking', 'deep_work', 'habits', 'goal_setting', 'task_management'],
    keyPatterns: ['pomodoro', '80_20_rule', 'time_boxing', 'batching', 'single_tasking'],
    commonGotchas: ['multitasking', 'perfectionism', 'procrastination', 'burnout', 'busy_vs_productive'],
    researchAreas: ['flow_state', 'cognitive_load', 'energy_management'],
  },
  business: {
    domain: 'business',
    name: 'Business & Entrepreneurship',
    description: 'Starting, growing, and running a business',
    subDomains: ['startups', 'marketing', 'sales', 'pricing', 'growth', 'management'],
    keyPatterns: ['mvp', 'product_market_fit', 'value_proposition', 'customer_discovery', 'lean_startup'],
    commonGotchas: ['building_without_validation', 'pricing_too_low', 'ignoring_unit_economics', 'premature_scaling'],
    researchAreas: ['business_models', 'market_research', 'competitive_analysis'],
  },
  finance: {
    domain: 'finance',
    name: 'Personal Finance & Investing',
    description: 'Money management, investing, and wealth building',
    subDomains: ['budgeting', 'investing', 'retirement', 'taxes', 'debt_management'],
    keyPatterns: ['pay_yourself_first', 'dollar_cost_averaging', 'compound_interest', 'diversification'],
    commonGotchas: ['lifestyle_creep', 'timing_the_market', 'single_income_dependency', 'emotional_investing'],
    researchAreas: ['portfolio_theory', 'tax_optimization', 'passive_income'],
  },
  health: {
    domain: 'health',
    name: 'Health & Wellness',
    description: 'Physical and mental well-being',
    subDomains: ['fitness', 'nutrition', 'sleep', 'mental_health', 'stress_management'],
    keyPatterns: ['progressive_overload', 'sleep_hygiene', 'mindfulness', 'habit_stacking'],
    commonGotchas: ['all_or_nothing', 'ignoring_sleep', 'diet_extremism', 'overtraining'],
    researchAreas: ['longevity', 'behavioral_change', 'evidence_based_fitness'],
  },
  career: {
    domain: 'career',
    name: 'Career Development',
    description: 'Professional growth, job search, and advancement',
    subDomains: ['job_search', 'networking', 'negotiation', 'skills_development', 'leadership'],
    keyPatterns: ['skill_stacking', 't_shaped_skills', 'personal_branding', 'mentorship'],
    commonGotchas: ['waiting_to_be_noticed', 'accepting_first_offer', 'specializing_too_narrow', 'ignoring_networking'],
    researchAreas: ['career_capital', 'job_crafting', 'portfolio_career'],
  },
  learning: {
    domain: 'learning',
    name: 'Learning & Skill Acquisition',
    description: 'How to learn effectively and master new skills',
    subDomains: ['deliberate_practice', 'memory', 'reading', 'note_taking', 'teaching'],
    keyPatterns: ['spaced_repetition', 'active_recall', 'interleaving', 'feynman_technique'],
    commonGotchas: ['passive_consumption', 'shiny_object_syndrome', 'tutorial_hell', 'cramming'],
    researchAreas: ['learning_science', 'metacognition', 'expertise_development'],
  },
  communication: {
    domain: 'communication',
    name: 'Communication & Relationships',
    description: 'Effective communication and interpersonal skills',
    subDomains: ['listening', 'writing', 'presenting', 'negotiation', 'conflict_resolution'],
    keyPatterns: ['active_listening', 'nonviolent_communication', 'radical_candor', 'storytelling'],
    commonGotchas: ['listening_to_reply', 'avoiding_difficult_conversations', 'unclear_communication', 'assumptions'],
    researchAreas: ['persuasion', 'emotional_intelligence', 'team_dynamics'],
  },
  general: {
    domain: 'general',
    name: 'General Programming',
    description: 'Cross-cutting concerns and fundamentals',
    subDomains: ['algorithms', 'data_structures', 'design_patterns', 'clean_code'],
    keyPatterns: ['solid', 'dry', 'kiss', 'yagni'],
    commonGotchas: ['premature_optimization', 'over_engineering', 'magic_numbers', 'god_objects'],
    researchAreas: ['software_craftsmanship', 'technical_debt', 'refactoring'],
  },
};

export interface ExpertDomainInfo {
  domain: KnowledgeDomain;
  name: string;
  description: string;
  subDomains: string[];
  keyPatterns: string[];
  commonGotchas: string[];
  researchAreas: string[];
}
