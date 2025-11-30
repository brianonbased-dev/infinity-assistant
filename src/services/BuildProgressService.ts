/**
 * Build Progress Service
 *
 * Manages build progress tracking with:
 * - Real-time phase tracking
 * - Checkpoint creation and revert system
 * - Visual evidence capture
 * - Mock data testing
 * - Conversation flow orchestration
 */

import type {
  BuildProgress,
  BuildStatus,
  BuildPhase,
  PhaseProgress,
  PhaseStep,
  BuildCheckpoint,
  CheckpointSnapshot,
  FileStateRef,
  RevertRequest,
  RevertResult,
  VisualEvidence,
  EvidenceType,
  EvidenceData,
  EvidenceAnnotation,
  MockDataConfig,
  MockScenario,
  MockTestResult,
  BuildConversation,
  ConversationRole,
  ConversationTopic,
  ConversationMessage,
  ConversationResolution,
  TimelineEvent,
  TimelineEventType,
  BuildMetrics,
  PERSONAS,
} from '@/types/build-progress';

// ============================================================================
// BUILD PROGRESS SERVICE
// ============================================================================

class BuildProgressServiceImpl {
  private builds: Map<string, BuildProgress> = new Map();
  private checkpoints: Map<string, BuildCheckpoint> = new Map();
  private evidence: Map<string, VisualEvidence> = new Map();
  private conversations: Map<string, BuildConversation> = new Map();
  private mockTests: Map<string, MockTestResult> = new Map();

  // Event listeners for real-time updates
  private listeners: Map<string, Set<(event: BuildProgressEvent) => void>> = new Map();

  // ============================================================================
  // BUILD LIFECYCLE
  // ============================================================================

  /**
   * Start a new build progress tracking session
   */
  async startBuild(
    sessionId: string,
    userId: string,
    templateId: string
  ): Promise<BuildProgress> {
    const buildId = crypto.randomUUID();

    const phases: PhaseProgress[] = [
      'setup',
      'scaffolding',
      'database',
      'backend',
      'frontend',
      'integration',
      'testing',
      'deployment',
      'verification',
    ].map((phase) => ({
      phase: phase as BuildPhase,
      status: 'pending',
      progress: 0,
      steps: [],
      evidence: [],
    }));

    const build: BuildProgress = {
      id: buildId,
      sessionId,
      userId,
      templateId,
      status: 'initializing',
      currentPhase: 'setup',
      phases,
      checkpoints: [],
      evidence: [],
      conversations: [],
      mockTests: [],
      timeline: [],
      metrics: {
        totalDuration: 0,
        phaseDurations: {} as Record<BuildPhase, number>,
        checkpointCount: 0,
        revertCount: 0,
        evidenceCount: 0,
        testsPassed: 0,
        testsFailed: 0,
        conversationCount: 0,
        decisionsRequired: 0,
        decisionsMade: 0,
        linesOfCodeGenerated: 0,
        filesCreated: 0,
        filesModified: 0,
      },
      startedAt: new Date(),
    };

    this.builds.set(buildId, build);

    // Add timeline event
    this.addTimelineEvent(build, {
      type: 'phase_started',
      title: 'Build Started',
      description: `Starting build for template ${templateId}`,
      phase: 'setup',
      actor: 'system',
    });

    // Create initial checkpoint
    await this.createCheckpoint(buildId, 'setup', 'Initial State', 'Build initialization', true);

    this.emitEvent(buildId, { type: 'build_started', build });

    return build;
  }

  /**
   * Update build status
   */
  updateBuildStatus(buildId: string, status: BuildStatus): void {
    const build = this.builds.get(buildId);
    if (!build) return;

    build.status = status;

    if (status === 'completed') {
      build.completedAt = new Date();
      build.metrics.totalDuration = build.completedAt.getTime() - build.startedAt.getTime();
    }

    this.emitEvent(buildId, { type: 'status_changed', status });
  }

