/**
 * Knowledge Helpers Service
 *
 * Quick helpers for making the Assistant "ultra smart" by:
 * - Connecting dots between concepts
 * - Cross-referencing knowledge
 * - Generating insights from patterns
 * - Triggering ResearcherAgent for deep needs
 * - Building knowledge graphs on-the-fly
 *
 * These are FAST, targeted helpers that enhance thinking:
 * - connectDots() - Find connections between concepts
 * - crossReference() - Check knowledge against multiple sources
 * - generateInsight() - Create insight from findings
 * - needsResearch() - Detect when ResearcherAgent should be invoked
 * - buildContext() - Build rich context for a topic
 * - explainConnection() - Explain how two concepts relate
 *
 * Design Philosophy:
 * - Speed over completeness for most helpers
 * - Triggers deep research only when needed
 * - Builds on existing knowledge services
 * - Provides actionable helpers, not raw data
 */

import { getResearchMasterService, type ResearchResult, type ResearchFinding } from './ResearchMasterService';
import { getWorldKnowledgeService } from './WorldKnowledgeService';
import { getUserMemoryStorageService } from './UserMemoryStorageService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Connection between two concepts
 */
export interface ConceptConnection {
  conceptA: string;
  conceptB: string;
  connectionType: 'related' | 'dependent' | 'contrasting' | 'complementary' | 'causal';
  strength: number;        // 0-1
  explanation: string;     // How they connect
  evidence: string[];      // Supporting findings
  domain?: string;
}

/**
 * Cross-reference result
 */
export interface CrossReferenceResult {
  topic: string;
  sources: Array<{
    source: string;
    agrees: boolean;
    content: string;
    confidence: number;
  }>;
  consensus: 'strong' | 'moderate' | 'weak' | 'conflicting';
  summary: string;
}

/**
 * Generated insight
 */
export interface GeneratedInsight {
  id: string;
  topic: string;
  insight: string;
  type: 'observation' | 'pattern' | 'warning' | 'recommendation' | 'question';
  confidence: number;
  basedOn: string[];       // Finding IDs
  actionable: boolean;
  timestamp: number;
}

/**
 * Research need assessment
 */
export interface ResearchNeedAssessment {
  topic: string;
  needsResearch: boolean;
  reason: string;
  suggestedMode: 'quick' | 'standard' | 'deep' | 'comprehensive' | 'researcher-agent';
  gaps: string[];
  urgency: 'low' | 'medium' | 'high';
}

/**
 * Built context for a topic
 */
export interface TopicContext {
  topic: string;
  summary: string;
  keyFacts: string[];
  relatedConcepts: string[];
  commonMistakes: string[];
  bestPractices: string[];
  resources: string[];
  confidence: number;
}

/**
 * Research trigger for ResearcherAgent
 */
