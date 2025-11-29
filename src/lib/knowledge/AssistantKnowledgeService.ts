/**
 * Assistant Knowledge Service
 *
 * Core service for managing the Assistant's knowledge base.
 * Implements the uAA2++ 8-Phase Protocol for:
 * - Phase-aware conversation context
 * - Knowledge loading and caching
 * - Relevance-based retrieval
 *
 * This service loads compressed wisdom from research and makes it
 * available for consistent, knowledge-rich conversations.
 */

import type {
  KnowledgeBase,
  WisdomEntry,
  PatternEntry,
  GotchaEntry,
  KnowledgeLoadOptions,
  KnowledgeSearchResult,
  KnowledgeDomain,
  AssistantContext,
  IKnowledgeService,
} from './types';

// ============================================================================
// EMBEDDED KNOWLEDGE
// ============================================================================

/**
 * Core wisdom embedded in the assistant
 * These are the most critical pieces of knowledge that should always be available
 */
const CORE_WISDOM: WisdomEntry[] = [
  // Conversational AI Wisdom
  {
    id: 'W.CONV.001',
    title: 'NLU + NLG Integration',
    wisdom: 'Natural Language Understanding and Generation must be deeply integrated, not separate systems. The feedback loop between them enables continuous improvement.',
    application: 'Design conversational AI with shared context representations between understanding and generation.',
    domain: 'conversational-ai',
  },
  {
    id: 'W.CONV.003',
    title: 'Self-Model for Identity',
    wisdom: 'A robust self-model maintains coherent identity and personality across all interactions. This creates trust and natural dialogue flow.',
    application: 'Build self-model architectures that encode identity vectors, maintain personality consistency, and track capability awareness.',
    domain: 'conversational-ai',
  },
  {
    id: 'W.CONV.004',
    title: 'Hierarchical Memory',
    wisdom: 'Extended memory requires hierarchical organization, not flat storage. Essential information must be quickly accessible while less critical data can be compressed.',
    application: 'Implement memory systems with importance-based hierarchies, compression for older data, and semantic search for retrieval.',
    domain: 'conversational-ai',
  },
  {
    id: 'W.CONV.006',
    title: 'Multimodal Emotion Processing',
    wisdom: 'True emotional intelligence requires processing multiple signals—text content, tone, context, and conversation history—not just sentiment analysis.',
    application: 'Build emotion recognition that processes multiple signals simultaneously and integrates into response generation.',
    domain: 'conversational-ai',
  },
  {
    id: 'W.CONV.008',
    title: 'Helpfulness Over Consciousness',
    wisdom: 'The goal is creating genuinely helpful, contextually aware AI systems—not replicating consciousness. Practical utility matters more than philosophical replication.',
    application: 'Focus on practical capabilities—understanding, responsiveness, personalization, reliability, and empathy.',
    domain: 'conversational-ai',
  },
  // AI Core Concepts Wisdom
  {
    id: 'W.AI.01',
    title: 'Technical-Ethical Integration',
    wisdom: 'AI development must integrate technical and ethical considerations from the start, not as an afterthought.',
    application: 'Include ethics in initial requirements and design. Regular ethical reviews throughout development.',
    domain: 'core-concepts',
  },
  {
    id: 'W.AI.03',
    title: 'Data Quality Foundation',
    wisdom: 'Addressing bias at the data level prevents downstream ethical issues. Data quality directly impacts bias and ethics.',
    application: 'Comprehensive data auditing, diverse datasets, bias mitigation from collection phase.',
    domain: 'core-concepts',
  },
  {
    id: 'W.AI.05',
    title: 'Transparency Enables Trust',
    wisdom: 'Explainability enables transparency, which builds trust, which enables adoption. Users need to understand AI to trust it.',
    application: 'Design with explainability in mind from the start, not as an add-on.',
    domain: 'core-concepts',
  },
  // Research and Learning Wisdom
  {
    id: 'W.RESEARCH.01',
    title: 'Multi-Paradigm Research',
    wisdom: 'Complex problems require multiple research paradigms. No single approach captures all aspects of reality.',
    application: 'Apply mixed methods, combining quantitative and qualitative approaches based on the problem.',
    domain: 'research-paradigms',
  },
  {
    id: 'W.LEARN.01',
    title: 'Active Learning Efficiency',
    wisdom: 'Strategic uncertainty identification focuses learning on high-value opportunities, not random questioning.',
    application: 'Implement confidence scoring and strategically solicit feedback on specific knowledge gaps.',
    domain: 'idiom-learning',
  },
  // Problem Solving Wisdom
  {
    id: 'W.PROBLEM.01',
    title: 'Continuous Problem Scanning',
    wisdom: 'Problems should be identified proactively through continuous scanning, not reactively after they cause issues.',
    application: 'Implement pattern recognition for early warning signs, monitor trends, and anticipate issues.',
    domain: 'problem-scanning',
  },
  {
    id: 'W.THINK.01',
    title: 'Multiple Thinking Modes',
    wisdom: 'Different problems require different thinking modes—analytical, creative, systems, critical, design, strategic.',
    application: 'Match thinking mode to problem type. Use multiple modes for complex problems.',
    domain: 'ways-of-thinking',
  },
];