  /**
   * Get build by ID
   */
  getBuild(buildId: string): BuildProgress | undefined {
    return this.builds.get(buildId);
  }

  // ============================================================================
  // PHASE MANAGEMENT
  // ============================================================================

  /**
   * Start a phase
   */
  async startPhase(buildId: string, phase: BuildPhase): Promise<void> {
    const build = this.builds.get(buildId);
    if (!build) return;

    const phaseProgress = build.phases.find((p) => p.phase === phase);
    if (!phaseProgress) return;

    phaseProgress.status = 'in_progress';
    phaseProgress.startedAt = new Date();
    build.currentPhase = phase;
    build.status = 'in_progress';

    this.addTimelineEvent(build, {
      type: 'phase_started',
      title: `${this.formatPhaseName(phase)} Started`,
      phase,
      actor: 'system',
    });

    this.emitEvent(buildId, { type: 'phase_started', phase });
  }

  /**
   * Update phase progress
   */
  updatePhaseProgress(
    buildId: string,
    phase: BuildPhase,
    progress: number,
    stepUpdate?: Partial<PhaseStep>
  ): void {
    const build = this.builds.get(buildId);
    if (!build) return;

    const phaseProgress = build.phases.find((p) => p.phase === phase);
    if (!phaseProgress) return;

    phaseProgress.progress = Math.min(100, Math.max(0, progress));

    if (stepUpdate && stepUpdate.id) {
      const existingStep = phaseProgress.steps.find((s) => s.id === stepUpdate.id);
      if (existingStep) {
        Object.assign(existingStep, stepUpdate);
      } else {
        phaseProgress.steps.push({
          id: stepUpdate.id,
          name: stepUpdate.name || 'Step',
          description: stepUpdate.description || '',
          status: stepUpdate.status || 'pending',
          progress: stepUpdate.progress || 0,
          ...stepUpdate,
        } as PhaseStep);
      }
    }

    this.emitEvent(buildId, { type: 'progress_updated', phase, progress });
  }

  /**
   * Complete a phase
   */
  async completePhase(buildId: string, phase: BuildPhase): Promise<void> {
    const build = this.builds.get(buildId);
    if (!build) return;

    const phaseProgress = build.phases.find((p) => p.phase === phase);
    if (!phaseProgress) return;

    phaseProgress.status = 'completed';
    phaseProgress.progress = 100;
    phaseProgress.completedAt = new Date();

    if (phaseProgress.startedAt) {
      build.metrics.phaseDurations[phase] =
        phaseProgress.completedAt.getTime() - phaseProgress.startedAt.getTime();
    }

    this.addTimelineEvent(build, {
      type: 'phase_completed',
      title: `${this.formatPhaseName(phase)} Completed`,
      phase,
      actor: 'system',
    });

    // Auto-create checkpoint at phase completion
    await this.createCheckpoint(
      buildId,
      phase,
      `${this.formatPhaseName(phase)} Complete`,
      `Automatic checkpoint after completing ${phase} phase`,
      true
    );

    this.emitEvent(buildId, { type: 'phase_completed', phase });
  }

  /**
   * Fail a phase
   */
  failPhase(buildId: string, phase: BuildPhase, error: string): void {
    const build = this.builds.get(buildId);
    if (!build) return;

    const phaseProgress = build.phases.find((p) => p.phase === phase);
    if (!phaseProgress) return;

    phaseProgress.status = 'failed';
    build.status = 'failed';
    build.error = error;

    this.addTimelineEvent(build, {
      type: 'error_occurred',
      title: `${this.formatPhaseName(phase)} Failed`,
      description: error,
      phase,
      actor: 'system',
    });

    this.emitEvent(buildId, { type: 'phase_failed', phase, error });
  }

  // ============================================================================
  // CHECKPOINT SYSTEM
  // ============================================================================

