/**
 * Project Persistence Types
 *
 * Type definitions for project storage, versioning, and collaboration
 */

// =============================================================================
// PROJECT CORE TYPES
// =============================================================================

export type ProjectStatus =
  | 'draft'
  | 'building'
  | 'paused'
  | 'testing'
  | 'reviewing'
  | 'deploying'
  | 'deployed'
  | 'archived';

export type ProjectType =
  | 'saas'
  | 'ecommerce'
  | 'portfolio'
  | 'blog'
  | 'api'
  | 'mobile_app'
  | 'game'
  | 'automation'
  | 'integration'
  | 'custom';

export type TechStack =
  | 'nextjs'
  | 'react'
  | 'vue'
  | 'svelte'
  | 'express'
  | 'fastapi'
  | 'django'
  | 'rails'
  | 'tauri'
  | 'electron'
  | 'react_native'
  | 'flutter';

export interface Project {
  id: string;
  userId: string;
  workspaceId: string;

  // Basic info
  name: string;
  description: string;
  type: ProjectType;
  status: ProjectStatus;

  // Technical configuration
  techStack: TechStack;
  framework: string;
  database?: DatabaseConfig;
  deployment?: DeploymentConfig;

  // File structure
  rootPath: string;
  files: ProjectFile[];
  directories: ProjectDirectory[];

  // Version control
  currentVersion: string;
  versions: ProjectVersion[];
  branches: ProjectBranch[];
  currentBranch: string;

  // Collaboration
  collaborators: Collaborator[];
  permissions: ProjectPermissions;

  // Build context
  buildContext: BuildContext;
  conversationHistory: ConversationSnapshot[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  lastBuildAt?: string;
  deployedAt?: string;

  // Settings
  settings: ProjectSettings;
  integrations: ProjectIntegration[];

  // Analytics
  analytics: ProjectAnalytics;
}

// =============================================================================
// FILE SYSTEM TYPES
// =============================================================================

export interface ProjectFile {
  id: string;
  path: string;
  name: string;
  extension: string;
  content: string;
  size: number;
  hash: string; // SHA-256 for diff detection

  // Versioning
  version: number;
  lastModified: string;
  modifiedBy: string;

  // Metadata
  language?: string;
  generated: boolean;
  locked: boolean;

  // AI context
  aiGenerated?: boolean;
  generationPrompt?: string;
  validationStatus?: FileValidationStatus;
}

export interface ProjectDirectory {
  id: string;
  path: string;
  name: string;
  children: string[]; // File/directory IDs
  expanded?: boolean;
}

export interface FileValidationStatus {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  lastValidated: string;
}

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  rule: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  line: number;
  column: number;
  message: string;
  rule: string;
  suggestion?: string;
}

// =============================================================================
// VERSION CONTROL TYPES
// =============================================================================

export interface ProjectVersion {
  id: string;
  version: string; // Semantic versioning
  projectId: string;

  // Snapshot
  snapshot: ProjectSnapshot;

  // Changes
  changes: FileChange[];
  summary: string;

  // Metadata
  createdAt: string;
  createdBy: string;

  // Context
  buildPhase?: string;
  checkpointId?: string;
  conversationContext?: string;

  // Tags
  tags: string[];
  isRelease: boolean;
  releaseNotes?: string;
}

export interface ProjectSnapshot {
  files: Record<string, FileSnapshot>;
  structure: DirectoryStructure;
  config: ProjectConfig;
  dependencies: DependencyLock;
}

export interface FileSnapshot {
  path: string;
  content: string;
  hash: string;
  size: number;
}

export interface DirectoryStructure {
  root: string;
  tree: DirectoryNode;
}

export interface DirectoryNode {
  name: string;
  type: 'file' | 'directory';
  children?: DirectoryNode[];
  fileId?: string;
}

export interface FileChange {
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  path: string;
  previousPath?: string; // For renames
  diff?: FileDiff;
}

export interface FileDiff {
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'add' | 'delete';
  content: string;
  lineNumber: {
    old?: number;
    new?: number;
  };
}

// =============================================================================
// BRANCH TYPES
// =============================================================================

export interface ProjectBranch {
  id: string;
  name: string;
  projectId: string;

  // Branch info
  baseBranch?: string;
  baseVersion: string;
  currentVersion: string;

  // Status
  isDefault: boolean;
  isProtected: boolean;
  status: 'active' | 'merged' | 'abandoned';

  // Metadata
  createdAt: string;
  createdBy: string;
  lastCommit: string;

