/**
 * EV API v2
 *
 * Unified EV API using new lib architecture.
 * Supports all manufacturers through adapter pattern.
 *
 * @route /api/ev/v2
 */

import { NextRequest } from 'next/server';
import { withAuth, withPublic, success, error, parseBody, getQuery, type AuthenticatedContext, type ApiContext } from '@/lib/apiMiddleware';
import { evService } from '@/lib/EV';
import '@/lib/EV/adapters'; // Register all adapters
import { eventBus, createPayload } from '@/lib/EventBus';
import type { EVCommand, Manufacturer } from '@/lib/EV/types';

// ============================================================================
// Types
// ============================================================================

interface EVRequest {
  action: string;
  vehicleId?: string;
  manufacturer?: Manufacturer;
  parameters?: Record<string, unknown>;
}

// ============================================================================
// POST Handler - Authenticated Actions
// ============================================================================

export const POST = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const body = await parseBody<EVRequest>(req);

  if (!body?.action) {
    return error('INVALID_REQUEST', 'Action is required', 400);
  }

  const { action, vehicleId, manufacturer, parameters } = body;

  // ========================================================================
  // Vehicle Actions
  // ========================================================================

  if (action === 'list_vehicles') {
    const vehicles = await evService.getUserVehicles(ctx.userId);
    eventBus.emit('vehicle.list_fetched', createPayload('EV API v2', {
      userId: ctx.userId,
      count: vehicles.length,
    }));
    return success({ vehicles }, ctx);
  }

  if (action === 'get_vehicle') {
    if (!vehicleId) {
      return error('VALIDATION_FAILED', 'vehicleId is required', 400);
    }
    const vehicle = await evService.getVehicle(ctx.userId, vehicleId);
    return success({ vehicle }, ctx);
  }

  if (action === 'get_battery') {
    if (!vehicleId) {
      return error('VALIDATION_FAILED', 'vehicleId is required', 400);
    }
    const battery = await evService.getBatteryState(ctx.userId, vehicleId);
    return success({ battery }, ctx);
  }

  if (action === 'get_charging') {
    if (!vehicleId) {
      return error('VALIDATION_FAILED', 'vehicleId is required', 400);
    }
    const charging = await evService.getChargingState(ctx.userId, vehicleId);
    return success({ charging }, ctx);
  }

  if (action === 'get_climate') {
    if (!vehicleId) {
      return error('VALIDATION_FAILED', 'vehicleId is required', 400);
    }
    const climate = await evService.getClimateState(ctx.userId, vehicleId);
    return success({ climate }, ctx);
  }

  if (action === 'get_location') {
    if (!vehicleId) {
      return error('VALIDATION_FAILED', 'vehicleId is required', 400);
    }
    const location = await evService.getLocation(ctx.userId, vehicleId);
    return success({ location }, ctx);
  }

  if (action === 'get_full_status') {
    if (!vehicleId) {
      return error('VALIDATION_FAILED', 'vehicleId is required', 400);
    }

    const [vehicle, battery, charging, climate, location] = await Promise.all([
      evService.getVehicle(ctx.userId, vehicleId),
      evService.getBatteryState(ctx.userId, vehicleId),
      evService.getChargingState(ctx.userId, vehicleId),
      evService.getClimateState(ctx.userId, vehicleId),
      evService.getLocation(ctx.userId, vehicleId),
    ]);

    return success({
      vehicle,
      battery,
      charging,
      climate,
      location,
    }, ctx);
  }

  // ========================================================================
  // Commands
  // ========================================================================

  const commandActions: EVCommand[] = [
    'lock', 'unlock', 'startCharging', 'stopCharging',
    'startClimate', 'stopClimate', 'setChargeLimit',
    'setClimateTemp', 'honk', 'flash', 'openChargePort',
    'closeChargePort', 'sentryModeOn', 'sentryModeOff',
    'setSpeedLimit', 'clearSpeedLimit', 'refresh',
  ];

  if (commandActions.includes(action as EVCommand)) {
    if (!vehicleId) {
      return error('VALIDATION_FAILED', 'vehicleId is required', 400);
    }

    const result = await evService.sendCommand(
      ctx.userId,
      vehicleId,
      action as EVCommand,
      parameters
    );

    eventBus.emit('vehicle.command_sent', createPayload('EV API v2', {
      userId: ctx.userId,
      vehicleId,
      command: action,
      success: result.success,
    }));

    if (!result.success) {
      return error('COMMAND_FAILED', result.error || 'Command failed', 400);
    }

    return success({ result }, ctx);
  }

  // ========================================================================
  // Charging Schedule
  // ========================================================================

  if (action === 'generate_schedule') {
    if (!vehicleId) {
      return error('VALIDATION_FAILED', 'vehicleId is required', 400);
    }

    const schedule = await evService.generateChargingSchedule(ctx.userId, vehicleId, {
      targetSoC: parameters?.targetSoC as number,
      departureTime: parameters?.departureTime as string,
      useSmartGrid: parameters?.useSmartGrid as boolean,
    });

    return success({ schedule }, ctx);
  }

  // ========================================================================
  // Charging Stations
  // ========================================================================

  if (action === 'nearby_stations') {
    if (!vehicleId) {
      return error('VALIDATION_FAILED', 'vehicleId is required', 400);
    }

    const lat = parameters?.latitude as number;
    const lng = parameters?.longitude as number;
    const radius = parameters?.radius as number;

    if (!lat || !lng) {
      return error('VALIDATION_FAILED', 'latitude and longitude are required', 400);
    }

    const stations = await evService.getNearbyChargingStations(
      ctx.userId,
      vehicleId,
      lat,
      lng,
      radius
    );

    return success({ stations }, ctx);
  }

  // ========================================================================
  // Connection Management
  // ========================================================================

  if (action === 'connect_vehicle') {
    if (!manufacturer) {
      return error('VALIDATION_FAILED', 'manufacturer is required', 400);
    }

    const authUrl = evService.getAuthUrl(manufacturer, ctx.userId);
    return success({ authUrl, manufacturer }, ctx);
  }

  if (action === 'disconnect_vehicle') {
    if (!vehicleId) {
      return error('VALIDATION_FAILED', 'vehicleId is required', 400);
    }

    await evService.removeVehicleConnection(ctx.userId, vehicleId);

    eventBus.emit('vehicle.disconnected', createPayload('EV API v2', {
      userId: ctx.userId,
      vehicleId,
    }));

    return success({ disconnected: true }, ctx);
  }

  return error('INVALID_ACTION', `Unknown action: ${action}`, 400);
}, {
  rateLimit: 60,
  logging: true,
});

// ============================================================================
// GET Handler - Quick Status
// ============================================================================

export const GET = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const query = getQuery(req);
  const { vehicleId, action = 'status' } = query;

  if (!vehicleId) {
    // Return list of vehicles
    const vehicles = await evService.getUserVehicles(ctx.userId);
    return success({ vehicles }, ctx);
  }

  if (action === 'battery') {
    const battery = await evService.getBatteryState(ctx.userId, vehicleId);
    return success({ battery }, ctx);
  }

  if (action === 'charging') {
    const charging = await evService.getChargingState(ctx.userId, vehicleId);
    return success({ charging }, ctx);
  }

  // Default: return full status
  const [vehicle, battery, charging] = await Promise.all([
    evService.getVehicle(ctx.userId, vehicleId),
    evService.getBatteryState(ctx.userId, vehicleId),
    evService.getChargingState(ctx.userId, vehicleId),
  ]);

  return success({
    vehicle,
    battery,
    charging,
  }, ctx);
}, {
  rateLimit: 120,
});
