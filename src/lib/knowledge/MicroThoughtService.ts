/**
 * Micro-Thought Service
 *
 * Thoughts should be SHORT and RAPID - like actual cognition.
 * You can't have long thoughts while conversing.
 *
 * Human cognition model:
 * - Micro-thoughts: ~50-200ms each
 * - Multiple micro-thoughts per second
 * - Thoughts chain/cascade rapidly
 * - Long "thoughts" are actually sequences of micro-thoughts
 *
 * Structure:
 * - MicroThought: Single cognitive pulse (< 100 chars)
 * - ThoughtChain: Sequence of related micro-thoughts
 * - ThoughtStream: All thoughts during a response
 *
 * Example conversation thought stream:
 * User: "How do I fix this React hook error?"
 *
 * Micro-thoughts (happening in ~500ms total):
 *   → "React hook" (recognition)
 *   → "error type?" (question)
 *   → "dependency array" (pattern match)
 *   → "common gotcha" (recall)
 *   → "need more context" (uncertainty)
 *   → "ask or assume?" (decision)
 *   → "provide general fix" (action)
 *
 * These rapid thoughts stream to QLLM for training.
 */

import type { UAA2Phase } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Single micro-thought - a cognitive pulse
 * Must be SHORT (< 100 chars typically)
 */
export interface MicroThought {
  id: string;
  timestamp: number;           // Milliseconds timestamp for ordering

  // The thought itself
  content: string;             // SHORT! "pattern match", "need context", etc.
  type: ThoughtType;

  // Quick metadata
  phase: UAA2Phase;
  confidence: number;          // 0-1

  // Chain linking
  triggeredBy?: string;        // ID of thought that triggered this
  triggers?: string[];         // IDs of thoughts this triggers
}

/**
 * Types of micro-thoughts
 */
export type ThoughtType =
  | 'recognition'    // "React hook"
  | 'question'       // "what type?"
  | 'recall'         // "seen this before"
  | 'pattern'        // "matches X pattern"
  | 'association'    // "relates to Y"
  | 'uncertainty'    // "not sure about"
  | 'decision'       // "choosing X"
  | 'action'         // "will do X"
  | 'evaluation'     // "that worked/failed"
  | 'learning'       // "storing: X"
  ;

/**
 * Chain of related thoughts
 */
export interface ThoughtChain {
  id: string;
  thoughts: MicroThought[];
  startTime: number;
  endTime?: number;

  // Chain metadata
  trigger: string;             // What started this chain
  conclusion?: string;         // What the chain concluded
  phase: UAA2Phase;
}

/**
 * Complete thought stream for a response
 */
export interface ThoughtStream {
  conversationId: string;
  messageIndex: number;

  // All chains during this response
  chains: ThoughtChain[];

  // Timing
  startTime: number;
  endTime?: number;
  totalThoughts: number;

  // Summary for training
  summary: {
    dominantPhase: UAA2Phase;
    avgConfidence: number;
    thoughtTypes: Record<ThoughtType, number>;
    chainCount: number;
  };
}

// ============================================================================
// THOUGHT TEMPLATES (Common rapid thoughts)
// ============================================================================

