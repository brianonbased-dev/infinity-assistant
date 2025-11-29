/**
 * Knowledge Connect API Endpoint
 *
 * Connects two concepts and finds relationships using KnowledgeHelpersService.
 * Used by uaa2-service via InfinityAssistantBridgeService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeHelpersService } from '@/lib/knowledge';
import logger from '@/utils/logger';

/**
 * POST /api/knowledge/connect
 *
 * Connect two concepts and find their relationship
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conceptA, conceptB } = body as {
      conceptA: string;
      conceptB: string;
    };

    // Validate concepts
    if (!conceptA || typeof conceptA !== 'string' || conceptA.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'conceptA is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (!conceptB || typeof conceptB !== 'string' || conceptB.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'conceptB is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Get knowledge helpers service
    const knowledgeHelpers = getKnowledgeHelpersService();

    // Connect concepts
    const connection = await knowledgeHelpers.connectDots(
      conceptA.trim(),
      conceptB.trim()
    );

    if (!connection) {
      return NextResponse.json({
        success: true,
        connection: {
          conceptA: conceptA.trim(),
          conceptB: conceptB.trim(),
          connectionType: 'associative',
          strength: 0.3,
          explanation: `No direct connection found between "${conceptA}" and "${conceptB}". They may be related through broader concepts.`,
          evidence: [],
          bridgingConcepts: [],
        },
      });
    }

    logger.info('[Knowledge Connect API] Concepts connected', {
      conceptA,
      conceptB,
      connectionType: connection.connectionType,
      strength: connection.strength,
    });

    return NextResponse.json({
      success: true,
      connection: {
        conceptA: connection.conceptA,
        conceptB: connection.conceptB,
        connectionType: connection.connectionType,
        strength: connection.strength,
        explanation: connection.explanation,
        evidence: connection.evidence || [],
        bridgingConcepts: connection.bridgingConcepts || [],
      },
    });
  } catch (error) {
    logger.error('[Knowledge Connect API] Error connecting concepts:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect concepts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
