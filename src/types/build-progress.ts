/**
 * Build Progress Types
 *
 * Comprehensive types for tracking build progress with:
 * - Visual evidence (screenshots, diffs, previews)
 * - Checkpoint/revert system
 * - Mock data testing
 * - Assistant → CEO → Futurist conversation flow
 */

// ============================================================================
// BUILD PROGRESS
// ============================================================================

export interface BuildProgress {
  id: string;
  sessionId: string;
  userId: string;
  templateId: string;
  status: BuildStatus;
  currentPhase: BuildPhase;
  phases: PhaseProgress[];
  checkpoints: BuildCheckpoint[];
  evidence: VisualEvidence[];
  conversations: BuildConversation[];
  mockTests: MockTestResult[];
  timeline: TimelineEvent[];
  metrics: BuildMetrics;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export type BuildStatus =
  | 'initializing'
  | 'in_progress'
  | 'paused'
  | 'awaiting_review'
  | 'awaiting_approval'
  | 'testing'
  | 'completed'
  | 'failed'
  | 'reverted';

export type BuildPhase =
  | 'setup'           // Environment setup
  | 'scaffolding'     // Project structure creation
  | 'database'        // Database schema and migrations
  | 'backend'         // API routes and services
  | 'frontend'        // UI components and pages
  | 'integration'     // Third-party integrations
  | 'testing'         // Automated tests
  | 'deployment'      // Build and deploy
  | 'verification';   // Final checks

export interface PhaseProgress {
  phase: BuildPhase;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
  steps: PhaseStep[];
  evidence: string[]; // Evidence IDs
  checkpointId?: string;
}

export interface PhaseStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  output?: string;
  error?: string;
  duration?: number; // ms
}

// ============================================================================
// CHECKPOINTS & REVERT
// ============================================================================

export interface BuildCheckpoint {
  id: string;
  buildId: string;
  phase: BuildPhase;
  name: string;
  description: string;
  createdAt: Date;
  snapshot: CheckpointSnapshot;
  canRevert: boolean;
  isAutomatic: boolean;
  createdBy: 'system' | 'user' | 'assistant' | 'ceo' | 'futurist';
  metadata: Record<string, unknown>;
}

export interface CheckpointSnapshot {
  /** Git commit hash or equivalent */
  commitHash?: string;
  /** File state references */
  fileState: FileStateRef[];
  /** Database migration version */
  dbMigrationVersion?: string;
  /** Environment variables at this point */
  envVarsHash: string;
  /** Deployed preview URL if available */
  previewUrl?: string;
  /** Screenshot of current state */
  screenshotId?: string;
}

export interface FileStateRef {
  path: string;
  hash: string;
  size: number;
  lastModified: Date;
}

export interface RevertRequest {
  buildId: string;
  checkpointId: string;
  reason: string;
  preserveAfter: boolean; // Keep changes made after checkpoint as stash
  requestedBy: string;
}

export interface RevertResult {
  success: boolean;
  revertedToCheckpoint: string;
  stashedChanges?: string; // Stash ID if preserveAfter was true
  filesReverted: number;
  error?: string;
}

// ============================================================================
// VISUAL EVIDENCE
// ============================================================================

export type EvidenceType =
  | 'screenshot'
  | 'video'
  | 'diff'
  | 'preview'
  | 'terminal'
  | 'code_snippet'
  | 'api_response'
  | 'test_result'
  | 'comparison';

export interface VisualEvidence {
  id: string;
  buildId: string;
  phase: BuildPhase;
  type: EvidenceType;
  title: string;
  description?: string;
  createdAt: Date;
  data: EvidenceData;
  annotations?: EvidenceAnnotation[];
  relatedCheckpoint?: string;
}

export type EvidenceData =
  | ScreenshotEvidence
  | VideoEvidence
  | DiffEvidence
  | PreviewEvidence
  | TerminalEvidence
  | CodeSnippetEvidence
  | ApiResponseEvidence
  | TestResultEvidence
  | ComparisonEvidence;

export interface ScreenshotEvidence {
  type: 'screenshot';
  url: string;
  width: number;
  height: number;
  device?: 'desktop' | 'tablet' | 'mobile';
  fullPage: boolean;
}

export interface VideoEvidence {
  type: 'video';
  url: string;
  duration: number; // seconds
  thumbnail?: string;
}

export interface DiffEvidence {
  type: 'diff';
  filePath: string;
  before: string;
  after: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  startLine: number;
  endLine: number;
  content: string;
  type: 'addition' | 'deletion' | 'context';
}

export interface PreviewEvidence {
  type: 'preview';
  url: string;
  route: string;
  status: 'live' | 'building' | 'error';
  lastUpdated: Date;
}

export interface TerminalEvidence {
  type: 'terminal';
  command: string;
  output: string;
  exitCode: number;
  duration: number;
}

export interface CodeSnippetEvidence {
  type: 'code_snippet';
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  code: string;
  highlight?: number[]; // Lines to highlight
}

export interface ApiResponseEvidence {
  type: 'api_response';
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  statusCode: number;
  requestBody?: unknown;
  responseBody: unknown;
  duration: number;
}

export interface TestResultEvidence {
  type: 'test_result';
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  assertions: AssertionResult[];
}

export interface AssertionResult {
  name: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  message?: string;
}

export interface ComparisonEvidence {
  type: 'comparison';
  title: string;
  before: ScreenshotEvidence;
  after: ScreenshotEvidence;
  diffPercentage: number;
  diffImageUrl?: string;
}

export interface EvidenceAnnotation {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  author: string;
  createdAt: Date;
  type: 'comment' | 'issue' | 'suggestion' | 'approval';
}

// ============================================================================
// MOCK DATA TESTING
// ============================================================================

