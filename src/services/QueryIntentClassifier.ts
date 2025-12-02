/**
 * Query Intent Classifier
 *
 * Automatically detects the user's intent and routes to the appropriate mode.
 * This makes explicit mode toggles redundant - the assistant just works.
 *
 * Intent Categories:
 * - SEARCH: Looking up information, facts, definitions, "what is", "how does"
 * - ASSIST: Conversation, help, explanation, analysis, "help me", "explain"
 * - BUILD: Code generation, architecture, implementation, "create", "build", "generate"
 */

export type QueryIntent = 'search' | 'assist' | 'build';

export interface IntentClassification {
  intent: QueryIntent;
  confidence: number;
  reasoning: string;
  suggestedMode: QueryIntent;
  keywords: string[];
}

// Intent patterns with weights
const INTENT_PATTERNS: Record<QueryIntent, { patterns: RegExp[]; keywords: string[]; weight: number }> = {
  search: {
    patterns: [
      /^(what|who|where|when|which|how many|how much)\s/i,
      /\?(what|who|where|when|which|how)\s/i,
      /^(find|search|look up|lookup|look for)\s/i,
      /^(define|definition of)\s/i,
      /^(list|show me|give me)\s+(all|the|some)?\s*(options|examples|ways)/i,
      /\b(best practices?|patterns?|gotchas?|wisdom)\b/i,
      /^(is there|are there|does|do|can)\s/i,
    ],
    keywords: [
      'what', 'who', 'where', 'when', 'which', 'find', 'search', 'lookup',
      'define', 'list', 'show', 'best practice', 'pattern', 'gotcha', 'wisdom',
      'examples', 'documentation', 'reference', 'compare', 'difference',
    ],
    weight: 1.0,
  },
  assist: {
    patterns: [
      /^(help|assist|explain|clarify|elaborate)\s/i,
      /^(can you|could you|would you|will you)\s+(help|explain|tell|assist)/i,
      /^(i need|i want|i'd like)\s+(help|assistance|to understand)/i,
      /^(why|how come|how does)\s/i,
      /\b(understand|confused|stuck|problem|issue)\b/i,
      /^(tell me|teach me|show me how)/i,
      /\b(advice|suggestion|recommend|opinion)\b/i,
      /^(hi|hello|hey|thanks|thank you)/i,
    ],
    keywords: [
      'help', 'explain', 'understand', 'why', 'how', 'advice', 'suggest',
      'recommend', 'think', 'opinion', 'confused', 'stuck', 'problem',
      'issue', 'tell me', 'teach', 'clarify', 'elaborate', 'analyze',
    ],
    weight: 1.0,
  },
  build: {
    patterns: [
      /^(build|create|generate|make|write|develop|implement)\s/i,
      /^(code|scaffold|setup|initialize|init)\s/i,
      /\b(api|endpoint|component|service|class|function|module)\b.*\b(for|that|which)\b/i,
      /^(i want to|let's|we should)\s+(build|create|make)/i,
      /\b(architecture|design|structure|schema)\s+(for|of)\b/i,
      /\b(deploy|deployment|infrastructure|ci\/cd)\b/i,
      /\b(react|next|node|python|typescript|javascript)\s+(app|application|project|component)/i,
      /^(add|implement|integrate)\s+\w+\s+(feature|functionality|support)/i,
    ],
    keywords: [
      'build', 'create', 'generate', 'make', 'write', 'develop', 'implement',
      'code', 'scaffold', 'setup', 'api', 'endpoint', 'component', 'service',
      'class', 'function', 'module', 'architecture', 'design', 'schema',
      'deploy', 'app', 'application', 'project', 'feature', 'database',
    ],
    weight: 1.2, // Slightly higher weight for build since it's more specific
  },
};

// Conversation context patterns (indicate ASSIST mode)
const CONVERSATIONAL_PATTERNS = [
  /^(yes|no|yeah|nope|sure|ok|okay|thanks|thank you|please|sorry)/i,
  /^(i think|i believe|in my opinion|i feel|i'm|i am)/i,
  /^(that's|it's|this is)\s+(good|great|interesting|helpful|useful)/i,
  /^(can we|let's|shall we)\s+(talk|discuss|chat)/i,
];

// Code-specific patterns (strong BUILD indicators)
const CODE_PATTERNS = [
  /```[\w]*\n/,  // Code blocks
  /\b(function|const|let|var|class|interface|type|import|export)\b/,
  /\b(async|await|return|if|else|for|while|switch)\b/,
  /[{}\[\]()];?$/,  // Code-like endings
  /\b\w+\.\w+\(/,  // Method calls
];

class QueryIntentClassifier {
  /**
   * Classify the intent of a user query
   */
  classify(query: string, conversationContext?: { previousMessages?: string[]; currentMode?: QueryIntent }): IntentClassification {
    const normalizedQuery = query.trim().toLowerCase();
    const scores: Record<QueryIntent, number> = { search: 0, assist: 0, build: 0 };
    const matchedKeywords: Record<QueryIntent, string[]> = { search: [], assist: [], build: [] };

    // Check for conversational patterns first (strong ASSIST indicator)
    for (const pattern of CONVERSATIONAL_PATTERNS) {
      if (pattern.test(query)) {
        scores.assist += 2;
      }
    }

    // Check for code patterns (strong BUILD indicator)
    for (const pattern of CODE_PATTERNS) {
      if (pattern.test(query)) {
        scores.build += 2;
      }
    }

    // Score each intent category
    for (const [intent, config] of Object.entries(INTENT_PATTERNS) as [QueryIntent, typeof INTENT_PATTERNS.search][]) {
      // Check regex patterns
      for (const pattern of config.patterns) {
        if (pattern.test(query)) {
          scores[intent] += 2 * config.weight;
        }
      }

      // Check keywords
      for (const keyword of config.keywords) {
        if (normalizedQuery.includes(keyword.toLowerCase())) {
          scores[intent] += 1 * config.weight;
          matchedKeywords[intent].push(keyword);
        }
      }
    }

    // Context-aware adjustments
    if (conversationContext?.currentMode) {
      // Slight bias towards current mode for continuity
      scores[conversationContext.currentMode] += 0.5;
    }

    // If previous messages exist and query is short, likely a follow-up (ASSIST)
    if (conversationContext?.previousMessages?.length && query.length < 50) {
      scores.assist += 1;
    }

    // Determine winner
    const entries = Object.entries(scores) as [QueryIntent, number][];
    entries.sort((a, b) => b[1] - a[1]);

    const [topIntent, topScore] = entries[0];
    const [secondIntent, secondScore] = entries[1];

    // Calculate confidence based on score differential
    const totalScore = entries.reduce((sum, [, score]) => sum + score, 0);
    const confidence = totalScore > 0
      ? Math.min(0.95, (topScore / totalScore) + (topScore - secondScore) * 0.1)
      : 0.33; // Equal distribution if no signals

    // Generate reasoning
    const reasoning = this.generateReasoning(query, topIntent, matchedKeywords[topIntent], confidence);

    return {
      intent: topIntent,
      confidence,
      reasoning,
      suggestedMode: topIntent,
      keywords: matchedKeywords[topIntent],
    };
  }

  /**
   * Quick classification without detailed analysis
   */
  quickClassify(query: string): QueryIntent {
    const result = this.classify(query);
    return result.intent;
  }

  /**
   * Check if a query should trigger a mode switch
   */
  shouldSwitchMode(query: string, currentMode: QueryIntent): { shouldSwitch: boolean; newMode: QueryIntent; confidence: number } {
    const classification = this.classify(query, { currentMode });

    // Only switch if confidence is high enough and it's a different mode
    const shouldSwitch = classification.intent !== currentMode && classification.confidence > 0.6;

    return {
      shouldSwitch,
      newMode: classification.intent,
      confidence: classification.confidence,
    };
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(query: string, intent: QueryIntent, keywords: string[], confidence: number): string {
    const confidenceLevel = confidence > 0.8 ? 'high' : confidence > 0.5 ? 'moderate' : 'low';

    const intentDescriptions: Record<QueryIntent, string> = {
      search: 'information lookup or knowledge search',
      assist: 'conversation, help, or explanation',
      build: 'code generation or implementation',
    };

    let reasoning = `Detected ${intentDescriptions[intent]} intent with ${confidenceLevel} confidence.`;

    if (keywords.length > 0) {
      reasoning += ` Keywords: ${keywords.slice(0, 3).join(', ')}.`;
    }

    return reasoning;
  }

  /**
   * Get all possible intents with their scores (for debugging/UI)
   */
  getAllIntentScores(query: string): Record<QueryIntent, { score: number; confidence: number }> {
    const classification = this.classify(query);
    const normalizedQuery = query.trim().toLowerCase();

    // Re-calculate for all intents
    const scores: Record<QueryIntent, number> = { search: 0, assist: 0, build: 0 };

    for (const [intent, config] of Object.entries(INTENT_PATTERNS) as [QueryIntent, typeof INTENT_PATTERNS.search][]) {
      for (const pattern of config.patterns) {
        if (pattern.test(query)) {
          scores[intent] += 2 * config.weight;
        }
      }
      for (const keyword of config.keywords) {
        if (normalizedQuery.includes(keyword.toLowerCase())) {
          scores[intent] += 1 * config.weight;
        }
      }
    }

    const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0) || 1;

    return {
      search: { score: scores.search, confidence: scores.search / totalScore },
      assist: { score: scores.assist, confidence: scores.assist / totalScore },
      build: { score: scores.build, confidence: scores.build / totalScore },
    };
  }
}

// Singleton instance
let classifierInstance: QueryIntentClassifier | null = null;

export function getQueryIntentClassifier(): QueryIntentClassifier {
  if (!classifierInstance) {
    classifierInstance = new QueryIntentClassifier();
  }
  return classifierInstance;
}

export default QueryIntentClassifier;
