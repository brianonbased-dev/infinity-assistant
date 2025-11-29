/**
 * Cognitive Stream Service
 *
 * Manages TWO parallel data streams from every conversation:
 *
 * STREAM 1: QLLM Training Stream (Internal Thoughts)
 * ─────────────────────────────────────────────────────
 * - Agent's internal cognitive process
 * - Reasoning chains, pattern recognition, uncertainty
 * - Flows to uAA2-service for Brittney training
 * - Rich metadata: phase sequences, decision points, confidence
 *
 * STREAM 2: User Conversation Stream (External Delivery)
 * ─────────────────────────────────────────────────────
 * - Actual messages between user and assistant
 * - Phase patterns extracted for local compression
 * - Stays with user (editable local memory)
 * - Minimal metadata: phase labels, importance
 *
 * Why Two Streams?
 * - QLLM needs to learn HOW to think, not just WHAT was said
 * - Users need their conversation context, not agent internals
 * - Training benefits from reasoning traces
 * - Privacy: user data stays local, patterns go to training
 */

import { getDualPhaseOrchestrator } from './DualPhaseArchitecture';
import type {
  InternalCognitiveState,
  ExternalDeliveryState,
  KnowledgeExtractionResult,
} from './DualPhaseArchitecture';
import type { UAA2Phase } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * QLLM Training Record - Rich internal thought data
 * This is what Brittney learns from
 */
export interface QLLMThoughtRecord {
  id: string;
  timestamp: string;

  // The thought process (what QLLM learns to replicate)
  thought: {
    phase: UAA2Phase;
    content: string;           // What the agent was "thinking"
    trigger: string;           // What triggered this thought
    duration: number;          // How long in this phase
  };

  // Reasoning chain (critical for QLLM)
  reasoning: {
    inputAnalysis: string;     // How input was interpreted
    knowledgeRetrieval: string[]; // What knowledge was accessed
    patternMatching: string[]; // Patterns recognized
    decisionPoints: Array<{
      question: string;
      options: string[];
      chosen: string;
      confidence: number;
    }>;
    uncertainties: string[];   // What wasn't clear
  };

  // Outcome (for supervised learning)
  outcome: {
    responseGenerated: boolean;
    userSatisfied?: boolean;   // If we have feedback
    errorOccurred: boolean;
    learningsExtracted: number;
  };

  // Phase transition data
  phaseTransition?: {
    from: UAA2Phase;
    to: UAA2Phase;
    reason: string;
  };

  // Anonymized context (no user PII)
  context: {
    domain: string;            // 'frontend', 'backend', etc.
    questionType: string;      // 'how-to', 'debugging', etc.
    complexity: number;        // 1-10
    technologiesMentioned: string[];
  };
}

/**
 * User Conversation Record - Clean message with phase pattern
 * This stays with the user
 */
export interface UserConversationRecord {
  id: string;
  timestamp: string;

  // The actual message
  message: {
    role: 'user' | 'assistant';
    content: string;
    phase: UAA2Phase;          // Simplified phase label
  };

  // Phase pattern (for local compression)
  phasePattern: {
    detectedPhase: UAA2Phase;
    confidence: number;
    indicators: string[];      // Why this phase was detected
  };

  // Extractable knowledge (for user's local memory)
  extractable: {
    facts: string[];           // Personal facts mentioned
    preferences: string[];     // Preferences expressed
    projectContext: string[];  // Project-related context
  };

  // Importance for compression decisions
  importance: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Stream batch - collected records ready to send
 */
export interface StreamBatch {
  batchId: string;
  conversationId: string;
  timestamp: string;

  // For QLLM
  thoughtRecords: QLLMThoughtRecord[];

  // For user
  conversationRecords: UserConversationRecord[];

  // Metadata
  metadata: {
    messageCount: number;
    phaseSequence: UAA2Phase[];
    domainsEncountered: string[];
    totalThinkingTime: number;
  };
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class CognitiveStreamService {
  private static instance: CognitiveStreamService;
  private orchestrator = getDualPhaseOrchestrator();

  // Buffers for batching
  private thoughtBuffer = new Map<string, QLLMThoughtRecord[]>();
  private conversationBuffer = new Map<string, UserConversationRecord[]>();

  // Configuration
  private config = {
    batchSize: 10,             // Records per batch
    flushInterval: 30000,      // 30 seconds
    qllmEndpoint: process.env.UAA2_SERVICE_URL || 'https://uaa2.example.com',
    syncSecret: process.env.UAA2_TRAINING_SYNC_SECRET || '',
  };

  // Timing tracking
  private phaseStartTimes = new Map<string, number>();

  private constructor() {
    // Auto-flush periodically
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.flushAllBuffers(), this.config.flushInterval);
    }
  }

