/**
 * Thought-Knowledge Connector
 *
 * Connects micro-thoughts with knowledge retrieval and memory.
 * Uses quantum parallel batching for rapid, concurrent knowledge lookups.
 *
 * How it works:
 * 1. Thought fires (e.g., "React hook" recognition)
 * 2. Connector immediately triggers parallel knowledge searches
 * 3. Results flow back to enhance the thought
 * 4. Associations are stored for future recall
 *
 * This mimics how human cognition works:
 * - A thought triggers associated memories
 * - Multiple associations fire in parallel
 * - Connections strengthen with use
 *
 * Knowledge Sources:
 * - LOCAL: User's personal wisdom, patterns, gotchas, facts (always available)
 * - EXTERNAL: World knowledge from Master Portal, documentation, domain packs
 *
 * Design: "Smarter online, still remembers offline"
 * - Online: Parallel retrieval from local + external sources
 * - Offline: Local memory + cached world knowledge
 *
 * Integration with QLLM:
 * - Thought-knowledge associations are training data
 * - Teaches Brittney what to recall when
 */

import { getMicroThoughtService, type MicroThought, type ThoughtType } from './MicroThoughtService';
import { getUserMemoryStorageService } from './UserMemoryStorageService';
import { getWorldKnowledgeService, type NetworkStatus, type ExternalSource } from './WorldKnowledgeService';
import { getResearchMasterService, type ResearchResult } from './ResearchMasterService';
import { getKnowledgeHelpersService, type ResearchNeedAssessment } from './KnowledgeHelpersService';
import type { UAA2Phase } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Knowledge retrieval result from a thought
 */
export interface ThoughtKnowledgeResult {
  thoughtId: string;
  thought: string;
  retrievals: KnowledgeRetrieval[];
  associations: KnowledgeAssociation[];
  totalRetrievalTime: number;
  // Network status and source breakdown
  networkStatus: NetworkStatus;
  sourceBreakdown: {
    local: number;
    external: number;
  };
  // Research assessment (for deep thoughts)
  researchNeeded?: ResearchNeedAssessment;
  // Deep research result (if triggered)
  deepResearch?: ResearchResult;
}

/**
 * Single knowledge retrieval
 */
export interface KnowledgeRetrieval {
  id: string;
  source: 'wisdom' | 'patterns' | 'gotchas' | 'facts' | 'memory' | 'external';
  content: string;
  relevance: number;      // 0-1
  retrievalTime: number;  // ms
  triggered: string;      // What thought triggered this
}

/**
 * Association between thought and knowledge
 */
export interface KnowledgeAssociation {
  thoughtPattern: string;   // Pattern that triggered (e.g., "react hook")
  knowledgeKey: string;     // What knowledge was accessed
  strength: number;         // 0-1, strengthens with use
  lastUsed: number;         // Timestamp
  useCount: number;
}

/**
 * Parallel retrieval batch
 */
interface RetrievalBatch {
  id: string;
  queries: RetrievalQuery[];
  priority: number;
  callback: (results: KnowledgeRetrieval[]) => void;
}

/**
 * Knowledge source type (local vs external)
 */
type LocalSource = 'wisdom' | 'patterns' | 'gotchas' | 'facts' | 'memory';
type KnowledgeSourceType = LocalSource | 'external';

/**
 * Single retrieval query
 */
interface RetrievalQuery {
  pattern: string;
  sources: Array<KnowledgeSourceType>;
  maxResults: number;
  // New: Whether to include external world knowledge
  includeExternal?: boolean;
  externalSources?: ExternalSource[];
}

// ============================================================================
// KNOWLEDGE TRIGGERS
// ============================================================================

/**
 * What knowledge to retrieve for each thought type
 *
 * Now includes external world knowledge for richer context.
 * External sources are queried in parallel with local memory.
 */