export interface MockDataConfig {
  id: string;
  name: string;
  description?: string;
  scenarios: MockScenario[];
  createdAt: Date;
}

export interface MockScenario {
  id: string;
  name: string;
  description?: string;
  type: 'happy_path' | 'edge_case' | 'error_case' | 'stress_test' | 'custom';
  data: MockDataSet;
  expectedOutcome: ExpectedOutcome;
}

export interface MockDataSet {
  users?: MockUser[];
  products?: MockProduct[];
  orders?: MockOrder[];
  custom?: Record<string, unknown[]>;
}

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: string;
  metadata?: Record<string, unknown>;
}

export interface MockProduct {
  id: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface MockOrder {
  id: string;
  userId: string;
  products: { productId: string; quantity: number }[];
  total: number;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface ExpectedOutcome {
  success: boolean;
  assertions: string[];
  screenshots?: string[];
  apiResponses?: { endpoint: string; expectedStatus: number }[];
}

export interface MockTestResult {
  id: string;
  buildId: string;
  scenarioId: string;
  scenarioName: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  assertions: AssertionResult[];
  evidence: string[]; // Evidence IDs
  error?: string;
}

// ============================================================================
// CONVERSATION FLOW (Assistant → CEO → Futurist)
// ============================================================================

export type ConversationRole = 'user' | 'assistant' | 'ceo' | 'futurist';

export interface BuildConversation {
  id: string;
  buildId: string;
  phase: BuildPhase;
  checkpointId?: string;
  topic: ConversationTopic;
  messages: ConversationMessage[];
  status: 'active' | 'resolved' | 'escalated' | 'archived';
  resolution?: ConversationResolution;
  createdAt: Date;
  resolvedAt?: Date;
}

export type ConversationTopic =
  | 'implementation_question'
  | 'design_decision'
  | 'approval_request'
  | 'issue_report'
  | 'change_request'
  | 'strategic_review'
  | 'future_consideration';

export interface ConversationMessage {
  id: string;
  role: ConversationRole;
  content: string;
  timestamp: Date;
  attachments?: MessageAttachment[];
  suggestions?: ActionSuggestion[];
  requiresResponse?: ConversationRole[];
}

export interface MessageAttachment {
  type: 'evidence' | 'checkpoint' | 'file' | 'link';
  id: string;
  title: string;
  preview?: string;
}

export interface ActionSuggestion {
  id: string;
  action: 'approve' | 'reject' | 'modify' | 'revert' | 'escalate' | 'defer';
  label: string;
  description?: string;
  impact: 'low' | 'medium' | 'high';
  automated: boolean; // Can be executed automatically
}

export interface ConversationResolution {
  decision: 'approved' | 'rejected' | 'modified' | 'deferred';
  resolvedBy: ConversationRole;
  reason: string;
  actions: string[];
  nextCheckpointId?: string;
}

// ============================================================================
// PERSONA CONFIGURATIONS
// ============================================================================

export interface PersonaConfig {
  role: ConversationRole;
  name: string;
  title: string;
  avatar?: string;
  focus: string[];
  decisionAuthority: string[];
  escalatesTo?: ConversationRole;
}

export const PERSONAS: Record<Exclude<ConversationRole, 'user'>, PersonaConfig> = {
  assistant: {
    role: 'assistant',
    name: 'Builder Assistant',
    title: 'Technical Implementation Lead',
    focus: [
      'Code quality and best practices',
      'Technical feasibility',
      'Implementation details',
      'Bug fixes and optimizations',
    ],
    decisionAuthority: [
      'Code structure',
      'Library choices',
      'Technical implementation',
      'Performance optimizations',
    ],
    escalatesTo: 'ceo',
  },
  ceo: {
    role: 'ceo',
    name: 'Strategic Advisor',
    title: 'Chief Executive Officer',
    focus: [
      'Business value and ROI',
      'User experience impact',
      'Resource allocation',
      'Timeline and priorities',
    ],
    decisionAuthority: [
      'Feature priorities',
      'Resource allocation',
      'Go/no-go decisions',
      'Scope changes',
    ],
    escalatesTo: 'futurist',
  },
  futurist: {
    role: 'futurist',
    name: 'Vision Architect',
    title: 'Chief Futurist',
    focus: [
      'Long-term vision alignment',
      'Innovation opportunities',
      'Market trends',
      'Scalability and future-proofing',
    ],
    decisionAuthority: [
      'Strategic direction',
      'Innovation investments',
      'Long-term architecture',
      'Market positioning',
    ],
  },
};

// ============================================================================
// TIMELINE & METRICS
// ============================================================================

export interface TimelineEvent {
  id: string;
  buildId: string;
  timestamp: Date;
  type: TimelineEventType;
  title: string;
  description?: string;
  phase?: BuildPhase;
  actor?: ConversationRole | 'system';
  metadata?: Record<string, unknown>;
  relatedIds?: {
    checkpointId?: string;
    evidenceId?: string;
    conversationId?: string;
    testId?: string;
  };
}

export type TimelineEventType =
  | 'phase_started'
  | 'phase_completed'
  | 'checkpoint_created'
  | 'evidence_captured'
  | 'test_run'
  | 'conversation_started'
  | 'decision_made'
  | 'revert_performed'
  | 'error_occurred'
  | 'user_interaction'
  | 'deployment'
  | 'approval';

export interface BuildMetrics {
  totalDuration: number; // ms
  phaseDurations: Record<BuildPhase, number>;
  checkpointCount: number;
  revertCount: number;
  evidenceCount: number;
  testsPassed: number;
  testsFailed: number;
  conversationCount: number;
  decisionsRequired: number;
  decisionsMade: number;
  linesOfCodeGenerated: number;
  filesCreated: number;
  filesModified: number;
}
