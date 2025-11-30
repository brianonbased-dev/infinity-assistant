/**
 * EV Charging Stations API
 *
 * Public endpoint for finding nearby charging stations.
 * Uses user's connected vehicles for network-specific stations.
 *
 * @route /api/ev/v2/stations
 */

import { NextRequest } from 'next/server';
import { withAuth, withPublic, success, error, getQuery, type AuthenticatedContext, type ApiContext } from '@/lib/apiMiddleware';
import { evService } from '@/lib/EV';
import '@/lib/EV/adapters';
import type { ChargingStation } from '@/lib/EV/types';

// ============================================================================
// GET Handler - Find Nearby Stations
// ============================================================================

export const GET = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const query = getQuery(req);

  const lat = parseFloat(query.latitude || query.lat || '');
  const lng = parseFloat(query.longitude || query.lng || '');
  const radius = parseFloat(query.radius || '25'); // Default 25 miles
  const vehicleId = query.vehicleId;
  const networks = query.networks?.split(',');
  const connectorTypes = query.connectors?.split(',');
  const minPower = parseFloat(query.minPower || '0');
  const availableOnly = query.availableOnly === 'true';

  // Validate coordinates
  if (isNaN(lat) || isNaN(lng)) {
    return error('VALIDATION_FAILED', 'Valid latitude and longitude are required', 400);
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return error('VALIDATION_FAILED', 'Coordinates out of range', 400);
  }

  let stations: ChargingStation[] = [];

  // If vehicleId provided, get manufacturer-specific stations
  if (vehicleId) {
    stations = await evService.getNearbyChargingStations(
      ctx.userId,
      vehicleId,
      lat,
      lng,
      radius
    );
  } else {
    // Get stations from all connected vehicles
    const vehicles = await evService.getUserVehicles(ctx.userId);

    if (vehicles.length > 0) {
      // Use first vehicle's manufacturer for stations
      const firstVehicle = vehicles[0];
      stations = await evService.getNearbyChargingStations(
        ctx.userId,
        firstVehicle.id,
        lat,
        lng,
        radius
      );
    } else {
      // No connected vehicles - return empty with hint
      return success({
        stations: [],
        hint: 'Connect a vehicle to see manufacturer-specific charging stations',
        publicNetworks: [
          'ChargePoint',
          'EVgo',
          'Electrify America',
          'Tesla Supercharger (with adapter)',
        ],
      }, ctx);
    }
  }

  // Apply filters
  let filteredStations = stations;

  if (networks && networks.length > 0) {
    filteredStations = filteredStations.filter(s =>
      networks.some(n => s.network?.toLowerCase().includes(n.toLowerCase()))
    );
  }

  if (connectorTypes && connectorTypes.length > 0) {
    filteredStations = filteredStations.filter(s =>
      s.connectors.some(c =>
        connectorTypes.some(ct => c.type.toLowerCase().includes(ct.toLowerCase()))
      )
    );
  }

  if (minPower > 0) {
    filteredStations = filteredStations.filter(s =>
      s.connectors.some(c => (c.power || 0) >= minPower)
    );
  }

  if (availableOnly) {
    filteredStations = filteredStations.filter(s => s.available !== false);
  }

  // Sort by distance (approximate)
  filteredStations.sort((a, b) => {
    const distA = Math.sqrt(
      Math.pow(a.latitude - lat, 2) + Math.pow(a.longitude - lng, 2)
    );
    const distB = Math.sqrt(
      Math.pow(b.latitude - lat, 2) + Math.pow(b.longitude - lng, 2)
    );
    return distA - distB;
  });

  // Group by type
  const dcFast = filteredStations.filter(s =>
    s.connectors.some(c => (c.power || 0) >= 50)
  );
  const level2 = filteredStations.filter(s =>
    !s.connectors.some(c => (c.power || 0) >= 50)
  );

  return success({
    stations: filteredStations,
    summary: {
      total: filteredStations.length,
      dcFast: dcFast.length,
      level2: level2.length,
      available: filteredStations.filter(s => s.available !== false).length,
    },
    filters: {
      latitude: lat,
      longitude: lng,
      radius,
      networks,
      connectorTypes,
      minPower,
      availableOnly,
    },
  }, ctx);
}, {
  rateLimit: 30,
});

// ============================================================================
// POST Handler - Find Route Stations
// ============================================================================

export const POST = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const body = await req.json();

  const { vehicleId, route, preferences } = body;

  if (!vehicleId || !route) {
    return error('VALIDATION_FAILED', 'vehicleId and route are required', 400);
  }

  if (!Array.isArray(route) || route.length < 2) {
    return error('VALIDATION_FAILED', 'route must have at least 2 waypoints', 400);
  }

  // Get vehicle info for range calculation
  const vehicle = await evService.getVehicle(ctx.userId, vehicleId);
  const battery = await evService.getBatteryState(ctx.userId, vehicleId);

  if (!vehicle || !battery) {
    return error('VEHICLE_NOT_FOUND', 'Vehicle not found', 404);
  }

  // Calculate stations needed along route
  const currentRange = battery.range;
  const routeStations: Array<{
    waypoint: number;
    latitude: number;
    longitude: number;
    stations: ChargingStation[];
    recommended: ChargingStation | null;
  }> = [];

  // Simplified route planning - find stations at each waypoint
  for (let i = 0; i < route.length; i++) {
    const waypoint = route[i];
    const { latitude, longitude } = waypoint;

    const stations = await evService.getNearbyChargingStations(
      ctx.userId,
      vehicleId,
      latitude,
      longitude,
      preferences?.searchRadius || 10
    );

    // Recommend fastest charger
    const dcFastStations = stations
      .filter(s => s.connectors.some(c => (c.power || 0) >= 50))
      .filter(s => s.available !== false);

    const recommended = dcFastStations.length > 0
      ? dcFastStations.reduce((best, current) => {
          const bestPower = Math.max(...(best.connectors.map(c => c.power || 0)));
          const currentPower = Math.max(...(current.connectors.map(c => c.power || 0)));
          return currentPower > bestPower ? current : best;
        })
      : null;

    routeStations.push({
      waypoint: i,
      latitude,
      longitude,
      stations,
      recommended,
    });
  }

  return success({
    vehicle: {
      id: vehicle.id,
      name: vehicle.displayName,
      currentRange,
      batteryLevel: battery.level,
    },
    route: {
      waypoints: route.length,
      stations: routeStations,
    },
    recommendations: routeStations
      .filter(rs => rs.recommended)
      .map(rs => ({
        waypoint: rs.waypoint,
        station: rs.recommended,
      })),
  }, ctx);
}, {
  rateLimit: 10,
});