const THOUGHT_KNOWLEDGE_TRIGGERS: Record<ThoughtType, RetrievalQuery> = {
  recognition: {
    pattern: '',  // Filled dynamically from thought content
    sources: ['patterns', 'facts'],
    maxResults: 3,
    // Recognition needs quick pattern matching + world knowledge for context
    includeExternal: true,
    externalSources: ['domain-knowledge', 'documentation'],
  },
  question: {
    pattern: '',
    sources: ['wisdom', 'gotchas'],
    maxResults: 2,
    // Questions benefit from external documentation
    includeExternal: true,
    externalSources: ['master-portal', 'documentation'],
  },
  recall: {
    pattern: '',
    sources: ['memory', 'facts', 'wisdom'],
    maxResults: 5,
    // Recall primarily uses local memory, but can check cache
    includeExternal: false,
  },
  pattern: {
    pattern: '',
    sources: ['patterns', 'gotchas'],
    maxResults: 3,
    // Pattern matching needs both local and world patterns
    includeExternal: true,
    externalSources: ['master-portal', 'domain-knowledge'],
  },
  association: {
    pattern: '',
    sources: ['wisdom', 'patterns', 'facts'],
    maxResults: 4,
    // Associations connect to broader knowledge
    includeExternal: true,
    externalSources: ['master-portal', 'documentation', 'domain-knowledge'],
  },
  uncertainty: {
    pattern: '',
    sources: ['gotchas', 'wisdom'],
    maxResults: 2,
    // Uncertainty should check world knowledge for clarification
    includeExternal: true,
    externalSources: ['master-portal', 'documentation'],
  },
  decision: {
    pattern: '',
    sources: ['patterns', 'wisdom'],
    maxResults: 2,
    // Decisions benefit from best practices in world knowledge
    includeExternal: true,
    externalSources: ['domain-knowledge', 'documentation'],
  },
  action: {
    pattern: '',
    sources: ['patterns'],
    maxResults: 1,
    // Actions need to be fast - local only
    includeExternal: false,
  },
  evaluation: {
    pattern: '',
    sources: ['gotchas', 'wisdom'],
    maxResults: 2,
    // Evaluation needs comprehensive knowledge check
    includeExternal: true,
    externalSources: ['master-portal', 'domain-knowledge'],
  },
  learning: {
    pattern: '',
    sources: ['wisdom', 'patterns', 'gotchas'],
    maxResults: 3,
    // Learning actively seeks external knowledge
    includeExternal: true,
    externalSources: ['master-portal', 'documentation', 'domain-knowledge'],
  },
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class ThoughtKnowledgeConnector {
  private static instance: ThoughtKnowledgeConnector;

  // Association storage (in-memory, synced to local storage)
  private associations = new Map<string, KnowledgeAssociation>();

  // Retrieval queue for parallel processing
  private retrievalQueue: RetrievalBatch[] = [];
  private isProcessing = false;

  // Parallel lanes for retrieval
  private maxParallelRetrievals = 5;
  private activeRetrievals = 0;

  // Cache for recent retrievals
  private retrievalCache = new Map<string, { results: KnowledgeRetrieval[]; timestamp: number }>();
  private cacheMaxAge = 30000; // 30 seconds

  private constructor() {
    // Start periodic cache cleanup
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanCache(), 60000);
    }
  }

  static getInstance(): ThoughtKnowledgeConnector {
    if (!ThoughtKnowledgeConnector.instance) {
      ThoughtKnowledgeConnector.instance = new ThoughtKnowledgeConnector();
    }
    return ThoughtKnowledgeConnector.instance;
  }

  // ==========================================================================
  // THOUGHT-TRIGGERED KNOWLEDGE RETRIEVAL
  // ==========================================================================

  /**
   * Connect a thought to knowledge (async, parallel)
   * This is the main entry point - call after each micro-thought
   *
   * Now retrieves from BOTH local memory AND external world knowledge
   * in parallel for richer context. Works offline with cached knowledge.
   */
  async connectThought(
    userId: string,
    thought: MicroThought
  ): Promise<ThoughtKnowledgeResult> {
    const startTime = Date.now();
    const retrievals: KnowledgeRetrieval[] = [];
    let localCount = 0;
    let externalCount = 0;

    // Get retrieval config for this thought type
    const config = { ...THOUGHT_KNOWLEDGE_TRIGGERS[thought.type] };
    config.pattern = thought.content;

    // Get world knowledge service for external retrieval
    const worldKnowledge = getWorldKnowledgeService();
    const networkStatus = worldKnowledge.getNetworkStatus();

    // Check cache first
    const cacheKey = `${thought.type}:${thought.content}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return {
        thoughtId: thought.id,
        thought: thought.content,
        retrievals: cached,
        associations: this.getAssociations(thought.content),
        totalRetrievalTime: Date.now() - startTime,
        networkStatus,
        sourceBreakdown: {
          local: cached.filter(r => r.source !== 'external').length,
          external: cached.filter(r => r.source === 'external').length,
        },
      };
    }

    // Build parallel retrieval promises
    const retrievalPromises: Promise<KnowledgeRetrieval[]>[] = [];

    // 1. Local memory sources (always queried)
    const localSources = config.sources.filter(s => s !== 'external') as LocalSource[];
    for (const source of localSources) {
      retrievalPromises.push(
        this.retrieveFromSource(userId, source, config.pattern, config.maxResults)
      );
    }

    // 2. External world knowledge (if enabled and online)
    if (config.includeExternal && networkStatus !== 'offline') {
      retrievalPromises.push(
        this.retrieveFromExternal(
          config.pattern,
          config.maxResults,
          config.externalSources
        )
      );
    }

    // Execute all retrievals in parallel
    const results = await Promise.all(retrievalPromises);

    // Flatten and categorize results
    for (const sourceResults of results) {
      for (const result of sourceResults) {
        retrievals.push(result);
        if (result.source === 'external') {
          externalCount++;
        } else {
          localCount++;
        }
      }
    }

    // Sort by relevance
    retrievals.sort((a, b) => b.relevance - a.relevance);

    // Limit total results (more results when we have external)
    const maxTotal = config.includeExternal ? config.maxResults * 3 : config.maxResults * 2;
    const limitedRetrievals = retrievals.slice(0, maxTotal);

    // Update associations
    for (const retrieval of limitedRetrievals) {
      this.strengthenAssociation(thought.content, retrieval.id, retrieval.relevance);
    }

    // Cache results
    this.addToCache(cacheKey, limitedRetrievals);

    return {
      thoughtId: thought.id,
      thought: thought.content,
      retrievals: limitedRetrievals,
      associations: this.getAssociations(thought.content),
      totalRetrievalTime: Date.now() - startTime,
      networkStatus,
      sourceBreakdown: {
        local: localCount,
        external: externalCount,
      },
    };
  }

  /**
   * Retrieve from external world knowledge sources
   */
  private async retrieveFromExternal(
    pattern: string,
    maxResults: number,
    sources?: ExternalSource[]
  ): Promise<KnowledgeRetrieval[]> {
    try {
      const worldKnowledge = getWorldKnowledgeService();
      const result = await worldKnowledge.query({
        pattern,
        maxResults,
        sources: sources || ['master-portal', 'documentation', 'domain-knowledge'],
        priority: 'balanced',
      });

      return result.results;
    } catch (error) {
      console.warn('[ThoughtKnowledge] External retrieval error:', error);
      return [];
    }
  }

  /**
   * Quick knowledge lookup (synchronous from cache/associations)
   * Use for rapid thought enhancement without waiting
   */
  quickLookup(thoughtContent: string): KnowledgeRetrieval[] {
    // Try cache
    const cacheKey = `quick:${thoughtContent}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Try associations
    const associations = this.getAssociations(thoughtContent);
    if (associations.length > 0) {
      // Return associated knowledge (would need actual content lookup in production)
      return associations.map(a => ({
        id: a.knowledgeKey,
        source: 'memory' as const,
        content: `Associated: ${a.knowledgeKey}`,
        relevance: a.strength,
        retrievalTime: 0,
        triggered: thoughtContent,
      }));
    }

    return [];
  }

  // ==========================================================================
  // DEEP THINKING (RESEARCH-ENHANCED)
  // ==========================================================================

  /**
   * Deep thinking - connects thought to comprehensive research
   * Used when standard retrieval isn't enough
   *
   * This triggers:
   * 1. Standard retrieval
   * 2. Research need assessment
   * 3. Deep research if needed (triggers ResearcherAgent queue if critical)
   */
  async deepThink(
    userId: string,
    thought: MicroThought,
    forceDeepResearch = false
  ): Promise<ThoughtKnowledgeResult> {
    const startTime = Date.now();

    // First, do standard connection
    const baseResult = await this.connectThought(userId, thought);

    // Assess if we need deeper research
    const helpers = getKnowledgeHelpersService();
    const researchNeeded = await helpers.needsResearch(
      thought.content,
      baseResult.retrievals.map(r => ({
        id: r.id,
        source: r.source === 'external' ? 'world-knowledge' : 'local-memory',
        content: r.content,
        relevance: r.relevance,
        confidence: r.relevance, // Use relevance as confidence proxy
        type: this.inferFindingType(r.source),
      }))
    );

    // Add research assessment to result
    baseResult.researchNeeded = researchNeeded;

    // If research is needed and we're allowed to do it
    if (forceDeepResearch || (researchNeeded.needsResearch && researchNeeded.urgency !== 'low')) {
      try {
        const research = getResearchMasterService();
        const deepResult = await research.research({
          topic: thought.content,
          mode: researchNeeded.suggestedMode === 'researcher-agent' ? 'comprehensive' : researchNeeded.suggestedMode,
          context: `Thought type: ${thought.type}, Phase: ${thought.phase}`,
          requireSynthesis: true,
          includeGaps: true,
        });

        baseResult.deepResearch = deepResult;

        // Merge deep research findings into retrievals
        for (const finding of deepResult.findings.slice(0, 5)) {
          baseResult.retrievals.push({
            id: finding.id,
            source: 'external',
            content: finding.content,
            relevance: finding.relevance,
            retrievalTime: deepResult.metrics.totalTimeMs,
            triggered: thought.content,
          });
        }

        // Re-sort by relevance
        baseResult.retrievals.sort((a, b) => b.relevance - a.relevance);

      } catch (error) {
        console.warn('[ThoughtKnowledge] Deep research error:', error);
      }
    }

    baseResult.totalRetrievalTime = Date.now() - startTime;

    return baseResult;
  }

  /**
   * Infer finding type from retrieval source
   */
  private inferFindingType(source: KnowledgeRetrieval['source']): 'fact' | 'pattern' | 'wisdom' | 'gotcha' | 'insight' | 'gap' {
    switch (source) {
      case 'wisdom': return 'wisdom';
      case 'patterns': return 'pattern';
      case 'gotchas': return 'gotcha';
      case 'facts': return 'fact';
      default: return 'insight';
    }
  }

  /**
   * Connect dots between two concepts during thinking
   */
  async connectConcepts(conceptA: string, conceptB: string): Promise<{
    connected: boolean;
    explanation: string;
    strength: number;
  }> {
    const helpers = getKnowledgeHelpersService();
    const connection = await helpers.connectDots(conceptA, conceptB);

    if (!connection) {
      return {
        connected: false,
        explanation: `No clear connection between "${conceptA}" and "${conceptB}"`,
        strength: 0,
      };
    }

    return {
      connected: true,
      explanation: connection.explanation,
      strength: connection.strength,
    };
  }

  /**
   * Build rich context for a topic (for comprehensive understanding)
   */
  async buildTopicContext(topic: string): Promise<{
    summary: string;
    keyFacts: string[];
    relatedConcepts: string[];
    commonMistakes: string[];
    bestPractices: string[];
  }> {
    const helpers = getKnowledgeHelpersService();
    const context = await helpers.buildContext(topic);

    return {
      summary: context.summary,
      keyFacts: context.keyFacts,
      relatedConcepts: context.relatedConcepts,
      commonMistakes: context.commonMistakes,
      bestPractices: context.bestPractices,
    };
  }

  // ==========================================================================
  // SOURCE-SPECIFIC RETRIEVAL
  // ==========================================================================

  /**
   * Retrieve from a specific LOCAL knowledge source
   */
  private async retrieveFromSource(
    userId: string,
    source: LocalSource,
    pattern: string,
    maxResults: number
  ): Promise<KnowledgeRetrieval[]> {
    const startTime = Date.now();
    const results: KnowledgeRetrieval[] = [];

    try {
      const memoryService = getUserMemoryStorageService();
      const localMemory = await memoryService.getLocalMemory(userId);

      const patternLower = pattern.toLowerCase();

      switch (source) {
        case 'wisdom':
          for (const w of localMemory.wisdom) {
            const relevance = this.calculateRelevance(patternLower, w.content);
            if (relevance > 0.3) {
              results.push({
                id: w.id,
                source: 'wisdom',
                content: w.content,
                relevance,
                retrievalTime: Date.now() - startTime,
                triggered: pattern,
              });
            }
          }
          break;

        case 'patterns':
          for (const p of localMemory.patterns) {
            const relevance = this.calculateRelevance(patternLower, `${p.name} ${p.description}`);
            if (relevance > 0.3) {
              results.push({
                id: p.id,
                source: 'patterns',
                content: `${p.name}: ${p.description}`,
                relevance,
                retrievalTime: Date.now() - startTime,
                triggered: pattern,
              });
            }
          }
          break;

        case 'gotchas':
          for (const g of localMemory.gotchas) {
            const relevance = this.calculateRelevance(patternLower, `${g.problem} ${g.solution}`);
            if (relevance > 0.3) {
              results.push({
                id: g.id,
                source: 'gotchas',
                content: `${g.problem} → ${g.solution}`,
                relevance,
                retrievalTime: Date.now() - startTime,
                triggered: pattern,
              });
            }
          }
          break;

        case 'facts':
          for (const f of localMemory.facts) {
            const relevance = this.calculateRelevance(patternLower, f.content);
            if (relevance > 0.3) {
              results.push({
                id: f.id,
                source: 'facts',
                content: f.content,
                relevance,
                retrievalTime: Date.now() - startTime,
                triggered: pattern,
              });
            }
          }
          break;

        case 'memory':
          // Search across all sources
          const allResults = await Promise.all([
            this.retrieveFromSource(userId, 'wisdom', pattern, 2),
            this.retrieveFromSource(userId, 'patterns', pattern, 2),
            this.retrieveFromSource(userId, 'gotchas', pattern, 2),
          ]);
          results.push(...allResults.flat());
          break;
      }

      // Sort by relevance and limit
      results.sort((a, b) => b.relevance - a.relevance);
      return results.slice(0, maxResults);
    } catch (error) {
      console.warn(`[ThoughtKnowledge] Retrieval error from ${source}:`, error);
      return [];
    }
  }

  /**
   * Calculate relevance between pattern and content
   */
  private calculateRelevance(pattern: string, content: string): number {
    const contentLower = content.toLowerCase();

    // Direct match
    if (contentLower.includes(pattern)) return 0.9;

    // Word overlap
    const patternWords = pattern.split(/\s+/).filter(w => w.length > 2);
    const contentWords = contentLower.split(/\s+/);
    const matches = patternWords.filter(w => contentWords.some(cw => cw.includes(w)));

    if (matches.length === 0) return 0;

    // Calculate Jaccard-like similarity
    const similarity = matches.length / patternWords.length;

    // Boost for technical terms
    const techTerms = ['react', 'hook', 'api', 'error', 'bug', 'fix', 'pattern', 'async'];
    const techBoost = patternWords.some(w => techTerms.includes(w)) ? 0.1 : 0;

    return Math.min(similarity + techBoost, 1);
  }

  // ==========================================================================
  // ASSOCIATION MANAGEMENT
  // ==========================================================================

  /**
   * Strengthen association between thought pattern and knowledge
   */
  private strengthenAssociation(
    thoughtPattern: string,
    knowledgeKey: string,
    relevance: number
  ): void {
    const key = `${thoughtPattern}:${knowledgeKey}`;
    const existing = this.associations.get(key);

    if (existing) {
      // Strengthen existing association
      existing.strength = Math.min(existing.strength + relevance * 0.1, 1);
      existing.lastUsed = Date.now();
      existing.useCount++;
    } else {
      // Create new association
      this.associations.set(key, {
        thoughtPattern,
        knowledgeKey,
        strength: relevance * 0.5,
        lastUsed: Date.now(),
        useCount: 1,
      });
    }
  }

  /**
   * Get associations for a thought pattern
   */
  private getAssociations(thoughtPattern: string): KnowledgeAssociation[] {
    const results: KnowledgeAssociation[] = [];

    for (const [key, assoc] of this.associations) {
      if (key.startsWith(thoughtPattern)) {
        results.push(assoc);
      }
    }

    return results.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Decay unused associations (call periodically)
   */
  decayAssociations(): void {
    const now = Date.now();
    const decayThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

    for (const [key, assoc] of this.associations) {
      const age = now - assoc.lastUsed;
      if (age > decayThreshold) {
        assoc.strength *= 0.9; // Decay by 10%

        // Remove very weak associations
        if (assoc.strength < 0.1) {
          this.associations.delete(key);
        }
      }
    }
  }

  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================

  private getFromCache(key: string): KnowledgeRetrieval[] | null {
    const cached = this.retrievalCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      return cached.results;
    }
    return null;
  }

  private addToCache(key: string, results: KnowledgeRetrieval[]): void {
    this.retrievalCache.set(key, { results, timestamp: Date.now() });
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.retrievalCache) {
      if (now - cached.timestamp > this.cacheMaxAge) {
        this.retrievalCache.delete(key);
      }
    }
  }

  // ==========================================================================
  // PARALLEL BATCH RETRIEVAL
  // ==========================================================================

  /**
   * Batch multiple retrievals for quantum parallel processing
   */
  async batchRetrieve(
    userId: string,
    queries: Array<{ pattern: string; type: ThoughtType }>
  ): Promise<Map<string, KnowledgeRetrieval[]>> {
    const results = new Map<string, KnowledgeRetrieval[]>();

    // Process all queries in parallel
    const promises = queries.map(async ({ pattern, type }) => {
      const config = { ...THOUGHT_KNOWLEDGE_TRIGGERS[type] };
      config.pattern = pattern;

      const retrievals: KnowledgeRetrieval[] = [];

      // Filter out 'external' sources since retrieveFromSource only handles local sources
      const localSources = config.sources.filter((s): s is LocalSource => s !== 'external');
      const sourcePromises = localSources.map(source =>
        this.retrieveFromSource(userId, source, pattern, config.maxResults)
      );

      const sourceResults = await Promise.all(sourcePromises);
      for (const sr of sourceResults) {
        retrievals.push(...sr);
      }

      return { pattern, retrievals };
    });

    const allResults = await Promise.all(promises);
    for (const { pattern, retrievals } of allResults) {
      results.set(pattern, retrievals);
    }

    return results;
  }

  // ==========================================================================
  // THOUGHT CHAIN ENHANCEMENT
  // ==========================================================================

  /**
   * Enhance a thought chain with knowledge connections
   * Call this after a chain of micro-thoughts completes
   */
  async enhanceThoughtChain(
    userId: string,
    thoughts: MicroThought[]
  ): Promise<{
    thoughts: MicroThought[];
    knowledge: Map<string, KnowledgeRetrieval[]>;
    connections: Array<{ from: string; to: string; strength: number }>;
  }> {
    // Batch retrieve for all thoughts
    const queries = thoughts.map(t => ({
      pattern: t.content,
      type: t.type,
    }));

    const knowledge = await this.batchRetrieve(userId, queries);

    // Find connections between thoughts based on shared knowledge
    const connections: Array<{ from: string; to: string; strength: number }> = [];

    for (let i = 0; i < thoughts.length; i++) {
      for (let j = i + 1; j < thoughts.length; j++) {
        const kA = knowledge.get(thoughts[i].content) || [];
        const kB = knowledge.get(thoughts[j].content) || [];

        // Check for shared knowledge
        const sharedIds = kA
          .map(k => k.id)
          .filter(id => kB.some(k => k.id === id));

        if (sharedIds.length > 0) {
          connections.push({
            from: thoughts[i].id,
            to: thoughts[j].id,
            strength: sharedIds.length / Math.max(kA.length, kB.length),
          });
        }
      }
    }

    return { thoughts, knowledge, connections };
  }

  // ==========================================================================
  // EXPORT FOR TRAINING
  // ==========================================================================

  /**
   * Export associations for QLLM training
   */
  exportAssociationsForTraining(): Array<{
    pattern: string;
    knowledge: string;
    strength: number;
    useCount: number;
  }> {
    return Array.from(this.associations.values()).map(a => ({
      pattern: a.thoughtPattern,
      knowledge: a.knowledgeKey,
      strength: a.strength,
      useCount: a.useCount,
    }));
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalAssociations: number;
    cacheSize: number;
    averageStrength: number;
    topPatterns: string[];
    networkStatus: NetworkStatus;
    worldKnowledgeStats: {
      cacheSize: number;
      domainPacksLoaded: number;
    };
  } {
    const associations = Array.from(this.associations.values());
    const avgStrength = associations.length > 0
      ? associations.reduce((sum, a) => sum + a.strength, 0) / associations.length
      : 0;

    // Get top patterns by use count
    const patternCounts = new Map<string, number>();
    for (const a of associations) {
      patternCounts.set(a.thoughtPattern, (patternCounts.get(a.thoughtPattern) || 0) + a.useCount);
    }
    const topPatterns = Array.from(patternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([p]) => p);

    // Get world knowledge stats
    const worldKnowledge = getWorldKnowledgeService();
    const worldStats = worldKnowledge.getStats();

    return {
      totalAssociations: this.associations.size,
      cacheSize: this.retrievalCache.size,
      averageStrength: avgStrength,
      topPatterns,
      networkStatus: worldStats.networkStatus,
      worldKnowledgeStats: {
        cacheSize: worldStats.cacheSize,
        domainPacksLoaded: worldStats.domainPacksLoaded,
      },
    };
  }

  /**
   * Get network status (convenience method)
   */
  getNetworkStatus(): NetworkStatus {
    const worldKnowledge = getWorldKnowledgeService();
    return worldKnowledge.getNetworkStatus();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getThoughtKnowledgeConnector = (): ThoughtKnowledgeConnector => {
  return ThoughtKnowledgeConnector.getInstance();
};

// ============================================================================
// HELPER: Quick thought with knowledge
// ============================================================================

/**
 * Fire a thought and immediately connect to knowledge
 * Convenience function for rapid thinking with memory access
 */
export async function thinkWithKnowledge(
  conversationId: string,
  userId: string,
  thought: string,
  type: ThoughtType = 'recognition'
): Promise<{
  thought: MicroThought;
  knowledge: ThoughtKnowledgeResult;
}> {
  const microThoughtService = getMicroThoughtService();
  const connector = getThoughtKnowledgeConnector();

  // Fire the thought
  const microThought = microThoughtService.think(conversationId, thought, { type });

  // Connect to knowledge (parallel)
  const knowledge = await connector.connectThought(userId, microThought);

  return { thought: microThought, knowledge };
}

/**
 * Quick recall - fast memory lookup without full retrieval
 */
export function quickRecall(thought: string): KnowledgeRetrieval[] {
  const connector = getThoughtKnowledgeConnector();
  return connector.quickLookup(thought);
}

// ============================================================================
// DEEP THINKING HELPERS
// ============================================================================

/**
 * Deep think - comprehensive research-enhanced thinking
 * Use when standard retrieval isn't enough
 */
export async function deepThinkWithKnowledge(
  conversationId: string,
  userId: string,
  thought: string,
  type: ThoughtType = 'recognition',
  forceDeepResearch = false
): Promise<{
  thought: MicroThought;
  knowledge: ThoughtKnowledgeResult;
}> {
  const microThoughtService = getMicroThoughtService();
  const connector = getThoughtKnowledgeConnector();

  // Fire the thought
  const microThought = microThoughtService.think(conversationId, thought, { type });

  // Deep think with research
  const knowledge = await connector.deepThink(userId, microThought, forceDeepResearch);

  return { thought: microThought, knowledge };
}

/**
 * Connect concepts - find how two ideas relate
 */
export async function connectConcepts(
  conceptA: string,
  conceptB: string
): Promise<{
  connected: boolean;
  explanation: string;
  strength: number;
}> {
  const connector = getThoughtKnowledgeConnector();
  return connector.connectConcepts(conceptA, conceptB);
}

/**
 * Build context - get comprehensive understanding of a topic
 */
export async function buildTopicContext(
  topic: string
): Promise<{
  summary: string;
  keyFacts: string[];
  relatedConcepts: string[];
  commonMistakes: string[];
  bestPractices: string[];
}> {
  const connector = getThoughtKnowledgeConnector();
  return connector.buildTopicContext(topic);
}