  // Description
  description?: string;
  purpose?: 'feature' | 'bugfix' | 'experiment' | 'release';
}

export interface BranchMerge {
  id: string;
  sourceBranch: string;
  targetBranch: string;

  status: 'pending' | 'conflicted' | 'merged' | 'cancelled';
  conflicts?: MergeConflict[];

  mergedAt?: string;
  mergedBy?: string;
}

export interface MergeConflict {
  filePath: string;
  type: 'content' | 'deleted' | 'renamed';
  sourceContent?: string;
  targetContent?: string;
  resolution?: 'source' | 'target' | 'manual';
  resolvedContent?: string;
}

// =============================================================================
// COLLABORATION TYPES
// =============================================================================

export interface Collaborator {
  userId: string;
  email: string;
  name: string;
  avatar?: string;
  role: CollaboratorRole;
  permissions: CollaboratorPermissions;
  addedAt: string;
  addedBy: string;
  lastActive?: string;
}

export type CollaboratorRole =
  | 'owner'
  | 'admin'
  | 'developer'
  | 'reviewer'
  | 'viewer';

export interface CollaboratorPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canDeploy: boolean;
  canInvite: boolean;
  canManageSettings: boolean;
  canViewAnalytics: boolean;
  canRevert: boolean;
  canMerge: boolean;
}

export interface ProjectPermissions {
  isPublic: boolean;
  allowForks: boolean;
  allowComments: boolean;
  requireReview: boolean;
  protectedBranches: string[];
}

// =============================================================================
// BUILD CONTEXT TYPES
// =============================================================================

export interface BuildContext {
  // Original requirements
  originalPrompt: string;
  refinedRequirements: RefinedRequirement[];

  // Architecture decisions
  architectureDecisions: ArchitectureDecision[];

  // Progress
  currentPhase: string;
  phaseHistory: PhaseRecord[];

  // Knowledge applied
  knowledgePackets: string[]; // Packet IDs
  appliedPatterns: string[];
  avoidedGotchas: string[];

  // AI context
  conversationSummary: string;
  keyDecisions: KeyDecision[];
}

export interface RefinedRequirement {
  id: string;
  original: string;
  refined: string;
  category: 'functional' | 'non-functional' | 'technical' | 'ux';
  priority: 'must' | 'should' | 'could' | 'wont';
  status: 'pending' | 'in_progress' | 'completed' | 'deferred';
}

export interface ArchitectureDecision {
  id: string;
  title: string;
  context: string;
  decision: string;
  rationale: string;
  alternatives: string[];
  consequences: string[];
  decidedAt: string;
  decidedBy: 'user' | 'assistant' | 'ceo' | 'futurist';
}

export interface PhaseRecord {
  phase: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  filesCreated: string[];
  filesModified: string[];
  testsRun: number;
  testsPassed: number;
}

export interface KeyDecision {
  id: string;
  question: string;
  answer: string;
  decidedBy: string;
  impact: 'low' | 'medium' | 'high';
  timestamp: string;
}

export interface ConversationSnapshot {
  id: string;
  timestamp: string;
  phase: string;
  persona: 'assistant' | 'ceo' | 'futurist';
  summary: string;
  keyPoints: string[];
  filesDiscussed: string[];
  decisionsRecorded: string[];
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export interface DatabaseConfig {
  provider: 'supabase' | 'planetscale' | 'neon' | 'mongodb' | 'postgres' | 'sqlite';
  connectionString?: string;
  schema?: string;
  migrations: DatabaseMigration[];
}

export interface DatabaseMigration {
  id: string;
  version: number;
  name: string;
  sql: string;
  appliedAt?: string;
  status: 'pending' | 'applied' | 'failed' | 'rolled_back';
}

export interface DeploymentConfig {
  provider: 'vercel' | 'railway' | 'netlify' | 'aws' | 'gcp' | 'docker';
  environment: 'development' | 'staging' | 'production';
  url?: string;
  customDomain?: string;
  envVariables: Record<string, string>;
  buildCommand: string;
  startCommand: string;
  region?: string;
}

export interface ProjectConfig {
  packageJson?: Record<string, unknown>;
  tsConfig?: Record<string, unknown>;
  eslintConfig?: Record<string, unknown>;
  prettierConfig?: Record<string, unknown>;
  tailwindConfig?: Record<string, unknown>;
  envTemplate: Record<string, string>;
}

export interface DependencyLock {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  lockfileVersion: number;
  hash: string;
}

export interface ProjectSettings {
  autoSave: boolean;
  autoSaveInterval: number; // seconds

