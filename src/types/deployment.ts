/**
 * Deployment Types
 *
 * Type definitions for multi-platform deployment automation
 */

// =============================================================================
// PROVIDER TYPES
// =============================================================================

export type DeploymentProvider =
  | 'vercel'
  | 'railway'
  | 'netlify'
  | 'aws'
  | 'gcp'
  | 'azure'
  | 'docker'
  | 'kubernetes'
  | 'cloudflare'
  | 'fly';

export type DeploymentEnvironment =
  | 'development'
  | 'staging'
  | 'preview'
  | 'production';

export type DeploymentStatus =
  | 'pending'
  | 'queued'
  | 'building'
  | 'deploying'
  | 'deployed'
  | 'failed'
  | 'cancelled'
  | 'rolled_back';

// =============================================================================
// DEPLOYMENT CONFIGURATION
// =============================================================================

export interface DeploymentConfig {
  provider: DeploymentProvider;
  projectId: string;
  environment: DeploymentEnvironment;

  // Provider-specific config
  providerConfig: ProviderConfig;

  // Build configuration
  buildConfig: BuildConfig;

  // Environment variables
  envVariables: EnvVariable[];

  // Domain configuration
  domains: DomainConfig[];

  // Resource limits
  resources?: ResourceConfig;

  // Scaling configuration
  scaling?: ScalingConfig;

  // Health checks
  healthChecks?: HealthCheckConfig[];

  // Hooks
  hooks?: DeploymentHooks;
}

export interface ProviderConfig {
  // Common
  projectName: string;
  teamId?: string;
  region?: string;

  // Vercel specific
  vercel?: VercelConfig;

  // Railway specific
  railway?: RailwayConfig;

  // Docker specific
  docker?: DockerConfig;

  // Kubernetes specific
  kubernetes?: KubernetesConfig;

  // AWS specific
  aws?: AWSConfig;
}

export interface VercelConfig {
  scope?: string;
  framework?: string;
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  devCommand?: string;
  rootDirectory?: string;
}

export interface RailwayConfig {
  serviceId?: string;
  environmentId?: string;
  startCommand?: string;
  healthcheckPath?: string;
  numReplicas?: number;
  sleepAfter?: number; // seconds of inactivity
}

export interface DockerConfig {
  dockerfile?: string;
  context?: string;
  registry?: string;
  imageName?: string;
  tag?: string;
  buildArgs?: Record<string, string>;
  ports?: PortMapping[];
  volumes?: VolumeMapping[];
  networks?: string[];
}

export interface KubernetesConfig {
  namespace?: string;
  cluster?: string;
  deployment?: string;
  service?: string;
  ingress?: string;
  configMap?: string;
  secrets?: string[];
}

export interface AWSConfig {
  region: string;
  service: 'ecs' | 'lambda' | 'apprunner' | 'ec2' | 'amplify';
  vpc?: string;
  subnets?: string[];
  securityGroups?: string[];
  role?: string;
  logGroup?: string;
}

export interface BuildConfig {
  command: string;
  outputDir?: string;
  installCommand?: string;
  nodeVersion?: string;
  pythonVersion?: string;
  goVersion?: string;
  cache?: CacheConfig;
  env?: Record<string, string>;
}

export interface CacheConfig {
  enabled: boolean;
  paths?: string[];
  key?: string;
}

export interface EnvVariable {
  key: string;
  value: string;
  environment: DeploymentEnvironment | 'all';
  secret?: boolean;
  encrypted?: boolean;
}

export interface DomainConfig {
  domain: string;
  environment: DeploymentEnvironment;
  primary?: boolean;
  ssl?: SSLConfig;
  redirect?: RedirectConfig;
}

export interface SSLConfig {
  enabled: boolean;
  provider?: 'letsencrypt' | 'custom' | 'cloudflare';
  certificate?: string;
  privateKey?: string;
  autoRenew?: boolean;
}

export interface RedirectConfig {
  from: string;
  to: string;
  statusCode: 301 | 302 | 307 | 308;
}

export interface ResourceConfig {
  memory?: string; // e.g., "512Mi", "1Gi"
  cpu?: string; // e.g., "0.5", "1"
  storage?: string;
  maxMemory?: string;
  maxCpu?: string;
}

export interface ScalingConfig {
  minInstances: number;
  maxInstances: number;
  targetCPU?: number; // percentage
  targetMemory?: number; // percentage
  targetRequestsPerSecond?: number;
  scaleToZero?: boolean;
  cooldownPeriod?: number; // seconds
}

export interface HealthCheckConfig {
  path: string;
  port?: number;
  interval: number; // seconds
  timeout: number; // seconds
  healthyThreshold: number;
  unhealthyThreshold: number;
  protocol?: 'http' | 'https' | 'tcp';
}

export interface DeploymentHooks {
  preBuild?: string[];
  postBuild?: string[];
  preDeploy?: string[];
  postDeploy?: string[];
  onSuccess?: string[];
  onFailure?: string[];
}

export interface PortMapping {
  container: number;
  host: number;
  protocol?: 'tcp' | 'udp';
}

export interface VolumeMapping {
  source: string;
  target: string;
  readonly?: boolean;
}

// =============================================================================
// DEPLOYMENT RECORD TYPES
// =============================================================================

export interface Deployment {
  id: string;
  projectId: string;
  provider: DeploymentProvider;
  environment: DeploymentEnvironment;
  status: DeploymentStatus;

  // Version info
  version: string;
  commitHash?: string;
  commitMessage?: string;
  branch?: string;

