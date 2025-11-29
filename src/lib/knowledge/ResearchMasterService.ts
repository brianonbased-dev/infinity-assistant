/**
 * Research Master Service
 *
 * Orchestrates deep, multi-source research to make the Assistant "ultra smart."
 * Goes beyond simple retrieval to actively research, synthesize, and generate insights.
 *
 * Research Modes:
 * 1. QUICK - Fast lookup from cached/local knowledge (< 500ms)
 * 2. STANDARD - Local + external knowledge query (< 2s)
 * 3. DEEP - Multi-source research with synthesis (< 10s)
 * 4. COMPREHENSIVE - Full research protocol with web search (< 30s)
 *
 * Research Sources:
 * - Local user memory (wisdom, patterns, gotchas, facts)
 * - World knowledge (Master Portal, domain packs)
 * - Cross-domain patterns (find connections across fields)
 * - Curiosity-driven exploration (what we don't know)
 * - Web search (when available and comprehensive mode)
 *
 * Key Features:
 * - Parallel multi-source queries
 * - Knowledge synthesis (combine findings into insights)
 * - Gap detection (identify what we don't know)
 * - Confidence scoring (how sure are we?)
 * - Source attribution (where did this come from?)
 *
 * Integration:
 * - Used by ThoughtKnowledgeConnector for deep thoughts
 * - Used by WorldKnowledgeService for comprehensive queries
 * - Can be invoked directly for research-heavy tasks
 */

import { getWorldKnowledgeService, type WorldKnowledgeResult } from './WorldKnowledgeService';
import { getUserMemoryStorageService } from './UserMemoryStorageService';
import type { KnowledgeRetrieval } from './ThoughtKnowledgeConnector';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Research mode - determines depth and time budget
 */
export type ResearchMode = 'quick' | 'standard' | 'deep' | 'comprehensive';

/**
 * Research query
 */
export interface ResearchQuery {
  topic: string;
  mode?: ResearchMode;
  context?: string;                    // Additional context
  domain?: string;                     // Focus domain (e.g., 'react', 'api')
  relatedTopics?: string[];           // Related topics to explore
  maxTimeMs?: number;                  // Time budget
  requireSynthesis?: boolean;          // Generate synthesis
  includeGaps?: boolean;               // Include knowledge gaps
}

/**
 * Research finding from a single source
 */
export interface ResearchFinding {
  id: string;
  source: 'local-memory' | 'world-knowledge' | 'cross-domain' | 'web-search' | 'synthesis';
  content: string;
  relevance: number;           // 0-1
  confidence: number;          // 0-1 (how confident in accuracy)
  type: 'fact' | 'pattern' | 'wisdom' | 'gotcha' | 'insight' | 'gap';
  domain?: string;
  references?: string[];       // Source IDs or URLs
}

/**
 * Knowledge synthesis - combined insight from multiple findings
 */
export interface KnowledgeSynthesis {
  id: string;
  topic: string;
  summary: string;             // 1-2 sentence summary
  keyInsights: string[];       // Bulleted insights
  confidence: number;          // Overall confidence
  sourceCount: number;         // How many sources contributed
  domains: string[];           // Domains covered
  gaps: string[];              // What we don't know
  timestamp: number;
}

/**
 * Full research result
 */
export interface ResearchResult {
  query: ResearchQuery;
  findings: ResearchFinding[];
  synthesis?: KnowledgeSynthesis;
  gaps: string[];              // Knowledge gaps identified
  relatedQuestions: string[];  // Questions for further research
  metrics: {
    totalTimeMs: number;
    sourcesQueried: number;
    findingsCount: number;
    synthesized: boolean;
  };
}

/**
 * Research cache entry
 */
