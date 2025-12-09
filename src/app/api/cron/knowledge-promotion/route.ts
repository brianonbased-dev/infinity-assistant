/**
 * Knowledge Promotion Cron Job
 * 
 * Automatically promotes experimental knowledge to canonical
 * Runs periodically to evaluate and promote qualified items
 * 
 * Schedule: Daily (can be configured in Vercel Cron)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgePromotionService } from '@/lib/knowledge-promotion';
import logger from '@/utils/logger';

/**
 * GET /api/cron/knowledge-promotion
 * 
 * Cron endpoint for automated knowledge promotion
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
    logger.info('[Knowledge Promotion Cron] Starting automated promotion');

    const promotionService = getKnowledgePromotionService();
    const result = await promotionService.batchPromote(20); // Promote up to 20 items per run

    if (result.evaluated === 0) {
      logger.info('[Knowledge Promotion Cron] No experimental knowledge to evaluate');
      return NextResponse.json({
        success: true,
        message: 'No experimental knowledge to evaluate',
        evaluated: 0,
        promoted: 0
      });
    }

    logger.info('[Knowledge Promotion Cron] Completed automated promotion', {
      evaluated: result.evaluated,
      promoted: result.promoted,
      failed: result.failed
    });

    return NextResponse.json({
      success: true,
      evaluated: result.evaluated,
      promoted: result.promoted,
      failed: result.failed,
      results: result.results,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    logger.error('[Knowledge Promotion Cron] Fatal error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to promote knowledge',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
