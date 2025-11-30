/**
 * Unified Build Orchestrator
 *
 * Consolidates BuildProgressService, UnifiedBuildOrchestrator, CodeGenOrchestrator.
 * Single entry point for all build-related operations.
 */

import { createSingleton } from '../createSingleton';
import { getCache } from '../CacheService';
import { eventBus, createPayload } from '../EventBus';
import type {
  BuildRequest,
  BuildProgress,
  BuildPhase,
  BuildStatus,
  PhaseProgress,
  StepProgress,
  BuildCheckpoint,
  CodeGenRequest,
  CodeGenResult,
  Deployment,
  BuildMetrics,
  TimelineEvent,
} from './types';

// ============================================================================
// Build Orchestrator Implementation
// ============================================================================

class BuildOrchestratorImpl {
  private builds = new Map<string, BuildProgress>();
  private checkpoints = new Map<string, BuildCheckpoint[]>();
  private deployments = new Map<string, Deployment[]>();

  private buildCache = getCache<BuildProgress>('builds', { ttl: 3600000 }); // 1 hour
  private listeners = new Map<string, Set<(event: any) => void>>();

  // ============================================================================
  // Build Lifecycle
  // ============================================================================

  /**
   * Start a new build
   */
  async startBuild(request: BuildRequest): Promise<BuildProgress> {
    const buildId = `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const phases: PhaseProgress[] = this.initializePhases(request);

    const build: BuildProgress = {
      id: buildId,
      sessionId: `session_${Date.now()}`,
      userId: request.userId,
      workspaceId: request.workspaceId,
      request,
      status: 'in_progress',
      currentPhase: 'initialization',
      phases,
      timeline: [{
        id: `event_${Date.now()}`,
        type: 'phase_start',
        phase: 'initialization',
        message: 'Build started',
        timestamp: new Date(),
      }],
      metrics: this.initializeMetrics(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.builds.set(buildId, build);
    this.buildCache.set(buildId, build);

    eventBus.emit('build.started', createPayload('BuildOrchestrator', {
      buildId,
      userId: request.userId,
      projectType: request.type,
    }));

    // Start async build process
    this.executeBuild(build).catch(err => {
      this.handleBuildError(buildId, err);
    });

    return build;
  }

  /**
   * Get build progress
   */
  async getBuild(buildId: string): Promise<BuildProgress | null> {
    return this.builds.get(buildId) || this.buildCache.get(buildId);
  }

  /**
   * Pause a build
   */
  async pauseBuild(buildId: string): Promise<boolean> {
    const build = this.builds.get(buildId);
    if (!build || build.status !== 'in_progress') {
      return false;
    }

    build.status = 'paused';
    build.updatedAt = new Date();
    this.addTimelineEvent(build, 'user_action', 'Build paused by user');

    eventBus.emit('build.paused', createPayload('BuildOrchestrator', { buildId }));

    return true;
  }

  /**
   * Resume a paused build
   */
  async resumeBuild(buildId: string): Promise<boolean> {
    const build = this.builds.get(buildId);
    if (!build || build.status !== 'paused') {
      return false;
    }

    build.status = 'in_progress';
    build.updatedAt = new Date();
    this.addTimelineEvent(build, 'user_action', 'Build resumed');

    eventBus.emit('build.resumed', createPayload('BuildOrchestrator', { buildId }));

    // Continue execution
    this.executeBuild(build).catch(err => {
      this.handleBuildError(buildId, err);
    });

    return true;
  }

  /**
   * Cancel a build
   */
  async cancelBuild(buildId: string): Promise<boolean> {
    const build = this.builds.get(buildId);
    if (!build) {
      return false;
    }

    build.status = 'cancelled';
    build.updatedAt = new Date();
    this.addTimelineEvent(build, 'user_action', 'Build cancelled');

    eventBus.emit('build.cancelled', createPayload('BuildOrchestrator', { buildId }));

    return true;
  }

  // ============================================================================
  // Phase Management
  // ============================================================================

  /**
   * Update phase progress
   */
  updatePhaseProgress(
    buildId: string,
    phase: BuildPhase,
    progress: number,
    stepUpdate?: Partial<StepProgress>
  ): void {
    const build = this.builds.get(buildId);
    if (!build) return;

    const phaseProgress = build.phases.find(p => p.phase === phase);
    if (!phaseProgress) return;

    phaseProgress.progress = progress;
    phaseProgress.status = progress >= 100 ? 'completed' : 'running';

    if (stepUpdate && stepUpdate.id) {
      const step = phaseProgress.steps.find(s => s.id === stepUpdate.id);
      if (step) {
        Object.assign(step, stepUpdate);
      }
    }

    build.updatedAt = new Date();
    this.notifyListeners(buildId, { type: 'progress', phase, progress });
  }

  /**
   * Complete a phase
   */
  async completePhase(buildId: string, phase: BuildPhase): Promise<void> {
    const build = this.builds.get(buildId);
    if (!build) return;

    const phaseProgress = build.phases.find(p => p.phase === phase);
    if (!phaseProgress) return;

    phaseProgress.status = 'completed';
    phaseProgress.progress = 100;
    phaseProgress.completedAt = new Date();

    // Calculate duration
    if (phaseProgress.startedAt) {
      build.metrics.phaseDurations[phase] =
        phaseProgress.completedAt.getTime() - phaseProgress.startedAt.getTime();
    }

    this.addTimelineEvent(build, 'phase_complete', `${phase} phase completed`, { phase });

    // Move to next phase
    const nextPhase = this.getNextPhase(phase);
    if (nextPhase && build.status === 'in_progress') {
      build.currentPhase = nextPhase;
      const nextPhaseProgress = build.phases.find(p => p.phase === nextPhase);
      if (nextPhaseProgress) {
        nextPhaseProgress.status = 'running';
        nextPhaseProgress.startedAt = new Date();
      }
      this.addTimelineEvent(build, 'phase_start', `Starting ${nextPhase} phase`, { phase: nextPhase });
    }

    eventBus.emit('build.phase_completed', createPayload('BuildOrchestrator', {
      buildId,
      phase,
      nextPhase,
    }));
  }

  // ============================================================================
  // Checkpoints
  // ============================================================================

  /**
   * Create a checkpoint
   */
  async createCheckpoint(
    buildId: string,
    name: string,
    description: string
  ): Promise<BuildCheckpoint | null> {
    const build = this.builds.get(buildId);
    if (!build) return null;

    const checkpoint: BuildCheckpoint = {
      id: `checkpoint_${Date.now()}`,
      buildId,
      phase: build.currentPhase,
      name,
      description,
      snapshot: {
        files: [], // Would capture actual file state
        environment: {},
      },
      createdAt: new Date(),
    };

    const buildCheckpoints = this.checkpoints.get(buildId) || [];
    buildCheckpoints.push(checkpoint);
    this.checkpoints.set(buildId, buildCheckpoints);

    this.addTimelineEvent(build, 'checkpoint', `Checkpoint created: ${name}`);

    return checkpoint;
  }

  /**
   * Revert to checkpoint
   */
  async revertToCheckpoint(buildId: string, checkpointId: string): Promise<boolean> {
    const checkpointList = this.checkpoints.get(buildId);
    const checkpoint = checkpointList?.find(c => c.id === checkpointId);
    if (!checkpoint) return false;

    const build = this.builds.get(buildId);
    if (!build) return false;

    // Reset to checkpoint phase
    build.currentPhase = checkpoint.phase;

    // Reset phases after checkpoint
    const phaseIndex = build.phases.findIndex(p => p.phase === checkpoint.phase);
    for (let i = phaseIndex + 1; i < build.phases.length; i++) {
      build.phases[i].status = 'pending';
      build.phases[i].progress = 0;
      build.phases[i].steps = [];
    }

    this.addTimelineEvent(build, 'user_action', `Reverted to checkpoint: ${checkpoint.name}`);

    return true;
  }

  // ============================================================================
  // Code Generation
  // ============================================================================

  /**
   * Generate code for a request
   */
  async generateCode(request: CodeGenRequest): Promise<CodeGenResult> {
    const startTime = Date.now();

    // This would integrate with actual LLM for code generation
    // For now, return a placeholder result
    const result: CodeGenResult = {
      success: true,
      code: `// Generated code for: ${request.intent}\n// TODO: Implement actual code generation`,
      explanation: `This would generate ${request.language} code for: ${request.intent}`,
      warnings: [],
      suggestions: [
        {
          type: 'best_practice',
          title: 'Add error handling',
          description: 'Consider adding try-catch blocks for async operations',
          impact: 'medium',
        },
      ],
      metadata: {
        requestId: `codegen_${Date.now()}`,
        tokensUsed: 0,
        generationTime: Date.now() - startTime,
      },
    };