interface CachedResearch {
  result: ResearchResult;
  timestamp: number;
  ttl: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Time budgets per mode (ms)
 */
const MODE_TIME_BUDGETS: Record<ResearchMode, number> = {
  quick: 500,
  standard: 2000,
  deep: 10000,
  comprehensive: 30000,
};

/**
 * Max findings per mode
 */
const MODE_MAX_FINDINGS: Record<ResearchMode, number> = {
  quick: 5,
  standard: 15,
  deep: 30,
  comprehensive: 50,
};

/**
 * Cache TTL per mode (ms)
 */
const MODE_CACHE_TTL: Record<ResearchMode, number> = {
  quick: 5 * 60 * 1000,       // 5 minutes
  standard: 15 * 60 * 1000,   // 15 minutes
  deep: 30 * 60 * 1000,       // 30 minutes
  comprehensive: 60 * 60 * 1000, // 1 hour
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class ResearchMasterService {
  private static instance: ResearchMasterService;

  // Research cache
  private cache = new Map<string, CachedResearch>();
  private maxCacheSize = 200;

  // Research metrics
  private metrics = {
    totalResearches: 0,
    cacheHits: 0,
    avgTimeMs: 0,
    avgFindings: 0,
  };

  private constructor() {
    // Periodic cache cleanup
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanCache(), 10 * 60 * 1000); // Every 10 minutes
    }
  }

  static getInstance(): ResearchMasterService {
    if (!ResearchMasterService.instance) {
      ResearchMasterService.instance = new ResearchMasterService();
    }
    return ResearchMasterService.instance;
  }

  // ==========================================================================
  // MAIN RESEARCH METHODS
  // ==========================================================================

  /**
   * Conduct research on a topic
   * Main entry point - automatically selects appropriate depth
   */
  async research(query: ResearchQuery): Promise<ResearchResult> {
    const startTime = Date.now();
    const mode = query.mode || 'standard';
    const timeBudget = query.maxTimeMs || MODE_TIME_BUDGETS[mode];

    // Check cache
    const cacheKey = this.getCacheKey(query);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    // Collect findings from all sources in parallel
    const findings: ResearchFinding[] = [];
    const gaps: string[] = [];

    try {
      // Execute research based on mode
      switch (mode) {
        case 'quick':
          await this.quickResearch(query, findings, timeBudget);
          break;
        case 'standard':
          await this.standardResearch(query, findings, gaps, timeBudget);
          break;
        case 'deep':
          await this.deepResearch(query, findings, gaps, timeBudget);
          break;
        case 'comprehensive':
          await this.comprehensiveResearch(query, findings, gaps, timeBudget);
          break;
      }

      // Sort by relevance
      findings.sort((a, b) => b.relevance - a.relevance);

      // Limit findings
      const maxFindings = MODE_MAX_FINDINGS[mode];
      const limitedFindings = findings.slice(0, maxFindings);

      // Generate synthesis if requested and we have enough findings
      let synthesis: KnowledgeSynthesis | undefined;
      if (query.requireSynthesis !== false && limitedFindings.length >= 3) {
        synthesis = this.synthesizeFindings(query.topic, limitedFindings);
      }

      // Generate related questions
      const relatedQuestions = this.generateRelatedQuestions(query, limitedFindings, gaps);

      const result: ResearchResult = {
        query,
        findings: limitedFindings,
        synthesis,
        gaps: query.includeGaps !== false ? gaps : [],
        relatedQuestions,
        metrics: {
          totalTimeMs: Date.now() - startTime,
          sourcesQueried: this.countUniqueSources(limitedFindings),
          findingsCount: limitedFindings.length,
          synthesized: !!synthesis,
        },
      };

      // Cache result
      this.addToCache(cacheKey, result, MODE_CACHE_TTL[mode]);

      // Update metrics
      this.updateMetrics(result);

      return result;
    } catch (error) {
      console.error('[ResearchMaster] Research error:', error);

      // Return partial results if any
      return {
        query,
        findings,
        gaps,
        relatedQuestions: [],
        metrics: {
          totalTimeMs: Date.now() - startTime,
          sourcesQueried: this.countUniqueSources(findings),
          findingsCount: findings.length,
          synthesized: false,
        },
      };
    }
  }