  static getInstance(): CognitiveStreamService {
    if (!CognitiveStreamService.instance) {
      CognitiveStreamService.instance = new CognitiveStreamService();
    }
    return CognitiveStreamService.instance;
  }

  // ==========================================================================
  // STREAM 1: QLLM THOUGHT STREAM
  // ==========================================================================

  /**
   * Record an internal thought for QLLM training
   * Called during agent's cognitive process
   */
  recordThought(
    conversationId: string,
    thought: {
      phase: UAA2Phase;
      content: string;
      trigger: string;
      reasoning?: Partial<QLLMThoughtRecord['reasoning']>;
      context?: Partial<QLLMThoughtRecord['context']>;
    }
  ): QLLMThoughtRecord {
    // Calculate duration if we have a start time
    const phaseKey = `${conversationId}:${thought.phase}`;
    const startTime = this.phaseStartTimes.get(phaseKey);
    const duration = startTime ? Date.now() - startTime : 0;

    // Record new start time
    this.phaseStartTimes.set(phaseKey, Date.now());

    const record: QLLMThoughtRecord = {
      id: `thought_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      thought: {
        phase: thought.phase,
        content: thought.content,
        trigger: thought.trigger,
        duration,
      },
      reasoning: {
        inputAnalysis: thought.reasoning?.inputAnalysis || '',
        knowledgeRetrieval: thought.reasoning?.knowledgeRetrieval || [],
        patternMatching: thought.reasoning?.patternMatching || [],
        decisionPoints: thought.reasoning?.decisionPoints || [],
        uncertainties: thought.reasoning?.uncertainties || [],
      },
      outcome: {
        responseGenerated: false,
        errorOccurred: false,
        learningsExtracted: 0,
      },
      context: {
        domain: thought.context?.domain || 'general',
        questionType: thought.context?.questionType || 'general',
        complexity: thought.context?.complexity || 5,
        technologiesMentioned: thought.context?.technologiesMentioned || [],
      },
    };

    // Add to buffer
    const buffer = this.thoughtBuffer.get(conversationId) || [];
    buffer.push(record);
    this.thoughtBuffer.set(conversationId, buffer);

    // Check if we should flush
    if (buffer.length >= this.config.batchSize) {
      this.flushThoughts(conversationId);
    }

    return record;
  }

  /**
   * Record a phase transition for QLLM
   */
  recordPhaseTransition(
    conversationId: string,
    from: UAA2Phase,
    to: UAA2Phase,
    reason: string
  ): void {
    // Get the last thought record and add transition
    const buffer = this.thoughtBuffer.get(conversationId) || [];
    if (buffer.length > 0) {
      buffer[buffer.length - 1].phaseTransition = { from, to, reason };
    }

    // Also record as a new thought
    this.recordThought(conversationId, {
      phase: to,
      content: `Transitioning from ${from} to ${to}`,
      trigger: reason,
      reasoning: {
        decisionPoints: [{
          question: 'Should transition phase?',
          options: ['stay', 'transition'],
          chosen: 'transition',
          confidence: 0.8,
        }],
      },
    });
  }

  /**
   * Record outcome/completion for QLLM learning
   */
  recordOutcome(
    conversationId: string,
    outcome: {
      responseGenerated: boolean;
      userSatisfied?: boolean;
      errorOccurred?: boolean;
      learningsExtracted?: number;
    }
  ): void {
    const buffer = this.thoughtBuffer.get(conversationId) || [];
    if (buffer.length > 0) {
      buffer[buffer.length - 1].outcome = {
        ...buffer[buffer.length - 1].outcome,
        ...outcome,
      };
    }
  }

  // ==========================================================================
  // STREAM 2: USER CONVERSATION STREAM
  // ==========================================================================

  /**
   * Record a conversation message for user's local memory
   * Called when messages are exchanged
   */
  recordConversation(
    conversationId: string,
    message: {
      role: 'user' | 'assistant';
      content: string;
    }
  ): UserConversationRecord {
    // Detect phase from message content
    const phasePattern = this.detectPhasePattern(message.content, message.role);

    // Extract user-relevant knowledge
    const extractable = this.extractUserKnowledge(message.content, message.role);

    // Determine importance
    const importance = this.determineImportance(message.content, extractable);

    const record: UserConversationRecord = {
      id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      message: {
        role: message.role,
        content: message.content,
        phase: phasePattern.detectedPhase,
      },
      phasePattern,
      extractable,
      importance,
    };

    // Add to buffer
    const buffer = this.conversationBuffer.get(conversationId) || [];
    buffer.push(record);
    this.conversationBuffer.set(conversationId, buffer);

    return record;
  }

  /**
   * Detect phase pattern from message content
   */
  private detectPhasePattern(
    content: string,
    role: 'user' | 'assistant'
  ): UserConversationRecord['phasePattern'] {
    const lower = content.toLowerCase();
    const indicators: string[] = [];
    let phase: UAA2Phase = 'intake';
    let confidence = 0.5;

    if (role === 'user') {
      // User messages - detect what phase they're driving
      if (lower.includes('?') || lower.includes('what') || lower.includes('how') || lower.includes('tell me')) {
        phase = 'intake';
        indicators.push('question_markers');
        confidence = 0.8;
      } else if (lower.includes('actually') || lower.includes('i meant') || lower.includes('let me clarify')) {
        phase = 'reintake';
        indicators.push('clarification_markers');
        confidence = 0.85;
      } else if (lower.includes('do it') || lower.includes('go ahead') || lower.includes('yes') || lower.includes('proceed')) {
        phase = 'execute';
        indicators.push('action_approval');
        confidence = 0.75;
      } else if (lower.includes('summary') || lower.includes('wrap up') || lower.includes('key points')) {
        phase = 'compress';
        indicators.push('summary_request');
        confidence = 0.9;
      }
    } else {
      // Assistant messages - detect what phase response represents
      if (lower.includes('let me understand') || lower.includes('so you want') || lower.includes('to clarify')) {
        phase = 'intake';
        indicators.push('understanding_statement');
        confidence = 0.8;
      } else if (lower.includes('analyzing') || lower.includes('looking at') || lower.includes('considering')) {
        phase = 'reflect';
        indicators.push('analysis_statement');
        confidence = 0.85;
      } else if (lower.includes('here\'s') || lower.includes('```') || lower.includes('you can')) {
        phase = 'execute';
        indicators.push('solution_delivery');
        confidence = 0.9;
      } else if (lower.includes('in summary') || lower.includes('to recap') || lower.includes('key takeaways')) {
        phase = 'compress';
        indicators.push('compression_statement');
        confidence = 0.95;
      } else if (lower.includes('i learned') || lower.includes('this teaches') || lower.includes('pattern')) {
        phase = 'grow';
        indicators.push('learning_statement');
        confidence = 0.8;
      }
    }

