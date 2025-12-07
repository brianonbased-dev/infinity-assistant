/**
 * Knowledge Gap Service
 * 
 * Identifies and prioritizes knowledge gaps for automated research
 */

import logger from '@/utils/logger';
import { getJobKnowledgeTracker } from '@/lib/job-detection';
import { getInterestKnowledgeTracker } from '@/lib/life-context';

export interface KnowledgeGap {
  id: string;
  type: 'professional' | 'companion';
  category: string;
  displayName: string;
  totalQueries: number;
  knowledgeGaps: number;
  gapRatio: number;
  priority: 'high' | 'medium' | 'low';
  topQueries: Array<{ query: string; count: number }>;
  lastUpdated: Date;
}

export interface GapResearchRequest {
  gapId: string;
  category: string;
  type: 'professional' | 'companion';
  queries: string[];
  priority: 'high' | 'medium' | 'low';
}

/**
 * Knowledge Gap Service
 * Identifies high-priority knowledge gaps for automated research
 */
export class KnowledgeGapService {
  /**
   * Get all knowledge gaps with prioritization
   */
  async identifyGaps(limit: number = 20): Promise<KnowledgeGap[]> {
    const gaps: KnowledgeGap[] = [];

    // Get professional mode gaps
    const jobTracker = getJobKnowledgeTracker();
    const jobStats = jobTracker.getStats();
    const topJobCategories = jobTracker.getTopCategories(50);

    topJobCategories.forEach(cat => {
      if (cat.knowledgeGaps > 0) {
        const gapRatio = cat.knowledgeGaps / cat.totalQueries;
        gaps.push({
          id: `professional-${cat.category}`,
          type: 'professional',
          category: cat.category,
          displayName: this.getJobCategoryDisplayName(cat.category),
          totalQueries: cat.totalQueries,
          knowledgeGaps: cat.knowledgeGaps,
          gapRatio,
          priority: gapRatio > 0.3 ? 'high' : gapRatio > 0.15 ? 'medium' : 'low',
          topQueries: cat.topQueries,
          lastUpdated: cat.lastUpdated
        });
      }
    });

    // Get companion mode gaps
    const interestTracker = getInterestKnowledgeTracker();
    const interestStats = interestTracker.getStats();
    const topInterests = interestTracker.getTopInterests(50);

    topInterests.forEach(interest => {
      if (interest.knowledgeGaps > 0) {
        const gapRatio = interest.knowledgeGaps / interest.totalQueries;
        gaps.push({
          id: `companion-${interest.interestCategory}`,
          type: 'companion',
          category: interest.interestCategory,
          displayName: this.getInterestDisplayName(interest.interestCategory),
          totalQueries: interest.totalQueries,
          knowledgeGaps: interest.knowledgeGaps,
          gapRatio,
          priority: gapRatio > 0.3 ? 'high' : gapRatio > 0.15 ? 'medium' : 'low',
          topQueries: interest.topQueries,
          lastUpdated: interest.lastUpdated
        });
      }
    });

    // Sort by priority and gap ratio
    gaps.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.gapRatio - a.gapRatio;
    });

    return gaps.slice(0, limit);
  }

  /**
   * Get high-priority gaps for research
   */
  async getHighPriorityGaps(limit: number = 10): Promise<GapResearchRequest[]> {
    const gaps = await this.identifyGaps(limit * 2);
    const highPriority = gaps.filter(g => g.priority === 'high').slice(0, limit);

    return highPriority.map(gap => ({
      gapId: gap.id,
      category: gap.category,
      type: gap.type,
      queries: gap.topQueries.slice(0, 5).map(q => q.query),
      priority: gap.priority
    }));
  }

  /**
   * Create research request from gap
   */
  createResearchRequest(gap: KnowledgeGap): GapResearchRequest {
    return {
      gapId: gap.id,
      category: gap.category,
      type: gap.type,
      queries: gap.topQueries.slice(0, 5).map(q => q.query),
      priority: gap.priority
    };
  }

  private getJobCategoryDisplayName(category: string): string {
    const names: Record<string, string> = {
      'management-business': 'Management & Business',
      'technology-engineering': 'Technology & Engineering',
      'healthcare-medical': 'Healthcare & Medical',
      'education-training': 'Education & Training',
      'creative-arts': 'Creative & Arts',
      'legal-compliance': 'Legal & Compliance',
      'sales-marketing': 'Sales & Marketing',
      'finance-accounting': 'Finance & Accounting',
      'operations-logistics': 'Operations & Logistics',
      'customer-service': 'Customer Service',
      'research-analysis': 'Research & Analysis',
      'skilled-trades': 'Skilled Trades',
      'agriculture-natural-resources': 'Agriculture & Natural Resources',
      'hospitality-tourism': 'Hospitality & Tourism',
      'public-safety-security': 'Public Safety & Security',
      'social-services': 'Social Services',
      'media-communications': 'Media & Communications',
      'real-estate-construction': 'Real Estate & Construction',
      'general': 'General',
      'unknown': 'Unknown'
    };
    return names[category] || category;
  }

  private getInterestDisplayName(interest: string): string {
    const names: Record<string, string> = {
      'hobbies-creative': 'Creative Hobbies',
      'hobbies-outdoor': 'Outdoor Activities',
      'hobbies-indoor': 'Indoor Hobbies',
      'learning-education': 'Learning & Education',
      'health-fitness': 'Health & Fitness',
      'travel-adventure': 'Travel & Adventure',
      'cooking-food': 'Cooking & Food',
      'technology-personal': 'Personal Technology',
      'entertainment-media': 'Entertainment & Media',
      'family-relationships': 'Family & Relationships',
      'pets-animals': 'Pets & Animals',
      'home-garden': 'Home & Garden',
      'finance-personal': 'Personal Finance',
      'general': 'General',
      'unknown': 'Unknown'
    };
    return names[interest] || interest;
  }
}

// Singleton instance
let knowledgeGapServiceInstance: KnowledgeGapService | null = null;

export function getKnowledgeGapService(): KnowledgeGapService {
  if (!knowledgeGapServiceInstance) {
    knowledgeGapServiceInstance = new KnowledgeGapService();
  }
  return knowledgeGapServiceInstance;
}