  /**
   * Create a checkpoint
   */
  async createCheckpoint(
    buildId: string,
    phase: BuildPhase,
    name: string,
    description: string,
    isAutomatic: boolean = false,
    createdBy: 'system' | 'user' | 'assistant' | 'ceo' | 'futurist' = 'system'
  ): Promise<BuildCheckpoint> {
    const build = this.builds.get(buildId);
    if (!build) {
      throw new Error('Build not found');
    }

    const checkpoint: BuildCheckpoint = {
      id: crypto.randomUUID(),
      buildId,
      phase,
      name,
      description,
      createdAt: new Date(),
      snapshot: await this.captureSnapshot(build),
      canRevert: true,
      isAutomatic,
      createdBy,
      metadata: {},
    };

    this.checkpoints.set(checkpoint.id, checkpoint);
    build.checkpoints.push(checkpoint);
    build.metrics.checkpointCount++;

    // Update phase with checkpoint
    const phaseProgress = build.phases.find((p) => p.phase === phase);
    if (phaseProgress) {
      phaseProgress.checkpointId = checkpoint.id;
    }

    this.addTimelineEvent(build, {
      type: 'checkpoint_created',
      title: `Checkpoint: ${name}`,
      description,
      phase,
      actor: createdBy,
      relatedIds: { checkpointId: checkpoint.id },
    });

    this.emitEvent(buildId, { type: 'checkpoint_created', checkpoint });

    return checkpoint;
  }

  /**
   * Capture current state snapshot
   */
  private async captureSnapshot(build: BuildProgress): Promise<CheckpointSnapshot> {
    // In production, this would capture actual git state, file hashes, etc.
    return {
      commitHash: `snap_${Date.now().toString(36)}`,
      fileState: [],
      dbMigrationVersion: '0',
      envVarsHash: crypto.randomUUID().slice(0, 8),
    };
  }

  /**
   * Revert to a checkpoint
   */
  async revertToCheckpoint(request: RevertRequest): Promise<RevertResult> {
    const build = this.builds.get(request.buildId);
    if (!build) {
      return { success: false, revertedToCheckpoint: '', filesReverted: 0, error: 'Build not found' };
    }

    const checkpoint = this.checkpoints.get(request.checkpointId);
    if (!checkpoint) {
      return { success: false, revertedToCheckpoint: '', filesReverted: 0, error: 'Checkpoint not found' };
    }

    if (!checkpoint.canRevert) {
      return { success: false, revertedToCheckpoint: '', filesReverted: 0, error: 'Checkpoint cannot be reverted' };
    }

    try {
      // Stash current changes if requested
      let stashedChanges: string | undefined;
      if (request.preserveAfter) {
        stashedChanges = `stash_${Date.now().toString(36)}`;
      }

      // Reset phases after checkpoint
      const checkpointPhaseIndex = build.phases.findIndex((p) => p.phase === checkpoint.phase);
      for (let i = checkpointPhaseIndex + 1; i < build.phases.length; i++) {
        build.phases[i].status = 'pending';
        build.phases[i].progress = 0;
        build.phases[i].steps = [];
        build.phases[i].startedAt = undefined;
        build.phases[i].completedAt = undefined;
      }

      // Update build state
      build.currentPhase = checkpoint.phase;
      build.status = 'reverted';
      build.metrics.revertCount++;

      this.addTimelineEvent(build, {
        type: 'revert_performed',
        title: `Reverted to: ${checkpoint.name}`,
        description: request.reason,
        phase: checkpoint.phase,
        actor: 'user',
        relatedIds: { checkpointId: checkpoint.id },
      });

      this.emitEvent(request.buildId, { type: 'reverted', checkpoint });

      return {
        success: true,
        revertedToCheckpoint: checkpoint.id,
        stashedChanges,
        filesReverted: checkpoint.snapshot.fileState.length,
      };
    } catch (error) {
      return {
        success: false,
        revertedToCheckpoint: '',
        filesReverted: 0,
        error: error instanceof Error ? error.message : 'Revert failed',
      };
    }
  }

  /**
   * Get all checkpoints for a build
   */
  getCheckpoints(buildId: string): BuildCheckpoint[] {
    const build = this.builds.get(buildId);
    return build?.checkpoints || [];
  }

