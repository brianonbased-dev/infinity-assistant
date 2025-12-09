/**
 * Promotion Monitoring API
 * 
 * Provides promotion statistics and alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPromotionMonitoringService } from '@/lib/monitoring/PromotionMonitoringService';
import logger from '@/utils/logger';

/**
 * GET /api/monitoring/promotion
 * 
 * Get promotion statistics and alerts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeAlerts = searchParams.get('includeAlerts') === 'true';

    const monitoringService = getPromotionMonitoringService();

    const stats = await monitoringService.getStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    if (!stats) {
      return NextResponse.json(
        { error: 'Failed to get promotion statistics' },
        { status: 500 }
      );
    }

    const result: any = {
      success: true,
      stats,
      timestamp: new Date().toISOString()
    };

    if (includeAlerts) {
      const alerts = await monitoringService.checkAlerts();
      result.alerts = alerts;
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('[Promotion Monitoring API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get promotion statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
