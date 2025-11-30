/**
 * Builder Workspace Types
 *
 * Types for the Infinity Builder workspace system.
 * Workspace files are created for each build project.
 *
 * Growth Stages (Lotus Metaphor):
 * - Seed: Planting the idea
 * - Roots: Establishing foundation
 * - Sprout: First growth emerges
 * - Stem: Building structure
 * - Bud: Taking shape
 * - Bloom: Coming to life
 * - Flourish: Full beauty
 * - Radiance: Complete & glowing
 *
 * Note: Internal orchestration is hidden from users.
 * Users see progress and growth stages, not agent details.
 */

// ============================================================================
// WORKSPACE TYPES
// ============================================================================

export interface BuilderWorkspace {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  status: WorkspaceStatus;
  currentPhase: BuildPhase;
  phases: PhaseProgress[];
  files: WorkspaceFile[];
  config: WorkspaceConfig;
  userRequest: string; // Original user request
}

export type WorkspaceStatus =
  | 'initializing'
  | 'processing'
  | 'awaiting_input'
  | 'building'
  | 'testing'
  | 'deploying'
  | 'completed'
  | 'error'
  | 'cancelled';

// ============================================================================
// PHASE TYPES (Lotus Growth Stages)
// ============================================================================

export type BuildPhase =
  | 'seed'      // Planting the idea
  | 'roots'     // Establishing foundation
  | 'sprout'    // First growth emerges
  | 'stem'      // Building structure
  | 'bud'       // Taking shape
  | 'bloom'     // Coming to life
  | 'flourish'  // Full beauty
  | 'radiance'; // Complete & glowing

export type PhaseStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_input'
  | 'completed'
  | 'skipped'
  | 'error';

export interface PhaseProgress {
  phase: BuildPhase;
  status: PhaseStatus;
  progress: number; // 0-100
  startedAt?: string;
  completedAt?: string;
  message?: string; // User-friendly status message
  choices?: PhaseChoice[]; // Multiple choice options when awaiting_input
  selectedChoice?: string;
  error?: string;
}

export interface PhaseChoice {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
}

// Phase display configuration (user-facing - lotus growth metaphor)
export const PHASE_DISPLAY: Record<BuildPhase, { emoji: string; title: string; description: string }> = {
  seed: {
    emoji: '🌱',
    title: 'Seed',
    description: 'Planting your idea',
  },
  roots: {
    emoji: '🌿',
    title: 'Roots',
    description: 'Establishing foundation',
  },
  sprout: {
    emoji: '🌾',
    title: 'Sprout',
    description: 'First growth emerges',
  },
  stem: {
    emoji: '🎋',
    title: 'Stem',
    description: 'Building structure',
  },
  bud: {
    emoji: '🌸',
    title: 'Bud',
    description: 'Taking shape',
  },
  bloom: {
    emoji: '🌺',
    title: 'Bloom',
    description: 'Coming to life',
  },
  flourish: {
    emoji: '🪷',
    title: 'Flourish',
    description: 'Full beauty',
  },
  radiance: {
    emoji: '✨',
    title: 'Radiance',
    description: 'Complete & glowing',
  },
};

export const PHASE_ORDER: BuildPhase[] = [
  'seed',
  'roots',
  'sprout',
  'stem',
  'bud',
  'bloom',
  'flourish',
  'radiance',
];

// ============================================================================
// FILE TYPES
// ============================================================================

export interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  fileType?: FileType;
  status: FileStatus;
  createdAt?: string;
  modifiedAt?: string;
  size?: number;
  content?: string; // Only for small files
}

export type FileType =
  | 'typescript'
  | 'javascript'
  | 'json'
  | 'css'
  | 'html'
  | 'markdown'
  | 'config'
  | 'other';

export type FileStatus = 'pending' | 'created' | 'modified' | 'deleted';

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface WorkspaceConfig {
  projectType: ProjectType;
  features: string[];
  techStack: TechStack;
  automation: AutomationLevel;
}

export type ProjectType =
  | 'web_app'
  | 'api'
  | 'full_stack'
  | 'mobile'
  | 'cli'
  | 'library'
  | 'other';

export interface TechStack {
  frontend?: string[];
  backend?: string[];
  database?: string[];
  hosting?: string[];
}

export type AutomationLevel = 'basic' | 'standard' | 'advanced' | 'enterprise';

// ============================================================================
// API TYPES
// ============================================================================

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  userRequest: string;
  projectType?: ProjectType;
  features?: string[];
}

export interface CreateWorkspaceResponse {
  success: boolean;
  workspace?: BuilderWorkspace;
  error?: string;
}

export interface WorkspaceProgressUpdate {
  workspaceId: string;
  phase: BuildPhase;
  status: PhaseStatus;
  progress: number;
  message?: string;
  files?: WorkspaceFile[];
  choices?: PhaseChoice[];
}

export interface WorkspaceChoiceRequest {
  workspaceId: string;
  phase: BuildPhase;
  choiceId: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create initial phase progress for a new workspace
 */
export function createInitialPhases(): PhaseProgress[] {
  return PHASE_ORDER.map((phase) => ({
    phase,
    status: 'pending',
    progress: 0,
  }));
}

/**
 * Calculate overall workspace progress (0-100)
 */
export function calculateWorkspaceProgress(phases: PhaseProgress[]): number {
  const weights: Record<BuildPhase, number> = {
    seed: 10,
    roots: 10,
    sprout: 15,
    stem: 15,
    bud: 15,
    bloom: 15,
    flourish: 10,
    radiance: 10,
  };

  let completed = 0;
  let inProgress = 0;

  phases.forEach((p) => {
    const weight = weights[p.phase];
    if (p.status === 'completed') {
      completed += weight;
    } else if (p.status === 'in_progress') {
      inProgress += (weight * p.progress) / 100;
    } else if (p.status === 'skipped') {
      completed += weight; // Count skipped as complete for progress
    }
  });

  return Math.round(completed + inProgress);
}

/**
 * Get the next phase in order
 */
export function getNextPhase(currentPhase: BuildPhase): BuildPhase | null {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  if (currentIndex < 0 || currentIndex >= PHASE_ORDER.length - 1) {
    return null;
  }
  return PHASE_ORDER[currentIndex + 1];
}

/**
 * Check if workspace is complete
 */
export function isWorkspaceComplete(phases: PhaseProgress[]): boolean {
  return phases.every(
    (p) => p.status === 'completed' || p.status === 'skipped'
  );
}

/**
 * Get user-friendly status message
 */
export function getStatusMessage(status: WorkspaceStatus): string {
  const messages: Record<WorkspaceStatus, string> = {
    initializing: 'Planting the seed...',
    processing: 'Your creation is growing...',
    awaiting_input: 'Waiting for your guidance...',
    building: 'Building your vision...',
    testing: 'Testing the waters...',
    deploying: 'Preparing to bloom...',
    completed: 'Your creation is complete!',
    error: 'Something needs attention',
    cancelled: 'Growth paused',
  };
  return messages[status];
}
