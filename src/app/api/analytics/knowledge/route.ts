/**
 * Knowledge Analytics API
 * 
 * Aggregated analytics endpoint for knowledge collection and tracking
 * Combines data from both professional (jobs) and companion (interests) tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJobKnowledgeTracker } from '@/lib/job-detection';
import { getInterestKnowledgeTracker } from '@/lib/life-context';
import logger from '@/utils/logger';

/**
 * GET /api/analytics/knowledge
 * 
 * Get comprehensive knowledge analytics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // 'professional', 'companion', or 'all'
    const timeframe = searchParams.get('timeframe') || 'all'; // 'day', 'week', 'month', 'all'

    const jobTracker = getJobKnowledgeTracker();
    const interestTracker = getInterestKnowledgeTracker();

    const result: any = {
      summary: {
        totalQueries: 0,
        totalKnowledgeGaps: 0,
        totalExperimentalKnowledge: 0,
        totalCanonicalKnowledge: 0,
      },
      professional: null,
      companion: null,
      trends: [],
      topCategories: [],
      knowledgeGaps: []
    };

    // Get professional mode data
    if (!mode || mode === 'all' || mode === 'professional') {
      const jobStats = jobTracker.getStats();
      const topJobCategories = jobTracker.getTopCategories(10);

      result.professional = {
        summary: {
          totalQueries: jobStats.totalQueries,
          totalKnowledgeGaps: jobStats.totalKnowledgeGaps,
          totalExperimentalKnowledge: jobStats.totalExperimentalKnowledge,
          totalCanonicalKnowledge: jobStats.totalCanonicalKnowledge,
        },
        topCategories: topJobCategories.map(cat => ({
          category: cat.category,
          displayName: getJobCategoryDisplayName(cat.category),
          totalQueries: cat.totalQueries,
          knowledgeGaps: cat.knowledgeGaps,
          experimentalKnowledge: cat.experimentalKnowledge,
          canonicalKnowledge: cat.canonicalKnowledge,
          topQueries: cat.topQueries.slice(0, 5)
        })),
        byCategory: Object.entries(jobStats.byCategory).map(([category, metrics]) => ({
          category,
          displayName: getJobCategoryDisplayName(category as any),
          ...metrics
        }))
      };

      result.summary.totalQueries += jobStats.totalQueries;
      result.summary.totalKnowledgeGaps += jobStats.totalKnowledgeGaps;
      result.summary.totalExperimentalKnowledge += jobStats.totalExperimentalKnowledge;
      result.summary.totalCanonicalKnowledge += jobStats.totalCanonicalKnowledge;
    }

    // Get companion mode data
    if (!mode || mode === 'all' || mode === 'companion') {
      const interestStats = interestTracker.getStats();
      const topInterests = interestTracker.getTopInterests(10);

      result.companion = {
        summary: {
          totalQueries: interestStats.totalQueries,
          totalKnowledgeGaps: interestStats.totalKnowledgeGaps,
          totalExperimentalKnowledge: interestStats.totalExperimentalKnowledge,
          totalCanonicalKnowledge: interestStats.totalCanonicalKnowledge,
        },
        topInterests: topInterests.map(interest => ({
          interest: interest.interestCategory,
          displayName: getInterestDisplayName(interest.interestCategory),
          totalQueries: interest.totalQueries,
          knowledgeGaps: interest.knowledgeGaps,
          experimentalKnowledge: interest.experimentalKnowledge,
          canonicalKnowledge: interest.canonicalKnowledge,
          topQueries: interest.topQueries.slice(0, 5)
        })),
        byLifeStage: Object.entries(interestStats.byLifeStage).map(([stage, metrics]) => ({
          stage,
          displayName: getLifeStageDisplayName(stage as any),
          metrics: metrics.map(m => ({
            interest: m.interestCategory,
            displayName: getInterestDisplayName(m.interestCategory),
            ...m
          }))
        })),
        byInterest: Object.entries(interestStats.byInterest).map(([interest, metrics]) => ({
          interest,
          displayName: getInterestDisplayName(interest as any),
          ...metrics
        }))
      };

      result.summary.totalQueries += interestStats.totalQueries;
      result.summary.totalKnowledgeGaps += interestStats.totalKnowledgeGaps;
      result.summary.totalExperimentalKnowledge += interestStats.totalExperimentalKnowledge;
      result.summary.totalCanonicalKnowledge += interestStats.totalCanonicalKnowledge;
    }

    // Identify top knowledge gaps (categories with high gap ratio)
    if (result.professional) {
      result.professional.topCategories.forEach((cat: any) => {
        if (cat.knowledgeGaps > 0) {
          const gapRatio = cat.knowledgeGaps / cat.totalQueries;
          result.knowledgeGaps.push({
            type: 'professional',
            category: cat.category,
            displayName: cat.displayName,
            totalQueries: cat.totalQueries,
            knowledgeGaps: cat.knowledgeGaps,
            gapRatio,
            priority: gapRatio > 0.3 ? 'high' : gapRatio > 0.15 ? 'medium' : 'low'
          });
        }
      });
    }

    if (result.companion) {
      result.companion.topInterests.forEach((interest: any) => {
        if (interest.knowledgeGaps > 0) {
          const gapRatio = interest.knowledgeGaps / interest.totalQueries;
          result.knowledgeGaps.push({
            type: 'companion',
            category: interest.interest,
            displayName: interest.displayName,
            totalQueries: interest.totalQueries,
            knowledgeGaps: interest.knowledgeGaps,
            gapRatio,
            priority: gapRatio > 0.3 ? 'high' : gapRatio > 0.15 ? 'medium' : 'low'
          });
        }
      });
    }

    // Sort knowledge gaps by priority and gap ratio
    result.knowledgeGaps.sort((a: any, b: any) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority as keyof typeof priorityOrder] !== priorityOrder[b.priority as keyof typeof priorityOrder]) {
        return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder];
      }
      return b.gapRatio - a.gapRatio;
    });

    // Combine top categories for unified view
    result.topCategories = [
      ...(result.professional?.topCategories || []).map((cat: any) => ({
        type: 'professional',
        ...cat
      })),
      ...(result.companion?.topInterests || []).map((interest: any) => ({
        type: 'companion',
        category: interest.interest,
        displayName: interest.displayName,
        totalQueries: interest.totalQueries,
        knowledgeGaps: interest.knowledgeGaps,
        experimentalKnowledge: interest.experimentalKnowledge,
        canonicalKnowledge: interest.canonicalKnowledge
      }))
    ].sort((a, b) => b.totalQueries - a.totalQueries).slice(0, 20);

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    logger.error('[Knowledge Analytics API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve analytics data' },
      { status: 500 }
    );
  }
}

// Helper functions
function getJobCategoryDisplayName(category: string): string {
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

function getInterestDisplayName(interest: string): string {
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

function getLifeStageDisplayName(stage: string): string {
  const names: Record<string, string> = {
    'student': 'Student',
    'parent': 'Parent',
    'retiree': 'Retiree',
    'hobbyist': 'Hobbyist',
    'caregiver': 'Caregiver',
    'life-transition': 'Life Transition',
    'professional-personal': 'Work-Life Balance',
    'general': 'General',
    'unknown': 'Unknown'
  };
  return names[stage] || stage;
}

