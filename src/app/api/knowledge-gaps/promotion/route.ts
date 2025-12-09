/**
 * Knowledge Promotion API
 * 
 * Manual and automatic promotion of experimental knowledge to canonical
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgePromotionService } from '@/lib/knowledge-promotion';
import logger from '@/utils/logger';

/**
 * POST /api/knowledge-gaps/promotion
 * 
 * Promote experimental knowledge to canonical
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { knowledgeId, batch } = body;

    const promotionService = getKnowledgePromotionService();

    if (batch) {
      // Batch promotion
      const result = await promotionService.batchPromote(20);
      return NextResponse.json({
        success: true,
        evaluated: result.evaluated,
        promoted: result.promoted,
        failed: result.failed,
        results: result.results
      });
    }

    if (!knowledgeId) {
      return NextResponse.json(
        { error: 'knowledgeId is required for single promotion' },
        { status: 400 }
      );
    }

    // Single promotion (would need to fetch knowledge first)
    // For now, return batch promotion result
    const result = await promotionService.batchPromote(1);
    
    return NextResponse.json({
      success: true,
      promoted: result.promoted > 0,
      result: result.results[0]
    });
  } catch (error: unknown) {
    logger.error('[Knowledge Promotion API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to promote knowledge',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/knowledge-gaps/promotion
 * 
 * Get promotion statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Return promotion statistics
    // In production, query database for actual stats
    return NextResponse.json({
      success: true,
      stats: {
        totalExperimental: 0, // Would query database
        totalCanonical: 0, // Would query database
        promotionRate: 0, // Would calculate
        lastPromotion: null // Would query database
      }
    });
  } catch (error: unknown) {
    logger.error('[Knowledge Promotion API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get promotion statistics' },
      { status: 500 }
    );
  }
}
