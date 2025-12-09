/**
 * Knowledge Gap Research Cron Job
 * 
 * Automatically researches high-priority knowledge gaps
 * Runs periodically to fill knowledge base gaps
 * 
 * Schedule: Daily (can be configured in Vercel Cron)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeGapService } from '@/lib/knowledge-gaps/KnowledgeGapService';
import { getResearchMasterService } from '@/lib/knowledge';
import { getJobKnowledgeTracker } from '@/lib/job-detection';
import { getInterestKnowledgeTracker } from '@/lib/life-context';
import logger from '@/utils/logger';

/**
 * GET /api/cron/knowledge-gaps
 * 
 * Cron endpoint for automated knowledge gap research
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
    logger.info('[Knowledge Gap Cron] Starting automated research');

    const gapService = getKnowledgeGapService();
    const highPriorityGaps = await gapService.getHighPriorityGaps(5); // Research top 5 high-priority gaps

    if (highPriorityGaps.length === 0) {
      logger.info('[Knowledge Gap Cron] No high-priority gaps found');
      return NextResponse.json({
        success: true,
        message: 'No high-priority knowledge gaps found',
        gapsResearched: 0
      });
    }

    const researchService = getResearchMasterService();
    const results = [];

    for (const gap of highPriorityGaps) {
      try {
        // Research the top query for this gap
        const topQuery = gap.queries[0];
        if (!topQuery) continue;

        logger.info('[Knowledge Gap Cron] Researching gap:', {
          gapId: gap.gapId,
          category: gap.category,
          query: topQuery
        });

        const research = await researchService.research({
          topic: topQuery,
          mode: 'deep' // Use deep research for automated filling
        });

        // Track experimental knowledge creation
        if (gap.type === 'professional') {
          const jobTracker = getJobKnowledgeTracker();
          jobTracker.trackExperimentalKnowledge(gap.category as any);
        } else {
          const interestTracker = getInterestKnowledgeTracker();
          interestTracker.trackExperimentalKnowledge(undefined, gap.category as any);
        }

        // Queue for promotion evaluation (will be processed by promotion cron)
        logger.info('[Knowledge Gap Cron] Research completed, will be evaluated for promotion', {
          gapId: gap.gapId,
          findings: research.findings.length
        });

        results.push({
          gapId: gap.gapId,
          category: gap.category,
          type: gap.type,
          query: topQuery,
          findings: research.findings.length,
          status: 'completed'
        });

        logger.info('[Knowledge Gap Cron] Completed research for gap:', {
          gapId: gap.gapId,
          findings: research.findings.length
        });

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        logger.error('[Knowledge Gap Cron] Error researching gap:', {
          gapId: gap.gapId,
          error
        });

        results.push({
          gapId: gap.gapId,
          category: gap.category,
          type: gap.type,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.status === 'completed').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    logger.info('[Knowledge Gap Cron] Completed automated research', {
      total: highPriorityGaps.length,
      success: successCount,
      errors: errorCount
    });

    return NextResponse.json({
      success: true,
      gapsResearched: successCount,
      gapsFailed: errorCount,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    logger.error('[Knowledge Gap Cron] Fatal error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to research knowledge gaps',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

