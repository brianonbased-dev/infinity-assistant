/**
 * Energy Metrics API
 *
 * Get energy consumption, generation, and EV charging metrics.
 *
 * GET /api/mesh/devices/energy - Get energy metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDeviceMeshService, type EnergyMetrics } from '@/services/DeviceMeshService';
import { getCurrentUser } from '@/lib/auth';
import logger from '@/utils/logger';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/mesh/devices/energy - Get energy metrics
 *
 * Query params:
 * - period: hour | day | week | month (default: day)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const period = (request.nextUrl.searchParams.get('period') as EnergyMetrics['period']) || 'day';

    if (!['hour', 'day', 'week', 'month'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Must be: hour, day, week, or month' },
        { status: 400, headers: corsHeaders }
      );
    }

    const deviceMesh = getDeviceMeshService();
    const metrics = deviceMesh.getEnergyMetrics(user.id, period);

    // Get energy-related devices for context
    const devices = deviceMesh.getUserDevices(user.id);
    const energyDevices = devices.filter(d =>
      ['energy', 'vehicle', 'climate', 'appliance'].includes(d.category)
    );

    // Calculate savings/efficiency suggestions
    const suggestions: string[] = [];

    if (metrics.consumption.total > 0) {
      const topConsumer = Object.entries(metrics.consumption.byCategory)
        .sort(([, a], [, b]) => b - a)[0];

      if (topConsumer) {
        suggestions.push(`Your highest energy consumption is from ${topConsumer[0]} devices (${topConsumer[1].toFixed(1)} kWh)`);
      }
    }

    if (metrics.generation?.solar && metrics.generation.solar > 0) {
      const selfConsumption = Math.min(metrics.generation.solar / metrics.consumption.total * 100, 100);
      suggestions.push(`Solar self-consumption: ${selfConsumption.toFixed(0)}%`);
    }

    if (metrics.evCharging?.energyUsed) {
      suggestions.push(`EV charging used ${metrics.evCharging.energyUsed.toFixed(1)} kWh across ${metrics.evCharging.sessionsCount} sessions`);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          metrics,
          devices: {
            total: energyDevices.length,
            byCategory: {
              energy: energyDevices.filter(d => d.category === 'energy').length,
              vehicle: energyDevices.filter(d => d.category === 'vehicle').length,
              climate: energyDevices.filter(d => d.category === 'climate').length,
              appliance: energyDevices.filter(d => d.category === 'appliance').length,
            },
          },
          suggestions,
          summary: {
            netConsumption: metrics.consumption.total - (metrics.generation?.solar || 0),
            hasRenewables: (metrics.generation?.solar || 0) > 0,
            hasStorage: !!metrics.storage,
            hasEV: !!metrics.evCharging,
          },
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[EnergyAPI] GET error', { error });
    return NextResponse.json(
      { error: 'Failed to get energy metrics' },
      { status: 500, headers: corsHeaders }
    );
  }
}
