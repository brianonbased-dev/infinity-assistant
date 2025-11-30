/**
 * Tesla-Specific EV API
 *
 * Official Tesla Fleet API integration endpoints for:
 * - Vehicle authentication and linking
 * - Real-time vehicle data
 * - Charging control
 * - Climate preconditioning
 * - Media control for driving experience
 * - Supercharger and destination charger locations
 *
 * Uses Tesla Fleet API (2024+) with Vehicle Command SDK
 *
 * @route /api/ev/tesla
 * @see https://developer.tesla.com/docs/fleet-api
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTeslaIntegrationService,
  type TeslaAuthConfig,
  type TeslaTokens,
} from '@/services/TeslaIntegrationService';
import { getDrivingMusicService } from '@/services/DrivingMusicService';
import { withOptionalRateLimit } from '@/middleware/apiRateLimit';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

type TeslaAction =
  // Auth
  | 'get_auth_url'
  | 'exchange_token'
  | 'refresh_token'
  // Vehicle
  | 'list_vehicles'
  | 'get_vehicle_data'
  | 'wake_vehicle'
  // Charging
  | 'start_charging'
  | 'stop_charging'
  | 'set_charge_limit'
  | 'set_charging_amps'
  | 'open_charge_port'
  | 'close_charge_port'
  | 'schedule_charging'
  // Climate
  | 'start_climate'
  | 'stop_climate'
  | 'set_temperature'
  | 'set_seat_heater'
  | 'set_steering_wheel_heater'
  | 'set_climate_keeper'
  | 'schedule_departure'
  // Media
  | 'media_play'
  | 'media_next'
  | 'media_prev'
  | 'media_volume_up'
  | 'media_volume_down'
  // Stations
  | 'nearby_chargers'
  // Combined
  | 'get_status_with_music';

interface TeslaAPIRequest {
  action: TeslaAction;
  accessToken?: string;
  vehicleId?: string;
  parameters?: Record<string, unknown>;
}

// ============================================================================
// AUTH CONFIG (stored securely in production)
// ============================================================================

const getAuthConfig = (): TeslaAuthConfig => ({
  clientId: process.env.TESLA_CLIENT_ID || '',
  clientSecret: process.env.TESLA_CLIENT_SECRET || '',
  redirectUri: process.env.TESLA_REDIRECT_URI || 'https://infinityassistant.io/api/ev/tesla/callback',
  scope: [
    'openid',
    'offline_access',
    'user_data',
    'vehicle_device_data',
    'vehicle_cmds',
    'vehicle_charging_cmds',
    'vehicle_location',
  ],
});

// ============================================================================
// POST HANDLER
// ============================================================================

export const POST = withOptionalRateLimit(async (request: NextRequest) => {
  const startTime = Date.now();

  try {
    const body: TeslaAPIRequest = await request.json();
    const { action, accessToken, vehicleId, parameters } = body;

    // Get user service
    const userService = getUserService();
    const userId = request.headers.get('x-user-id') ||
      userService.getAnonymousUserId(request.cookies.get('infinity_anon_user')?.value);

    logger.info('[Tesla API] Processing request', { action, vehicleId, userId });

    const teslaService = getTeslaIntegrationService();
    let result: unknown;

    // ========================================================================
    // AUTHENTICATION ACTIONS
    // ========================================================================

    if (action === 'get_auth_url') {
      const state = parameters?.state as string || `infinity_${Date.now()}`;
      const authUrl = teslaService.getAuthorizationUrl(getAuthConfig(), state);
      result = { authUrl, state };
    }

    else if (action === 'exchange_token') {
      const code = parameters?.code as string;
      if (!code) {
        return NextResponse.json({ error: 'Authorization code required' }, { status: 400 });
      }
      const tokens = await teslaService.exchangeCodeForTokens(code, getAuthConfig());
      result = {
        success: true,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        // Note: In production, tokens should be stored securely, not returned to client
      };
    }

    else if (action === 'refresh_token') {
      const refreshToken = parameters?.refreshToken as string;
      if (!refreshToken) {
        return NextResponse.json({ error: 'Refresh token required' }, { status: 400 });
      }
      const tokens = await teslaService.refreshTokens(refreshToken, getAuthConfig().clientId);
      result = {
        success: true,
        expiresAt: tokens.expiresAt,
      };
    }

    // ========================================================================
    // VEHICLE ACTIONS (require accessToken)
    // ========================================================================

    else {
      // All other actions require access token
      if (!accessToken) {
        return NextResponse.json(
          { error: 'Access token required. Please authenticate with Tesla first.' },
          { status: 401 }
        );
      }

      // ======================================================================
      // VEHICLE DATA
      // ======================================================================

      if (action === 'list_vehicles') {
        const vehicles = await teslaService.getVehicles(accessToken);
        result = {
          vehicles: vehicles.map(v => ({
            id: v.vehicleId,
            vin: v.vin,
            name: v.displayName,
            state: v.state,
            accessType: v.accessType,
          })),
        };
      }

      else if (action === 'get_vehicle_data') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }

        const data = await teslaService.getVehicleData(accessToken, vehicleId);

        // Convert to Infinity Assistant format
        const evVehicle = teslaService.toEVVehicle(
          { vehicleId: parseInt(vehicleId), vin: data.vin, displayName: data.displayName, state: data.state, id: data.id, inService: false, accessType: 'OWNER', apiVersion: data.vehicleState.apiVersion },
          data
        );
        const batteryState = teslaService.toBatteryState(vehicleId, data.chargeState, data.climateState);

        result = {
          vehicle: evVehicle,
          battery: batteryState,
          tesla: {
            chargeState: data.chargeState,
            climateState: data.climateState,
            driveState: data.driveState,
            vehicleState: data.vehicleState,
          },
        };
      }

      else if (action === 'wake_vehicle') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        const success = await teslaService.wakeVehicle(accessToken, vehicleId);
        result = { success, message: success ? 'Vehicle is now online' : 'Failed to wake vehicle' };
      }

      // ======================================================================
      // CHARGING COMMANDS
      // ======================================================================

      else if (action === 'start_charging') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        result = await teslaService.startCharging(accessToken, vehicleId);
      }

      else if (action === 'stop_charging') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        result = await teslaService.stopCharging(accessToken, vehicleId);
      }

      else if (action === 'set_charge_limit') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        const percent = parameters?.percent as number;
        if (typeof percent !== 'number' || percent < 50 || percent > 100) {
          return NextResponse.json({ error: 'Percent must be between 50 and 100' }, { status: 400 });
        }
        result = await teslaService.setChargeLimit(accessToken, vehicleId, percent);
      }

      else if (action === 'set_charging_amps') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        const amps = parameters?.amps as number;
        if (typeof amps !== 'number') {
          return NextResponse.json({ error: 'Amps value required' }, { status: 400 });
        }
        result = await teslaService.setChargingAmps(accessToken, vehicleId, amps);
      }

      else if (action === 'open_charge_port') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        result = await teslaService.openChargePort(accessToken, vehicleId);
      }

      else if (action === 'close_charge_port') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        result = await teslaService.closeChargePort(accessToken, vehicleId);
      }

      else if (action === 'schedule_charging') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        const enable = parameters?.enable as boolean;
        const time = parameters?.time as number; // minutes after midnight
        result = await teslaService.scheduleCharging(accessToken, vehicleId, enable, time);
      }

      // ======================================================================
      // CLIMATE COMMANDS
      // ======================================================================

      else if (action === 'start_climate') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        result = await teslaService.startClimate(accessToken, vehicleId);
      }

      else if (action === 'stop_climate') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        result = await teslaService.stopClimate(accessToken, vehicleId);
      }

      else if (action === 'set_temperature') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        const driverTemp = parameters?.driverTemp as number;
        const passengerTemp = parameters?.passengerTemp as number;
        if (typeof driverTemp !== 'number') {
          return NextResponse.json({ error: 'Driver temperature required' }, { status: 400 });
        }
        result = await teslaService.setTemperature(accessToken, vehicleId, driverTemp, passengerTemp);
      }

      else if (action === 'set_seat_heater') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        const heater = parameters?.heater as 0 | 1 | 2 | 4 | 5;
        const level = parameters?.level as 0 | 1 | 2 | 3;
        result = await teslaService.setSeatHeater(accessToken, vehicleId, heater, level);
      }

      else if (action === 'set_steering_wheel_heater') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        const on = parameters?.on as boolean;
        result = await teslaService.setSteeringWheelHeater(accessToken, vehicleId, on);
      }

      else if (action === 'set_climate_keeper') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        const mode = parameters?.mode as 0 | 1 | 2 | 3;
        result = await teslaService.setClimateKeeperMode(accessToken, vehicleId, mode);
      }

      else if (action === 'schedule_departure') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        const departureTime = parameters?.departureTime as number;
        const precondition = parameters?.precondition as boolean ?? true;
        const offPeakCharging = parameters?.offPeakCharging as boolean ?? true;
        result = await teslaService.scheduleDeparture(
          accessToken,
          vehicleId,
          departureTime,
          precondition,
          offPeakCharging
        );
      }

      // ======================================================================
      // MEDIA COMMANDS (Driving Music Integration)
      // ======================================================================

      else if (action === 'media_play') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        result = await teslaService.mediaPlay(accessToken, vehicleId);
      }

      else if (action === 'media_next') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        result = await teslaService.mediaNextTrack(accessToken, vehicleId);
      }

      else if (action === 'media_prev') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        result = await teslaService.mediaPrevTrack(accessToken, vehicleId);
      }

      else if (action === 'media_volume_up') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        result = await teslaService.mediaVolumeUp(accessToken, vehicleId);
      }

      else if (action === 'media_volume_down') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        result = await teslaService.mediaVolumeDown(accessToken, vehicleId);
      }

      // ======================================================================
      // CHARGING STATIONS
      // ======================================================================

      else if (action === 'nearby_chargers') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }
        const teslaSites = await teslaService.getNearbyChargingSites(accessToken, vehicleId);
        const stations = teslaService.toChargingStations(teslaSites);
        result = {
          superchargers: stations.filter(s => s.name.includes('Supercharger') || s.connectors[0]?.maxPower > 50),
          destinationChargers: stations.filter(s => !s.name.includes('Supercharger') && s.connectors[0]?.maxPower <= 50),
          all: stations,
        };
      }

      // ======================================================================
      // COMBINED: STATUS WITH MUSIC RECOMMENDATION
      // ======================================================================

      else if (action === 'get_status_with_music') {
        if (!vehicleId) {
          return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 });
        }

        // Get vehicle data
        const data = await teslaService.getVehicleData(accessToken, vehicleId);
        const batteryState = teslaService.toBatteryState(vehicleId, data.chargeState, data.climateState);

        // Get music recommendation based on vehicle state
        const musicService = getDrivingMusicService();
        const hour = new Date().getHours();
        const timeOfDay = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : hour < 22 ? 'evening' : 'night';

        const musicRecommendation = await musicService.getRecommendation({
          battery: batteryState,
          weather: {
            temperature: data.climateState.outsideTemp,
          },
          driving: {
            speed: data.driveState.speed || 0,
            drivingMode: 'normal',
          },
          timeOfDay,
        });

        result = {
          vehicle: {
            name: data.displayName,
            vin: data.vin,
            state: data.state,
            odometer: data.vehicleState.odometer,
            softwareVersion: data.vehicleState.carVersion,
          },
          battery: {
            level: data.chargeState.batteryLevel,
            range: Math.round(data.chargeState.estBatteryRange * 1.60934), // km
            chargingState: data.chargeState.chargingState,
            chargerPower: data.chargeState.chargerPower,
            minutesToFull: data.chargeState.minutesToFullCharge,
            chargeLimit: data.chargeState.chargeLimitSoc,
          },
          climate: {
            insideTemp: data.climateState.insideTemp,
            outsideTemp: data.climateState.outsideTemp,
            isClimateOn: data.climateState.isClimateOn,
            isPreconditioning: data.climateState.isPreconditioning,
            driverTempSetting: data.climateState.driverTempSetting,
          },
          location: {
            latitude: data.driveState.latitude,
            longitude: data.driveState.longitude,
            heading: data.driveState.heading,
            speed: data.driveState.speed,
          },
          music: musicRecommendation,
        };
      }

      else {
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      action,
      data: result,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    });
  } catch (error) {
    logger.error('[Tesla API] Error:', error);

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

// ============================================================================
// GET HANDLER (Quick Status)
// ============================================================================

export const GET = withOptionalRateLimit(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const accessToken = searchParams.get('accessToken');
  const vehicleId = searchParams.get('vehicleId');

  if (!accessToken || !vehicleId) {
    return NextResponse.json(
      { error: 'accessToken and vehicleId required' },
      { status: 400 }
    );
  }

  try {
    const teslaService = getTeslaIntegrationService();
    const data = await teslaService.getVehicleData(accessToken, vehicleId);

    return NextResponse.json({
      success: true,
      battery: {
        level: data.chargeState.batteryLevel,
        range: Math.round(data.chargeState.estBatteryRange * 1.60934),
        charging: data.chargeState.chargingState === 'Charging',
      },
      climate: {
        insideTemp: data.climateState.insideTemp,
        isOn: data.climateState.isClimateOn,
      },
      vehicle: {
        name: data.displayName,
        state: data.state,
        locked: data.vehicleState.locked,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get Tesla status' },
      { status: 500 }
    );
  }
});