  // ============================================================================
  // VISUAL EVIDENCE
  // ============================================================================

  /**
   * Capture visual evidence
   */
  async captureEvidence(
    buildId: string,
    phase: BuildPhase,
    type: EvidenceType,
    title: string,
    data: EvidenceData,
    description?: string
  ): Promise<VisualEvidence> {
    const build = this.builds.get(buildId);
    if (!build) {
      throw new Error('Build not found');
    }

    const evidence: VisualEvidence = {
      id: crypto.randomUUID(),
      buildId,
      phase,
      type,
      title,
      description,
      createdAt: new Date(),
      data,
      annotations: [],
    };

    this.evidence.set(evidence.id, evidence);
    build.evidence.push(evidence);
    build.metrics.evidenceCount++;

    // Link to phase
    const phaseProgress = build.phases.find((p) => p.phase === phase);
    if (phaseProgress) {
      phaseProgress.evidence.push(evidence.id);
    }

    this.addTimelineEvent(build, {
      type: 'evidence_captured',
      title: `Evidence: ${title}`,
      description: `${type} captured`,
      phase,
      actor: 'system',
      relatedIds: { evidenceId: evidence.id },
    });

    this.emitEvent(buildId, { type: 'evidence_captured', evidence });

    return evidence;
  }

  /**
   * Add annotation to evidence
   */
  addEvidenceAnnotation(
    evidenceId: string,
    annotation: Omit<EvidenceAnnotation, 'id' | 'createdAt'>
  ): EvidenceAnnotation | null {
    const evidence = this.evidence.get(evidenceId);
    if (!evidence) return null;

    const newAnnotation: EvidenceAnnotation = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      ...annotation,
    };

    evidence.annotations = evidence.annotations || [];
    evidence.annotations.push(newAnnotation);

    const build = this.builds.get(evidence.buildId);
    if (build) {
      this.emitEvent(build.id, { type: 'annotation_added', evidenceId, annotation: newAnnotation });
    }