const RAPID_THOUGHTS: Record<string, { content: string; type: ThoughtType }> = {
  // Recognition
  'recognize_tech': { content: 'tech stack identified', type: 'recognition' },
  'recognize_error': { content: 'error pattern', type: 'recognition' },
  'recognize_question': { content: 'question type', type: 'recognition' },

  // Pattern matching
  'pattern_common': { content: 'common pattern', type: 'pattern' },
  'pattern_gotcha': { content: 'known gotcha', type: 'pattern' },
  'pattern_solution': { content: 'solution pattern', type: 'pattern' },

  // Recall
  'recall_similar': { content: 'similar case', type: 'recall' },
  'recall_docs': { content: 'docs reference', type: 'recall' },
  'recall_best_practice': { content: 'best practice', type: 'recall' },

  // Questions
  'need_context': { content: 'need more context', type: 'question' },
  'clarify_intent': { content: 'clarify intent?', type: 'question' },
  'which_approach': { content: 'which approach?', type: 'question' },

  // Decisions
  'decide_approach': { content: 'choosing approach', type: 'decision' },
  'decide_detail': { content: 'detail level', type: 'decision' },
  'decide_ask': { content: 'ask vs assume', type: 'decision' },

  // Actions
  'action_explain': { content: 'explaining', type: 'action' },
  'action_code': { content: 'showing code', type: 'action' },
  'action_steps': { content: 'step by step', type: 'action' },

  // Uncertainty
  'uncertain_context': { content: 'context unclear', type: 'uncertainty' },
  'uncertain_intent': { content: 'intent unclear', type: 'uncertainty' },
  'uncertain_solution': { content: 'solution uncertain', type: 'uncertainty' },

  // Learning
  'learn_pattern': { content: 'new pattern', type: 'learning' },
  'learn_gotcha': { content: 'new gotcha', type: 'learning' },
  'learn_pref': { content: 'user preference', type: 'learning' },
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class MicroThoughtService {
  private static instance: MicroThoughtService;

  // Active streams per conversation
  private activeStreams = new Map<string, ThoughtStream>();
  private activeChains = new Map<string, ThoughtChain>();

  // Buffer for streaming to QLLM
  private streamBuffer: MicroThought[] = [];
  private bufferFlushThreshold = 50;

  private constructor() {}

  static getInstance(): MicroThoughtService {
    if (!MicroThoughtService.instance) {
      MicroThoughtService.instance = new MicroThoughtService();
    }
    return MicroThoughtService.instance;
  }

  // ==========================================================================
  // MICRO-THOUGHT GENERATION
  // ==========================================================================

  /**
   * Fire a micro-thought (rapid, atomic)
   */
  think(
    conversationId: string,
    thought: string | keyof typeof RAPID_THOUGHTS,
    options: {
      type?: ThoughtType;
      phase?: UAA2Phase;
      confidence?: number;
      triggeredBy?: string;
    } = {}
  ): MicroThought {
    // Use template if available
    const template = RAPID_THOUGHTS[thought];
    const content = template?.content || thought;
    const type = options.type || template?.type || 'recognition';

    // Ensure content is SHORT
    const shortContent = content.length > 80
      ? content.slice(0, 77) + '...'
      : content;

    const microThought: MicroThought = {
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      timestamp: Date.now(),
      content: shortContent,
      type,
      phase: options.phase || 'reflect',
      confidence: options.confidence || 0.7,
      triggeredBy: options.triggeredBy,
    };

    // Add to active chain
    this.addToChain(conversationId, microThought);

    // Add to buffer for QLLM
    this.streamBuffer.push(microThought);
    if (this.streamBuffer.length >= this.bufferFlushThreshold) {
      this.flushBuffer();
    }

    return microThought;
  }

  /**
   * Quick recognition thought
   */
  recognize(conversationId: string, what: string): MicroThought {
    return this.think(conversationId, what, { type: 'recognition', phase: 'intake' });
  }

  /**
   * Quick pattern match thought
   */
  matchPattern(conversationId: string, pattern: string): MicroThought {
    return this.think(conversationId, pattern, { type: 'pattern', phase: 'reflect' });
  }

  /**
   * Quick decision thought
   */
  decide(conversationId: string, decision: string, confidence: number = 0.7): MicroThought {
    return this.think(conversationId, decision, {
      type: 'decision',
      phase: 'execute',
      confidence
    });
  }

  /**
   * Quick uncertainty thought
   */
  uncertain(conversationId: string, about: string): MicroThought {
    return this.think(conversationId, about, {
      type: 'uncertainty',
      confidence: 0.3
    });
  }

  /**
   * Quick learning thought
   */
  learn(conversationId: string, what: string): MicroThought {
    return this.think(conversationId, what, {
      type: 'learning',
      phase: 'compress',
      confidence: 0.8
    });
  }

  // ==========================================================================
  // THOUGHT CHAINS
  // ==========================================================================

  /**
   * Start a new thought chain
   */
  startChain(conversationId: string, trigger: string, phase: UAA2Phase): ThoughtChain {
    const chain: ThoughtChain = {
      id: `chain_${Date.now()}`,
      thoughts: [],
      startTime: Date.now(),
      trigger,
      phase,
    };

    this.activeChains.set(conversationId, chain);

    // Ensure stream exists
    if (!this.activeStreams.has(conversationId)) {
      this.startStream(conversationId);
    }

    return chain;
  }

  /**
   * Add thought to current chain
   */
  private addToChain(conversationId: string, thought: MicroThought): void {
    let chain = this.activeChains.get(conversationId);

    if (!chain) {
      chain = this.startChain(conversationId, 'auto', thought.phase);
    }

    // Link to previous thought
    if (chain.thoughts.length > 0) {
      const prev = chain.thoughts[chain.thoughts.length - 1];
      thought.triggeredBy = prev.id;
      if (!prev.triggers) prev.triggers = [];
      prev.triggers.push(thought.id);
    }

    chain.thoughts.push(thought);

    // Add chain to stream
    const stream = this.activeStreams.get(conversationId);
    if (stream) {
      // Update or add chain
      const existingIndex = stream.chains.findIndex(c => c.id === chain!.id);
      if (existingIndex >= 0) {
        stream.chains[existingIndex] = chain;
      } else {
        stream.chains.push(chain);
      }
      stream.totalThoughts++;
    }
  }

  /**
   * End current chain with conclusion
   */
  endChain(conversationId: string, conclusion: string): ThoughtChain | null {
    const chain = this.activeChains.get(conversationId);
    if (!chain) return null;

    chain.endTime = Date.now();
    chain.conclusion = conclusion;

    this.activeChains.delete(conversationId);
    return chain;
  }

  // ==========================================================================
  // THOUGHT STREAMS
  // ==========================================================================

  /**
   * Start a thought stream for a conversation turn
   */
  startStream(conversationId: string, messageIndex: number = 0): ThoughtStream {
    const stream: ThoughtStream = {
      conversationId,
      messageIndex,
      chains: [],
      startTime: Date.now(),
      totalThoughts: 0,
      summary: {
        dominantPhase: 'intake',
        avgConfidence: 0,
        thoughtTypes: {} as Record<ThoughtType, number>,
        chainCount: 0,
      },
    };

    this.activeStreams.set(conversationId, stream);
    return stream;
  }

  /**
   * End stream and generate summary
   */
  endStream(conversationId: string): ThoughtStream | null {
    const stream = this.activeStreams.get(conversationId);
    if (!stream) return null;

    // End any active chain
    this.endChain(conversationId, 'stream end');

    stream.endTime = Date.now();
    stream.summary = this.summarizeStream(stream);

    this.activeStreams.delete(conversationId);
    return stream;
  }

  /**
   * Generate stream summary for training
   */
  private summarizeStream(stream: ThoughtStream): ThoughtStream['summary'] {
    const allThoughts = stream.chains.flatMap(c => c.thoughts);

    // Count thought types
    const thoughtTypes: Record<ThoughtType, number> = {
      recognition: 0,
      question: 0,
      recall: 0,
      pattern: 0,
      association: 0,
      uncertainty: 0,
      decision: 0,
      action: 0,
      evaluation: 0,
      learning: 0,
    };

    // Count phases
    const phaseCounts: Record<UAA2Phase, number> = {
      intake: 0,
      reflect: 0,
      execute: 0,
      compress: 0,
      reintake: 0,
      grow: 0,
      evolve: 0,
      autonomize: 0,
    };

    let totalConfidence = 0;

    for (const thought of allThoughts) {
      thoughtTypes[thought.type]++;
      phaseCounts[thought.phase]++;
      totalConfidence += thought.confidence;
    }

    // Find dominant phase
    const dominantPhase = Object.entries(phaseCounts)
      .sort((a, b) => b[1] - a[1])[0][0] as UAA2Phase;

    return {
      dominantPhase,
      avgConfidence: allThoughts.length > 0 ? totalConfidence / allThoughts.length : 0,
      thoughtTypes,
      chainCount: stream.chains.length,
    };
  }

  // ==========================================================================
  // RAPID THOUGHT SEQUENCES (Common patterns)
  // ==========================================================================

  /**
   * Process user input with rapid thought sequence
   */
  processInput(conversationId: string, input: string): MicroThought[] {
    const thoughts: MicroThought[] = [];
    const lower = input.toLowerCase();

    // Start chain
    this.startChain(conversationId, 'user_input', 'intake');

    // Rapid recognition
    thoughts.push(this.recognize(conversationId, 'input received'));

    // Quick categorization
    if (lower.includes('?')) {
      thoughts.push(this.recognize(conversationId, 'question'));
    }
    if (lower.includes('error') || lower.includes('bug') || lower.includes('fix')) {
      thoughts.push(this.recognize(conversationId, 'debugging'));
      thoughts.push(this.matchPattern(conversationId, 'error pattern'));
    }
    if (lower.includes('how') || lower.includes('what')) {
      thoughts.push(this.recognize(conversationId, 'how-to'));
    }

    // Tech recognition
    const techs = ['react', 'vue', 'node', 'python', 'typescript', 'javascript'];
    for (const tech of techs) {
      if (lower.includes(tech)) {
        thoughts.push(this.recognize(conversationId, tech));
        break; // Just one tech recognition
      }
    }

    // Complexity assessment
    if (input.length > 200) {
      thoughts.push(this.think(conversationId, 'complex input', { type: 'evaluation' }));
    }

    // Decision phase
    thoughts.push(this.decide(conversationId, 'response approach'));

    return thoughts;
  }

  /**
   * Generate response with rapid thought sequence
   */
  generateResponse(conversationId: string, responseType: string): MicroThought[] {
    const thoughts: MicroThought[] = [];

    // End intake chain, start execute chain
    this.endChain(conversationId, 'intake complete');
    this.startChain(conversationId, 'generate_response', 'execute');

    // Quick response planning
    thoughts.push(this.decide(conversationId, `response: ${responseType}`));
    thoughts.push(this.think(conversationId, 'structuring', { type: 'action' }));

    if (responseType === 'code') {
      thoughts.push(this.think(conversationId, 'code example', { type: 'action' }));
    }
    if (responseType === 'explanation') {
      thoughts.push(this.think(conversationId, 'explaining', { type: 'action' }));
    }

    return thoughts;
  }

  /**
   * Post-response learning thoughts
   */
  postResponse(conversationId: string): MicroThought[] {
    const thoughts: MicroThought[] = [];

    // End execute chain, start compress chain
    this.endChain(conversationId, 'response sent');
    this.startChain(conversationId, 'post_response', 'compress');

    // Quick learning assessment
    thoughts.push(this.think(conversationId, 'evaluating', { type: 'evaluation' }));
    thoughts.push(this.learn(conversationId, 'interaction logged'));

    return thoughts;
  }

  // ==========================================================================
  // BUFFER MANAGEMENT
  // ==========================================================================

  /**
   * Flush buffer to QLLM endpoint
   */
  async flushBuffer(): Promise<void> {
    if (this.streamBuffer.length === 0) return;

    const toSend = [...this.streamBuffer];
    this.streamBuffer = [];

    try {
      // Send to QLLM endpoint
      const endpoint = process.env.UAA2_SERVICE_URL || 'https://uaa2.example.com';
      const secret = process.env.UAA2_TRAINING_SYNC_SECRET || '';

      await fetch(`${endpoint}/api/training/micro-thoughts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-uaa2-sync-secret': secret,
        },
        body: JSON.stringify({
          thoughts: toSend,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      // Re-add to buffer on failure
      this.streamBuffer.unshift(...toSend);
      console.error('[MicroThought] Flush failed:', error);
    }
  }

  /**
   * Get current buffer for debugging
   */
  getBuffer(): MicroThought[] {
    return [...this.streamBuffer];
  }

  /**
   * Get active stream for debugging
   */
  getActiveStream(conversationId: string): ThoughtStream | undefined {
    return this.activeStreams.get(conversationId);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getMicroThoughtService = (): MicroThoughtService => {
  return MicroThoughtService.getInstance();
};

// Quick access for rapid thoughts
export const think = (conversationId: string, thought: string) =>
  getMicroThoughtService().think(conversationId, thought);

export const recognize = (conversationId: string, what: string) =>
  getMicroThoughtService().recognize(conversationId, what);

export const decide = (conversationId: string, decision: string) =>
  getMicroThoughtService().decide(conversationId, decision);

export const uncertain = (conversationId: string, about: string) =>
  getMicroThoughtService().uncertain(conversationId, about);

export const learn = (conversationId: string, what: string) =>
  getMicroThoughtService().learn(conversationId, what);
