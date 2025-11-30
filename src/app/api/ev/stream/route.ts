/**
 * EV Real-time Updates Stream API
 *
 * Server-Sent Events (SSE) endpoint for real-time EV updates:
 * - Live battery status updates
 * - Charging state changes
 * - Climate control updates
 * - Location tracking
 * - Critical alerts (low battery, errors)
 *
 * @route GET /api/ev/stream
 */

import { NextRequest } from 'next/server';
import { getEVUpdateScheduler } from '@/services/EVUpdateScheduler';
import { getUnifiedEVService, ManufacturerCredentials } from '@/services/manufacturers/UnifiedEVService';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ev/stream
 *
 * Establish SSE connection for real-time EV updates
 *
 * Query Parameters:
 * - vehicleIds: Comma-separated list of vehicle IDs to subscribe to
 * - all: Set to "true" to subscribe to all user's vehicles
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const vehicleIdsParam = searchParams.get('vehicleIds');
  const subscribeAll = searchParams.get('all') === 'true';

  const userService = getUserService();
  const userId = request.headers.get('x-user-id') ||
    userService.getAnonymousUserId(request.cookies.get('infinity_anon_user')?.value);

  logger.info('[EV Stream] New SSE connection', { userId, subscribeAll });

  const scheduler = getEVUpdateScheduler();

  // Determine which vehicles to subscribe to
  let vehicleIds: string[] | undefined;
  if (!subscribeAll && vehicleIdsParam) {
    vehicleIds = vehicleIdsParam.split(',').map(id => id.trim());
  }

  // Create SSE stream
  const stream = scheduler.createSSEStream(vehicleIds);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * POST /api/ev/stream
 *
 * Register vehicles for streaming updates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, credentials, vehicleId, config } = body;

    const scheduler = getEVUpdateScheduler();
    const evService = getUnifiedEVService();

    switch (action) {
      case 'discover': {
        // Discover and register vehicles from credentials
        if (!credentials) {
          return Response.json(
            { error: 'Credentials required for discover action' },
            { status: 400 }
          );
        }

        const vehicles = await evService.discoverVehicles(credentials as ManufacturerCredentials);

        // Add each vehicle to the scheduler
        for (const vehicle of vehicles) {
          scheduler.addVehicle(vehicle.id, vehicle.manufacturer, {
            enabled: true,
            priority: 'normal',
          });
        }

        return Response.json({
          success: true,
          vehicles: vehicles.map(v => ({
            id: v.id,
            manufacturer: v.manufacturer,
            model: v.model,
            year: v.year,
          })),
        });
      }

      case 'add': {
        // Add a specific vehicle to scheduler
        if (!vehicleId || !credentials) {
          return Response.json(
            { error: 'vehicleId and credentials required' },
            { status: 400 }
          );
        }

        scheduler.addVehicle(
          vehicleId,
          (credentials as ManufacturerCredentials).manufacturer,
          config
        );

        return Response.json({ success: true, vehicleId });
      }

      case 'remove': {
        // Remove a vehicle from scheduler
        if (!vehicleId) {
          return Response.json(
            { error: 'vehicleId required' },
            { status: 400 }
          );
        }

        scheduler.removeVehicle(vehicleId);
        return Response.json({ success: true, vehicleId });
      }

      case 'update_config': {
        // Update scheduler configuration for a vehicle
        if (!vehicleId || !config) {
          return Response.json(
            { error: 'vehicleId and config required' },
            { status: 400 }
          );
        }

        scheduler.updateSchedule(vehicleId, config);
        return Response.json({ success: true, vehicleId });
      }

      case 'start': {
        // Start the scheduler
        scheduler.start();
        return Response.json({ success: true, message: 'Scheduler started' });
      }

      case 'stop': {
        // Stop the scheduler
        scheduler.stop();
        return Response.json({ success: true, message: 'Scheduler stopped' });
      }

      case 'force_update': {
        // Force immediate update for a vehicle
        if (!vehicleId) {
          return Response.json(
            { error: 'vehicleId required' },
            { status: 400 }
          );
        }

        const status = await scheduler.forceUpdate(vehicleId);
        return Response.json({ success: true, status });
      }

      case 'stats': {
        // Get scheduler statistics
        const stats = scheduler.getStats();
        return Response.json({ success: true, stats });
      }

      default:
        return Response.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('[EV Stream] Error:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
