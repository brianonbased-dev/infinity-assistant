/**
 * Knowledge Context API Endpoint
 *
 * Builds context for a topic using KnowledgeHelpersService.
 * Used by uaa2-service via InfinityAssistantBridgeService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeHelpersService } from '@/lib/knowledge';
import logger from '@/utils/logger';

/**
 * POST /api/knowledge/context
 *
 * Build context for a topic
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic } = body as {
      topic: string;
    };

    // Validate topic
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Topic is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Get knowledge helpers service
    const knowledgeHelpers = getKnowledgeHelpersService();

    // Build context
    const context = await knowledgeHelpers.buildContext(topic.trim());

    const ctx = context as any;
    logger.info('[Knowledge Context API] Context built', {
      topic,
      keyFactsCount: ctx.keyFacts?.length || 0,
      relatedTopicsCount: ctx.relatedTopics?.length || 0,
    });

    return NextResponse.json({
      success: true,
      context: {
        topic: ctx.topic,
        keyFacts: ctx.keyFacts || [],
        relatedTopics: ctx.relatedTopics || [],
        commonMistakes: ctx.commonMistakes || [],
        bestPractices: ctx.bestPractices || [],
        openQuestions: ctx.openQuestions || [],
        confidence: ctx.confidence,
      },
    });
  } catch (error) {
    logger.error('[Knowledge Context API] Error building context:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to build context',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