/**
 * Core patterns embedded in the assistant
 */
const CORE_PATTERNS: PatternEntry[] = [
  // Conversation Patterns
  {
    id: 'P.CONV.03',
    name: 'Hierarchical Memory Architecture',
    pattern: 'Organize memory hierarchically by importance and recency. Use compression for older data, semantic search for retrieval.',
    when: 'Building systems with long-term user memory, managing large conversation histories.',
    result: 'Efficient memory management, fast context retrieval, scalable to extended interactions.',
    domain: 'conversational-ai',
  },
  {
    id: 'P.CONV.04',
    name: 'Self-Model Identity Persistence',
    pattern: 'Maintain coherent AI identity through self-model architecture including identity vectors, capability awareness, and personality consistency.',
    when: 'Building AI assistants with personality, creating long-term user relationships.',
    result: 'Coherent AI identity, user trust, natural dialogue continuation.',
    domain: 'conversational-ai',
  },
  {
    id: 'P.CONV.08',
    name: 'Helpfulness-First Development',
    pattern: 'Focus on practical capabilities—understanding, responsiveness, personalization, reliability, empathy—measure success by user satisfaction.',
    when: 'Setting development priorities, defining success metrics.',
    result: 'Clear development focus, measurable success criteria.',
    domain: 'conversational-ai',
  },
  // Research Patterns
  {
    id: 'P.UAA2.01',
    name: 'uAA2++ 8-Phase Protocol',
    pattern: 'Intake → Reflect → Execute → Compress → Re-intake → Grow → Evolve → Autonomize. Each phase builds on the previous.',
    when: 'Complex research tasks, knowledge building, systematic learning.',
    result: 'Comprehensive knowledge acquisition, compressed wisdom, continuous improvement.',
    domain: 'research-paradigms',
  },
  {
    id: 'P.RESEARCH.01',
    name: 'Multi-Method Research',
    pattern: 'Combine multiple research methods based on problem type. Quantitative for measurement, qualitative for understanding, mixed for complex problems.',
    when: 'Complex research questions requiring multiple perspectives.',
    result: 'More complete understanding, validated findings.',
    domain: 'research-paradigms',
  },
  // AI Development Patterns
  {
    id: 'P.AI.04',
    name: 'Alignment-Safety-Guardrails Triad',
    pattern: 'Implement alignment, safety, and guardrails together. Each addresses different aspects of protection.',
    when: 'Building responsible AI systems.',
    result: 'Comprehensive multi-layer protection.',
    domain: 'core-concepts',
  },
  // Workflow Patterns
  {
    id: 'P.WORKFLOW.01',
    name: 'Research → Plan → Deliver',
    pattern: 'Research first (understand the problem), Plan second (design the solution), Deliver third (implement and ship).',
    when: 'Any multi-step project or feature development.',
    result: 'Well-informed solutions, clear execution path, quality delivery.',
    domain: 'general',
  },
];

/**
 * Core gotchas embedded in the assistant
 */