export interface ResearchTrigger {
  topic: string;
  reason: string;
  suggestedQuestions: string[];
  priority: number;
  context: string;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class KnowledgeHelpersService {
  private static instance: KnowledgeHelpersService;

  // Cache for expensive operations
  private connectionCache = new Map<string, { connection: ConceptConnection; timestamp: number }>();
  private contextCache = new Map<string, { context: TopicContext; timestamp: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  // Pending research triggers (to be picked up by ResearcherAgent)
  private pendingResearchTriggers: ResearchTrigger[] = [];
  private maxPendingTriggers = 10;

  private constructor() {}

  static getInstance(): KnowledgeHelpersService {
    if (!KnowledgeHelpersService.instance) {
      KnowledgeHelpersService.instance = new KnowledgeHelpersService();
    }
    return KnowledgeHelpersService.instance;
  }

  // ==========================================================================
  // CONNECT DOTS
  // ==========================================================================

  /**
   * Find connections between two concepts
   * Fast helper to understand how things relate
   */
  async connectDots(conceptA: string, conceptB: string): Promise<ConceptConnection | null> {
    // Check cache
    const cacheKey = `${conceptA.toLowerCase()}:${conceptB.toLowerCase()}`;
    const cached = this.connectionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.connection;
    }

    try {
      // Quick research on both concepts together
      const research = getResearchMasterService();
      const result = await research.research({
        topic: `${conceptA} ${conceptB}`,
        mode: 'quick',
        relatedTopics: [conceptA, conceptB],
      });

      if (result.findings.length === 0) {
        return null;
      }

      // Analyze findings for connection type
      const connection = this.analyzeConnection(conceptA, conceptB, result.findings);

      // Cache
      if (connection) {
        this.connectionCache.set(cacheKey, { connection, timestamp: Date.now() });
      }

      return connection;
    } catch (error) {
      console.warn('[KnowledgeHelpers] connectDots error:', error);
      return null;
    }
  }

  /**
   * Analyze findings to determine connection type
   */
  private analyzeConnection(
    conceptA: string,
    conceptB: string,
    findings: ResearchFinding[]
  ): ConceptConnection | null {
    const aLower = conceptA.toLowerCase();
    const bLower = conceptB.toLowerCase();

    // Check for dependency patterns
    const dependencyPatterns = [
      'requires', 'needs', 'depends on', 'uses', 'built on',
      'enables', 'powers', 'supports', 'provides'
    ];

    // Check for contrast patterns
    const contrastPatterns = [
      'vs', 'versus', 'unlike', 'instead of', 'alternative to',
      'differs from', 'compared to', 'while', 'but'
    ];

    // Check for complementary patterns
    const complementaryPatterns = [
      'works with', 'combines with', 'together with', 'along with',
      'paired with', 'integrates with', 'complements'
    ];

    // Check for causal patterns
    const causalPatterns = [
      'causes', 'leads to', 'results in', 'creates', 'produces',
      'triggers', 'enables', 'prevents'
    ];

    let connectionType: ConceptConnection['connectionType'] = 'related';
    let strength = 0.5;
    const evidence: string[] = [];

    for (const finding of findings) {
      const content = finding.content.toLowerCase();

      // Must contain both concepts
      if (!content.includes(aLower) && !content.includes(bLower)) {
        continue;
      }

      evidence.push(finding.content.substring(0, 100));

      // Check patterns
      if (dependencyPatterns.some(p => content.includes(p))) {
        connectionType = 'dependent';
        strength = Math.max(strength, finding.relevance);
      } else if (contrastPatterns.some(p => content.includes(p))) {
        connectionType = 'contrasting';
        strength = Math.max(strength, finding.relevance);
      } else if (complementaryPatterns.some(p => content.includes(p))) {
        connectionType = 'complementary';
        strength = Math.max(strength, finding.relevance);
      } else if (causalPatterns.some(p => content.includes(p))) {
        connectionType = 'causal';
        strength = Math.max(strength, finding.relevance);
      }
    }

    if (evidence.length === 0) {
      return null;
    }

    return {
      conceptA,
      conceptB,
      connectionType,
      strength,
      explanation: this.generateConnectionExplanation(conceptA, conceptB, connectionType, evidence),
      evidence: evidence.slice(0, 3),
    };
  }

  /**
   * Generate explanation for connection
   */
  private generateConnectionExplanation(
    conceptA: string,
    conceptB: string,
    type: ConceptConnection['connectionType'],
    evidence: string[]
  ): string {
    switch (type) {
      case 'dependent':
        return `${conceptA} depends on or requires ${conceptB}`;
      case 'contrasting':
        return `${conceptA} and ${conceptB} are alternatives or have contrasting approaches`;
      case 'complementary':
        return `${conceptA} and ${conceptB} work well together`;
      case 'causal':
        return `${conceptA} causes or leads to effects related to ${conceptB}`;
      default:
        return `${conceptA} and ${conceptB} are related concepts`;
    }
  }

  // ==========================================================================
  // CROSS-REFERENCE
  // ==========================================================================

  /**
   * Cross-reference a topic against multiple sources
   * Checks if sources agree on information
   */
  async crossReference(topic: string, claim?: string): Promise<CrossReferenceResult> {
    const research = getResearchMasterService();

    // Research the topic/claim
    const result = await research.research({
      topic: claim || topic,
      mode: 'standard',
      requireSynthesis: false,
    });

    // Group by source
    const sourceMap = new Map<string, ResearchFinding[]>();
    for (const finding of result.findings) {
      const list = sourceMap.get(finding.source) || [];
      list.push(finding);
      sourceMap.set(finding.source, list);
    }

    // Analyze agreement
    const sources: CrossReferenceResult['sources'] = [];
    let agreementScore = 0;

    for (const [source, findings] of sourceMap) {
      const topFinding = findings.sort((a, b) => b.relevance - a.relevance)[0];

      // Check if this source supports or contradicts
      const agrees = topFinding.confidence > 0.6;

      sources.push({
        source,
        agrees,
        content: topFinding.content.substring(0, 150),
        confidence: topFinding.confidence,
      });

      if (agrees) agreementScore++;
    }

    // Determine consensus
    const agreementRatio = sources.length > 0 ? agreementScore / sources.length : 0;
    let consensus: CrossReferenceResult['consensus'];

    if (agreementRatio >= 0.8) consensus = 'strong';
    else if (agreementRatio >= 0.6) consensus = 'moderate';
    else if (agreementRatio >= 0.4) consensus = 'weak';
    else consensus = 'conflicting';

    return {
      topic,
      sources,
      consensus,
      summary: this.generateConsensusSummary(topic, sources, consensus),
    };
  }

  /**
   * Generate consensus summary
   */
  private generateConsensusSummary(
    topic: string,
    sources: CrossReferenceResult['sources'],
    consensus: CrossReferenceResult['consensus']
  ): string {
    const agreeing = sources.filter(s => s.agrees).length;
    const total = sources.length;

    switch (consensus) {
      case 'strong':
        return `Strong agreement (${agreeing}/${total} sources) on "${topic}"`;
      case 'moderate':
        return `Moderate agreement (${agreeing}/${total} sources) on "${topic}"`;
      case 'weak':
        return `Weak agreement (${agreeing}/${total} sources) on "${topic}" - verify independently`;
      case 'conflicting':
        return `Conflicting information on "${topic}" - sources disagree`;
    }
  }

  // ==========================================================================
  // GENERATE INSIGHT
  // ==========================================================================

  /**
   * Generate insight from findings
   */
  generateInsight(topic: string, findings: ResearchFinding[]): GeneratedInsight | null {
    if (findings.length === 0) return null;

    // Determine insight type based on findings
    const hasGotcha = findings.some(f => f.type === 'gotcha');
    const hasPattern = findings.some(f => f.type === 'pattern');
    const hasGap = findings.some(f => f.type === 'gap');

    let type: GeneratedInsight['type'];
    let insight: string;
    let actionable = false;

    if (hasGotcha) {
      type = 'warning';
      const gotcha = findings.find(f => f.type === 'gotcha')!;
      insight = `Watch out: ${gotcha.content.substring(0, 150)}`;
      actionable = true;
    } else if (hasPattern) {
      type = 'pattern';
      const pattern = findings.find(f => f.type === 'pattern')!;
      insight = `Pattern identified: ${pattern.content.substring(0, 150)}`;
      actionable = true;
    } else if (hasGap) {
      type = 'question';
      insight = `Knowledge gap: More research needed on "${topic}"`;
      actionable = false;
    } else if (findings.length >= 3) {
      type = 'observation';
      const topFindings = findings.slice(0, 3).map(f => f.content.substring(0, 50));
      insight = `Key observations on "${topic}": ${topFindings.join('; ')}`;
      actionable = false;
    } else {
      type = 'observation';
      insight = findings[0].content.substring(0, 200);
      actionable = false;
    }

    const avgConfidence = findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length;

    return {
      id: `insight-${Date.now()}`,
      topic,
      insight,
      type,
      confidence: avgConfidence,
      basedOn: findings.map(f => f.id),
      actionable,
      timestamp: Date.now(),
    };
  }

  // ==========================================================================
  // NEEDS RESEARCH
  // ==========================================================================

  /**
   * Assess if a topic needs deeper research
   * Used to decide when to trigger ResearcherAgent
   */
  async needsResearch(topic: string, existingKnowledge?: ResearchFinding[]): Promise<ResearchNeedAssessment> {
    // Quick check of existing knowledge
    let findings = existingKnowledge;
    if (!findings) {
      const research = getResearchMasterService();
      const result = await research.research({ topic, mode: 'quick' });
      findings = result.findings;
    }

    const gaps: string[] = [];
    let needsResearch = false;
    let suggestedMode: ResearchNeedAssessment['suggestedMode'] = 'quick';
    let urgency: ResearchNeedAssessment['urgency'] = 'low';
    let reason = '';

    // Check coverage
    if (findings.length === 0) {
      needsResearch = true;
      reason = 'No existing knowledge found';
      suggestedMode = 'researcher-agent';
      urgency = 'high';
      gaps.push('No knowledge base coverage');
    } else if (findings.length < 3) {
      needsResearch = true;
      reason = 'Limited knowledge coverage';
      suggestedMode = 'deep';
      urgency = 'medium';
      gaps.push('Limited knowledge depth');
    }

    // Check confidence
    const avgConfidence = findings.length > 0
      ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length
      : 0;

    if (avgConfidence < 0.5) {
      needsResearch = true;
      reason = reason || 'Low confidence in existing knowledge';
      suggestedMode = needsResearch ? 'researcher-agent' : 'deep';
      urgency = 'medium';
      gaps.push('Low confidence knowledge');
    }

    // Check for diversity
    const sources = new Set(findings.map(f => f.source));
    if (sources.size < 2) {
      gaps.push('Single source - needs cross-verification');
      if (!needsResearch) {
        suggestedMode = 'standard';
      }
    }

    // Check for recency (if we had timestamps)
    const hasRecent = findings.some(f =>
      f.references?.some(r => r.includes('2024') || r.includes('2025'))
    );
    if (!hasRecent && findings.length > 0) {
      gaps.push('May need more recent information');
    }

    // Determine if ResearcherAgent should be triggered
    if (suggestedMode === 'researcher-agent') {
      this.triggerResearcherAgent(topic, reason, gaps);
    }

    return {
      topic,
      needsResearch,
      reason: reason || 'Adequate knowledge coverage',
      suggestedMode,
      gaps,
      urgency,
    };
  }

  /**
   * Trigger ResearcherAgent for deep research
   */
  private triggerResearcherAgent(topic: string, reason: string, gaps: string[]): void {
    const trigger: ResearchTrigger = {
      topic,
      reason,
      suggestedQuestions: [
        `What are the fundamentals of ${topic}?`,
        `What are best practices for ${topic}?`,
        `What are common mistakes with ${topic}?`,
        ...gaps.map(g => `Can you research: ${g}?`),
      ],
      priority: 0.8,
      context: `Research triggered due to: ${reason}. Gaps: ${gaps.join(', ')}`,
    };

    this.pendingResearchTriggers.push(trigger);

    // Limit pending triggers
    if (this.pendingResearchTriggers.length > this.maxPendingTriggers) {
      this.pendingResearchTriggers.shift(); // Remove oldest
    }

    console.log('[KnowledgeHelpers] ResearcherAgent trigger queued:', topic);
  }

  /**
   * Get pending research triggers (for ResearcherAgent to consume)
   */
  getPendingResearchTriggers(): ResearchTrigger[] {
    return [...this.pendingResearchTriggers];
  }

  /**
   * Mark research trigger as consumed
   */
  consumeResearchTrigger(topic: string): void {
    const index = this.pendingResearchTriggers.findIndex(t => t.topic === topic);
    if (index >= 0) {
      this.pendingResearchTriggers.splice(index, 1);
    }
  }

  // ==========================================================================
  // BUILD CONTEXT
  // ==========================================================================

  /**
   * Build rich context for a topic
   * Creates a comprehensive summary for the Assistant
   */
  async buildContext(topic: string): Promise<TopicContext> {
    // Check cache
    const cached = this.contextCache.get(topic.toLowerCase());
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.context;
    }

    const research = getResearchMasterService();
    const result = await research.research({
      topic,
      mode: 'standard',
      requireSynthesis: true,
      includeGaps: true,
    });

    // Extract key facts
    const keyFacts = result.findings
      .filter(f => f.type === 'fact' || f.type === 'wisdom')
      .slice(0, 5)
      .map(f => f.content.substring(0, 100));

    // Extract related concepts
    const relatedConcepts: string[] = [];
    for (const finding of result.findings) {
      const techTerms = finding.content.match(/\b(react|typescript|api|database|cache|async|component|state)\b/gi);
      if (techTerms) {
        relatedConcepts.push(...techTerms.map(t => t.toLowerCase()));
      }
    }
    const uniqueRelated = [...new Set(relatedConcepts)].filter(c => c !== topic.toLowerCase()).slice(0, 5);

    // Extract gotchas as common mistakes
    const commonMistakes = result.findings
      .filter(f => f.type === 'gotcha')
      .slice(0, 3)
      .map(f => f.content.substring(0, 100));

    // Extract patterns as best practices
    const bestPractices = result.findings
      .filter(f => f.type === 'pattern')
      .slice(0, 3)
      .map(f => f.content.substring(0, 100));

    const context: TopicContext = {
      topic,
      summary: result.synthesis?.summary || `Context for ${topic}`,
      keyFacts,
      relatedConcepts: uniqueRelated,
      commonMistakes,
      bestPractices,
      resources: result.findings.flatMap(f => f.references || []).slice(0, 5),
      confidence: result.synthesis?.confidence || 0.5,
    };

    // Cache
    this.contextCache.set(topic.toLowerCase(), { context, timestamp: Date.now() });

    return context;
  }