  // Build settings
  autoValidate: boolean;
  autoFormat: boolean;
  strictMode: boolean;

  // AI settings
  preferredPersona: 'assistant' | 'ceo' | 'futurist';
  knowledgeLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  explainDecisions: boolean;

  // Notification settings
  notifyOnBuild: boolean;
  notifyOnDeploy: boolean;
  notifyOnError: boolean;
}

// =============================================================================
// INTEGRATION TYPES
// =============================================================================

export interface ProjectIntegration {
  id: string;
  type: IntegrationType;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  config: Record<string, unknown>;
  lastSync?: string;
  syncErrors?: string[];
}

export type IntegrationType =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'figma'
  | 'notion'
  | 'slack'
  | 'discord'
  | 'linear'
  | 'jira'
  | 'stripe'
  | 'analytics';

// =============================================================================
// ANALYTICS TYPES
// =============================================================================

export interface ProjectAnalytics {
  // Size metrics
  totalFiles: number;
  totalLines: number;
  totalSize: number; // bytes

  // Activity metrics
  totalVersions: number;
  totalEdits: number;
  averageSessionDuration: number;

  // Build metrics
  totalBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  averageBuildTime: number;

  // Quality metrics
  testCoverage?: number;
  lintErrors: number;
  typeErrors: number;

  // AI metrics
  aiGeneratedLines: number;
  aiSuggestionAcceptRate: number;
  knowledgePacketsUsed: number;

  // Time tracking
  totalBuildTime: number; // minutes
  timeByPhase: Record<string, number>;
}

// =============================================================================
// STORAGE TYPES
// =============================================================================

export interface StorageProvider {
  type: 'local' | 's3' | 'supabase' | 'gcs';
  bucket?: string;
  prefix?: string;
  credentials?: StorageCredentials;
}

export interface StorageCredentials {
  accessKey?: string;
  secretKey?: string;
  region?: string;
  endpoint?: string;
}

export interface StoredProject {
  projectId: string;
  storagePath: string;
  size: number;
  lastAccessed: string;
  compressed: boolean;
}

// =============================================================================
// EXPORT/IMPORT TYPES
// =============================================================================

export interface ProjectExport {
  version: string;
  exportedAt: string;
  exportedBy: string;

  project: Project;
  versions: ProjectVersion[];
  branches: ProjectBranch[];

  // Optional includes
  includeHistory?: boolean;
  includeAnalytics?: boolean;
  includeIntegrations?: boolean;
}

export interface ProjectImport {
  source: 'file' | 'url' | 'github' | 'template';
  data: ProjectExport | string;
  options: ImportOptions;
}

export interface ImportOptions {
  preserveHistory: boolean;
  preserveCollaborators: boolean;
  targetWorkspace: string;
  newName?: string;
  overwrite: boolean;
}

// =============================================================================
// TEMPLATE TYPES
// =============================================================================

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  techStack: TechStack;

  // Template content
  files: TemplateFile[];
  config: ProjectConfig;

  // Customization
  variables: TemplateVariable[];
  prompts: TemplatePrompt[];

  // Metadata
  author: string;
  version: string;
  tags: string[];
  downloads: number;
  rating: number;
}

export interface TemplateFile {
  path: string;
  content: string;
  isTemplate: boolean; // Contains variables to replace
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'boolean' | 'number' | 'select';
  default?: string | boolean | number;
  options?: string[]; // For select type
  required: boolean;
}

export interface TemplatePrompt {
  id: string;
  question: string;
  variableName: string;
  type: 'text' | 'confirm' | 'select' | 'multiselect';
  options?: string[];
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export type ProjectEvent =
  | { type: 'project_created'; data: Project }
  | { type: 'project_updated'; data: Partial<Project> }
  | { type: 'project_deleted'; data: { projectId: string } }
  | { type: 'file_created'; data: ProjectFile }
  | { type: 'file_updated'; data: { fileId: string; changes: Partial<ProjectFile> } }
  | { type: 'file_deleted'; data: { fileId: string } }
  | { type: 'version_created'; data: ProjectVersion }
  | { type: 'branch_created'; data: ProjectBranch }
  | { type: 'branch_merged'; data: BranchMerge }
  | { type: 'collaborator_added'; data: Collaborator }
  | { type: 'collaborator_removed'; data: { userId: string } }
  | { type: 'deployment_started'; data: { environment: string } }
  | { type: 'deployment_completed'; data: { environment: string; url: string } }
  | { type: 'deployment_failed'; data: { environment: string; error: string } };

export type ProjectEventHandler = (event: ProjectEvent) => void | Promise<void>;
