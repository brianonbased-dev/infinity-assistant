/**
 * Unified Build Orchestrator
 *
 * Consolidates BuildProgressService, UnifiedBuildOrchestrator, CodeGenOrchestrator.
 * Single entry point for all build-related operations.
 */

import { createSingleton } from '../createSingleton';
import { getCache } from '../CacheService';
import { eventBus } from '../EventBus';
import { getUnifiedLLMClient } from '../llm/UnifiedLLMClient';
import { packetEnhancerService, type BuildEnhancement } from '../../services/PacketEnhancerService';
import { masterRpcClient, type KnowledgePacket } from '../../services/MasterRpcClient';

// Helper to emit events without strict typing (for build orchestrator)
const emitBuildEvent = (event: string, data: Record<string, unknown>) => {
  (eventBus as any).emit(event, { source: 'BuildOrchestrator', timestamp: Date.now(), ...data });
};
import type {
  BuildRequest,
  BuildProgress,
  BuildPhase,
  PhaseProgress,
  StepProgress,
  BuildCheckpoint,
  CodeGenRequest,
  CodeGenResult,
  CodeWarning,
  CodeSuggestion,
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

  // Knowledge packet enhancements per session
  private sessionEnhancements = new Map<string, BuildEnhancement>();
  private sessionPackets = new Map<string, KnowledgePacket[]>();

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

    emitBuildEvent('build.started' as any, {
      source: 'BuildOrchestrator',
      timestamp: Date.now(),
      buildId,
      userId: request.userId,
      projectType: request.type,
    } as any);

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

    emitBuildEvent('build.paused', { buildId });

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

    emitBuildEvent('build.resumed', { buildId });

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

    emitBuildEvent('build.cancelled', { buildId });

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

    emitBuildEvent('build.phase_completed', {
      buildId,
      phase,
      nextPhase,
    });
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
  // Knowledge Packet Enhancement
  // ============================================================================

  /**
   * Load and apply knowledge packets for a build session
   * Call this before starting code generation to enhance with user's applied packets
   */
  async loadSessionEnhancements(sessionId: string, userId: string): Promise<BuildEnhancement | null> {
    try {
      // Get user's applied packets for build mode
      const appliedPackets = await masterRpcClient.getUserAppliedPackets('build');

      if (appliedPackets.build.length === 0) {
        console.log('[BuildOrchestrator] No build packets applied for user');
        return null;
      }

      // Store packets for this session
      this.sessionPackets.set(sessionId, appliedPackets.build);

      // Apply enhancements using the packet enhancer service
      const enhancement = await packetEnhancerService.enhanceBuildMode(sessionId, appliedPackets.build);
      this.sessionEnhancements.set(sessionId, enhancement);

      emitBuildEvent('packets.applied', {
        sessionId,
        userId,
        packetCount: appliedPackets.build.length,
        patternsAdded: enhancement.patternsAdded,
        templatesAdded: enhancement.templatesAdded,
      });

      console.log('[BuildOrchestrator] Applied build enhancements:', {
        patterns: enhancement.patterns.length,
        templates: enhancement.templates.length,
        guidance: enhancement.architecturalGuidance.length,
      });

      return enhancement;
    } catch (error) {
      console.error('[BuildOrchestrator] Failed to load session enhancements:', error);
      return null;
    }
  }

  /**
   * Get enhancement context for LLM prompts
   * Returns formatted context from applied knowledge packets
   */
  getEnhancementContext(sessionId: string): string {
    return packetEnhancerService.getBuildPromptContext(sessionId);
  }

  /**
   * Get code patterns for a specific language from applied packets
   */
  getAppliedPatterns(sessionId: string, language?: string) {
    return packetEnhancerService.getPatterns(sessionId, language);
  }

  /**
   * Get code templates from applied packets
   */
  getAppliedTemplates(sessionId: string, language?: string) {
    return packetEnhancerService.getTemplates(sessionId, language);
  }

  /**
   * Clear session enhancements when build is complete
   */
  clearSessionEnhancements(sessionId: string): void {
    this.sessionEnhancements.delete(sessionId);
    this.sessionPackets.delete(sessionId);
    packetEnhancerService.clearSession(sessionId);
  }

  // ============================================================================
  // Code Generation
  // ============================================================================

  /**
   * Generate code for a request using Unified LLM Service
   * Enhanced with knowledge packets when available
   */
  async generateCode(request: CodeGenRequest, sessionId?: string): Promise<CodeGenResult> {
    const startTime = Date.now();

    try {
      // Use the Unified LLM Client for real AI-powered code generation
      const llmClient = getUnifiedLLMClient();

      // Check if LLM is available
      const isAvailable = await llmClient.healthCheck();

      if (isAvailable) {
        // Get packet enhancement context if session has applied packets
        let enhancedContext = request.context || '';
        if (sessionId) {
          const packetContext = this.getEnhancementContext(sessionId);
          if (packetContext) {
            enhancedContext = `${packetContext}\n\n${enhancedContext}`;
            console.log('[BuildOrchestrator] Enhanced code gen with packet context');
          }

          // Add relevant patterns as hints
          const patterns = this.getAppliedPatterns(sessionId, request.language);
          if (patterns.length > 0) {
            const patternHints = patterns.map(p => `- ${p.name}: ${p.description}`).join('\n');
            enhancedContext = `[Available Patterns for ${request.language}:\n${patternHints}]\n\n${enhancedContext}`;
          }
        }

        // Generate code using the LLM with enhanced context
        const llmResult = await llmClient.generateCode({
          intent: request.intent,
          language: request.language,
          framework: request.framework,
          context: enhancedContext,
          existingCode: request.existingCode,
        });

        emitBuildEvent('code.generated', {
          language: request.language,
          framework: request.framework,
          success: llmResult.success,
          provider: llmResult.metadata.provider,
          tokensUsed: llmResult.metadata.tokensUsed,
        });

        return {
          success: llmResult.success,
          code: llmResult.code,
          explanation: llmResult.explanation,
          warnings: llmResult.warnings,
          suggestions: llmResult.suggestions,
          metadata: {
            requestId: llmResult.metadata.requestId,
            tokensUsed: llmResult.metadata.tokensUsed,
            generationTime: llmResult.metadata.generationTime,
          },
        };
      }

      // Fallback to template-based generation if LLM unavailable
      console.warn('[BuildOrchestrator] LLM unavailable, using template fallback');
      return this.generateCodeFromTemplate(request, startTime);

    } catch (error) {
      console.error('[BuildOrchestrator] Code generation error:', error);

      // Fallback on error
      return this.generateCodeFromTemplate(request, startTime, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Fallback template-based code generation when LLM is unavailable
   */
  private generateCodeFromTemplate(
    request: CodeGenRequest,
    startTime: number,
    errorMessage?: string
  ): CodeGenResult {
    const templates: Record<string, string> = {
      typescript: `/**
 * ${request.intent}
 *
 * Generated by Infinity Builder
 * Language: ${request.language}
 * Framework: ${request.framework || 'none'}
 */

// TODO: Implement ${request.intent}
export function main() {
  console.log('Implementation pending');
}

export default main;
`,
      javascript: `/**
 * ${request.intent}
 *
 * Generated by Infinity Builder
 */

// TODO: Implement ${request.intent}
function main() {
  console.log('Implementation pending');
}

module.exports = { main };
`,
      python: `"""
${request.intent}

Generated by Infinity Builder
"""

def main():
    # TODO: Implement ${request.intent}
    print("Implementation pending")

if __name__ == "__main__":
    main()
`,
    };

    const code = templates[request.language] || templates.typescript;

    emitBuildEvent('code.generated', {
      language: request.language,
      framework: request.framework,
      success: true,
      fallback: true,
    });

    const warnings: CodeWarning[] = errorMessage
      ? [
          { type: 'compatibility', severity: 'warning', message: `LLM code generation failed: ${errorMessage}` },
          { type: 'style', severity: 'info', message: 'Using template fallback - manual implementation required' },
        ]
      : [
          { type: 'compatibility', severity: 'info', message: 'LLM service unavailable - using template fallback' },
          { type: 'style', severity: 'info', message: 'Manual implementation required' },
        ];

    const suggestions: CodeSuggestion[] = [
      {
        type: 'improvement',
        title: 'Implement main logic',
        description: `Replace the TODO with actual implementation for: ${request.intent}`,
        impact: 'high',
      },
      {
        type: 'best_practice',
        title: 'Add error handling',
        description: 'Consider adding try-catch blocks for async operations',
        impact: 'medium',
      },
      {
        type: 'improvement',
        title: 'Add unit tests',
        description: 'Create unit tests for the generated code',
        impact: 'medium',
      },
    ];

    return {
      success: true,
      code,
      explanation: errorMessage
        ? `Template-based code generated (LLM error: ${errorMessage}). Please implement the actual logic.`
        : `Template-based code generated. LLM service unavailable - please implement the actual logic for: ${request.intent}`,
      warnings,
      suggestions,
      metadata: {
        requestId: `codegen_${Date.now()}`,
        tokensUsed: 0,
        generationTime: Date.now() - startTime,
      },
    };
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

    emitBuildEvent('deployment.started', {
      deploymentId: deployment.id,
      buildId,
      environment,
    });

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
      if ((build.status as string) !== 'in_progress') break;

      while ((build.status as string) === 'paused') {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if ((build.status as string) === 'cancelled') break;

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

      emitBuildEvent('build.completed', {
        buildId: build.id,
        duration: build.metrics.totalDuration,
      });
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

    emitBuildEvent('deployment.completed', {
      deploymentId: deployment.id,
      buildId: deployment.buildId,
      url: deployment.url,
    });
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

    emitBuildEvent('build.failed', {
      buildId,
      error: error.message,
      phase: build.currentPhase,
    });
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

const buildOrchestratorAccessor = createSingleton(() => new BuildOrchestratorImpl(), { name: 'BuildOrchestrator' });

export const getBuildOrchestrator = buildOrchestratorAccessor;
export const buildOrchestrator = buildOrchestratorAccessor();

export default buildOrchestrator;