  // ==========================================================================
  // EXPLAIN CONNECTION
  // ==========================================================================

  /**
   * Explain how two concepts relate
   * More detailed than connectDots
   */
  async explainConnection(conceptA: string, conceptB: string): Promise<string> {
    const connection = await this.connectDots(conceptA, conceptB);

    if (!connection) {
      return `No clear connection found between "${conceptA}" and "${conceptB}". They may be unrelated or the connection requires deeper research.`;
    }

    let explanation = connection.explanation;

    // Add strength context
    if (connection.strength > 0.8) {
      explanation += ' (strong connection)';
    } else if (connection.strength > 0.5) {
      explanation += ' (moderate connection)';
    } else {
      explanation += ' (weak connection)';
    }

    // Add evidence
    if (connection.evidence.length > 0) {
      explanation += `\n\nEvidence: "${connection.evidence[0]}"`;
    }

    return explanation;
  }

  // ==========================================================================
  // QUICK HELPERS
  // ==========================================================================

  /**
   * Quick check if knowledge exists for a topic
   */
  async hasKnowledge(topic: string): Promise<boolean> {
    const research = getResearchMasterService();
    const result = await research.research({ topic, mode: 'quick' });
    return result.findings.length > 0;
  }

  /**
   * Quick relevance check between two strings
   */
  isRelevant(query: string, content: string): boolean {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();

    // Direct match
    if (contentLower.includes(queryLower)) return true;

    // Word overlap
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const matchCount = queryWords.filter(w => contentLower.includes(w)).length;

    return matchCount >= queryWords.length / 2;
  }