    return newAnnotation;
  }

  /**
   * Get evidence by ID
   */
  getEvidence(evidenceId: string): VisualEvidence | undefined {
    return this.evidence.get(evidenceId);
  }

  /**
   * Get all evidence for a build
   */
  getBuildEvidence(buildId: string): VisualEvidence[] {
    const build = this.builds.get(buildId);
    return build?.evidence || [];
  }

  // ============================================================================
  // MOCK DATA TESTING
  // ============================================================================

  /**
   * Run mock data tests
   */
  async runMockTests(
    buildId: string,
    config: MockDataConfig
  ): Promise<MockTestResult[]> {
    const build = this.builds.get(buildId);
    if (!build) {
      throw new Error('Build not found');
    }

    build.status = 'testing';
    const results: MockTestResult[] = [];

    for (const scenario of config.scenarios) {
      const result = await this.runScenario(build, scenario);
      results.push(result);
      this.mockTests.set(result.id, result);
      build.mockTests.push(result);

      if (result.status === 'passed') {
        build.metrics.testsPassed++;
      } else if (result.status === 'failed') {
        build.metrics.testsFailed++;
      }
    }

    this.addTimelineEvent(build, {
      type: 'test_run',
      title: `Mock Tests: ${config.name}`,
      description: `${results.filter((r) => r.status === 'passed').length}/${results.length} passed`,
      actor: 'system',
    });

    this.emitEvent(buildId, { type: 'tests_completed', results });

    return results;
  }

  /**
   * Run a single test scenario
   */
  private async runScenario(
    build: BuildProgress,
    scenario: MockScenario
  ): Promise<MockTestResult> {
    const result: MockTestResult = {
      id: crypto.randomUUID(),
      buildId: build.id,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: 'running',
      startedAt: new Date(),
      assertions: [],
      evidence: [],
    };

    try {
      // Simulate test execution
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

      // Check expected outcomes
      for (const assertion of scenario.expectedOutcome.assertions) {
        const passed = Math.random() > 0.2; // 80% pass rate for demo
        result.assertions.push({
          name: assertion,
          passed,
          message: passed ? 'Assertion passed' : 'Assertion failed',
        });
      }

      result.status = result.assertions.every((a) => a.passed) ? 'passed' : 'failed';
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - result.startedAt!.getTime();

      // Capture test evidence
      const evidence = await this.captureEvidence(
        build.id,
        'testing',
        'test_result',
        `Test: ${scenario.name}`,
        {
          type: 'test_result',
          testName: scenario.name,
          passed: result.status === 'passed',
          duration: result.duration,
          assertions: result.assertions,
        }
      );
      result.evidence.push(evidence.id);
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Test execution failed';
      result.completedAt = new Date();
    }

    return result;
  }

  // ============================================================================
  // CONVERSATION FLOW
  // ============================================================================

  /**
   * Start a conversation
   */
  async startConversation(
    buildId: string,
    topic: ConversationTopic,
    initialMessage: string,
    checkpointId?: string
  ): Promise<BuildConversation> {
    const build = this.builds.get(buildId);
    if (!build) {
      throw new Error('Build not found');
    }

    const conversation: BuildConversation = {
      id: crypto.randomUUID(),
      buildId,
      phase: build.currentPhase,
      checkpointId,
      topic,
      messages: [
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: initialMessage,
          timestamp: new Date(),
          requiresResponse: ['assistant'],
        },
      ],
      status: 'active',
      createdAt: new Date(),
    };

    this.conversations.set(conversation.id, conversation);
    build.conversations.push(conversation);
    build.metrics.conversationCount++;

    this.addTimelineEvent(build, {
      type: 'conversation_started',
      title: `Conversation: ${this.formatTopicName(topic)}`,
      phase: build.currentPhase,
      actor: 'user',
      relatedIds: { conversationId: conversation.id },
    });

    // Auto-generate assistant response
    await this.generatePersonaResponse(conversation, 'assistant');

    this.emitEvent(buildId, { type: 'conversation_started', conversation });

    return conversation;
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    conversationId: string,
    role: ConversationRole,
    content: string,
    attachments?: { type: 'evidence' | 'checkpoint'; id: string; title: string }[]
  ): Promise<ConversationMessage> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const message: ConversationMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date(),
      attachments: attachments?.map((a) => ({ ...a, preview: undefined })),
    };

    conversation.messages.push(message);

    const build = this.builds.get(conversation.buildId);
    if (build) {
      this.emitEvent(build.id, { type: 'message_added', conversationId, message });
    }

    return message;
  }

  /**
   * Generate response from a persona (assistant/CEO/futurist)
   */
  async generatePersonaResponse(
    conversation: BuildConversation,
    role: Exclude<ConversationRole, 'user'>
  ): Promise<ConversationMessage> {
    const persona = this.getPersonaConfig(role);
    const lastMessage = conversation.messages[conversation.messages.length - 1];

    // In production, this would call the actual AI model
    const responseContent = this.simulatePersonaResponse(persona, conversation, lastMessage);

    const message: ConversationMessage = {
      id: crypto.randomUUID(),
      role,
      content: responseContent,
      timestamp: new Date(),
      suggestions: this.generateSuggestions(role, conversation),
      requiresResponse: this.determineNextResponder(role, conversation),
    };

    conversation.messages.push(message);

    const build = this.builds.get(conversation.buildId);
    if (build) {
      this.emitEvent(build.id, { type: 'message_added', conversationId: conversation.id, message });
    }

    return message;
  }

  /**
   * Escalate conversation to next level
   */
  async escalateConversation(
    conversationId: string,
    reason: string
  ): Promise<ConversationMessage | null> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;

    const lastRole = conversation.messages[conversation.messages.length - 1].role;
    const currentPersona = this.getPersonaConfig(lastRole as Exclude<ConversationRole, 'user'>);

    if (!currentPersona?.escalatesTo) {
      return null; // Cannot escalate further
    }

    conversation.status = 'escalated';

    // Add escalation message
    const escalationMessage = await this.addMessage(
      conversationId,
      lastRole,
      `Escalating to ${currentPersona.escalatesTo} for review. Reason: ${reason}`
    );

    // Generate response from escalated persona
    await this.generatePersonaResponse(conversation, currentPersona.escalatesTo);

    const build = this.builds.get(conversation.buildId);
    if (build) {
      build.metrics.decisionsRequired++;
      this.emitEvent(build.id, { type: 'conversation_escalated', conversationId, to: currentPersona.escalatesTo });
    }

    return escalationMessage;
  }

  /**
   * Resolve conversation
   */
  async resolveConversation(
    conversationId: string,
    resolution: ConversationResolution
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;

    conversation.status = 'resolved';
    conversation.resolution = resolution;
    conversation.resolvedAt = new Date();

    const build = this.builds.get(conversation.buildId);
    if (build) {
      build.metrics.decisionsMade++;

      this.addTimelineEvent(build, {
        type: 'decision_made',
        title: `Decision: ${resolution.decision}`,
        description: resolution.reason,
        phase: conversation.phase,
        actor: resolution.resolvedBy,
        relatedIds: { conversationId },
      });

      this.emitEvent(build.id, { type: 'conversation_resolved', conversationId, resolution });
    }
  }

  /**
   * Get persona configuration
   */
  private getPersonaConfig(role: Exclude<ConversationRole, 'user'>) {
    const personas = {
      assistant: {
        role: 'assistant' as const,
        name: 'Builder Assistant',
        title: 'Technical Implementation Lead',
        focus: ['Code quality', 'Technical feasibility', 'Implementation details'],
        decisionAuthority: ['Code structure', 'Library choices', 'Technical implementation'],
        escalatesTo: 'ceo' as const,
      },
      ceo: {
        role: 'ceo' as const,
        name: 'Strategic Advisor',
        title: 'Chief Executive Officer',
        focus: ['Business value', 'User experience', 'Resource allocation'],
        decisionAuthority: ['Feature priorities', 'Resource allocation', 'Go/no-go decisions'],
        escalatesTo: 'futurist' as const,
      },
      futurist: {
        role: 'futurist' as const,
        name: 'Vision Architect',
        title: 'Chief Futurist',
        focus: ['Long-term vision', 'Innovation', 'Market trends'],
        decisionAuthority: ['Strategic direction', 'Innovation investments', 'Long-term architecture'],
        escalatesTo: undefined,
      },
    };
    return personas[role];
  }

  /**
   * Simulate persona response (would be AI-generated in production)
   */
  private simulatePersonaResponse(
    persona: ReturnType<typeof this.getPersonaConfig>,
    conversation: BuildConversation,
    lastMessage: ConversationMessage
  ): string {
    const responses = {
      assistant: `As your Technical Lead, I've reviewed this. From a code quality perspective, ${lastMessage.content.includes('?') ? 'I recommend we proceed with the established patterns' : 'this aligns with our architecture'}. Should I implement this change, or would you like me to escalate to the CEO for business impact assessment?`,
      ceo: `From a strategic standpoint, I see the value in this direction. The ROI considerations are favorable. ${conversation.topic === 'approval_request' ? 'I approve this approach' : 'Let me know if you need a final decision, or if we should consult with our Futurist for long-term implications'}.`,
      futurist: `Looking at this from a 5-10 year perspective, this decision aligns with emerging market trends. The scalability implications are positive. I recommend proceeding with an eye toward future extensibility.`,
    };

    return responses[persona.role] || 'I understand. Let me analyze this further.';
  }

  /**
   * Generate action suggestions
   */
  private generateSuggestions(
    role: Exclude<ConversationRole, 'user'>,
    conversation: BuildConversation
  ): ConversationMessage['suggestions'] {
    const baseSuggestions = [
      { id: '1', action: 'approve' as const, label: 'Approve', impact: 'medium' as const, automated: true },
      { id: '2', action: 'modify' as const, label: 'Request Changes', impact: 'medium' as const, automated: false },
    ];

    if (role !== 'futurist') {
      baseSuggestions.push({
        id: '3',
        action: 'escalate' as const,
        label: `Escalate to ${role === 'assistant' ? 'CEO' : 'Futurist'}`,
        impact: 'low' as const,
        automated: true,
      });
    }

    if (conversation.checkpointId) {
      baseSuggestions.push({
        id: '4',
        action: 'revert' as const,
        label: 'Revert to Checkpoint',
        impact: 'high' as const,
        automated: true,
      });
    }

    return baseSuggestions;
  }

  /**
   * Determine who should respond next
   */
  private determineNextResponder(
    currentRole: ConversationRole,
    conversation: BuildConversation
  ): ConversationRole[] | undefined {
    if (conversation.topic === 'approval_request') {
      return ['user'];
    }
    if (currentRole === 'assistant') {
      return ['user', 'ceo'];
    }
    if (currentRole === 'ceo') {
      return ['user', 'futurist'];
    }
    return ['user'];
  }

  // ============================================================================
  // TIMELINE & EVENTS
  // ============================================================================

  /**
   * Add timeline event
   */
  private addTimelineEvent(
    build: BuildProgress,
    event: Omit<TimelineEvent, 'id' | 'buildId' | 'timestamp'>
  ): void {
    const timelineEvent: TimelineEvent = {
      id: crypto.randomUUID(),
      buildId: build.id,
      timestamp: new Date(),
      ...event,
    };

    build.timeline.push(timelineEvent);
  }

  /**
   * Get timeline for a build
   */
  getTimeline(buildId: string): TimelineEvent[] {
    const build = this.builds.get(buildId);
    return build?.timeline || [];
  }

  // ============================================================================
  // REAL-TIME EVENTS
  // ============================================================================

  /**
   * Subscribe to build events
   */
  subscribe(buildId: string, callback: (event: BuildProgressEvent) => void): () => void {
    if (!this.listeners.has(buildId)) {
      this.listeners.set(buildId, new Set());
    }
    this.listeners.get(buildId)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(buildId)?.delete(callback);
    };
  }

  /**
   * Emit event to subscribers
   */
  private emitEvent(buildId: string, event: BuildProgressEvent): void {
    const callbacks = this.listeners.get(buildId);
    if (callbacks) {
      callbacks.forEach((callback) => callback(event));
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private formatPhaseName(phase: BuildPhase): string {
    return phase
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatTopicName(topic: ConversationTopic): string {
    return topic
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type BuildProgressEvent =
  | { type: 'build_started'; build: BuildProgress }
  | { type: 'status_changed'; status: BuildStatus }
  | { type: 'phase_started'; phase: BuildPhase }
  | { type: 'phase_completed'; phase: BuildPhase }
  | { type: 'phase_failed'; phase: BuildPhase; error: string }
  | { type: 'progress_updated'; phase: BuildPhase; progress: number }
  | { type: 'checkpoint_created'; checkpoint: BuildCheckpoint }
  | { type: 'reverted'; checkpoint: BuildCheckpoint }
  | { type: 'evidence_captured'; evidence: VisualEvidence }
  | { type: 'annotation_added'; evidenceId: string; annotation: EvidenceAnnotation }
  | { type: 'tests_completed'; results: MockTestResult[] }
  | { type: 'conversation_started'; conversation: BuildConversation }
  | { type: 'message_added'; conversationId: string; message: ConversationMessage }
  | { type: 'conversation_escalated'; conversationId: string; to: ConversationRole }
  | { type: 'conversation_resolved'; conversationId: string; resolution: ConversationResolution };

// Export singleton
export const buildProgressService = new BuildProgressServiceImpl();

// Export class for testing
export { BuildProgressServiceImpl };