    return { detectedPhase: phase, confidence, indicators };
  }

  /**
   * Extract user-relevant knowledge (for local storage)
   */
  private extractUserKnowledge(
    content: string,
    role: 'user' | 'assistant'
  ): UserConversationRecord['extractable'] {
    const facts: string[] = [];
    const preferences: string[] = [];
    const projectContext: string[] = [];

    if (role === 'user') {
      // Personal facts
      const nameMatch = content.match(/(?:my name is|i'm|i am)\s+(\w+)/i);
      if (nameMatch) facts.push(`Name: ${nameMatch[1]}`);

      const roleMatch = content.match(/(?:i work as|i'm a|i am a)\s+(.+?)(?:\.|,|$)/i);
      if (roleMatch) facts.push(`Role: ${roleMatch[1]}`);

      // Preferences
      const prefMatch = content.match(/(?:i prefer|i like|i always|i want)\s+(.+?)(?:\.|,|$)/i);
      if (prefMatch) preferences.push(prefMatch[1]);

      // Project context
      const projectMatch = content.match(/(?:my project|working on|building)\s+(.+?)(?:\.|,|$)/i);
      if (projectMatch) projectContext.push(projectMatch[1]);

      // Tech stack
      const techMatches = content.match(/(?:using|with)\s+(react|vue|node|python|typescript)/gi);
      if (techMatches) projectContext.push(...techMatches);
    }

    return { facts, preferences, projectContext };
  }

  /**
   * Determine message importance for compression
   */
  private determineImportance(
    content: string,
    extractable: UserConversationRecord['extractable']
  ): UserConversationRecord['importance'] {
    const lower = content.toLowerCase();

    // Critical: explicit memory requests or corrections
    if (lower.includes('remember') || lower.includes('always') || lower.includes('never forget')) {
      return 'critical';
    }

    // High: has extractable personal info
    if (extractable.facts.length > 0 || extractable.preferences.length > 0) {
      return 'high';
    }

    // Medium: project context
    if (extractable.projectContext.length > 0) {
      return 'medium';
    }

    // Low: general conversation
    return 'low';
  }

  // ==========================================================================
  // BUFFER MANAGEMENT & STREAMING
  // ==========================================================================

  /**
   * Flush thought buffer to QLLM (uAA2-service)
   */
  async flushThoughts(conversationId: string): Promise<void> {
    const buffer = this.thoughtBuffer.get(conversationId);
    if (!buffer || buffer.length === 0) return;

    try {
      // Send to uAA2-service
      const response = await fetch(`${this.config.qllmEndpoint}/api/training/thoughts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-uaa2-sync-secret': this.config.syncSecret,
        },
        body: JSON.stringify({
          conversationId,
          thoughts: buffer,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        // Clear buffer on success
        this.thoughtBuffer.set(conversationId, []);
        console.log(`[CognitiveStream] Flushed ${buffer.length} thoughts to QLLM`);
      }
    } catch (error) {
      console.error('[CognitiveStream] Failed to flush thoughts:', error);
      // Keep buffer for retry
    }
  }

  /**
   * Get conversation buffer for local storage
   */
  getConversationBuffer(conversationId: string): UserConversationRecord[] {
    return this.conversationBuffer.get(conversationId) || [];
  }

  /**
   * Clear conversation buffer (after local storage)
   */
  clearConversationBuffer(conversationId: string): void {
    this.conversationBuffer.set(conversationId, []);
  }

  /**
   * Flush all buffers
   */
  async flushAllBuffers(): Promise<void> {
    for (const conversationId of this.thoughtBuffer.keys()) {
      await this.flushThoughts(conversationId);
    }
  }

  /**
   * Get complete batch for both streams
   */
  getBatch(conversationId: string): StreamBatch {
    const thoughts = this.thoughtBuffer.get(conversationId) || [];
    const conversations = this.conversationBuffer.get(conversationId) || [];

    // Calculate metadata
    const phaseSequence = thoughts.map(t => t.thought.phase);
    const domains = [...new Set(thoughts.map(t => t.context.domain))];
    const totalTime = thoughts.reduce((sum, t) => sum + t.thought.duration, 0);

    return {
      batchId: `batch_${Date.now()}`,
      conversationId,
      timestamp: new Date().toISOString(),
      thoughtRecords: thoughts,
      conversationRecords: conversations,
      metadata: {
        messageCount: conversations.length,
        phaseSequence,
        domainsEncountered: domains,
        totalThinkingTime: totalTime,
      },
    };
  }

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  /**
   * Process a complete message exchange
   * Records both thought stream and conversation stream
   */
  async processMessageExchange(
    conversationId: string,
    userMessage: string,
    assistantResponse: string,
    thinking?: {
      analysisTime?: number;
      patternsFound?: string[];
      uncertainties?: string[];
    }
  ): Promise<{
    thoughtRecord: QLLMThoughtRecord;
    userRecord: UserConversationRecord;
    assistantRecord: UserConversationRecord;
    knowledge: KnowledgeExtractionResult;
  }> {
    // Process internal state
    await this.orchestrator.processInternalPhase(conversationId, {
      userMessage,
    });

    // Record user message for conversation stream
    const userRecord = this.recordConversation(conversationId, {
      role: 'user',
      content: userMessage,
    });

    // Record thought for QLLM stream
    const thoughtRecord = this.recordThought(conversationId, {
      phase: 'execute',
      content: `Responding to: ${userMessage.slice(0, 50)}...`,
      trigger: 'user_message',
      reasoning: {
        inputAnalysis: `User intent detected: ${userRecord.phasePattern.detectedPhase}`,
        patternMatching: thinking?.patternsFound || [],
        uncertainties: thinking?.uncertainties || [],
      },
      context: {
        complexity: userMessage.length > 200 ? 7 : 4,
      },
    });

    // Record assistant response for conversation stream
    const assistantRecord = this.recordConversation(conversationId, {
      role: 'assistant',
      content: assistantResponse,
    });

    // Record outcome
    this.recordOutcome(conversationId, {
      responseGenerated: true,
      learningsExtracted: assistantRecord.extractable.facts.length +
                          assistantRecord.extractable.preferences.length,
    });

    // Extract knowledge split
    const knowledge = this.orchestrator.extractKnowledge(
      conversationId,
      userMessage,
      assistantResponse
    );

    // Process compression
    await this.orchestrator.processInternalPhase(conversationId, {
      previousResponse: assistantResponse,
    });

    return {
      thoughtRecord,
      userRecord,
      assistantRecord,
      knowledge,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getCognitiveStreamService = (): CognitiveStreamService => {
  return CognitiveStreamService.getInstance();
};
