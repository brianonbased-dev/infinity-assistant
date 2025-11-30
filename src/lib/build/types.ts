/**
 * Unified Build Types
 *
 * Single source of truth for all build-related types.
 */

// ============================================================================
// Build Phases
// ============================================================================

export type BuildPhase =
  | 'initialization'
  | 'requirements'
  | 'architecture'
  | 'database'
  | 'backend'
  | 'frontend'
  | 'integration'
  | 'testing'
  | 'deployment'
  | 'monitoring'
  | 'complete';

export type BuildStatus =
  | 'pending'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

// ============================================================================
// Project Types
// ============================================================================

export type ProjectType =
  | 'web_app'
  | 'api'
  | 'mobile_app'
  | 'cli'
  | 'library'
  | 'fullstack'
  | 'microservice';

export type TechStack = {
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'rust';
  framework?: string;
  database?: 'postgres' | 'mysql' | 'mongodb' | 'supabase' | 'planetscale';
  deployment?: 'vercel' | 'railway' | 'docker' | 'aws' | 'gcp';
  testing?: 'jest' | 'vitest' | 'pytest' | 'go-test';
};

// ============================================================================
// Build Request
// ============================================================================

export interface BuildRequest {
  userId: string;
  workspaceId: string;
  name: string;
  description: string;
  type: ProjectType;
  techStack: TechStack;
  features: FeatureRequest[];
  database?: DatabaseRequest;
  deployment?: DeploymentRequest;
  testing?: TestingRequest;
  monitoring?: MonitoringRequest;
}

export interface FeatureRequest {
  name: string;
  description: string;
  priority: 'must' | 'should' | 'could';
  type: 'functional' | 'ui' | 'api' | 'integration';
}

export interface DatabaseRequest {
  provider: 'supabase' | 'planetscale' | 'neon' | 'postgres';
  entities: EntityRequest[];
  features: ('timestamps' | 'soft_delete' | 'audit_log' | 'rls')[];
}

export interface EntityRequest {
  name: string;
  description: string;
  fields?: FieldRequest[];
  relationships?: string[];
}

export interface FieldRequest {
  name: string;
  type?: string;
  required?: boolean;
  unique?: boolean;
}

export interface DeploymentRequest {
  provider: 'vercel' | 'railway' | 'docker';
  environments: ('development' | 'staging' | 'production')[];
  autoDeployOnPush?: boolean;
  domains?: string[];
}

export interface TestingRequest {
  framework: 'jest' | 'vitest' | 'pytest';
  types: ('unit' | 'integration' | 'e2e')[];
  coverageThreshold?: number;
  autoGenerate?: boolean;
}

export interface MonitoringRequest {
  errorTracking?: boolean;
  analytics?: boolean;
  logging?: boolean;
  alerting?: boolean;
}

// ============================================================================
// Build Progress
// ============================================================================

export interface BuildProgress {
  id: string;
  sessionId: string;
  userId: string;
  workspaceId: string;
  request: BuildRequest;
  status: BuildStatus;
  currentPhase: BuildPhase;
  phases: PhaseProgress[];
  timeline: TimelineEvent[];
  metrics: BuildMetrics;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface PhaseProgress {
  phase: BuildPhase;
  status: StepStatus;
  progress: number; // 0-100
  steps: StepProgress[];
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface StepProgress {
  id: string;
  name: string;
  description: string;
  status: StepStatus;
  progress: number;
  output?: string;
  artifacts?: string[];
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface TimelineEvent {
  id: string;
  type: 'phase_start' | 'phase_complete' | 'step_complete' | 'error' | 'checkpoint' | 'user_action';
  phase?: BuildPhase;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export interface BuildMetrics {
  totalDuration?: number;
  phaseDurations: Record<BuildPhase, number>;
  linesOfCode: number;
  filesGenerated: number;
  testsGenerated: number;
  testsPassing: number;
  coveragePercent?: number;
  deploymentTime?: number;
}

// ============================================================================
// Checkpoints
// ============================================================================

export interface BuildCheckpoint {
  id: string;
  buildId: string;
  phase: BuildPhase;
  name: string;
  description: string;
  snapshot: CheckpointSnapshot;
  createdAt: Date;
}

export interface CheckpointSnapshot {
  files: FileSnapshot[];
  database?: DatabaseSnapshot;
  environment?: Record<string, string>;
}

export interface FileSnapshot {
  path: string;
  content: string;
  hash: string;
}

export interface DatabaseSnapshot {
  schema: string;
  migrations: string[];
  seedData?: string;
}

// ============================================================================
// Code Generation
// ============================================================================

export interface CodeGenRequest {
  intent: string;
  context?: string;
  existingCode?: string;
  targetFile?: string;
  language: string;
  framework?: string;
  skillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  maxTokens?: number;
  requirements?: string[];
}

export interface CodeGenResult {
  success: boolean;
  code: string;
  explanation: string;
  warnings: CodeWarning[];
  suggestions: CodeSuggestion[];
  metadata: {
    requestId: string;
    tokensUsed: number;
    generationTime: number;
  };
}

export interface CodeWarning {
  type: 'gotcha' | 'security' | 'performance' | 'style' | 'compatibility';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  line?: number;
  fix?: string;
}

export interface CodeSuggestion {
  type: 'improvement' | 'alternative' | 'optimization' | 'best_practice';
  title: string;
  description: string;
  code?: string;
  impact: 'low' | 'medium' | 'high';
}

// ============================================================================
// Deployment
// ============================================================================

export interface Deployment {
  id: string;
  buildId: string;
  environment: 'development' | 'staging' | 'production';
  provider: 'vercel' | 'railway' | 'docker';
  status: 'pending' | 'building' | 'deploying' | 'live' | 'failed' | 'rolled_back';
  url?: string;
  logs: string[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

// ============================================================================
// Events
// ============================================================================

export interface BuildEventPayload {
  buildId: string;
  userId: string;
  phase: BuildPhase;
  status: BuildStatus;
  timestamp: Date;
}

export interface PhaseEventPayload extends BuildEventPayload {
  progress: number;
  stepId?: string;
}

export interface DeploymentEventPayload {
  deploymentId: string;
  buildId: string;
  environment: string;
  status: Deployment['status'];
  url?: string;
  timestamp: Date;
}
