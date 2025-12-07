/**
 * Job Knowledge Tracker
 * 
 * Tracks knowledge accumulation by profession/job category
 * Used for analytics and knowledge base growth insights
 */

import logger from '@/utils/logger';
import type { JobCategory, JobDetectionResult } from './JobDetectionService';

export interface JobKnowledgeMetrics {
  category: JobCategory;
  totalQueries: number;
  knowledgeGaps: number;
  experimentalKnowledge: number;
  canonicalKnowledge: number;
  lastUpdated: Date;
  topQueries: Array<{ query: string; count: number }>;
}

export interface KnowledgeAccumulationStats {
  byCategory: Record<JobCategory, JobKnowledgeMetrics>;
  totalQueries: number;
  totalKnowledgeGaps: number;
  totalExperimentalKnowledge: number;
  totalCanonicalKnowledge: number;
}

/**
 * Job Knowledge Tracker
 * Tracks knowledge accumulation by profession
 */
export class JobKnowledgeTracker {
  private metrics: Map<JobCategory, JobKnowledgeMetrics> = new Map();

  /**
   * Track a query for a job category
   */
  trackQuery(jobResult: JobDetectionResult, query: string, hadKnowledgeGap: boolean = false): void {
    const { category } = jobResult;
    
    if (!this.metrics.has(category)) {
      this.metrics.set(category, {
        category,
        totalQueries: 0,
        knowledgeGaps: 0,
        experimentalKnowledge: 0,
        canonicalKnowledge: 0,
        lastUpdated: new Date(),
        topQueries: []
      });
    }

    const metrics = this.metrics.get(category)!;
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
  }

  /**
   * Track experimental knowledge creation
   */
  trackExperimentalKnowledge(category: JobCategory): void {
    if (!this.metrics.has(category)) {
      this.metrics.set(category, {
        category,
        totalQueries: 0,
        knowledgeGaps: 0,
        experimentalKnowledge: 0,
        canonicalKnowledge: 0,
        lastUpdated: new Date(),
        topQueries: []
      });
    }

    const metrics = this.metrics.get(category)!;
    metrics.experimentalKnowledge += 1;
    metrics.lastUpdated = new Date();
  }

  /**
   * Track canonical knowledge promotion
   */
  trackCanonicalKnowledge(category: JobCategory): void {
    if (!this.metrics.has(category)) {
      this.metrics.set(category, {
        category,
        totalQueries: 0,
        knowledgeGaps: 0,
        experimentalKnowledge: 0,
        canonicalKnowledge: 0,
        lastUpdated: new Date(),
        topQueries: []
      });
    }

    const metrics = this.metrics.get(category)!;
    metrics.canonicalKnowledge += 1;
    metrics.lastUpdated = new Date();
  }

  /**
   * Get metrics for a specific category
   */
  getMetrics(category: JobCategory): JobKnowledgeMetrics | null {
    return this.metrics.get(category) || null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): JobKnowledgeMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get accumulation stats
   */
  getStats(): KnowledgeAccumulationStats {
    const byCategory: Record<JobCategory, JobKnowledgeMetrics> = {} as Record<JobCategory, JobKnowledgeMetrics>;
    
    let totalQueries = 0;
    let totalKnowledgeGaps = 0;
    let totalExperimentalKnowledge = 0;
    let totalCanonicalKnowledge = 0;

    this.metrics.forEach((metrics, category) => {
      byCategory[category] = metrics;
      totalQueries += metrics.totalQueries;
      totalKnowledgeGaps += metrics.knowledgeGaps;
      totalExperimentalKnowledge += metrics.experimentalKnowledge;
      totalCanonicalKnowledge += metrics.canonicalKnowledge;
    });

    return {
      byCategory,
      totalQueries,
      totalKnowledgeGaps,
      totalExperimentalKnowledge,
      totalCanonicalKnowledge
    };
  }

  /**
   * Get top categories by query count
   */
  getTopCategories(limit: number = 10): JobKnowledgeMetrics[] {
    return this.getAllMetrics()
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
let jobKnowledgeTrackerInstance: JobKnowledgeTracker | null = null;

export function getJobKnowledgeTracker(): JobKnowledgeTracker {
  if (!jobKnowledgeTrackerInstance) {
    jobKnowledgeTrackerInstance = new JobKnowledgeTracker();
  }
  return jobKnowledgeTrackerInstance;
}