    eventBus.emit('code.generated', createPayload('BuildOrchestrator', {
      language: request.language,
      framework: request.framework,
      success: true,
    }));

    return result;
  }

  // ============================================================================
  // Deployment
  // ============================================================================

  /**
   * Deploy a build
   */
  async deploy(
    buildId: string,
    environment: 'development' | 'staging' | 'production'
  ): Promise<Deployment> {
    const build = this.builds.get(buildId);
    if (!build) {
      throw new Error('Build not found');
    }

    const deployment: Deployment = {
      id: `deploy_${Date.now()}`,
      buildId,
      environment,
      provider: build.request.deployment?.provider || 'vercel',
      status: 'pending',
      logs: [],
      startedAt: new Date(),
    };

    const buildDeployments = this.deployments.get(buildId) || [];
    buildDeployments.push(deployment);
    this.deployments.set(buildId, buildDeployments);

    eventBus.emit('deployment.started', createPayload('BuildOrchestrator', {
      deploymentId: deployment.id,
      buildId,
      environment,
    }));

    // Execute deployment async
    this.executeDeployment(deployment).catch(err => {
      deployment.status = 'failed';
      deployment.error = err.message;
    });

    return deployment;
  }

  /**
   * Get deployment status
   */
  async getDeployment(deploymentId: string): Promise<Deployment | null> {
    for (const deployments of this.deployments.values()) {
      const deployment = deployments.find(d => d.id === deploymentId);
      if (deployment) return deployment;
    }
    return null;
  }

  // ============================================================================
  // Event Subscription
  // ============================================================================

  /**
   * Subscribe to build events
   */
  subscribe(buildId: string, callback: (event: any) => void): () => void {
    const listeners = this.listeners.get(buildId) || new Set();
    listeners.add(callback);
    this.listeners.set(buildId, listeners);

    return () => {
      listeners.delete(callback);
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private initializePhases(request: BuildRequest): PhaseProgress[] {
    const phases: BuildPhase[] = [
      'initialization',
      'requirements',
      'architecture',
    ];

    if (request.database) phases.push('database');
    phases.push('backend');
    if (request.type !== 'api' && request.type !== 'cli') phases.push('frontend');
    phases.push('integration');
    if (request.testing) phases.push('testing');
    if (request.deployment) phases.push('deployment');
    if (request.monitoring) phases.push('monitoring');
    phases.push('complete');

    return phases.map((phase, index) => ({
      phase,
      status: index === 0 ? 'running' : 'pending',
      progress: 0,
      steps: [],
      startedAt: index === 0 ? new Date() : undefined,
    }));
  }

  private initializeMetrics(): BuildMetrics {
    return {
      phaseDurations: {} as Record<BuildPhase, number>,
      linesOfCode: 0,
      filesGenerated: 0,
      testsGenerated: 0,
      testsPassing: 0,
    };
  }

  private getNextPhase(current: BuildPhase): BuildPhase | null {
    const order: BuildPhase[] = [
      'initialization',
      'requirements',
      'architecture',
      'database',
      'backend',
      'frontend',
      'integration',
      'testing',
      'deployment',
      'monitoring',
      'complete',
    ];

    const currentIndex = order.indexOf(current);
    return currentIndex < order.length - 1 ? order[currentIndex + 1] : null;
  }

  private addTimelineEvent(
    build: BuildProgress,
    type: TimelineEvent['type'],
    message: string,
    details?: Record<string, unknown>
  ): void {
    build.timeline.push({
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      phase: build.currentPhase,
      message,
      details,
      timestamp: new Date(),
    });
  }

  private notifyListeners(buildId: string, event: any): void {
    const listeners = this.listeners.get(buildId);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (err) {
          console.error('[BuildOrchestrator] Listener error:', err);
        }
      });
    }
  }

  private async executeBuild(build: BuildProgress): Promise<void> {
    // Simulate build execution
    // In production, this would orchestrate actual build steps
    for (const phase of build.phases) {
      if (build.status !== 'in_progress') break;

      while (build.status === 'paused') {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (build.status === 'cancelled') break;

      // Simulate phase progress
      for (let progress = 0; progress <= 100; progress += 10) {
        if (build.status !== 'in_progress') break;
        this.updatePhaseProgress(build.id, phase.phase, progress);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (build.status === 'in_progress') {
        await this.completePhase(build.id, phase.phase);
      }
    }

    if (build.status === 'in_progress') {
      build.status = 'completed';
      build.completedAt = new Date();
      build.metrics.totalDuration = build.completedAt.getTime() - build.createdAt.getTime();

      eventBus.emit('build.completed', createPayload('BuildOrchestrator', {
        buildId: build.id,
        duration: build.metrics.totalDuration,
      }));
    }
  }

  private async executeDeployment(deployment: Deployment): Promise<void> {
    deployment.status = 'building';
    deployment.logs.push(`[${new Date().toISOString()}] Starting deployment...`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    deployment.status = 'deploying';
    deployment.logs.push(`[${new Date().toISOString()}] Deploying to ${deployment.environment}...`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    deployment.status = 'live';
    deployment.url = `https://${deployment.environment}.example.com`;
    deployment.completedAt = new Date();
    deployment.logs.push(`[${new Date().toISOString()}] Deployment complete: ${deployment.url}`);

    eventBus.emit('deployment.completed', createPayload('BuildOrchestrator', {
      deploymentId: deployment.id,
      buildId: deployment.buildId,
      url: deployment.url,
    }));
  }

  private handleBuildError(buildId: string, error: Error): void {
    const build = this.builds.get(buildId);
    if (!build) return;

    build.status = 'failed';
    build.updatedAt = new Date();
    this.addTimelineEvent(build, 'error', `Build failed: ${error.message}`);

    const currentPhase = build.phases.find(p => p.phase === build.currentPhase);
    if (currentPhase) {
      currentPhase.status = 'failed';
      currentPhase.error = error.message;
    }

    eventBus.emit('build.failed', createPayload('BuildOrchestrator', {
      buildId,
      error: error.message,
      phase: build.currentPhase,
    }));
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const { getInstance: getBuildOrchestrator, instance: buildOrchestrator } =
  createSingleton(() => new BuildOrchestratorImpl(), { name: 'BuildOrchestrator' });

export default buildOrchestrator;