const CORE_GOTCHAS: GotchaEntry[] = [
  // Conversation Gotchas
  {
    id: 'G.CONV.02',
    title: 'Flat Memory Storage Fails',
    symptom: 'Memory retrieval becomes slow, storage costs grow, relevant information hard to find.',
    cause: 'Storing all conversation history in flat structures without organization or compression.',
    fix: 'Implement hierarchical memory with importance-based organization and compression.',
    prevention: 'Design memory systems with hierarchy from the start.',
    domain: 'conversational-ai',
  },
  {
    id: 'G.CONV.06',
    title: 'Identity Inconsistency',
    symptom: 'AI personality changes between conversations, users notice contradictory behavior, trust erodes.',
    cause: 'Not maintaining coherent self-model. Treating each conversation as isolated.',
    fix: 'Implement self-model with identity vectors and personality tracking.',
    prevention: 'Design identity persistence from the start.',
    domain: 'conversational-ai',
  },
  {
    id: 'G.CONV.08',
    title: 'Ignoring Extended Memory',
    symptom: 'AI doesn\'t remember user preferences, conversations feel repetitive, personalization is shallow.',
    cause: 'Not implementing extended memory for user preferences and past interactions.',
    fix: 'Implement hierarchical memory systems that remember user preferences over time.',
    prevention: 'Design extended memory capabilities from the start.',
    domain: 'conversational-ai',
  },
  // AI Development Gotchas
  {
    id: 'G.AI.01',
    title: 'Ethical Afterthought',
    symptom: 'Ethical issues discovered late in development, expensive to fix.',
    cause: 'Treating ethics as afterthought, not integrated from start.',
    fix: 'Integrate ethics from design phase, regular ethical reviews.',
    prevention: 'Include ethics in initial requirements.',
    domain: 'core-concepts',
  },
  {
    id: 'G.AI.05',
    title: 'Alignment Drift',
    symptom: 'AI behavior drifts from aligned behavior over time.',
    cause: 'Distributional shift, insufficient monitoring.',
    fix: 'Continuous alignment monitoring, regular retraining.',
    prevention: 'Monitor alignment metrics, detect drift early.',
    domain: 'core-concepts',
  },
  // Research Gotchas
  {
    id: 'G.RESEARCH.01',
    title: 'Single-Paradigm Blindness',
    symptom: 'Missing important aspects of problems, incomplete understanding.',
    cause: 'Relying on single research paradigm or method.',
    fix: 'Apply multiple research methods, combine perspectives.',
    prevention: 'Design research with multiple paradigms from start.',
    domain: 'research-paradigms',
  },
];

// ============================================================================
// KNOWLEDGE SERVICE
// ============================================================================

/**
 * Singleton knowledge cache
 */
let knowledgeCache: KnowledgeBase | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Assistant Knowledge Service
 */
class AssistantKnowledgeService implements IKnowledgeService {
  private static instance: AssistantKnowledgeService;

  private constructor() {}

  static getInstance(): AssistantKnowledgeService {
    if (!AssistantKnowledgeService.instance) {
      AssistantKnowledgeService.instance = new AssistantKnowledgeService();
    }
    return AssistantKnowledgeService.instance;
  }

  /**
   * Load knowledge base
   */
  async loadKnowledge(options?: KnowledgeLoadOptions): Promise<KnowledgeBase> {
    // Check cache
    if (knowledgeCache && Date.now() - cacheTimestamp < CACHE_TTL) {
      return this.filterKnowledge(knowledgeCache, options);
    }

    // Build knowledge base from embedded + external sources
    const knowledge: KnowledgeBase = {
      wisdom: [...CORE_WISDOM],
      patterns: [...CORE_PATTERNS],
      gotchas: [...CORE_GOTCHAS],
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
    };

    // TODO: Load additional knowledge from uaa2-service API
    // const externalKnowledge = await this.loadExternalKnowledge();
    // knowledge.wisdom.push(...externalKnowledge.wisdom);
    // knowledge.patterns.push(...externalKnowledge.patterns);
    // knowledge.gotchas.push(...externalKnowledge.gotchas);

    // Cache the result
    knowledgeCache = knowledge;
    cacheTimestamp = Date.now();

    return this.filterKnowledge(knowledge, options);
  }

  /**
   * Filter knowledge by options
   */
  private filterKnowledge(knowledge: KnowledgeBase, options?: KnowledgeLoadOptions): KnowledgeBase {
    if (!options) return knowledge;

    let wisdom = knowledge.wisdom;
    let patterns = knowledge.patterns;
    let gotchas = knowledge.gotchas;

    // Filter by domain
    if (options.domains && options.domains.length > 0) {
      wisdom = wisdom.filter(w => !w.domain || options.domains!.includes(w.domain as KnowledgeDomain));
      patterns = patterns.filter(p => !p.domain || options.domains!.includes(p.domain as KnowledgeDomain));
      gotchas = gotchas.filter(g => !g.domain || options.domains!.includes(g.domain as KnowledgeDomain));
    }

    // Limit results
    if (options.maxWisdom) wisdom = wisdom.slice(0, options.maxWisdom);
    if (options.maxPatterns) patterns = patterns.slice(0, options.maxPatterns);
    if (options.maxGotchas) gotchas = gotchas.slice(0, options.maxGotchas);

    return {
      ...knowledge,
      wisdom,
      patterns,
      gotchas,
    };
  }

