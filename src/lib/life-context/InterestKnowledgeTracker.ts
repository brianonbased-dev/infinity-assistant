/**
 * Interest Knowledge Tracker
 * 
 * Tracks knowledge accumulation by life context and interests for companion mode
 * Used for analytics and knowledge base growth insights
 */

import logger from '@/utils/logger';
import type { LifeStage, InterestCategory, LifeContextResult } from './LifeContextDetectionService';

export interface InterestKnowledgeMetrics {
  lifeStage?: LifeStage;
  interestCategory: InterestCategory;
  totalQueries: number;
  knowledgeGaps: number;
  experimentalKnowledge: number;
  canonicalKnowledge: number;
  lastUpdated: Date;
  topQueries: Array<{ query: string; count: number }>;
}

export interface InterestAccumulationStats {
  byLifeStage: Record<LifeStage, InterestKnowledgeMetrics[]>;
  byInterest: Record<InterestCategory, InterestKnowledgeMetrics>;
  totalQueries: number;
  totalKnowledgeGaps: number;
  totalExperimentalKnowledge: number;
  totalCanonicalKnowledge: number;
}

/**
 * Interest Knowledge Tracker
 * Tracks knowledge accumulation by life context and interests
 */
export class InterestKnowledgeTracker {
  private metrics: Map<string, InterestKnowledgeMetrics> = new Map();

  /**
   * Generate key for metrics map
   */
  private getKey(lifeStage: LifeStage | undefined, interest: InterestCategory): string {
    return `${lifeStage || 'general'}:${interest}`;
  }

  /**
   * Track a query for a life context/interest
   */
  trackQuery(contextResult: LifeContextResult, query: string, hadKnowledgeGap: boolean = false): void {
    const { lifeStage, interests } = contextResult;
    
    // Track for each interest detected
    interests.forEach(interest => {
      const key = this.getKey(lifeStage, interest);
      
      if (!this.metrics.has(key)) {
        this.metrics.set(key, {
          lifeStage,
          interestCategory: interest,
          totalQueries: 0,
          knowledgeGaps: 0,
          experimentalKnowledge: 0,
          canonicalKnowledge: 0,
          lastUpdated: new Date(),
          topQueries: []
        });
      }

      const metrics = this.metrics.get(key)!;
      metrics.totalQueries += 1;
      metrics.lastUpdated = new Date();

      if (hadKnowledgeGap) {
        metrics.knowledgeGaps += 1;
      }

      // Track top queries
      const existingQuery = metrics.topQueries.find(q => q.query === query);
      if (existingQuery) {
        existingQuery.count += 1;
      } else {
        metrics.topQueries.push({ query, count: 1 });
      }

      // Keep only top 10 queries
      metrics.topQueries.sort((a, b) => b.count - a.count);
      metrics.topQueries = metrics.topQueries.slice(0, 10);
    });
  }

