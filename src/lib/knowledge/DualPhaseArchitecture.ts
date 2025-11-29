/**
 * Dual Phase Architecture
 *
 * Like humans have an internal monologue while speaking externally,
 * the assistant operates on TWO simultaneous phase tracks:
 *
 * 1. INTERNAL COGNITIVE PHASES (Background - for agent thinking & training)
 *    - How the agent processes, learns, and evolves
 *    - Extracts knowledge for uAA2-service/QLLM training
 *    - Runs continuously in background
 *    - User doesn't see this directly
 *
 * 2. EXTERNAL DELIVERY PHASES (Foreground - for user communication)
 *    - How the agent communicates with the user
 *    - User-facing phase indicators
 *    - Stores user-relevant compressed memories locally
 *    - User can see and influence this
 *
 * Knowledge Extraction Split:
 * - User Knowledge: Personal facts, preferences, project context → Local storage
 * - Training Knowledge: Patterns, techniques, problem-solving → Database for QLLM
 *
 * Example Flow:
 * User asks: "How do I fix this React hook error?"
 *
 * INTERNAL (agent's mind):
 *   INTAKE → "Gathering: React error, hooks, user's code context"
 *   REFLECT → "Analyzing: This is a dependency array issue, common pattern"
 *   EXECUTE → "Formulating: Solution with explanation"
 *   COMPRESS → "Learning: P.REACT.HOOKS.01 - Dependency array gotcha"
 *
 * EXTERNAL (to user):
 *   INTAKE → "I see you're having a React hooks issue..."
 *   EXECUTE → "Here's how to fix it: [solution]"
 *   (User doesn't see REFLECT/COMPRESS - that's internal)
 */

import type { UAA2Phase } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Internal cognitive state - the agent's "inner voice"
 */
export interface InternalCognitiveState {
  // Current thinking phase
  phase: UAA2Phase;
  phaseStartedAt: string;

  // What the agent is currently processing
  currentThought: string;

  // Gathered context
  context: {
    userIntent: string;
    relevantKnowledge: string[];
    identifiedPatterns: string[];
    potentialGotchas: string[];
  };

  // Learning in progress
  learning: {
    newWisdom: string[];
    newPatterns: string[];
    newGotchas: string[];
    confidenceScores: Record<string, number>;
  };

  // Processing metrics
  processingDepth: number; // 0-10, how deeply analyzed
  uncertaintyLevel: number; // 0-1, how uncertain about response
}

/**
 * External delivery state - what user sees/experiences
 */
export interface ExternalDeliveryState {
  // Current communication phase
  phase: 'listening' | 'thinking' | 'responding' | 'clarifying' | 'summarizing';
  phaseStartedAt: string;

  // User-facing status
  status: string; // "Understanding your question...", "Working on it...", etc.

  // What's being delivered
  delivery: {
    responseType: 'answer' | 'question' | 'suggestion' | 'action' | 'summary';
    confidence: 'high' | 'medium' | 'low';
    needsClarification: boolean;
  };

  // User engagement
  engagement: {
    questionsAsked: number;
    topicsExplored: string[];
    userSatisfactionSignals: string[];
  };
}

/**
 * Knowledge extraction result - split between user and training
 */
export interface KnowledgeExtractionResult {
  // For user's local storage (personal, editable)
  userKnowledge: {
    facts: Array<{
      content: string;
      category: 'personal' | 'project' | 'preference' | 'context';
      confidence: number;
    }>;
    preferences: Array<{
      key: string;
      value: string;
      inferred: boolean;
    }>;
    projectContext: Array<{
      name: string;
      detail: string;
      relevance: number;
    }>;
  };

  // For training database (patterns, techniques - anonymized)
  trainingKnowledge: {
    wisdom: Array<{
      content: string;
      domain: string;
      confidence: number;
    }>;
    patterns: Array<{
      name: string;
      description: string;
      applicability: string[];
      effectiveness: number;
    }>;
    gotchas: Array<{
      problem: string;
      solution: string;
      domain: string;
      frequency: number;
    }>;
    interactions: Array<{
      questionType: string;
      solutionApproach: string;
      success: boolean;
      phaseSequence: UAA2Phase[];
    }>;
  };
}

/**
 * Dual phase snapshot - complete state at any moment
 */
export interface DualPhaseSnapshot {
  timestamp: string;
  conversationId: string;
  messageIndex: number;

  internal: InternalCognitiveState;
  external: ExternalDeliveryState;