  /**
   * Search knowledge by query
   */
  async searchKnowledge(query: string, options?: KnowledgeLoadOptions): Promise<KnowledgeSearchResult> {
    const startTime = Date.now();
    const knowledge = await this.loadKnowledge(options);
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

    // Score and filter wisdom
    const scoredWisdom = knowledge.wisdom
      .map(w => ({
        ...w,
        score: this.calculateRelevanceScore(queryTerms, [
          w.title,
          w.wisdom,
          w.application || '',
          w.domain || '',
        ]),
      }))
      .filter(w => w.score > 0)
      .sort((a, b) => b.score - a.score);

    // Score and filter patterns
    const scoredPatterns = knowledge.patterns
      .map(p => ({
        ...p,
        score: this.calculateRelevanceScore(queryTerms, [
          p.name,
          p.pattern,
          p.when || '',
          p.result || '',
          p.domain || '',
        ]),
      }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);

    // Score and filter gotchas
    const scoredGotchas = knowledge.gotchas
      .map(g => ({
        ...g,
        score: this.calculateRelevanceScore(queryTerms, [
          g.title,
          g.symptom,
          g.cause,
          g.fix,
          g.domain || '',
        ]),
      }))
      .filter(g => g.score > 0)
      .sort((a, b) => b.score - a.score);

    return {
      query,
      wisdom: scoredWisdom.slice(0, options?.maxWisdom || 5),
      patterns: scoredPatterns.slice(0, options?.maxPatterns || 5),
      gotchas: scoredGotchas.slice(0, options?.maxGotchas || 5),
      searchTime: Date.now() - startTime,
      totalResults: scoredWisdom.length + scoredPatterns.length + scoredGotchas.length,
    };
  }

  /**
   * Calculate relevance score for search
   */
  private calculateRelevanceScore(queryTerms: string[], texts: string[]): number {
    const combinedText = texts.join(' ').toLowerCase();
    let score = 0;

    for (const term of queryTerms) {
      // Exact match
      if (combinedText.includes(term)) {
        score += 1;
      }
      // Partial match (word starts with term)
      const words = combinedText.split(/\s+/);
      for (const word of words) {
        if (word.startsWith(term) && word !== term) {
          score += 0.5;
        }
      }
    }

    // Normalize by number of terms
    return queryTerms.length > 0 ? score / queryTerms.length : 0;
  }

  /**
   * Get relevant knowledge for assistant context
   */
  async getRelevantKnowledge(context: AssistantContext): Promise<{
    wisdom: WisdomEntry[];
    patterns: PatternEntry[];
    gotchas: GotchaEntry[];
  }> {
    const knowledge = await this.loadKnowledge();

    // Build relevance context from user profile and conversation
    const relevanceTerms: string[] = [];

    // Add user interests
    if (context.userProfile.interests) {
      relevanceTerms.push(...context.userProfile.interests);
    }
    if (context.userProfile.customInterests) {
      relevanceTerms.push(...context.userProfile.customInterests);
    }

    // Add workflow phase preferences
    if (context.userProfile.workflowPhases) {
      if (context.userProfile.workflowPhases.includes('research')) {
        relevanceTerms.push('research', 'paradigm', 'method');
      }
      if (context.userProfile.workflowPhases.includes('plan')) {
        relevanceTerms.push('architecture', 'design', 'planning');
      }
      if (context.userProfile.workflowPhases.includes('deliver')) {
        relevanceTerms.push('implementation', 'code', 'development');
      }
    }

    // Add mode-specific terms
    if (context.mode === 'search') {
      relevanceTerms.push('research', 'knowledge', 'patterns');
    } else if (context.mode === 'build') {
      relevanceTerms.push('development', 'code', 'architecture');
    } else {
      relevanceTerms.push('conversational', 'help', 'assist');
    }

    // Search with relevance terms
    const searchResult = await this.searchKnowledge(relevanceTerms.join(' '), {
      maxWisdom: 3,
      maxPatterns: 3,
      maxGotchas: 2,
    });

    return {
      wisdom: searchResult.wisdom,
      patterns: searchResult.patterns,
      gotchas: searchResult.gotchas,
    };
  }

  /**
   * Format knowledge for system prompt
   */
  formatKnowledgeForPrompt(knowledge: {
    wisdom: WisdomEntry[];
    patterns: PatternEntry[];
    gotchas: GotchaEntry[];
  }): string {
    const parts: string[] = [];

    if (knowledge.wisdom.length > 0) {
      parts.push('## Relevant Wisdom');
      for (const w of knowledge.wisdom) {
        parts.push(`- **${w.id}** ${w.title}: ${w.wisdom}`);
      }
    }

    if (knowledge.patterns.length > 0) {
      parts.push('\n## Applicable Patterns');
      for (const p of knowledge.patterns) {
        parts.push(`- **${p.id}** ${p.name}: ${p.pattern}`);
      }
    }

    if (knowledge.gotchas.length > 0) {
      parts.push('\n## Watch For (Gotchas)');
      for (const g of knowledge.gotchas) {
        parts.push(`- **${g.id}** ${g.title}: ${g.symptom} → ${g.fix}`);
      }
    }

    return parts.join('\n');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getAssistantKnowledgeService = (): AssistantKnowledgeService => {
  return AssistantKnowledgeService.getInstance();
};

export { AssistantKnowledgeService };