  // URLs
  url?: string;
  inspectorUrl?: string;
  logsUrl?: string;

  // Timing
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number; // milliseconds

  // Build info
  buildLogs?: string[];
  buildOutput?: BuildOutput;

  // Deploy info
  deployLogs?: string[];
  deployOutput?: DeployOutput;

  // Error info
  error?: DeploymentError;

  // Metadata
  createdBy: string;
  trigger: DeploymentTrigger;
  metadata?: Record<string, string>;
}

export interface BuildOutput {
  success: boolean;
  duration: number;
  size: number; // bytes
  files: number;
  warnings?: string[];
}

export interface DeployOutput {
  success: boolean;
  duration: number;
  instances?: number;
  regions?: string[];
}

export interface DeploymentError {
  code: string;
  message: string;
  stack?: string;
  phase: 'build' | 'deploy' | 'validation' | 'healthcheck';
  recoverable: boolean;
  suggestions?: string[];
}

export type DeploymentTrigger =
  | 'manual'
  | 'git_push'
  | 'git_merge'
  | 'schedule'
  | 'webhook'
  | 'rollback'
  | 'api';

// =============================================================================
// DEPLOYMENT PIPELINE TYPES
// =============================================================================

export interface DeploymentPipeline {
  id: string;
  name: string;
  projectId: string;
  stages: PipelineStage[];
  triggers: PipelineTrigger[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  steps: PipelineStep[];
  condition?: StageCondition;
  onFailure: 'stop' | 'continue' | 'rollback';
  timeout?: number; // seconds
}

export interface PipelineStep {
  id: string;
  name: string;
  type: StepType;
  config: StepConfig;
  condition?: StepCondition;
  retries?: number;
  timeout?: number;
}

export type StepType =
  | 'build'
  | 'test'
  | 'lint'
  | 'security_scan'
  | 'deploy'
  | 'notify'
  | 'approval'
  | 'custom';

export interface StepConfig {
  command?: string;
  script?: string;
  environment?: DeploymentEnvironment;
  provider?: DeploymentProvider;
  notification?: NotificationConfig;
  approval?: ApprovalConfig;
}

export interface NotificationConfig {
  channels: NotificationChannel[];
  template?: string;
  includeDetails?: boolean;
}

export interface NotificationChannel {
  type: 'slack' | 'discord' | 'email' | 'webhook';
  target: string; // channel ID, email, or webhook URL
}

export interface ApprovalConfig {
  requiredApprovers: number;
  approvers: string[]; // user IDs
  timeoutHours: number;
  autoApproveFor?: DeploymentEnvironment[];
}

export interface StageCondition {
  type: 'branch' | 'environment' | 'manual' | 'schedule' | 'expression';
  value: string;
}

export interface StepCondition {
  type: 'success' | 'failure' | 'always' | 'expression';
  value?: string;
}

export interface PipelineTrigger {
  type: 'push' | 'pull_request' | 'tag' | 'schedule' | 'manual';
  config: TriggerConfig;
}

export interface TriggerConfig {
  branches?: string[];
  tags?: string[];
  paths?: string[];
  schedule?: string; // cron expression
}

// =============================================================================
// ROLLBACK TYPES
// =============================================================================

export interface RollbackRequest {
  deploymentId: string;
  targetDeploymentId: string;
  reason: string;
  requestedBy: string;
}

export interface RollbackResult {
  success: boolean;
  deployment?: Deployment;
  error?: DeploymentError;
  previousDeployment: Deployment;
  newDeployment?: Deployment;
}

// =============================================================================
// PREVIEW DEPLOYMENT TYPES
// =============================================================================

export interface PreviewDeployment {
  id: string;
  projectId: string;
  pullRequestId?: string;
  pullRequestUrl?: string;
  branch: string;
  url: string;
  status: DeploymentStatus;
  createdAt: string;
  expiresAt?: string;
  deployment: Deployment;
}

// =============================================================================
// METRICS TYPES
// =============================================================================

export interface DeploymentMetrics {
  projectId: string;
  period: 'day' | 'week' | 'month' | 'year';

  // Deployment counts
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  cancelledDeployments: number;

  // Timing
  averageBuildTime: number;
  averageDeployTime: number;
  averageTotalTime: number;
  p95BuildTime: number;
  p95DeployTime: number;

  // By environment
  deploymentsByEnvironment: Record<DeploymentEnvironment, number>;

  // By provider
  deploymentsByProvider: Record<DeploymentProvider, number>;

  // Trends
  deploymentTrend: TrendData[];
  successRateTrend: TrendData[];
}

export interface TrendData {
  date: string;
  value: number;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export type DeploymentEvent =
  | { type: 'deployment_started'; data: Deployment }
  | { type: 'deployment_building'; data: { deploymentId: string; progress: number } }
  | { type: 'deployment_deploying'; data: { deploymentId: string; progress: number } }
  | { type: 'deployment_completed'; data: Deployment }
  | { type: 'deployment_failed'; data: { deployment: Deployment; error: DeploymentError } }
  | { type: 'deployment_cancelled'; data: { deploymentId: string; reason: string } }
  | { type: 'rollback_started'; data: RollbackRequest }
  | { type: 'rollback_completed'; data: RollbackResult }
  | { type: 'preview_created'; data: PreviewDeployment }
  | { type: 'preview_expired'; data: { previewId: string } };

export type DeploymentEventHandler = (event: DeploymentEvent) => void | Promise<void>;
