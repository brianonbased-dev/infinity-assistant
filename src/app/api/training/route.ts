/**
 * Training Data Export API
 *
 * Exports phase-annotated conversation data for QLLM (Brittney) training.
 * This endpoint connects infinityassistant-service to uaa2-service's
 * MLTrainingDataService pipeline.
 *
 * Endpoints:
 * - GET /api/training - Get training data statistics
 * - POST /api/training - Export training batch
 * - POST /api/training/uaa2 - Export in uaa2-service compatible format
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTrainingDataExportService, getPhaseTransitionService } from '@/lib/knowledge';
import logger from '@/utils/logger';

/**
 * GET /api/training
 *
 * Get training data statistics and phase distribution
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'stats';
    const conversationId = searchParams.get('conversationId');

    const trainingService = getTrainingDataExportService();

    if (format === 'stats') {
      const stats = trainingService.getExportStats();
      return NextResponse.json({
        success: true,
        stats,
        metadata: {
          service: 'infinityassistant-training',
          exportFormats: ['json', 'qllm', 'uaa2'],
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (format === 'conversation' && conversationId) {
      const exportData = trainingService.exportConversation(conversationId);
      if (!exportData) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        data: exportData,
      });
    }

    if (format === 'phase-status' && conversationId) {
      const phaseService = getPhaseTransitionService();
      const phase = phaseService.getCurrentPhase(conversationId);
      const transitions = phaseService.getTransitions(conversationId);
      const stats = phaseService.getPhaseStats(conversationId);

      return NextResponse.json({
        success: true,
        conversationId,
        currentPhase: phase,
        transitions: transitions.slice(-10), // Last 10 transitions
        phaseStats: stats,
      });
    }

    return NextResponse.json({
      success: true,
      formats: {
        stats: 'GET /api/training?format=stats',
        conversation: 'GET /api/training?format=conversation&conversationId=xxx',
        phaseStatus: 'GET /api/training?format=phase-status&conversationId=xxx',
      },
    });
  } catch (error) {
    logger.error('[Training API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get training data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/training
 *
 * Export training batch for QLLM training
 * Body: { conversationIds?: string[], minConfidence?: number, maxRecords?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      conversationIds,
      minConfidence = 0.3,
      maxRecords = 1000,
      format = 'qllm',
      dateFrom,
      dateTo,
    } = body;

    const trainingService = getTrainingDataExportService();

    if (format === 'uaa2') {
      // Export in uaa2-service MLTrainingDataService compatible format
      const uaa2Data = trainingService.exportForUAA2Training();

      logger.info('[Training API] Exported UAA2 format', {
        samples: uaa2Data.metadata.totalSamples,
        features: uaa2Data.metadata.featureCount,
      });

      return NextResponse.json({
        success: true,
        format: 'uaa2-ml-training',
        data: uaa2Data,
        metadata: {
          compatibleWith: 'uaa2-service/MLTrainingDataService',
          exportedAt: new Date().toISOString(),
        },
      });
    }

    // Default: Export as QLLM training batch
    const batch = trainingService.createTrainingBatch({
      conversationIds,
      minConfidence,
      maxRecords,
      dateFrom,
      dateTo,
    });

    logger.info('[Training API] Created training batch', {
      batchId: batch.batchId,
      records: batch.metadata.totalRecords,
      conversations: batch.metadata.uniqueConversations,
    });

    return NextResponse.json({
      success: true,
      format: 'brittney-qllm',
      batch,
    });
  } catch (error) {
    logger.error('[Training API] Error creating batch:', error);
    return NextResponse.json(
      { error: 'Failed to create training batch' },
      { status: 500 }
    );
  }
}