  /**
   * Quick research - cache + local memory only
   */
  private async quickResearch(
    query: ResearchQuery,
    findings: ResearchFinding[],
    timeBudget: number
  ): Promise<void> {
    const deadline = Date.now() + timeBudget;

    // Query local memory
    const localFindings = await this.queryLocalMemory(query.topic, query.domain);
    findings.push(...localFindings);

    // Quick world knowledge lookup (cache only)
    if (Date.now() < deadline) {
      const worldService = getWorldKnowledgeService();
      const worldFindings = await worldService.quickLookup(query.topic, query.domain);
      findings.push(...this.convertToFindings(worldFindings, 'world-knowledge'));
    }
  }

  /**
   * Standard research - local + world knowledge
   */
  private async standardResearch(
    query: ResearchQuery,
    findings: ResearchFinding[],
    gaps: string[],
    timeBudget: number
  ): Promise<void> {
    const deadline = Date.now() + timeBudget;

    // Parallel queries to local and world knowledge
    const [localFindings, worldResult] = await Promise.all([
      this.queryLocalMemory(query.topic, query.domain),
      this.queryWorldKnowledge(query.topic, query.domain, query.context),
    ]);

    findings.push(...localFindings);
    findings.push(...this.convertToFindings(worldResult.results, 'world-knowledge'));

    // Detect gaps if we have time
    if (Date.now() < deadline) {
      const detectedGaps = this.detectKnowledgeGaps(query.topic, findings);
      gaps.push(...detectedGaps);
    }
  }

  /**
   * Deep research - multi-source with cross-domain
   */
  private async deepResearch(
    query: ResearchQuery,
    findings: ResearchFinding[],
    gaps: string[],
    timeBudget: number
  ): Promise<void> {
    const deadline = Date.now() + timeBudget;

    // Phase 1: Standard research
    await this.standardResearch(query, findings, gaps, timeBudget / 2);

    // Phase 2: Cross-domain exploration
    if (Date.now() < deadline && query.relatedTopics) {
      for (const relatedTopic of query.relatedTopics.slice(0, 3)) {
        if (Date.now() >= deadline) break;

        const crossFindings = await this.queryCrossDomain(
          query.topic,
          relatedTopic,
          query.domain
        );
        findings.push(...crossFindings);
      }
    }

    // Phase 3: Pattern detection
    if (Date.now() < deadline) {
      const patterns = this.detectPatterns(findings);
      findings.push(...patterns);
    }

    // Phase 4: Deeper gap analysis
    if (Date.now() < deadline) {
      const deepGaps = this.deepGapAnalysis(query.topic, findings);
      gaps.push(...deepGaps.filter(g => !gaps.includes(g)));
    }
  }

  /**
   * Comprehensive research - full protocol with web search
   */
  private async comprehensiveResearch(
    query: ResearchQuery,
    findings: ResearchFinding[],
    gaps: string[],
    timeBudget: number
  ): Promise<void> {
    const deadline = Date.now() + timeBudget;

    // Phase 1: Deep research
    await this.deepResearch(query, findings, gaps, timeBudget / 2);

    // Phase 2: Web search (if available)
    if (Date.now() < deadline) {
      const webFindings = await this.queryWebSearch(query.topic, query.context);
      findings.push(...webFindings);
    }

    // Phase 3: Multiple related topic exploration
    if (Date.now() < deadline) {
      const autoRelated = this.inferRelatedTopics(query.topic, findings);
      for (const topic of autoRelated.slice(0, 5)) {
        if (Date.now() >= deadline) break;

        const relatedFindings = await this.queryWorldKnowledge(topic, query.domain);
        findings.push(...this.convertToFindings(relatedFindings.results, 'world-knowledge'));
      }
    }

    // Phase 4: Comprehensive gap analysis
    if (Date.now() < deadline) {
      const comprehensiveGaps = this.comprehensiveGapAnalysis(query.topic, findings);
      gaps.push(...comprehensiveGaps.filter(g => !gaps.includes(g)));
    }
  }

