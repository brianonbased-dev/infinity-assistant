/**
 * EV Optimization API
 *
 * Public API endpoints for Electric Vehicle optimization features
 * in Infinity Assistant phone app and direct car app integration.
 *
 * Features:
 * - Vehicle status and battery monitoring
 * - Smart charging optimization (quantum-enhanced)
 * - V2G scheduling and revenue optimization
 * - Range prediction with weather integration
 * - Battery health diagnostics
 * - Driving mode with music integration
 *
 * @route /api/ev
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEVOptimizationService } from '@/services/EVOptimizationService';
import { withOptionalRateLimit } from '@/middleware/apiRateLimit';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';
import type { EVOptimizationAction, EVUserPreferences } from '@/types/ev-optimization';

interface EVAPIRequest {
  action: EVOptimizationAction;
  vehicleId?: string;
  parameters?: Record<string, unknown>;
  preferences?: EVUserPreferences;
}

/**
 * POST /api/ev
 *
 * Main EV optimization endpoint
 */
export const POST = withOptionalRateLimit(async (request: NextRequest) => {
  const startTime = Date.now();

  try {
    const body: EVAPIRequest = await request.json();
    const { action, vehicleId, parameters, preferences } = body;

    // Validate action
    const validActions: EVOptimizationAction[] = [
      'get_status',
      'predict_range',
      'optimize_charging',
      'schedule_v2g',
      'find_stations',
      'get_health',
      'update_preferences',
      'start_charging',
      'stop_charging',
      'precondition',
    ];

    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Valid actions: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Get user ID
    const userService = getUserService();
    const userId = request.headers.get('x-user-id') ||
      userService.getAnonymousUserId(request.cookies.get('infinity_anon_user')?.value);

    // Get or create vehicle ID
    const activeVehicleId = vehicleId || `vehicle_${userId}_default`;

    logger.info('[EV API] Processing request', {
      action,
      vehicleId: activeVehicleId,
      userId,
    });

    // Process request through EV Optimization Service
    const evService = getEVOptimizationService();
    const result = await evService.handleRequest({
      userId,
      vehicleId: activeVehicleId,
      action,
      parameters,
      preferences,
    });

    // Add driving context if in driving mode
    if (parameters?.drivingMode) {
      result.metadata = {
        ...result.metadata,
        drivingMode: true,
        musicSuggestion: getDrivingMusicSuggestion(result.data),
      };
    }

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    });
  } catch (error) {
    logger.error('[EV API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/ev
 *
 * Quick status check for EV
 */
export const GET = withOptionalRateLimit(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const vehicleId = searchParams.get('vehicleId');
    const action = searchParams.get('action') || 'get_status';

    const userService = getUserService();
    const userId = request.headers.get('x-user-id') ||
      userService.getAnonymousUserId(request.cookies.get('infinity_anon_user')?.value);

    const activeVehicleId = vehicleId || `vehicle_${userId}_default`;

    const evService = getEVOptimizationService();
    const result = await evService.handleRequest({
      userId,
      vehicleId: activeVehicleId,
      action: action as EVOptimizationAction,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('[EV API] GET Error:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to get EV status' },
      { status: 500 }
    );
  }
});

/**
 * Get driving music suggestion based on EV status
 */
function getDrivingMusicSuggestion(evData: unknown): {
  mood: string;
  genre: string;
  tempo: string;
  reason: string;
} {
  const data = evData as { battery?: { stateOfCharge?: number }; vehicle?: { currentRange?: number } };

  // Determine mood based on battery/range
  const soc = data?.battery?.stateOfCharge || 50;
  const range = data?.vehicle?.currentRange || 200;

  if (soc < 20) {
    return {
      mood: 'calm',
      genre: 'acoustic',
      tempo: 'slow',
      reason: 'Low battery - calm music to reduce range anxiety',
    };
  } else if (soc > 80) {
    return {
      mood: 'energetic',
      genre: 'electronic',
      tempo: 'upbeat',
      reason: 'Full charge - energetic music for the journey ahead',
    };
  } else if (range > 300) {
    return {
      mood: 'adventurous',
      genre: 'road-trip',
      tempo: 'varied',
      reason: 'Great range - road trip vibes for long distance driving',
    };
  }

  return {
    mood: 'balanced',
    genre: 'mixed',
    tempo: 'moderate',
    reason: 'Standard driving - balanced playlist',
  };
}
