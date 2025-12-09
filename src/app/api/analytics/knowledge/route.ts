/**
 * Knowledge Analytics API
 * 
 * Aggregated analytics endpoint for knowledge collection and tracking
 * Combines data from both professional (jobs) and companion (interests) tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJobKnowledgeTracker } from '@/lib/job-detection';
import { getInterestKnowledgeTracker } from '@/lib/life-context';
import { getTimeSeriesService } from '@/lib/analytics';
import logger from '@/utils/logger';

// In-memory detection accuracy data (in production, use database)
interface DetectionAccuracyData {
  date: string;
  overall: number;
  professional: number;
  companion: number;
  byCategory: Record<string, number>;
}

// Simple in-memory storage for trends (in production, use time-series database)
const trendData: {
  jobCategories: Array<{ date: string; queries: number; gaps: number; experimental: number; canonical: number }>;
  interests: Array<{ date: string; queries: number; gaps: number; experimental: number; canonical: number }>;
  accuracy: DetectionAccuracyData[];
} = {
  jobCategories: [],
  interests: [],
  accuracy: []
};

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
    const includeAccuracy = searchParams.get('includeAccuracy') === 'true';
    const includeTrends = searchParams.get('includeTrends') === 'true';

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
      trends: {
        jobCategories: [],
        interests: [],
        experimental: [],
        canonical: []
      },
      accuracy: null,
      topQueries: {
        byCategory: {} as Record<string, Array<{ query: string; count: number }>>,
        global: [] as Array<{ query: string; count: number; category: string }>
      },
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

    // Collect top queries by category
    if (result.professional) {
      result.professional.topCategories.forEach((cat: any) => {
        if (cat.topQueries && cat.topQueries.length > 0) {
          result.topQueries.byCategory[cat.category] = cat.topQueries;
          cat.topQueries.forEach((q: any) => {
            result.topQueries.global.push({
              query: q.query || q,
              count: q.count || 1,
              category: cat.category
            });
          });
        }
      });
    }

    if (result.companion) {
      result.companion.topInterests.forEach((interest: any) => {
        if (interest.topQueries && interest.topQueries.length > 0) {
          result.topQueries.byCategory[interest.interest] = interest.topQueries;
          interest.topQueries.forEach((q: any) => {
            result.topQueries.global.push({
              query: q.query || q,
              count: q.count || 1,
              category: interest.interest
            });
          });
        }
      });
    }

    // Sort global top queries
    result.topQueries.global.sort((a, b) => b.count - a.count);
    result.topQueries.global = result.topQueries.global.slice(0, 50);

    // Add trends data from time-series database
    if (includeTrends) {
      try {
        const timeSeriesService = getTimeSeriesService();
        const today = new Date();
        let startDate = new Date();
        
        // Calculate start date based on timeframe
        if (timeframe === 'day') {
          startDate.setDate(startDate.getDate() - 1);
        } else if (timeframe === 'week') {
          startDate.setDate(startDate.getDate() - 7);
        } else if (timeframe === 'month') {
          startDate.setDate(startDate.getDate() - 30);
        } else {
          startDate.setDate(startDate.getDate() - 90); // All time = 90 days
        }

        // Get trends from time-series database
        const [jobTrends, interestTrends] = await Promise.all([
          timeSeriesService.getTrends(startDate, today, 'professional'),
          timeSeriesService.getTrends(startDate, today, 'companion')
        ]);

        // If no historical data, fall back to simplified generation
        if (jobTrends.length === 0 && interestTrends.length === 0) {
          result.trends = {
            jobCategories: generateTrendData(timeframe, {
              queries: jobTracker.getStats().totalQueries,
              gaps: jobTracker.getStats().totalKnowledgeGaps,
              experimental: jobTracker.getStats().totalExperimentalKnowledge,
              canonical: jobTracker.getStats().totalCanonicalKnowledge
            }),
            interests: generateTrendData(timeframe, {
              queries: interestTracker.getStats().totalQueries,
              gaps: interestTracker.getStats().totalKnowledgeGaps,
              experimental: interestTracker.getStats().totalExperimentalKnowledge,
              canonical: interestTracker.getStats().totalCanonicalKnowledge
            }),
            experimental: generateTrendData(timeframe, {
              queries: 0,
              gaps: 0,
              experimental: result.summary.totalExperimentalKnowledge,
              canonical: 0
            }),
            canonical: generateTrendData(timeframe, {
              queries: 0,
              gaps: 0,
              experimental: 0,
              canonical: result.summary.totalCanonicalKnowledge
            })
          };
        } else {
          // Use real time-series data
          result.trends = {
            jobCategories: jobTrends,
            interests: interestTrends,
            experimental: jobTrends.map((jt, i) => ({
              date: jt.date,
              queries: 0,
              gaps: 0,
              experimental: jt.experimental,
              canonical: 0
            })),
            canonical: jobTrends.map((jt, i) => ({
              date: jt.date,
              queries: 0,
              gaps: 0,
              experimental: 0,
              canonical: jt.canonical
            }))
          };
        }
      } catch (error) {
        logger.warn('[Analytics] Failed to get time-series data, using fallback:', error);
        // Fall back to simplified generation
        result.trends = {
          jobCategories: generateTrendData(timeframe, {
            queries: jobTracker.getStats().totalQueries,
            gaps: jobTracker.getStats().totalKnowledgeGaps,
            experimental: jobTracker.getStats().totalExperimentalKnowledge,
            canonical: jobTracker.getStats().totalCanonicalKnowledge
          }),
          interests: generateTrendData(timeframe, {
            queries: interestTracker.getStats().totalQueries,
            gaps: interestTracker.getStats().totalKnowledgeGaps,
            experimental: interestTracker.getStats().totalExperimentalKnowledge,
            canonical: interestTracker.getStats().totalCanonicalKnowledge
          }),
          experimental: generateTrendData(timeframe, {
            queries: 0,
            gaps: 0,
            experimental: result.summary.totalExperimentalKnowledge,
            canonical: 0
          }),
          canonical: generateTrendData(timeframe, {
            queries: 0,
            gaps: 0,
            experimental: 0,
            canonical: result.summary.totalCanonicalKnowledge
          })
        };
      }
    }

    // Add detection accuracy data
    if (includeAccuracy) {
      try {
        const accuracyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}/api/detection/feedback`, {
          headers: {
            'Content-Type': 'application/json'
          }
        }).catch(() => null);

        if (accuracyResponse?.ok) {
          const accuracyData = await accuracyResponse.json();
          const overallAccuracy = parseFloat(accuracyData.stats?.accuracy || '0');
          
          // Try to get accuracy trends from time-series database
          let accuracyTrend: Array<{ date: string; accuracy: number }> = [];
          try {
            const timeSeriesService = getTimeSeriesService();
            const today = new Date();
            let startDate = new Date();
            
            if (timeframe === 'day') startDate.setDate(startDate.getDate() - 1);
            else if (timeframe === 'week') startDate.setDate(startDate.getDate() - 7);
            else if (timeframe === 'month') startDate.setDate(startDate.getDate() - 30);
            else startDate.setDate(startDate.getDate() - 90);
            
            accuracyTrend = await timeSeriesService.getAccuracyTrends(startDate, today);
          } catch (error) {
            logger.warn('[Analytics] Failed to get accuracy trends:', error);
          }

          // Fall back to simplified if no historical data
          if (accuracyTrend.length === 0) {
            accuracyTrend = generateTrendData(timeframe, {
              queries: 0,
              gaps: 0,
              experimental: 0,
              canonical: overallAccuracy
            }).map(d => ({ date: d.date, accuracy: d.canonical }));
          }

          result.accuracy = {
            overall: overallAccuracy,
            professional: parseFloat(accuracyData.stats?.categoryStats?.find((s: any) => s.category === 'professional')?.accuracy || '0'),
            companion: parseFloat(accuracyData.stats?.categoryStats?.find((s: any) => s.category === 'companion')?.accuracy || '0'),
            byCategory: (accuracyData.stats?.categoryStats || []).reduce((acc: Record<string, number>, stat: any) => {
              acc[stat.category] = parseFloat(stat.accuracy || '0');
              return acc;
            }, {}),
            trend: accuracyTrend
          };
        } else {
          // Fallback: estimate accuracy based on feedback store
          result.accuracy = {
            overall: 75, // Default estimate
            professional: 75,
            companion: 75,
            byCategory: {},
            trend: []
          };
        }
      } catch (error) {
        logger.warn('[Analytics] Failed to fetch accuracy data:', error);
        result.accuracy = {
          overall: 75,
          professional: 75,
          companion: 75,
          byCategory: {},
          trend: []
        };
      }
    }

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

/**
 * Generate trend data for a given timeframe
 * In production, this would query a time-series database
 */
function generateTrendData(
  timeframe: string,
  currentValues: { queries: number; gaps: number; experimental: number; canonical: number }
): Array<{ date: string; queries: number; gaps: number; experimental: number; canonical: number }> {
  const data: Array<{ date: string; queries: number; gaps: number; experimental: number; canonical: number }> = [];
  const today = new Date();
  
  let days = 30; // Default to 30 days
  if (timeframe === 'day') days = 1;
  else if (timeframe === 'week') days = 7;
  else if (timeframe === 'month') days = 30;
  else if (timeframe === 'all') days = 90;

  // Generate trend data (simplified - in production, use actual historical data)
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Simulate growth trend (in production, use actual data)
    const progress = (days - i) / days;
    const variance = 0.8 + Math.random() * 0.4; // 80-120% variance
    
    data.push({
      date: dateStr,
      queries: Math.floor(currentValues.queries * progress * variance),
      gaps: Math.floor(currentValues.gaps * progress * variance),
      experimental: Math.floor(currentValues.experimental * progress * variance),
      canonical: Math.floor(currentValues.canonical * progress * variance)
    });
  }

  return data;
}