  // ==========================================================================
  // SOURCE-SPECIFIC QUERIES
  // ==========================================================================

  /**
   * Query local user memory
   */
  private async queryLocalMemory(
    topic: string,
    domain?: string
  ): Promise<ResearchFinding[]> {
    const findings: ResearchFinding[] = [];
    const topicLower = topic.toLowerCase();

    try {
      const memoryService = getUserMemoryStorageService();
      // Note: In production, would get actual user ID from context
      const localMemory = await memoryService.getLocalMemory('default-user');

      // Search wisdom
      for (const w of localMemory.wisdom) {
        if (this.isRelevant(topicLower, w.content)) {
          findings.push({
            id: `local-wisdom-${w.id}`,
            source: 'local-memory',
            content: w.content,
            relevance: this.calculateRelevance(topicLower, w.content),
            confidence: 0.9, // Local memory is trusted
            type: 'wisdom',
            domain: w.domain,
          });
        }
      }

      // Search patterns
      for (const p of localMemory.patterns) {
        const combined = `${p.name} ${p.description}`;
        if (this.isRelevant(topicLower, combined)) {
          findings.push({
            id: `local-pattern-${p.id}`,
            source: 'local-memory',
            content: `${p.name}: ${p.description}`,
            relevance: this.calculateRelevance(topicLower, combined),
            confidence: 0.9,
            type: 'pattern',
            domain: p.domain,
          });
        }
      }

      // Search gotchas
      for (const g of localMemory.gotchas) {
        const combined = `${g.problem} ${g.solution}`;
        if (this.isRelevant(topicLower, combined)) {
          findings.push({
            id: `local-gotcha-${g.id}`,
            source: 'local-memory',
            content: `Problem: ${g.problem}\nSolution: ${g.solution}`,
            relevance: this.calculateRelevance(topicLower, combined),
            confidence: 0.9,
            type: 'gotcha',
            domain: g.domain,
          });
        }
      }

      // Search facts
      for (const f of localMemory.facts) {
        if (this.isRelevant(topicLower, f.content)) {
          findings.push({
            id: `local-fact-${f.id}`,
            source: 'local-memory',
            content: f.content,
            relevance: this.calculateRelevance(topicLower, f.content),
            confidence: f.verified ? 0.95 : 0.8,
            type: 'fact',
          });
        }
      }
    } catch (error) {
      console.warn('[ResearchMaster] Local memory query failed:', error);
    }

    return findings;
  }

  /**
   * Query world knowledge service
   */
  private async queryWorldKnowledge(
    topic: string,
    domain?: string,
    context?: string
  ): Promise<WorldKnowledgeResult> {
    const worldService = getWorldKnowledgeService();
    return worldService.query({
      pattern: context ? `${topic} ${context}` : topic,
      maxResults: 10,
      domain,
      sources: ['master-portal', 'documentation', 'domain-knowledge'],
      priority: 'quality',
    });
  }

  /**
   * Query cross-domain connections
   */
  private async queryCrossDomain(
    mainTopic: string,
    relatedTopic: string,
    domain?: string
  ): Promise<ResearchFinding[]> {
    const findings: ResearchFinding[] = [];

    try {
      // Query for connections between topics
      const worldService = getWorldKnowledgeService();
      const result = await worldService.query({
        pattern: `${mainTopic} ${relatedTopic}`,
        maxResults: 5,
        domain,
        sources: ['master-portal', 'domain-knowledge'],
        priority: 'quality',
      });

      for (const r of result.results) {
        findings.push({
          id: `cross-${r.id}`,
          source: 'cross-domain',
          content: r.content,
          relevance: r.relevance * 0.9, // Slightly lower for cross-domain
          confidence: 0.7,
          type: 'insight',
          references: [mainTopic, relatedTopic],
        });
      }
    } catch (error) {
      console.warn('[ResearchMaster] Cross-domain query failed:', error);
    }

    return findings;
  }

