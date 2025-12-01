/**
 * Knowledge Needs-Research API Endpoint
 *
 * Assesses whether a topic needs more research using KnowledgeHelpersService.
 * Used by uaa2-service via InfinityAssistantBridgeService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeHelpersService } from '@/lib/knowledge';
import logger from '@/utils/logger';

/**
 * POST /api/knowledge/needs-research
 *
 * Assess whether a topic needs more research
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

    // Check if research is needed
    const assessment = await knowledgeHelpers.needsResearch(topic.trim());

    logger.info('[Knowledge Needs-Research API] Assessment completed', {
      topic,
      needsResearch: assessment.needsResearch,
      urgency: assessment.urgency,
    });

    const result = assessment as any;
    return NextResponse.json({
      success: true,
      assessment: {
        topic: result.topic,
        needsResearch: result.needsResearch,
        confidenceInExisting: result.confidenceInExisting,
        gaps: result.gaps || [],
        suggestedQuestions: result.suggestedQuestions || [],
        urgency: result.urgency,
        reasoning: result.reasoning,
      },
    });
  } catch (error) {
    logger.error('[Knowledge Needs-Research API] Error assessing research needs:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to assess research needs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
