/**
 * Phase Transition Service
 *
 * Automatically detects and transitions between uAA2++ 8-Phase Protocol phases
 * based on conversation content and context. This generates rich training data
 * for the QLLM (Brittney) by annotating conversations with phase metadata.
 *
 * Phase Detection Logic:
 * - INTAKE: User provides new context, asks questions, shares information
 * - REFLECT: Analysis requested, "let me think", planning discussions
 * - EXECUTE: Action taken, code written, task performed
 * - COMPRESS: Summary requested, key points extracted, learning captured
 * - REINTAKE: Re-evaluation, "based on what we discussed", incorporating feedback
 * - GROW: Expanding knowledge, exploring new domains, connecting concepts
 * - EVOLVE: Optimization, improvement suggestions, better approaches
 * - AUTONOMIZE: Independent operation, proactive suggestions, anticipating needs
 *
 * Training Data Generation:
 * - Every phase transition is logged with context
 * - Conversations are annotated with phase metadata
 * - Exports in format compatible with uaa2-service MLTrainingDataService
 */

import type {
  UAA2Phase,
  PhaseContext,
  MemoryEntry,
} from './types';
import logger from '@/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface PhaseTransitionEvent {
  id: string;
  conversationId: string;
  previousPhase: UAA2Phase;
  newPhase: UAA2Phase;
  trigger: string;              // What triggered the transition
  confidence: number;           // 0-1 confidence in detection
  messageContent: string;       // The message that triggered transition
  timestamp: string;
  metadata: {
    messageType: 'user' | 'assistant' | 'system';
    keyPhrases: string[];
    contextSignals: string[];
  };
}

export interface PhaseAnnotatedMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  phase: UAA2Phase;
  phaseConfidence: number;
  timestamp: string;
  insights?: string[];
}

export interface TrainingDataExport {
  conversationId: string;
  userId: string;
  messages: PhaseAnnotatedMessage[];
  phaseTransitions: PhaseTransitionEvent[];
  metadata: {
    totalMessages: number;
    totalTransitions: number;
    phaseCounts: Record<UAA2Phase, number>;
    startTime: string;
    endTime: string;
    exportedAt: string;
  };
}

// ============================================================================
// PHASE DETECTION PATTERNS
// ============================================================================