  /**
   * Query web search (placeholder - would integrate with search API)
   */
  private async queryWebSearch(
    topic: string,
    context?: string
  ): Promise<ResearchFinding[]> {
    // Placeholder for web search integration
    // Would integrate with Brave Search, Bing, or custom search
    return [];
  }

  // ==========================================================================
  // SYNTHESIS & ANALYSIS
  // ==========================================================================

  /**
   * Synthesize findings into unified insights
   */
  private synthesizeFindings(
    topic: string,
    findings: ResearchFinding[]
  ): KnowledgeSynthesis {
    // Group findings by type
    const byType = new Map<string, ResearchFinding[]>();
    for (const f of findings) {
      const list = byType.get(f.type) || [];
      list.push(f);
      byType.set(f.type, list);
    }

    // Extract key insights (top relevant content from each type)
    const keyInsights: string[] = [];

    const patterns = byType.get('pattern') || [];
    if (patterns.length > 0) {
      keyInsights.push(`Key pattern: ${patterns[0].content.substring(0, 100)}...`);
    }

    const wisdom = byType.get('wisdom') || [];
    if (wisdom.length > 0) {
      keyInsights.push(`Wisdom: ${wisdom[0].content.substring(0, 100)}...`);
    }

    const gotchas = byType.get('gotcha') || [];
    if (gotchas.length > 0) {
      keyInsights.push(`Watch out: ${gotchas[0].content.substring(0, 100)}...`);
    }

    const facts = byType.get('fact') || [];
    if (facts.length > 0) {
      keyInsights.push(`Fact: ${facts[0].content.substring(0, 100)}...`);
    }

    // Calculate overall confidence
    const avgConfidence = findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length;

    // Collect domains
    const domains = [...new Set(findings.map(f => f.domain).filter(Boolean) as string[])];

    // Detect gaps
    const gaps = this.detectKnowledgeGaps(topic, findings);

    // Generate summary
    const summary = this.generateSummary(topic, findings, keyInsights);

    return {
      id: `synthesis-${Date.now()}`,
      topic,
      summary,
      keyInsights,
      confidence: avgConfidence,
      sourceCount: findings.length,
      domains,
      gaps,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate summary from findings
   */
  private generateSummary(
    topic: string,
    findings: ResearchFinding[],
    keyInsights: string[]
  ): string {
    const sourceTypes = [...new Set(findings.map(f => f.source))];
    const topFinding = findings[0];

    if (findings.length === 0) {
      return `Limited information found on "${topic}". Consider broader research.`;
    }

    if (findings.length < 3) {
      return `Found ${findings.length} relevant items on "${topic}" from ${sourceTypes.join(', ')}. ${topFinding?.content.substring(0, 100)}...`;
    }

    return `Comprehensive research on "${topic}" found ${findings.length} relevant items across ${sourceTypes.length} sources. Key insight: ${keyInsights[0] || topFinding?.content.substring(0, 100)}`;
  }

  /**
   * Detect patterns across findings
   */
  private detectPatterns(findings: ResearchFinding[]): ResearchFinding[] {
    const patterns: ResearchFinding[] = [];

    // Look for repeated concepts/keywords
    const wordFrequency = new Map<string, number>();
    for (const f of findings) {
      const words = f.content.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 4) { // Skip short words
          wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
        }
      }
    }

    // Find frequent terms (appearing in multiple findings)
    const frequentTerms = [...wordFrequency.entries()]
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    if (frequentTerms.length > 0) {
      patterns.push({
        id: `pattern-detected-${Date.now()}`,
        source: 'synthesis',
        content: `Common themes detected: ${frequentTerms.join(', ')}`,
        relevance: 0.8,
        confidence: 0.6,
        type: 'pattern',
      });
    }

    return patterns;
  }