  /**
   * Extract key terms from text
   */
  extractKeyTerms(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'to', 'for', 'of', 'with']);

    return words
      .filter(w => w.length > 3 && !stopWords.has(w))
      .filter((w, i, arr) => arr.indexOf(w) === i) // Unique
      .slice(0, 10);
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  /**
   * Get service stats
   */
  getStats(): {
    connectionCacheSize: number;
    contextCacheSize: number;
    pendingResearchTriggers: number;
  } {
    return {
      connectionCacheSize: this.connectionCache.size,
      contextCacheSize: this.contextCache.size,
      pendingResearchTriggers: this.pendingResearchTriggers.length,
    };
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.connectionCache.clear();
    this.contextCache.clear();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getKnowledgeHelpersService = (): KnowledgeHelpersService => {
  return KnowledgeHelpersService.getInstance();
};

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick: Connect two concepts
 */
export async function connectDots(conceptA: string, conceptB: string): Promise<ConceptConnection | null> {
  return getKnowledgeHelpersService().connectDots(conceptA, conceptB);
}

/**
 * Quick: Cross-reference a claim
 */
export async function crossReference(topic: string, claim?: string): Promise<CrossReferenceResult> {
  return getKnowledgeHelpersService().crossReference(topic, claim);
}

/**
 * Quick: Check if research is needed
 */
export async function needsResearch(topic: string): Promise<ResearchNeedAssessment> {
  return getKnowledgeHelpersService().needsResearch(topic);
}

/**
 * Quick: Build context for a topic
 */
export async function buildContext(topic: string): Promise<TopicContext> {
  return getKnowledgeHelpersService().buildContext(topic);
}

/**
 * Quick: Explain connection between concepts
 */
export async function explainConnection(conceptA: string, conceptB: string): Promise<string> {
  return getKnowledgeHelpersService().explainConnection(conceptA, conceptB);
}
