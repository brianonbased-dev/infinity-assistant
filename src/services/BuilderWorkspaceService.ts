/**
 * Builder Workspace Service
 *
 * Manages workspace creation, phase progression, and file tracking
 * for the Infinity Builder.
 *
 * Growth Stages (Lotus Metaphor):
 * - Seed: Planting the idea (analyzing request)
 * - Roots: Establishing foundation (planning architecture)
 * - Sprout: First growth (generating base structure)
 * - Stem: Building structure (core components)
 * - Bud: Taking shape (features & logic)
 * - Bloom: Coming to life (integration)
 * - Flourish: Full beauty (testing & polish)
 * - Radiance: Complete & glowing (ready to ship)
 *
 * Note: Internal orchestration is hidden from users.
 */

import {
  BuilderWorkspace,
  BuildPhase,
  PhaseProgress,
  PhaseStatus,
  WorkspaceFile,
  WorkspaceConfig,
  WorkspaceStatus,
  PhaseChoice,
  PHASE_ORDER,
  createInitialPhases,
  calculateWorkspaceProgress,
  getNextPhase,
} from '@/types/builder-workspace';

// ============================================================================
// WORKSPACE SERVICE
// ============================================================================

export class BuilderWorkspaceService {
  private workspaces: Map<string, BuilderWorkspace> = new Map();
  private listeners: Map<string, Set<(update: WorkspaceUpdate) => void>> = new Map();

  /**
   * Create a new workspace for a build request
   */
  async createWorkspace(
    name: string,
    userRequest: string,
    description?: string
  ): Promise<BuilderWorkspace> {
    const id = this.generateId();
    const now = new Date().toISOString();

    const workspace: BuilderWorkspace = {
      id,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      status: 'initializing',
      currentPhase: 'seed',
      phases: createInitialPhases(),
      files: [],
      config: {
        projectType: 'web_app',
        features: [],
        techStack: {},
        automation: 'standard',
      },
      userRequest,
    };

    this.workspaces.set(id, workspace);

    // Start the build process
    this.startBuild(id);

    return workspace;
  }

  /**
   * Get a workspace by ID
   */
  getWorkspace(id: string): BuilderWorkspace | undefined {
    return this.workspaces.get(id);
  }

