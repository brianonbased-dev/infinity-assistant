/**
 * Analytics Snapshot Cron Job
 * 
 * Creates daily snapshots of analytics data for time-series analysis
 * Runs daily to capture metrics
 * 
 * Schedule: Daily (can be configured in Vercel Cron)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJobKnowledgeTracker } from '@/lib/job-detection';
import { getInterestKnowledgeTracker } from '@/lib/life-context';
import { getTimeSeriesService } from '@/lib/analytics';
import logger from '@/utils/logger';

/**
 * GET /api/cron/analytics-snapshot
 * 
 * Cron endpoint for creating daily analytics snapshots
 * Should be called by Vercel Cron or similar scheduler
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (if configured)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    logger.info('[Analytics Snapshot Cron] Starting daily snapshot creation');

    const jobTracker = getJobKnowledgeTracker();
    const interestTracker = getInterestKnowledgeTracker();
    const timeSeriesService = getTimeSeriesService();

    const jobStats = jobTracker.getStats();
    const interestStats = interestTracker.getStats();

    // Create snapshots for all modes
    const results = await Promise.all([
      timeSeriesService.createSnapshot({
        mode: 'all',
        professional: {
          queries: jobStats.totalQueries,
          gaps: jobStats.totalKnowledgeGaps,
          experimental: jobStats.totalExperimentalKnowledge,
          canonical: jobStats.totalCanonicalKnowledge
        },
        companion: {
          queries: interestStats.totalQueries,
          gaps: interestStats.totalKnowledgeGaps,
          experimental: interestStats.totalExperimentalKnowledge,
          canonical: interestStats.totalCanonicalKnowledge
        }
      }),
      timeSeriesService.createSnapshot({
        mode: 'professional',
        professional: {
          queries: jobStats.totalQueries,
          gaps: jobStats.totalKnowledgeGaps,
          experimental: jobStats.totalExperimentalKnowledge,
          canonical: jobStats.totalCanonicalKnowledge
        }
      }),
      timeSeriesService.createSnapshot({
        mode: 'companion',
        companion: {
          queries: interestStats.totalQueries,
          gaps: interestStats.totalKnowledgeGaps,
          experimental: interestStats.totalExperimentalKnowledge,
          canonical: interestStats.totalCanonicalKnowledge
        }
      })
    ]);

    const successCount = results.filter(r => r).length;

    logger.info('[Analytics Snapshot Cron] Completed snapshot creation', {
      total: results.length,
      success: successCount
    });

    return NextResponse.json({
      success: true,
      snapshotsCreated: successCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    logger.error('[Analytics Snapshot Cron] Fatal error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create analytics snapshots',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
