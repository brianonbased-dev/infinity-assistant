/**
 * Training Data Sync API
 *
 * Endpoint for uaa2-service to fetch training data for QLLM (Brittney).
 * This provides a webhook-style interface for the training pipeline.
 *
 * Security: Uses shared secret for authentication
 * Format: Returns data compatible with MLTrainingDataService
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTrainingDataExportService, getPhaseTransitionService } from '@/lib/knowledge';
import logger from '@/utils/logger';

// Shared secret for uaa2-service authentication
const UAA2_SYNC_SECRET = process.env.UAA2_TRAINING_SYNC_SECRET || 'infinity-brittney-training-2024';

/**
 * POST /api/training/sync
 *
 * Called by uaa2-service to fetch new training data
 * Headers: x-uaa2-sync-secret (authentication)
 * Body: { lastSyncTime?: string, maxRecords?: number, format?: 'uaa2' | 'qllm' }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const secret = request.headers.get('x-uaa2-sync-secret');
    if (secret !== UAA2_SYNC_SECRET) {
      logger.warn('[Training Sync] Unauthorized sync attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      lastSyncTime,
      maxRecords = 500,
      format = 'uaa2',
      includePhaseHistory = true,
    } = body;

    const trainingService = getTrainingDataExportService();

    // Build export options
    const exportOptions = {
      maxRecords,
      dateFrom: lastSyncTime,
      minConfidence: 0.3,
    };

    let responseData;

    if (format === 'uaa2') {
      // Export in uaa2-service MLTrainingDataService format
      const uaa2Data = trainingService.exportForUAA2Training();
      responseData = {
        format: 'uaa2-ml-training',
        data: uaa2Data,
        syncInfo: {
          syncTime: new Date().toISOString(),
          recordCount: uaa2Data.metadata.totalSamples,
          featureCount: uaa2Data.metadata.featureCount,
        },
      };
    } else {
      // Export as QLLM training batch
      const batch = trainingService.createTrainingBatch(exportOptions);
      responseData = {
        format: 'brittney-qllm',
        data: batch,
        syncInfo: {
          syncTime: new Date().toISOString(),
          recordCount: batch.metadata.totalRecords,
          batchId: batch.batchId,
        },
      };
    }

    logger.info('[Training Sync] Data exported for uaa2-service', {
      format,
      records: responseData.syncInfo.recordCount,
    });

    return NextResponse.json({
      success: true,
      ...responseData,
    });
  } catch (error) {
    logger.error('[Training Sync] Error:', error);
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/training/sync/status
 *
 * Get sync status and available data summary
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const secret = request.headers.get('x-uaa2-sync-secret');
    if (secret !== UAA2_SYNC_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const trainingService = getTrainingDataExportService();
    const stats = trainingService.getExportStats();

    return NextResponse.json({
      success: true,
      status: 'ready',
      availableData: {
        conversations: stats.totalConversations,
        messages: stats.totalMessages,
        phaseTransitions: stats.totalTransitions,
        phaseDistribution: stats.phaseDistribution,
        avgConfidence: stats.avgConfidence,
      },
      endpoint: {
        sync: 'POST /api/training/sync',
        formats: ['uaa2', 'qllm'],
      },
    });
  } catch (error) {
    logger.error('[Training Sync] Status error:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