  /**
   * Track experimental knowledge creation
   */
  trackExperimentalKnowledge(lifeStage: LifeStage | undefined, interest: InterestCategory): void {
    const key = this.getKey(lifeStage, interest);
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        lifeStage,
        interestCategory: interest,
        totalQueries: 0,
        knowledgeGaps: 0,
        experimentalKnowledge: 0,
        canonicalKnowledge: 0,
        lastUpdated: new Date(),
        topQueries: []
      });
    }

    const metrics = this.metrics.get(key)!;
    metrics.experimentalKnowledge += 1;
    metrics.lastUpdated = new Date();
  }

  /**
   * Track canonical knowledge promotion
   */
  trackCanonicalKnowledge(lifeStage: LifeStage | undefined, interest: InterestCategory): void {
    const key = this.getKey(lifeStage, interest);
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        lifeStage,
        interestCategory: interest,
        totalQueries: 0,
        knowledgeGaps: 0,
        experimentalKnowledge: 0,
        canonicalKnowledge: 0,
        lastUpdated: new Date(),
        topQueries: []
      });
    }

    const metrics = this.metrics.get(key)!;
    metrics.canonicalKnowledge += 1;
    metrics.lastUpdated = new Date();
  }

  /**
   * Get metrics for a specific life stage/interest combination
   */
  getMetrics(lifeStage: LifeStage | undefined, interest: InterestCategory): InterestKnowledgeMetrics | null {
    const key = this.getKey(lifeStage, interest);
    return this.metrics.get(key) || null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): InterestKnowledgeMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics by life stage
   */
  getMetricsByLifeStage(lifeStage: LifeStage): InterestKnowledgeMetrics[] {
    return this.getAllMetrics().filter(m => m.lifeStage === lifeStage);
  }

  /**
   * Get metrics by interest category
   */
  getMetricsByInterest(interest: InterestCategory): InterestKnowledgeMetrics[] {
    return this.getAllMetrics().filter(m => m.interestCategory === interest);
  }

  /**
   * Get accumulation stats
   */
  getStats(): InterestAccumulationStats {
    const byLifeStage: Record<LifeStage, InterestKnowledgeMetrics[]> = {
      'student': [],
      'parent': [],
      'retiree': [],
      'hobbyist': [],
      'caregiver': [],
      'life-transition': [],
      'professional-personal': [],
      'general': [],
      'unknown': []
    };

    const byInterest: Record<InterestCategory, InterestKnowledgeMetrics> = {} as Record<InterestCategory, InterestKnowledgeMetrics>;
    
    let totalQueries = 0;
    let totalKnowledgeGaps = 0;
    let totalExperimentalKnowledge = 0;
    let totalCanonicalKnowledge = 0;

    this.metrics.forEach((metrics) => {
      // Group by life stage
      const stage = metrics.lifeStage || 'general';
      if (byLifeStage[stage]) {
        byLifeStage[stage].push(metrics);
      }

      // Aggregate by interest (sum all life stages for each interest)
      if (!byInterest[metrics.interestCategory]) {
        byInterest[metrics.interestCategory] = {
          lifeStage: undefined,
          interestCategory: metrics.interestCategory,
          totalQueries: 0,
          knowledgeGaps: 0,
          experimentalKnowledge: 0,
          canonicalKnowledge: 0,
          lastUpdated: new Date(),
          topQueries: []
        };
      }

      const interestMetrics = byInterest[metrics.interestCategory];
      interestMetrics.totalQueries += metrics.totalQueries;
      interestMetrics.knowledgeGaps += metrics.knowledgeGaps;
      interestMetrics.experimentalKnowledge += metrics.experimentalKnowledge;
      interestMetrics.canonicalKnowledge += metrics.canonicalKnowledge;
      if (metrics.lastUpdated > interestMetrics.lastUpdated) {
        interestMetrics.lastUpdated = metrics.lastUpdated;
      }

      // Aggregate totals
      totalQueries += metrics.totalQueries;
      totalKnowledgeGaps += metrics.knowledgeGaps;
      totalExperimentalKnowledge += metrics.experimentalKnowledge;
      totalCanonicalKnowledge += metrics.canonicalKnowledge;
    });

    return {
      byLifeStage,
      byInterest,
      totalQueries,
      totalKnowledgeGaps,
      totalExperimentalKnowledge,
      totalCanonicalKnowledge
    };
  }

  /**
   * Get top interests by query count
   */
  getTopInterests(limit: number = 10): InterestKnowledgeMetrics[] {
    const interestMap = new Map<InterestCategory, InterestKnowledgeMetrics>();

    // Aggregate by interest
    this.metrics.forEach((metrics) => {
      if (!interestMap.has(metrics.interestCategory)) {
        interestMap.set(metrics.interestCategory, {
          lifeStage: undefined,
          interestCategory: metrics.interestCategory,
          totalQueries: 0,
          knowledgeGaps: 0,
          experimentalKnowledge: 0,
          canonicalKnowledge: 0,
          lastUpdated: new Date(),
          topQueries: []
        });
      }

      const aggregated = interestMap.get(metrics.interestCategory)!;
      aggregated.totalQueries += metrics.totalQueries;
      aggregated.knowledgeGaps += metrics.knowledgeGaps;
      aggregated.experimentalKnowledge += metrics.experimentalKnowledge;
      aggregated.canonicalKnowledge += metrics.canonicalKnowledge;
    });

    return Array.from(interestMap.values())
      .sort((a, b) => b.totalQueries - a.totalQueries)
      .slice(0, limit);
  }

  /**
   * Export metrics for analytics
   */
  exportMetrics(): string {
    return JSON.stringify(this.getStats(), null, 2);
  }
}

// Singleton instance
let interestKnowledgeTrackerInstance: InterestKnowledgeTracker | null = null;

export function getInterestKnowledgeTracker(): InterestKnowledgeTracker {
  if (!interestKnowledgeTrackerInstance) {
    interestKnowledgeTrackerInstance = new InterestKnowledgeTracker();
  }
  return interestKnowledgeTrackerInstance;
}