  /**
   * Detect knowledge gaps
   */
  private detectKnowledgeGaps(topic: string, findings: ResearchFinding[]): string[] {
    const gaps: string[] = [];
    const topicWords = topic.toLowerCase().split(/\s+/);

    // Check for missing perspectives
    const hasPractical = findings.some(f => f.type === 'pattern' || f.type === 'gotcha');
    const hasTheoretical = findings.some(f => f.type === 'wisdom');
    const hasFacts = findings.some(f => f.type === 'fact');

    if (!hasPractical) {
      gaps.push(`No practical patterns or gotchas found for "${topic}"`);
    }
    if (!hasTheoretical) {
      gaps.push(`No wisdom/principles found for "${topic}"`);
    }
    if (!hasFacts) {
      gaps.push(`No verified facts found for "${topic}"`);
    }

    // Check for coverage of topic words
    for (const word of topicWords) {
      if (word.length > 3) {
        const covered = findings.some(f =>
          f.content.toLowerCase().includes(word)
        );
        if (!covered) {
          gaps.push(`Limited coverage of "${word}" aspect`);
        }
      }
    }

    return gaps.slice(0, 5); // Limit gaps
  }

  /**
   * Deep gap analysis
   */
  private deepGapAnalysis(topic: string, findings: ResearchFinding[]): string[] {
    const gaps = this.detectKnowledgeGaps(topic, findings);

    // Add domain coverage gaps
    const domains = [...new Set(findings.map(f => f.domain).filter(Boolean))];
    if (domains.length < 2) {
      gaps.push('Limited cross-domain perspective');
    }

    // Add source diversity gaps
    const sources = [...new Set(findings.map(f => f.source))];
    if (sources.length < 2) {
      gaps.push('Consider diversifying knowledge sources');
    }

    return gaps;
  }

  /**
   * Comprehensive gap analysis
   */
  private comprehensiveGapAnalysis(topic: string, findings: ResearchFinding[]): string[] {
    const gaps = this.deepGapAnalysis(topic, findings);

    // Check for recency
    const hasRecent = findings.some(f =>
      f.references?.some(r => r.includes('2024') || r.includes('2025'))
    );
    if (!hasRecent) {
      gaps.push('Consider checking for more recent information');
    }

    // Check confidence distribution
    const lowConfidence = findings.filter(f => f.confidence < 0.6);
    if (lowConfidence.length > findings.length / 2) {
      gaps.push('Many findings have low confidence - verification recommended');
    }

    return gaps;
  }

  /**
   * Generate related questions for further research
   */
  private generateRelatedQuestions(
    query: ResearchQuery,
    findings: ResearchFinding[],
    gaps: string[]
  ): string[] {
    const questions: string[] = [];

    // Questions from gaps
    for (const gap of gaps.slice(0, 2)) {
      questions.push(`What are the ${gap.replace('No ', '').replace(' found', '')}?`);
    }

    // Questions from domain connections
    const domains = [...new Set(findings.map(f => f.domain).filter(Boolean))];
    if (domains.length > 1) {
      questions.push(`How does ${query.topic} differ across ${domains.join(' vs ')}?`);
    }

    // Standard follow-up questions
    questions.push(`What are common mistakes with ${query.topic}?`);
    questions.push(`What are best practices for ${query.topic}?`);

    return questions.slice(0, 5);
  }