  // Sync status between phases
  sync: {
    internalAheadBy: number; // How many "thoughts" ahead internal is
    pendingDelivery: string[]; // What's waiting to be communicated
    suppressedInsights: string[]; // Internal insights not shared (too technical, etc.)
  };
}

// ============================================================================
// PHASE MAPPINGS
// ============================================================================

/**
 * How internal phases map to external delivery
 * Internal processing is more granular; external is simplified for user
 */
export const INTERNAL_TO_EXTERNAL_MAP: Record<UAA2Phase, ExternalDeliveryState['phase']> = {
  intake: 'listening',
  reflect: 'thinking',
  execute: 'responding',
  compress: 'thinking', // User doesn't see compression
  reintake: 'clarifying',
  grow: 'thinking', // Learning is internal
  evolve: 'thinking', // Evolution is internal
  autonomize: 'responding', // Autonomous actions appear as responses
};

/**
 * What to show user for each internal phase
 */
export const PHASE_USER_STATUS: Record<UAA2Phase, string> = {
  intake: 'Understanding your request...',
  reflect: 'Analyzing the problem...',
  execute: 'Working on your request...',
  compress: 'Processing...', // Vague - compression is internal
  reintake: 'Let me make sure I understand...',
  grow: 'Learning from this interaction...',
  evolve: 'Optimizing my approach...',
  autonomize: 'Taking action...',
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class DualPhaseOrchestrator {
  private static instance: DualPhaseOrchestrator;

  // Current states per conversation
  private internalStates = new Map<string, InternalCognitiveState>();
  private externalStates = new Map<string, ExternalDeliveryState>();
  private snapshots = new Map<string, DualPhaseSnapshot[]>();

  private constructor() {}

  static getInstance(): DualPhaseOrchestrator {
    if (!DualPhaseOrchestrator.instance) {
      DualPhaseOrchestrator.instance = new DualPhaseOrchestrator();
    }
    return DualPhaseOrchestrator.instance;
  }

  // ==========================================================================
  // INTERNAL COGNITIVE PHASE MANAGEMENT
  // ==========================================================================

  /**
   * Initialize internal cognitive state for a conversation
   */
  initializeInternal(conversationId: string): InternalCognitiveState {
    const state: InternalCognitiveState = {
      phase: 'intake',
      phaseStartedAt: new Date().toISOString(),
      currentThought: 'Awaiting input',
      context: {
        userIntent: '',
        relevantKnowledge: [],
        identifiedPatterns: [],
        potentialGotchas: [],
      },
      learning: {
        newWisdom: [],
        newPatterns: [],
        newGotchas: [],
        confidenceScores: {},
      },
      processingDepth: 0,
      uncertaintyLevel: 0.5,
    };

    this.internalStates.set(conversationId, state);
    return state;
  }

  /**
   * Process internal cognitive phase transition
   * This is the agent's "thinking" - happens continuously
   */
  async processInternalPhase(
    conversationId: string,
    input: {
      userMessage?: string;
      systemContext?: string;
      previousResponse?: string;
    }
  ): Promise<InternalCognitiveState> {
    let state = this.internalStates.get(conversationId);
    if (!state) {
      state = this.initializeInternal(conversationId);
    }

    const previousPhase = state.phase;

    // INTAKE: Gather and understand
    if (input.userMessage) {
      state.phase = 'intake';
      state.currentThought = `Processing: "${input.userMessage.slice(0, 100)}..."`;
      state.context.userIntent = this.extractIntent(input.userMessage);
      state.processingDepth = 1;
    }

    // REFLECT: Analyze and connect
    if (state.processingDepth >= 1 && state.phase === 'intake') {
      state.phase = 'reflect';
      state.currentThought = `Analyzing intent: ${state.context.userIntent}`;
      state.context.identifiedPatterns = this.identifyPatterns(input.userMessage || '');
      state.context.potentialGotchas = this.identifyGotchas(input.userMessage || '');
      state.processingDepth = 3;
    }

    // EXECUTE: Formulate response
    if (state.processingDepth >= 3 && state.phase === 'reflect') {
      state.phase = 'execute';
      state.currentThought = 'Formulating response...';
      state.uncertaintyLevel = this.calculateUncertainty(state.context);
      state.processingDepth = 5;
    }

    // COMPRESS: Extract learnings (background)
    if (state.processingDepth >= 5 && input.previousResponse) {
      state.phase = 'compress';
      state.currentThought = 'Extracting learnings...';

      // Extract what we learned from this interaction
      const learnings = this.extractLearnings(
        input.userMessage || '',
        input.previousResponse,
        state.context
      );

      state.learning.newWisdom.push(...learnings.wisdom);
      state.learning.newPatterns.push(...learnings.patterns);
      state.learning.newGotchas.push(...learnings.gotchas);

      state.processingDepth = 7;
    }

    // GROW: Integrate learnings
    if (state.processingDepth >= 7 && state.learning.newPatterns.length > 0) {
      state.phase = 'grow';
      state.currentThought = 'Integrating new knowledge...';
      state.processingDepth = 8;
    }

    // Record phase transition
    if (previousPhase !== state.phase) {
      this.recordSnapshot(conversationId, state);
    }

    this.internalStates.set(conversationId, state);
    return state;
  }

  /**
   * Get what the agent is "thinking" (for debugging/transparency)
   */
  getInternalThought(conversationId: string): string {
    const state = this.internalStates.get(conversationId);
    return state?.currentThought || 'Idle';
  }

  // ==========================================================================
  // EXTERNAL DELIVERY PHASE MANAGEMENT
  // ==========================================================================

  /**
   * Initialize external delivery state
   */
  initializeExternal(conversationId: string): ExternalDeliveryState {
    const state: ExternalDeliveryState = {
      phase: 'listening',
      phaseStartedAt: new Date().toISOString(),
      status: 'Ready to help',
      delivery: {
        responseType: 'answer',
        confidence: 'high',
        needsClarification: false,
      },
      engagement: {
        questionsAsked: 0,
        topicsExplored: [],
        userSatisfactionSignals: [],
      },
    };

    this.externalStates.set(conversationId, state);
    return state;
  }

  /**
   * Update external delivery phase based on internal state
   * This translates internal processing to user-facing state
   */
  updateExternalPhase(conversationId: string): ExternalDeliveryState {
    let external = this.externalStates.get(conversationId);
    if (!external) {
      external = this.initializeExternal(conversationId);
    }

    const internal = this.internalStates.get(conversationId);
    if (!internal) {
      return external;
    }

    // Map internal phase to external
    external.phase = INTERNAL_TO_EXTERNAL_MAP[internal.phase];
    external.status = PHASE_USER_STATUS[internal.phase];

    // Determine delivery confidence based on internal uncertainty
    if (internal.uncertaintyLevel > 0.7) {
      external.delivery.confidence = 'low';
      external.delivery.needsClarification = true;
    } else if (internal.uncertaintyLevel > 0.4) {
      external.delivery.confidence = 'medium';
    } else {
      external.delivery.confidence = 'high';
    }

    this.externalStates.set(conversationId, external);
    return external;
  }

  /**
   * Get user-facing status message
   */
  getUserStatus(conversationId: string): string {
    const external = this.externalStates.get(conversationId);
    return external?.status || 'Ready to help';
  }

  // ==========================================================================
  // KNOWLEDGE EXTRACTION (Split User vs Training)
  // ==========================================================================

  /**
   * Extract and split knowledge from conversation
   * User knowledge → Local storage (editable)
   * Training knowledge → Database (for QLLM)
   */
  extractKnowledge(
    conversationId: string,
    userMessage: string,
    assistantResponse: string
  ): KnowledgeExtractionResult {
    const result: KnowledgeExtractionResult = {
      userKnowledge: {
        facts: [],
        preferences: [],
        projectContext: [],
      },
      trainingKnowledge: {
        wisdom: [],
        patterns: [],
        gotchas: [],
        interactions: [],
      },
    };

    const combinedText = `${userMessage} ${assistantResponse}`.toLowerCase();
    const internal = this.internalStates.get(conversationId);

    // ==========================================================================
    // USER KNOWLEDGE EXTRACTION (Personal, stays local)
    // ==========================================================================

    // Personal facts (names, roles, etc.)
    const nameMatch = userMessage.match(/(?:my name is|i'm|i am)\s+(\w+)/i);
    if (nameMatch) {
      result.userKnowledge.facts.push({
        content: `User's name is ${nameMatch[1]}`,
        category: 'personal',
        confidence: 0.95,
      });
    }

    const roleMatch = userMessage.match(/(?:i work as|i'm a|i am a)\s+(.+?)(?:\.|,|$)/i);
    if (roleMatch) {
      result.userKnowledge.facts.push({
        content: `User works as: ${roleMatch[1]}`,
        category: 'personal',
        confidence: 0.9,
      });
    }

    // Project context
    const projectMatch = userMessage.match(/(?:my project|working on|building)\s+(?:is\s+)?(?:called\s+)?["']?(\w+)["']?/i);
    if (projectMatch) {
      result.userKnowledge.projectContext.push({
        name: projectMatch[1],
        detail: 'Project mentioned in conversation',
        relevance: 0.9,
      });
    }

    // Preferences (explicit)
    const prefMatch = userMessage.match(/(?:i prefer|i like|i always|i want)\s+(.+?)(?:\.|,|$)/i);
    if (prefMatch) {
      result.userKnowledge.preferences.push({
        key: 'explicit_preference',
        value: prefMatch[1],
        inferred: false,
      });
    }

    // Technology stack context
    const techMatches = combinedText.match(/(?:using|with|in)\s+(react|vue|angular|node|python|typescript|javascript|next\.?js)/gi);
    if (techMatches) {
      techMatches.forEach(match => {
        const tech = match.replace(/^(?:using|with|in)\s+/i, '');
        result.userKnowledge.projectContext.push({
          name: tech,
          detail: 'Technology in use',
          relevance: 0.8,
        });
      });
    }

    // ==========================================================================
    // TRAINING KNOWLEDGE EXTRACTION (Patterns, anonymized for QLLM)
    // ==========================================================================

    // Extract patterns from the interaction
    if (internal?.context.identifiedPatterns) {
      internal.context.identifiedPatterns.forEach(pattern => {
        result.trainingKnowledge.patterns.push({
          name: pattern,
          description: `Pattern identified in ${internal.phase} phase`,
          applicability: [internal.context.userIntent],
          effectiveness: 0.7,
        });
      });
    }

    // Extract gotchas/solutions
    if (assistantResponse.toLowerCase().includes('error') ||
        assistantResponse.toLowerCase().includes('issue') ||
        assistantResponse.toLowerCase().includes('problem')) {

      // Try to extract problem-solution pair
      const problemSolutionMatch = assistantResponse.match(
        /(?:the\s+)?(?:issue|problem|error)\s+(?:is|was)\s+(.+?)(?:\.|,).+?(?:fix|solve|solution)\s+(?:is|by)\s+(.+?)(?:\.|$)/i
      );

      if (problemSolutionMatch) {
        result.trainingKnowledge.gotchas.push({
          problem: problemSolutionMatch[1],
          solution: problemSolutionMatch[2],
          domain: this.inferDomain(combinedText),
          frequency: 1,
        });
      }
    }

    // Extract wisdom (general insights)
    const wisdomIndicators = [
      /(?:important to|key is to|remember that|always)\s+(.+?)(?:\.|$)/gi,
      /(?:best practice|recommended|should always)\s+(.+?)(?:\.|$)/gi,
    ];

    wisdomIndicators.forEach(pattern => {
      let match;
      while ((match = pattern.exec(assistantResponse)) !== null) {
        result.trainingKnowledge.wisdom.push({
          content: match[1],
          domain: this.inferDomain(combinedText),
          confidence: 0.7,
        });
      }
    });

    // Record the interaction pattern (for training)
    result.trainingKnowledge.interactions.push({
      questionType: this.classifyQuestion(userMessage),
      solutionApproach: this.classifySolution(assistantResponse),
      success: true, // Would need user feedback to know for sure
      phaseSequence: internal ? [internal.phase] : ['intake'],
    });

    return result;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private extractIntent(message: string): string {
    const lower = message.toLowerCase();

    if (lower.includes('how do i') || lower.includes('how to')) return 'how_to';
    if (lower.includes('what is') || lower.includes('explain')) return 'explanation';
    if (lower.includes('fix') || lower.includes('error') || lower.includes('bug')) return 'troubleshooting';
    if (lower.includes('create') || lower.includes('build') || lower.includes('make')) return 'creation';
    if (lower.includes('why') || lower.includes('reason')) return 'understanding';
    if (lower.includes('compare') || lower.includes('difference')) return 'comparison';
    if (lower.includes('best') || lower.includes('recommend')) return 'recommendation';

    return 'general';
  }

  private identifyPatterns(message: string): string[] {
    const patterns: string[] = [];
    const lower = message.toLowerCase();

    if (lower.includes('react') && lower.includes('hook')) patterns.push('react-hooks');
    if (lower.includes('async') || lower.includes('await')) patterns.push('async-programming');
    if (lower.includes('api') || lower.includes('fetch')) patterns.push('api-integration');
    if (lower.includes('state') || lower.includes('redux')) patterns.push('state-management');
    if (lower.includes('test') || lower.includes('spec')) patterns.push('testing');
    if (lower.includes('deploy') || lower.includes('production')) patterns.push('deployment');

    return patterns;
  }

  private identifyGotchas(message: string): string[] {
    const gotchas: string[] = [];
    const lower = message.toLowerCase();

    if (lower.includes('not working')) gotchas.push('functionality-issue');
    if (lower.includes('undefined') || lower.includes('null')) gotchas.push('null-reference');
    if (lower.includes('infinite loop') || lower.includes('re-render')) gotchas.push('render-loop');
    if (lower.includes('cors') || lower.includes('cross-origin')) gotchas.push('cors-issue');
    if (lower.includes('timeout') || lower.includes('slow')) gotchas.push('performance-issue');

    return gotchas;
  }

  private calculateUncertainty(context: InternalCognitiveState['context']): number {
    let uncertainty = 0.5;

    // More patterns identified = lower uncertainty
    if (context.identifiedPatterns.length > 2) uncertainty -= 0.2;
    if (context.identifiedPatterns.length > 0) uncertainty -= 0.1;

    // Potential gotchas = higher uncertainty (need to be careful)
    if (context.potentialGotchas.length > 0) uncertainty += 0.1;

    // Clear intent = lower uncertainty
    if (context.userIntent !== 'general') uncertainty -= 0.1;

    return Math.max(0, Math.min(1, uncertainty));
  }

  private extractLearnings(
    userMessage: string,
    response: string,
    context: InternalCognitiveState['context']
  ): { wisdom: string[]; patterns: string[]; gotchas: string[] } {
    return {
      wisdom: context.relevantKnowledge,
      patterns: context.identifiedPatterns,
      gotchas: context.potentialGotchas,
    };
  }

  private inferDomain(text: string): string {
    const lower = text.toLowerCase();

    if (lower.includes('react') || lower.includes('vue') || lower.includes('angular')) return 'frontend';
    if (lower.includes('node') || lower.includes('express') || lower.includes('api')) return 'backend';
    if (lower.includes('database') || lower.includes('sql') || lower.includes('mongo')) return 'database';
    if (lower.includes('deploy') || lower.includes('docker') || lower.includes('kubernetes')) return 'devops';
    if (lower.includes('test') || lower.includes('jest') || lower.includes('cypress')) return 'testing';

    return 'general';
  }

  private classifyQuestion(message: string): string {
    const lower = message.toLowerCase();

    if (lower.includes('how')) return 'procedural';
    if (lower.includes('what')) return 'definitional';
    if (lower.includes('why')) return 'explanatory';
    if (lower.includes('fix') || lower.includes('error')) return 'debugging';
    if (lower.includes('best') || lower.includes('should')) return 'advisory';

    return 'general';
  }

  private classifySolution(response: string): string {
    const lower = response.toLowerCase();

    if (lower.includes('```')) return 'code-example';
    if (lower.includes('step')) return 'step-by-step';
    if (lower.includes('because') || lower.includes('reason')) return 'explanatory';
    if (lower.includes('try') || lower.includes('consider')) return 'suggestive';

    return 'direct';
  }

  private recordSnapshot(conversationId: string, internal: InternalCognitiveState): void {
    const external = this.externalStates.get(conversationId) || this.initializeExternal(conversationId);

    const snapshot: DualPhaseSnapshot = {
      timestamp: new Date().toISOString(),
      conversationId,
      messageIndex: this.snapshots.get(conversationId)?.length || 0,
      internal: { ...internal },
      external: { ...external },
      sync: {
        internalAheadBy: 0,
        pendingDelivery: [],
        suppressedInsights: internal.learning.newPatterns.filter(p => p.includes('internal')),
      },
    };

    const existing = this.snapshots.get(conversationId) || [];
    existing.push(snapshot);
    this.snapshots.set(conversationId, existing);
  }

  /**
   * Get full dual-phase history for a conversation
   */
  getPhaseHistory(conversationId: string): DualPhaseSnapshot[] {
    return this.snapshots.get(conversationId) || [];
  }

  /**
   * Get current states for debugging
   */
  getCurrentStates(conversationId: string): {
    internal: InternalCognitiveState | undefined;
    external: ExternalDeliveryState | undefined;
  } {
    return {
      internal: this.internalStates.get(conversationId),
      external: this.externalStates.get(conversationId),
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getDualPhaseOrchestrator = (): DualPhaseOrchestrator => {
  return DualPhaseOrchestrator.getInstance();
};