const PHASE_PATTERNS: Record<UAA2Phase, {
  userPatterns: RegExp[];
  assistantPatterns: RegExp[];
  contextSignals: string[];
}> = {
  intake: {
    userPatterns: [
      /^(hi|hello|hey|good morning|good afternoon)/i,
      /can you help|i need|i want|i'm looking for/i,
      /my (situation|project|problem|goal) is/i,
      /here's (the|some|my) (context|background|situation)/i,
      /let me (tell|explain|share|give)/i,
      /^what (is|are|do|does|can)/i,
    ],
    assistantPatterns: [
      /i understand|i see|got it|thanks for (sharing|explaining)/i,
      /let me gather|let me understand|to clarify/i,
      /what (else|more) can you tell me/i,
    ],
    contextSignals: ['new-conversation', 'topic-change', 'context-provided'],
  },

  reflect: {
    userPatterns: [
      /what do you think|your thoughts|your opinion/i,
      /how should (we|i) approach/i,
      /analyze|consider|think about/i,
      /what are the (options|alternatives|possibilities)/i,
      /pros and cons|trade-?offs/i,
    ],
    assistantPatterns: [
      /let me (think|analyze|consider|reflect)/i,
      /analyzing|thinking about|considering/i,
      /here's my analysis|my assessment/i,
      /the key considerations|factors to consider/i,
    ],
    contextSignals: ['analysis-requested', 'planning', 'evaluation'],
  },

  execute: {
    userPatterns: [
      /^(do|make|create|build|write|implement|fix)/i,
      /go ahead|proceed|execute|run|start/i,
      /can you (do|make|create|build|write|implement)/i,
      /please (do|make|create|build|write|implement)/i,
    ],
    assistantPatterns: [
      /i('ll| will) (do|make|create|build|write|implement)/i,
      /here('s| is) the (code|solution|implementation)/i,
      /done|completed|finished|created|implemented/i,
      /i've (made|created|built|written|implemented)/i,
    ],
    contextSignals: ['action-taken', 'task-performed', 'code-written'],
  },

  compress: {
    userPatterns: [
      /summarize|summary|key (points|takeaways)/i,
      /what (did we|have we) (learn|discover|accomplish)/i,
      /recap|overview|wrap up/i,
      /in (short|brief|summary)/i,
    ],
    assistantPatterns: [
      /to summarize|in summary|key (points|takeaways)/i,
      /here's (a|the) summary|let me recap/i,
      /the main (points|insights|learnings)/i,
      /what we('ve| have) (learned|discovered|accomplished)/i,
    ],
    contextSignals: ['summary-provided', 'knowledge-extracted', 'learning-captured'],
  },

  reintake: {
    userPatterns: [
      /based on (what we|our) (discussed|learned)/i,
      /given (what we|our previous)/i,
      /now that we know|with this (in mind|understanding)/i,
      /re-?evaluate|reconsider|revisit/i,
      /let's (look|think) again/i,
    ],
    assistantPatterns: [
      /based on (our|the) (discussion|learning)/i,
      /incorporating (the|our) (feedback|learning)/i,
      /with this (new|additional) (context|information)/i,
      /re-?evaluating|reconsidering/i,
    ],
    contextSignals: ['feedback-incorporated', 're-evaluation', 'context-updated'],
  },

  grow: {
    userPatterns: [
      /what (else|other|more) can|how else/i,
      /expand|extend|explore|branch out/i,
      /related (to|topics|areas)|adjacent/i,
      /take it further|build on this/i,
      /what about (other|different)/i,
    ],
    assistantPatterns: [
      /this also (applies|relates) to/i,
      /expanding on this|building on this/i,
      /in related (areas|domains)/i,
      /you might also (consider|explore)/i,
      /this connects to/i,
    ],
    contextSignals: ['knowledge-expansion', 'domain-connection', 'exploration'],
  },

  evolve: {
    userPatterns: [
      /how can (we|i) improve|make (it|this) better/i,
      /optimize|enhance|refine|polish/i,
      /what's (the|a) better (way|approach)/i,
      /can we do (better|more efficiently)/i,
    ],
    assistantPatterns: [
      /here's (a|an) (improved|better|optimized)/i,
      /to (improve|optimize|enhance)/i,
      /a better approach|more efficient/i,
      /i recommend (improving|optimizing)/i,
    ],
    contextSignals: ['optimization', 'improvement', 'refinement'],
  },

  autonomize: {
    userPatterns: [
      /on your own|independently|autonomously/i,
      /without (me|my input)|proactively/i,
      /anticipate|predict|suggest without asking/i,
      /take initiative|be proactive/i,
    ],
    assistantPatterns: [
      /i (noticed|anticipated|predicted)/i,
      /you might want to|you should consider/i,
      /proactively|i took the initiative/i,
      /anticipating your (need|question)/i,
      /based on (your|our) (patterns|history)/i,
    ],
    contextSignals: ['proactive-suggestion', 'anticipation', 'autonomous-action'],
  },
};

// ============================================================================
// LONG CONVERSATION CONFIGURATION
// ============================================================================

interface ConversationMetrics {
  messageCount: number;
  messagesInCurrentPhase: number;
  lastPhaseChangeAt: number;
  recentTopics: string[];
  completedCycles: number;
}

// Phase duration thresholds (in messages) - triggers natural progression
const PHASE_MESSAGE_THRESHOLDS: Record<UAA2Phase, number> = {
  intake: 8,       // After 8 messages, should move to reflect
  reflect: 5,      // Analysis shouldn't take too long
  execute: 15,     // Execution can be longer
  compress: 4,     // Compression is quick
  reintake: 4,     // Re-intake is quick
  grow: 6,         // Growth exploration
  evolve: 5,       // Evolution suggestions
  autonomize: 10,  // Can stay autonomous longer
};

// Messages before suggesting a compress cycle
const COMPRESS_TRIGGER_THRESHOLD = 25;

// ============================================================================
// PHASE TRANSITION SERVICE
// ============================================================================

export class PhaseTransitionService {
  private transitionHistory: Map<string, PhaseTransitionEvent[]> = new Map();
  private currentPhases: Map<string, PhaseContext> = new Map();
  private conversationMetrics: Map<string, ConversationMetrics> = new Map();

  /**
   * Get or initialize conversation metrics
   */
  private getMetrics(conversationId: string): ConversationMetrics {
    let metrics = this.conversationMetrics.get(conversationId);
    if (!metrics) {
      metrics = {
        messageCount: 0,
        messagesInCurrentPhase: 0,
        lastPhaseChangeAt: Date.now(),
        recentTopics: [],
        completedCycles: 0,
      };
      this.conversationMetrics.set(conversationId, metrics);
    }
    return metrics;
  }

  /**
   * Detect phase from message content with long conversation awareness
   */
  detectPhase(
    content: string,
    role: 'user' | 'assistant' | 'system',
    currentPhase: UAA2Phase,
    conversationId?: string
  ): { phase: UAA2Phase; confidence: number; signals: string[] } {
    const metrics = conversationId ? this.getMetrics(conversationId) : null;
    const patterns = role === 'user' ? 'userPatterns' : 'assistantPatterns';

    let bestMatch: { phase: UAA2Phase; score: number; signals: string[] } = {
      phase: currentPhase,
      score: 0,
      signals: [],
    };

    // Pattern-based detection
    for (const [phase, config] of Object.entries(PHASE_PATTERNS)) {
      let score = 0;
      const signals: string[] = [];

      // Check patterns
      for (const pattern of config[patterns]) {
        if (pattern.test(content)) {
          score += 1;
          signals.push(pattern.source.substring(0, 30));
        }
      }

      // Normalize score
      const patternCount = config[patterns].length;
      const normalizedScore = patternCount > 0 ? score / patternCount : 0;

      if (normalizedScore > bestMatch.score) {
        bestMatch = {
          phase: phase as UAA2Phase,
          score: normalizedScore,
          signals: [...signals, ...config.contextSignals.slice(0, 2)],
        };
      }
    }

    // Apply phase flow logic (natural progression)
    const phaseFlow = this.getExpectedNextPhases(currentPhase);
    if (phaseFlow.includes(bestMatch.phase)) {
      bestMatch.score *= 1.2; // Boost expected transitions
    }

    // ====================================================================
    // LONG CONVERSATION DYNAMICS
    // ====================================================================

    if (metrics) {
      // Check if we've been in current phase too long
      const threshold = PHASE_MESSAGE_THRESHOLDS[currentPhase];
      if (metrics.messagesInCurrentPhase >= threshold) {
        // Suggest natural progression
        const nextPhases = this.getExpectedNextPhases(currentPhase);
        if (nextPhases.length > 0 && bestMatch.phase === currentPhase) {
          // Override to suggest next phase if stuck
          bestMatch.phase = nextPhases[0];
          bestMatch.score = 0.6;
          bestMatch.signals = ['phase-duration-trigger', `${metrics.messagesInCurrentPhase}-messages-in-phase`];
        }
      }

      // Trigger compress cycle for very long conversations
      if (metrics.messageCount > 0 &&
          metrics.messageCount % COMPRESS_TRIGGER_THRESHOLD === 0 &&
          currentPhase !== 'compress') {
        bestMatch.phase = 'compress';
        bestMatch.score = 0.75;
        bestMatch.signals = ['long-conversation-compress', `${metrics.messageCount}-total-messages`];
      }

      // After compress, suggest reintake for continuity
      if (currentPhase === 'compress' && metrics.messagesInCurrentPhase >= 2) {
        if (bestMatch.phase === 'compress') {
          bestMatch.phase = 'reintake';
          bestMatch.score = 0.7;
          bestMatch.signals = ['post-compress-reintake'];
        }
      }

      // Boost autonomize phase for very long conversations with multiple cycles
      if (metrics.completedCycles >= 2 && currentPhase === 'evolve') {
        const autonomizeBoost = Math.min(metrics.completedCycles * 0.1, 0.3);
        if (bestMatch.phase === 'autonomize') {
          bestMatch.score += autonomizeBoost;
        }
      }

      // Extract topics for context awareness
      const topics = this.extractTopics(content);
      metrics.recentTopics = [...topics, ...metrics.recentTopics].slice(0, 20);
    }

    // Minimum confidence threshold
    const confidence = Math.min(bestMatch.score, 1);

    // If confidence is too low, keep current phase
    if (confidence < 0.15) {
      return {
        phase: currentPhase,
        confidence: 0.5,
        signals: ['maintaining-phase'],
      };
    }

    return {
      phase: bestMatch.phase,
      confidence,
      signals: bestMatch.signals,
    };
  }

  /**
   * Extract topic keywords for context tracking
   */
  private extractTopics(content: string): string[] {
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'be', 'have', 'has', 'do', 'does',
      'will', 'would', 'could', 'should', 'can', 'and', 'but', 'or', 'if', 'then',
      'this', 'that', 'it', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'i', 'you', 'we', 'they', 'my', 'your', 'our', 'what', 'how', 'why',
    ]);

    return words
      .filter(w => w.length > 4 && !stopWords.has(w) && /^[a-z]+$/i.test(w))
      .slice(0, 5);
  }

  /**
   * Get expected next phases based on current phase
   */
  private getExpectedNextPhases(currentPhase: UAA2Phase): UAA2Phase[] {
    const flowMap: Record<UAA2Phase, UAA2Phase[]> = {
      intake: ['reflect', 'execute'],
      reflect: ['execute', 'intake'],
      execute: ['compress', 'reflect', 'execute'],
      compress: ['reintake', 'grow'],
      reintake: ['reflect', 'execute', 'grow'],
      grow: ['evolve', 'reflect'],
      evolve: ['autonomize', 'execute'],
      autonomize: ['intake', 'execute', 'reflect'],
    };
    return flowMap[currentPhase] || ['intake'];
  }

  /**
   * Process message and detect phase transition
   * Now with long conversation dynamics
   */
  processMessage(
    conversationId: string,
    content: string,
    role: 'user' | 'assistant' | 'system'
  ): PhaseTransitionEvent | null {
    // Get current phase
    let phaseContext = this.currentPhases.get(conversationId);
    if (!phaseContext) {
      phaseContext = {
        currentPhase: 'intake',
        phaseStartedAt: new Date().toISOString(),
        phaseHistory: [],
        cycleCount: 0,
      };
      this.currentPhases.set(conversationId, phaseContext);
    }

    // Update conversation metrics for long conversation awareness
    const metrics = this.getMetrics(conversationId);
    metrics.messageCount++;
    metrics.messagesInCurrentPhase++;

    // Detect phase WITH conversation context
    const detection = this.detectPhase(content, role, phaseContext.currentPhase, conversationId);

    // Check if phase changed
    if (detection.phase !== phaseContext.currentPhase && detection.confidence >= 0.3) {
      const transition: PhaseTransitionEvent = {
        id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        conversationId,
        previousPhase: phaseContext.currentPhase,
        newPhase: detection.phase,
        trigger: detection.signals[0] || 'content-analysis',
        confidence: detection.confidence,
        messageContent: content.substring(0, 200),
        timestamp: new Date().toISOString(),
        metadata: {
          messageType: role,
          keyPhrases: detection.signals,
          contextSignals: detection.signals,
        },
      };

      // Update phase context
      phaseContext.phaseHistory.push({
        phase: phaseContext.currentPhase,
        startedAt: phaseContext.phaseStartedAt,
        completedAt: new Date().toISOString(),
        insights: detection.signals,
      });
      phaseContext.currentPhase = detection.phase;
      phaseContext.phaseStartedAt = new Date().toISOString();

      // Reset messages in phase counter on phase change
      metrics.messagesInCurrentPhase = 0;
      metrics.lastPhaseChangeAt = Date.now();

      // Track if we completed a full cycle (returned to intake)
      if (detection.phase === 'intake' && phaseContext.phaseHistory.length > 0) {
        phaseContext.cycleCount++;
        metrics.completedCycles++;
      }

      // Store transition
      const transitions = this.transitionHistory.get(conversationId) || [];
      transitions.push(transition);
      this.transitionHistory.set(conversationId, transitions);

      logger.debug('[PhaseTransition] Phase changed', {
        conversationId,
        from: transition.previousPhase,
        to: transition.newPhase,
        confidence: transition.confidence,
        messageCount: metrics.messageCount,
        cycleCount: metrics.completedCycles,
      });

      return transition;
    }

    return null;
  }

  /**
   * Get current phase for conversation
   */
  getCurrentPhase(conversationId: string): PhaseContext {
    return this.currentPhases.get(conversationId) || {
      currentPhase: 'intake',
      phaseStartedAt: new Date().toISOString(),
      phaseHistory: [],
      cycleCount: 0,
    };
  }

  /**
   * Get all transitions for a conversation
   */
  getTransitions(conversationId: string): PhaseTransitionEvent[] {
    return this.transitionHistory.get(conversationId) || [];
  }

  /**
   * Manually set phase (for explicit user commands)
   */
  setPhase(conversationId: string, phase: UAA2Phase, reason: string): void {
    const phaseContext = this.getCurrentPhase(conversationId);

    if (phaseContext.currentPhase !== phase) {
      const transition: PhaseTransitionEvent = {
        id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        conversationId,
        previousPhase: phaseContext.currentPhase,
        newPhase: phase,
        trigger: 'manual-override',
        confidence: 1.0,
        messageContent: reason,
        timestamp: new Date().toISOString(),
        metadata: {
          messageType: 'system',
          keyPhrases: ['manual-set', reason],
          contextSignals: ['explicit-phase-change'],
        },
      };

      phaseContext.phaseHistory.push({
        phase: phaseContext.currentPhase,
        startedAt: phaseContext.phaseStartedAt,
        completedAt: new Date().toISOString(),
        insights: [reason],
      });
      phaseContext.currentPhase = phase;
      phaseContext.phaseStartedAt = new Date().toISOString();

      this.currentPhases.set(conversationId, phaseContext);

      const transitions = this.transitionHistory.get(conversationId) || [];
      transitions.push(transition);
      this.transitionHistory.set(conversationId, transitions);

      logger.info('[PhaseTransition] Manual phase set', {
        conversationId,
        phase,
        reason,
      });
    }
  }

  /**
   * Get phase statistics for a conversation
   */
  getPhaseStats(conversationId: string): Record<UAA2Phase, number> {
    const transitions = this.getTransitions(conversationId);
    const stats: Record<UAA2Phase, number> = {
      intake: 0,
      reflect: 0,
      execute: 0,
      compress: 0,
      reintake: 0,
      grow: 0,
      evolve: 0,
      autonomize: 0,
    };

    for (const transition of transitions) {
      stats[transition.newPhase]++;
    }

    return stats;
  }

  /**
   * Get conversation metrics for visibility
   */
  getConversationMetrics(conversationId: string): ConversationMetrics & {
    currentPhase: UAA2Phase;
    cycleCount: number;
    phaseDuration: number; // seconds in current phase
  } {
    const metrics = this.getMetrics(conversationId);
    const phaseContext = this.getCurrentPhase(conversationId);
    const phaseDuration = Math.floor((Date.now() - metrics.lastPhaseChangeAt) / 1000);

    return {
      ...metrics,
      currentPhase: phaseContext.currentPhase,
      cycleCount: phaseContext.cycleCount,
      phaseDuration,
    };
  }

  /**
   * Check if conversation needs attention (stuck in phase, no activity)
   */
  needsPhaseGuidance(conversationId: string): {
    needsGuidance: boolean;
    reason?: string;
    suggestedPhase?: UAA2Phase;
  } {
    const metrics = this.getMetrics(conversationId);
    const phaseContext = this.getCurrentPhase(conversationId);
    const threshold = PHASE_MESSAGE_THRESHOLDS[phaseContext.currentPhase];

    // Check if stuck in phase
    if (metrics.messagesInCurrentPhase >= threshold * 1.5) {
      const nextPhases = this.getExpectedNextPhases(phaseContext.currentPhase);
      return {
        needsGuidance: true,
        reason: `Extended time in ${phaseContext.currentPhase} phase (${metrics.messagesInCurrentPhase} messages)`,
        suggestedPhase: nextPhases[0],
      };
    }

    // Check if long conversation without compress
    if (metrics.messageCount >= COMPRESS_TRIGGER_THRESHOLD * 1.5 &&
        phaseContext.currentPhase !== 'compress' &&
        !phaseContext.phaseHistory.some(h => h.phase === 'compress')) {
      return {
        needsGuidance: true,
        reason: `Long conversation (${metrics.messageCount} messages) without knowledge compression`,
        suggestedPhase: 'compress',
      };
    }

    return { needsGuidance: false };
  }

  /**
   * Clear conversation data
   */
  clearConversation(conversationId: string): void {
    this.currentPhases.delete(conversationId);
    this.transitionHistory.delete(conversationId);
    this.conversationMetrics.delete(conversationId);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let phaseTransitionServiceInstance: PhaseTransitionService | null = null;

export function getPhaseTransitionService(): PhaseTransitionService {
  if (!phaseTransitionServiceInstance) {
    phaseTransitionServiceInstance = new PhaseTransitionService();
  }
  return phaseTransitionServiceInstance;
}