  /**
   * Infer related topics from findings
   */
  private inferRelatedTopics(topic: string, findings: ResearchFinding[]): string[] {
    const related = new Set<string>();

    // Extract potential related topics from content
    const technicalTerms = /\b(react|typescript|api|database|cache|async|hook|component|state|redux|graphql|rest|http|auth|jwt|oauth)\b/gi;

    for (const f of findings) {
      const matches = f.content.match(technicalTerms);
      if (matches) {
        for (const match of matches) {
          if (match.toLowerCase() !== topic.toLowerCase()) {
            related.add(match.toLowerCase());
          }
        }
      }
    }

    return [...related].slice(0, 5);
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Check if content is relevant to topic
   */
  private isRelevant(topic: string, content: string): boolean {
    const contentLower = content.toLowerCase();
    const topicWords = topic.split(/\s+/);

    // Direct match
    if (contentLower.includes(topic)) return true;

    // Word overlap
    const matchingWords = topicWords.filter(w =>
      w.length > 2 && contentLower.includes(w)
    );

    return matchingWords.length >= Math.max(1, topicWords.length / 2);
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(topic: string, content: string): number {
    const contentLower = content.toLowerCase();

    // Direct match = high relevance
    if (contentLower.includes(topic)) return 0.95;

    // Word overlap scoring
    const topicWords = topic.split(/\s+/).filter(w => w.length > 2);
    const matchingWords = topicWords.filter(w => contentLower.includes(w));

    return 0.5 + (matchingWords.length / topicWords.length) * 0.4;
  }

  /**
   * Convert KnowledgeRetrieval to ResearchFinding
   */
  private convertToFindings(
    retrievals: KnowledgeRetrieval[],
    source: ResearchFinding['source']
  ): ResearchFinding[] {
    return retrievals.map(r => ({
      id: r.id,
      source,
      content: r.content,
      relevance: r.relevance,
      confidence: source === 'world-knowledge' ? 0.75 : 0.8,
      type: this.inferType(r),
    }));
  }

  /**
   * Infer finding type from retrieval
   */
  private inferType(retrieval: KnowledgeRetrieval): ResearchFinding['type'] {
    switch (retrieval.source) {
      case 'wisdom': return 'wisdom';
      case 'patterns': return 'pattern';
      case 'gotchas': return 'gotcha';
      case 'facts': return 'fact';
      default: return 'insight';
    }
  }

  /**
   * Count unique sources in findings
   */
  private countUniqueSources(findings: ResearchFinding[]): number {
    return new Set(findings.map(f => f.source)).size;
  }

  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================

  private getCacheKey(query: ResearchQuery): string {
    return `${query.mode || 'standard'}:${query.topic}:${query.domain || ''}`;
  }

  private getFromCache(key: string): ResearchResult | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private addToCache(key: string, result: ResearchResult, ttl: number): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entries
      const entries = [...this.cache.entries()];
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < entries.length * 0.2; i++) {
        this.cache.delete(entries[i][0]);
      }
    }

    this.cache.set(key, { result, timestamp: Date.now(), ttl });
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // ==========================================================================
  // METRICS
  // ==========================================================================

  private updateMetrics(result: ResearchResult): void {
    this.metrics.totalResearches++;
    this.metrics.avgTimeMs =
      (this.metrics.avgTimeMs * (this.metrics.totalResearches - 1) +
        result.metrics.totalTimeMs) /
      this.metrics.totalResearches;
    this.metrics.avgFindings =
      (this.metrics.avgFindings * (this.metrics.totalResearches - 1) +
        result.metrics.findingsCount) /
      this.metrics.totalResearches;
  }

  /**
   * Get service metrics
   */
  getMetrics(): typeof this.metrics & { cacheSize: number } {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getResearchMasterService = (): ResearchMasterService => {
  return ResearchMasterService.getInstance();
};

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick research on a topic
 */
export async function quickResearch(topic: string, domain?: string): Promise<ResearchResult> {
  const service = getResearchMasterService();
  return service.research({ topic, mode: 'quick', domain });
}

/**
 * Standard research with synthesis
 */
export async function researchTopic(
  topic: string,
  context?: string,
  domain?: string
): Promise<ResearchResult> {
  const service = getResearchMasterService();
  return service.research({ topic, context, domain, mode: 'standard' });
}

/**
 * Deep research with cross-domain exploration
 */
export async function deepResearch(
  topic: string,
  relatedTopics?: string[],
  domain?: string
): Promise<ResearchResult> {
  const service = getResearchMasterService();
  return service.research({ topic, relatedTopics, domain, mode: 'deep' });
}

/**
 * Comprehensive research - full protocol
 */
export async function comprehensiveResearch(
  topic: string,
  context?: string,
  domain?: string
): Promise<ResearchResult> {
  const service = getResearchMasterService();
  return service.research({ topic, context, domain, mode: 'comprehensive' });
}