  /**
   * Subscribe to workspace updates
   */
  subscribe(
    workspaceId: string,
    callback: (update: WorkspaceUpdate) => void
  ): () => void {
    if (!this.listeners.has(workspaceId)) {
      this.listeners.set(workspaceId, new Set());
    }
    this.listeners.get(workspaceId)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(workspaceId)?.delete(callback);
    };
  }

  /**
   * Select a choice for a phase awaiting input
   */
  async selectChoice(
    workspaceId: string,
    phase: BuildPhase,
    choiceId: string
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return;

    const phaseInfo = workspace.phases.find((p) => p.phase === phase);
    if (!phaseInfo || phaseInfo.status !== 'awaiting_input') return;

    // Update the phase with selected choice
    phaseInfo.selectedChoice = choiceId;
    phaseInfo.status = 'in_progress';

    this.notifyListeners(workspaceId, {
      type: 'phase_update',
      workspace,
      phase,
      status: 'in_progress',
    });

    // Continue the build
    this.continuePhase(workspaceId, phase);
  }

  /**
   * Cancel a build
   */
  async cancelBuild(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return;

    workspace.status = 'cancelled';
    workspace.updatedAt = new Date().toISOString();

    this.notifyListeners(workspaceId, {
      type: 'status_update',
      workspace,
      status: 'cancelled',
    });
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private generateId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifyListeners(workspaceId: string, update: WorkspaceUpdate): void {
    const listeners = this.listeners.get(workspaceId);
    if (listeners) {
      listeners.forEach((callback) => callback(update));
    }
  }

  /**
   * Start the build process
   */
  private async startBuild(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return;

    // Start with seed phase
    await this.runPhase(workspaceId, 'seed');
  }

  /**
   * Run a specific phase
   */
  private async runPhase(workspaceId: string, phase: BuildPhase): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || workspace.status === 'cancelled') return;

    const phaseInfo = workspace.phases.find((p) => p.phase === phase);
    if (!phaseInfo) return;

    // Update phase status
    phaseInfo.status = 'in_progress';
    phaseInfo.startedAt = new Date().toISOString();
    workspace.currentPhase = phase;
    workspace.status = 'processing';

    this.notifyListeners(workspaceId, {
      type: 'phase_update',
      workspace,
      phase,
      status: 'in_progress',
    });

    // Simulate phase progress (in production, this would be real work)
    await this.simulatePhaseProgress(workspaceId, phase);
  }

  /**
   * Simulate phase progress with realistic timing
   */
  private async simulatePhaseProgress(
    workspaceId: string,
    phase: BuildPhase
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || workspace.status === 'cancelled') return;

    const phaseInfo = workspace.phases.find((p) => p.phase === phase);
    if (!phaseInfo) return;

    // Phase-specific logic
    const phaseConfig = this.getPhaseConfig(phase, workspace);

    // Simulate progress updates
    for (let progress = 0; progress <= 100; progress += 10) {
      // Re-check workspace status (could have been cancelled during async delay)
      const currentWorkspace = this.workspaces.get(workspaceId);
      if (!currentWorkspace || currentWorkspace.status === 'cancelled') return;

      phaseInfo.progress = progress;
      phaseInfo.message = phaseConfig.messages[Math.floor(progress / 25)] || phaseConfig.messages[0];

      this.notifyListeners(workspaceId, {
        type: 'progress_update',
        workspace,
        phase,
        progress,
      });

      // Add files during certain phases
      if (phaseConfig.files && progress === 50) {
        this.addFiles(workspaceId, phaseConfig.files);
      }

      await this.delay(phaseConfig.duration / 10);
    }

    // Check if this phase needs user input
    if (phaseConfig.choices && phaseConfig.choices.length > 0) {
      phaseInfo.status = 'awaiting_input';
      phaseInfo.choices = phaseConfig.choices;

      this.notifyListeners(workspaceId, {
        type: 'phase_update',
        workspace,
        phase,
        status: 'awaiting_input',
      });

      // Wait for user input (handled by selectChoice)
      return;
    }

    // Complete the phase
    await this.completePhase(workspaceId, phase);
  }

  /**
   * Continue a phase after user input
   */
  private async continuePhase(
    workspaceId: string,
    phase: BuildPhase
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return;

    // Short delay then complete
    await this.delay(500);
    await this.completePhase(workspaceId, phase);
  }

  /**
   * Complete a phase and move to next
   */
  private async completePhase(
    workspaceId: string,
    phase: BuildPhase
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return;

    const phaseInfo = workspace.phases.find((p) => p.phase === phase);
    if (!phaseInfo) return;

    // Mark phase complete
    phaseInfo.status = 'completed';
    phaseInfo.progress = 100;
    phaseInfo.completedAt = new Date().toISOString();

    this.notifyListeners(workspaceId, {
      type: 'phase_update',
      workspace,
      phase,
      status: 'completed',
    });

    // Move to next phase
    const nextPhase = getNextPhase(phase);
    if (nextPhase) {
      await this.runPhase(workspaceId, nextPhase);
    } else {
      // Build complete!
      workspace.status = 'completed';
      workspace.updatedAt = new Date().toISOString();

      this.notifyListeners(workspaceId, {
        type: 'status_update',
        workspace,
        status: 'completed',
      });
    }
  }

  /**
   * Add files to workspace
   */
  private addFiles(workspaceId: string, files: Partial<WorkspaceFile>[]): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return;

    const newFiles: WorkspaceFile[] = files.map((f, i) => ({
      id: `file_${Date.now()}_${i}`,
      name: f.name || 'file',
      path: f.path || '/',
      type: f.type || 'file',
      status: 'created',
      createdAt: new Date().toISOString(),
    }));

    workspace.files.push(...newFiles);

    this.notifyListeners(workspaceId, {
      type: 'files_update',
      workspace,
      files: newFiles,
    });
  }

  /**
   * Get phase-specific configuration
   */
  private getPhaseConfig(
    phase: BuildPhase,
    workspace: BuilderWorkspace
  ): PhaseConfig {
    const configs: Record<BuildPhase, PhaseConfig> = {
      seed: {
        duration: 2000,
        messages: [
          'Analyzing your idea...',
          'Understanding requirements...',
          'Identifying key features...',
          'Planning the approach...',
        ],
        files: [
          { name: 'workspace.json', path: '/', type: 'file' },
        ],
      },
      roots: {
        duration: 3000,
        messages: [
          'Establishing foundation...',
          'Setting up project structure...',
          'Configuring environment...',
          'Preparing dependencies...',
        ],
        files: [
          { name: 'src', path: '/', type: 'folder' },
          { name: 'package.json', path: '/', type: 'file' },
          { name: 'tsconfig.json', path: '/', type: 'file' },
        ],
      },
      sprout: {
        duration: 4000,
        messages: [
          'First growth emerging...',
          'Creating base components...',
          'Setting up routing...',
          'Building initial structure...',
        ],
        files: [
          { name: 'components', path: '/src', type: 'folder' },
          { name: 'App.tsx', path: '/src', type: 'file' },
          { name: 'index.tsx', path: '/src', type: 'file' },
        ],
        choices: [
          {
            id: 'minimal',
            label: 'Minimal Setup',
            description: 'Clean, lightweight starting point',
          },
          {
            id: 'full',
            label: 'Full Setup',
            description: 'Complete with all recommended features',
            recommended: true,
          },
        ],
      },
      stem: {
        duration: 5000,
        messages: [
          'Building structure...',
          'Creating core components...',
          'Implementing layouts...',
          'Adding navigation...',
        ],
        files: [
          { name: 'Layout.tsx', path: '/src/components', type: 'file' },
          { name: 'Navigation.tsx', path: '/src/components', type: 'file' },
          { name: 'styles', path: '/src', type: 'folder' },
        ],
      },
      bud: {
        duration: 6000,
        messages: [
          'Taking shape...',
          'Adding features...',
          'Implementing logic...',
          'Connecting components...',
        ],
        files: [
          { name: 'hooks', path: '/src', type: 'folder' },
          { name: 'utils', path: '/src', type: 'folder' },
          { name: 'api.ts', path: '/src/utils', type: 'file' },
        ],
      },
      bloom: {
        duration: 5000,
        messages: [
          'Coming to life...',
          'Integrating systems...',
          'Connecting data flow...',
          'Adding interactions...',
        ],
        files: [
          { name: 'services', path: '/src', type: 'folder' },
          { name: 'context', path: '/src', type: 'folder' },
        ],
        choices: [
          {
            id: 'dark',
            label: 'Dark Theme',
            description: 'Modern dark color scheme',
          },
          {
            id: 'light',
            label: 'Light Theme',
            description: 'Clean light color scheme',
          },
          {
            id: 'both',
            label: 'Both Themes',
            description: 'Support for dark and light modes',
            recommended: true,
          },
        ],
      },
      flourish: {
        duration: 4000,
        messages: [
          'Adding final touches...',
          'Running tests...',
          'Optimizing performance...',
          'Polishing UI...',
        ],
        files: [
          { name: 'tests', path: '/', type: 'folder' },
          { name: 'README.md', path: '/', type: 'file' },
        ],
      },
      radiance: {
        duration: 2000,
        messages: [
          'Final preparations...',
          'Building for production...',
          'Ready to shine!',
          'Complete!',
        ],
        files: [
          { name: 'dist', path: '/', type: 'folder' },
          { name: '.env.example', path: '/', type: 'file' },
        ],
      },
    };

    return configs[phase];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface PhaseConfig {
  duration: number;
  messages: string[];
  files?: Partial<WorkspaceFile>[];
  choices?: PhaseChoice[];
}

export interface WorkspaceUpdate {
  type: 'phase_update' | 'progress_update' | 'status_update' | 'files_update';
  workspace: BuilderWorkspace;
  phase?: BuildPhase;
  status?: PhaseStatus | WorkspaceStatus;
  progress?: number;
  files?: WorkspaceFile[];
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let workspaceService: BuilderWorkspaceService | null = null;

export function getBuilderWorkspaceService(): BuilderWorkspaceService {
  if (!workspaceService) {
    workspaceService = new BuilderWorkspaceService();
  }
  return workspaceService;
}

export default BuilderWorkspaceService;
