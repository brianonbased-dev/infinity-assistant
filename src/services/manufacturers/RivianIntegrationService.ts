/**
 * Rivian Integration Service for Infinity Assistant
 *
 * Rivian API integration for:
 * - Vehicle status monitoring (battery, range, location)
 * - Charging control and camp mode
 * - Remote start and climate preconditioning
 * - Adventure Network charging
 * - Gear Guard security
 *
 * Supports: R1T, R1S, R2, R3
 *
 * @author Infinity Assistant
 * @version 1.0.0
 */

import logger from '@/utils/logger';
import type {
  EVVehicle,
  BatteryState,
  ChargingStatus,
} from '@/types/ev-optimization';

// ============================================================================
// RIVIAN API TYPES
// ============================================================================

export interface RivianAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface RivianTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  userId: string;
}

export interface RivianVehicle {
  vehicleId: string;
  vin: string;
  name: string;
  model: string;
  modelYear: number;
  expectedDeliveryDate?: string;
  vehicleState: 'configured' | 'manufacturing' | 'delivered';
  roles: string[];
  settings: {
    name: string;
    timezone: string;
    distanceUnit: 'miles' | 'kilometers';
    temperatureUnit: 'fahrenheit' | 'celsius';
  };
}

export interface RivianVehicleState {
  powerState: {
    state: 'sleep' | 'awake' | 'ready' | 'driving';
    driveMode: string;
    gearPosition: string;
    chargerState: RivianChargerState;
  };
  batteryLevel: {
    value: number;
    timestamp: string;
  };
  batteryLimit: {
    ampLimit: number;
    socLimit: number;
  };
  range: {
    value: number;
    unit: string;
    timestamp: string;
  };
  odometer: {
    value: number;
    unit: string;
  };
  cabinClimate: {
    interiorTemperature: number;
    hvacPower: boolean;
    hvacMode: string;
    cabinPreconditioning: boolean;
    defrost: {
      defrostingFront: boolean;
      defrostingRear: boolean;
    };
    seatHeater: {
      frontLeft: number;
      frontRight: number;
      rearLeft: number;
      rearRight: number;
    };
    steeringWheelHeat: boolean;
  };
  location: {
    latitude: number;
    longitude: number;
    bearing: number;
    timestamp: string;
  };
  doors: {
    frontLeft: boolean;
    frontRight: boolean;
    rearLeft: boolean;
    rearRight: boolean;
  };
  windows: {
    frontLeft: number;
    frontRight: number;
    rearLeft: number;
    rearRight: number;
  };
  tires: {
    frontLeft: { pressure: number; status: string };
    frontRight: { pressure: number; status: string };
    rearLeft: { pressure: number; status: string };
    rearRight: { pressure: number; status: string };
  };
  gearGuard: {
    enabled: boolean;
    alarming: boolean;
    lastEvent?: {
      type: string;
      timestamp: string;
      videoUrl?: string;
    };
  };
  softwareUpdate: {
    available: boolean;
    version?: string;
    scheduledTime?: string;
    status: 'none' | 'downloading' | 'ready' | 'installing';
  };
}

export interface RivianChargerState {
  state: 'disconnected' | 'connected' | 'charging' | 'complete' | 'fault';
  chargerType: 'none' | 'level1' | 'level2' | 'dcfast' | 'adventure_network';
  power: number; // kW
  voltage: number;
  current: number;
  timeToFull: number; // minutes
  energyAdded: number; // kWh
  sessionStartTime?: string;
  scheduledCharging: {
    enabled: boolean;
    startTime?: string;
    endTime?: string;
  };
}

export interface RivianChargingStation {
  id: string;
  name: string;
  type: 'adventure_network' | 'waypoint' | 'partner';
  address: {
    line1: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  location: {
    latitude: number;
    longitude: number;
  };
  chargers: {
    id: string;
    power: number;
    connectorType: string;
    status: 'available' | 'in_use' | 'offline' | 'reserved';
  }[];
  amenities: string[];
  accessType: 'public' | 'rivian_exclusive';
  pricing: {
    perKwh: number;
    perMinute: number;
    currency: string;
  };
}

export interface RivianCommandResult {
  commandId: string;
  status: 'queued' | 'pending' | 'success' | 'failed';
  message?: string;
}

// ============================================================================
// RIVIAN SERVICE CONFIGURATION
// ============================================================================

interface RivianServiceConfig {
  baseUrl: string;
  graphqlUrl: string;
  wakeTimeout: number;
  pollInterval: number;
  cacheTimeout: number;
}

const defaultConfig: RivianServiceConfig = {
  baseUrl: 'https://rivian.com/api/gql',
  graphqlUrl: 'https://rivian.com/api/gql/gateway/graphql',
  wakeTimeout: 30000,
  pollInterval: 3000,
  cacheTimeout: 60000,
};

// ============================================================================
// RIVIAN INTEGRATION SERVICE
// ============================================================================

export class RivianIntegrationService {
  private config: RivianServiceConfig;
  private static instance: RivianIntegrationService;
  private stateCache = new Map<string, { data: RivianVehicleState; timestamp: number }>();

  private constructor(config: Partial<RivianServiceConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  static getInstance(config?: Partial<RivianServiceConfig>): RivianIntegrationService {
    if (!RivianIntegrationService.instance) {
      RivianIntegrationService.instance = new RivianIntegrationService(config);
    }
    return RivianIntegrationService.instance;
  }

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  getAuthorizationUrl(authConfig: RivianAuthConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: authConfig.clientId,
      redirect_uri: authConfig.redirectUri,
      response_type: 'code',
      scope: 'openid vehicle:read vehicle:write charging:read charging:write',
      state,
    });

    return `https://rivian.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    authConfig: RivianAuthConfig
  ): Promise<RivianTokens> {
    const response = await fetch('https://rivian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: authConfig.clientId,
        client_secret: authConfig.clientSecret,
        code,
        redirect_uri: authConfig.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Rivian token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      userId: data.user_id,
    };
  }

  async refreshTokens(refreshToken: string, authConfig: RivianAuthConfig): Promise<RivianTokens> {
    const response = await fetch('https://rivian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: authConfig.clientId,
        client_secret: authConfig.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Rivian token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      userId: data.user_id,
    };
  }

  // ==========================================================================
  // VEHICLE DATA (GraphQL)
  // ==========================================================================

  async getVehicles(accessToken: string): Promise<RivianVehicle[]> {
    const query = `
      query GetVehicles {
        currentUser {
          vehicles {
            id
            vin
            name
            model
            modelYear
            vehicleState
            roles
            settings {
              name
              timezone
              distanceUnit
              temperatureUnit
            }
          }
        }
      }
    `;

    const response = await this.graphqlRequest<{ currentUser?: { vehicles?: RivianVehicle[] } }>(accessToken, query);
    return response.data?.currentUser?.vehicles || [];
  }

  async getVehicleState(accessToken: string, vehicleId: string): Promise<RivianVehicleState> {
    const cached = this.getFromCache(this.stateCache, vehicleId);
    if (cached) return cached;

    const query = `
      query GetVehicleState($vehicleId: String!) {
        vehicleState(id: $vehicleId) {
          powerState {
            state
            driveMode
            gearPosition
            chargerState {
              state
              chargerType
              power
              voltage
              current
              timeToFull
              energyAdded
              sessionStartTime
              scheduledCharging {
                enabled
                startTime
                endTime
              }
            }
          }
          batteryLevel {
            value
            timestamp
          }
          batteryLimit {
            ampLimit
            socLimit
          }
          range {
            value
            unit
            timestamp
          }
          odometer {
            value
            unit
          }
          cabinClimate {
            interiorTemperature
            hvacPower
            hvacMode
            cabinPreconditioning
            defrost {
              defrostingFront
              defrostingRear
            }
            seatHeater {
              frontLeft
              frontRight
              rearLeft
              rearRight
            }
            steeringWheelHeat
          }
          location {
            latitude
            longitude
            bearing
            timestamp
          }
          doors {
            frontLeft
            frontRight
            rearLeft
            rearRight
          }
          tires {
            frontLeft { pressure status }
            frontRight { pressure status }
            rearLeft { pressure status }
            rearRight { pressure status }
          }
          gearGuard {
            enabled
            alarming
          }
          softwareUpdate {
            available
            version
            status
          }
        }
      }
    `;

    const response = await this.graphqlRequest(accessToken, query, { vehicleId });
    const state = response.data?.vehicleState as RivianVehicleState;

    this.setCache(this.stateCache, vehicleId, state);
    return state;
  }

  async getAdventureNetworkStations(
    accessToken: string,
    latitude: number,
    longitude: number,
    radius?: number
  ): Promise<RivianChargingStation[]> {
    const query = `
      query GetChargingStations($latitude: Float!, $longitude: Float!, $radius: Int) {
        chargingStations(
          location: { latitude: $latitude, longitude: $longitude }
          radius: $radius
        ) {
          id
          name
          type
          address {
            line1
            city
            state
            zipCode
            country
          }
          location {
            latitude
            longitude
          }
          chargers {
            id
            power
            connectorType
            status
          }
          amenities
          accessType
          pricing {
            perKwh
            perMinute
            currency
          }
        }
      }
    `;

    const response = await this.graphqlRequest<{ chargingStations?: RivianChargingStation[] }>(accessToken, query, {
      latitude,
      longitude,
      radius: radius || 50,
    });

    return response.data?.chargingStations || [];
  }

  // ==========================================================================
  // CHARGING COMMANDS
  // ==========================================================================

  async startCharging(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'startCharging');
  }

  async stopCharging(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'stopCharging');
  }

  async setChargeLimit(
    accessToken: string,
    vehicleId: string,
    socLimit: number
  ): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'setChargeLimit', {
      socLimit: Math.max(50, Math.min(100, socLimit)),
    });
  }

  async setAmpLimit(
    accessToken: string,
    vehicleId: string,
    ampLimit: number
  ): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'setAmpLimit', { ampLimit });
  }

  async scheduleCharging(
    accessToken: string,
    vehicleId: string,
    enabled: boolean,
    startTime?: string,
    endTime?: string
  ): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'setChargeSchedule', {
      enabled,
      startTime,
      endTime,
    });
  }

  // ==========================================================================
  // CLIMATE COMMANDS
  // ==========================================================================

  async precondition(
    accessToken: string,
    vehicleId: string,
    options?: { temperature?: number; defrost?: boolean }
  ): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'cabinPrecondition', {
      enabled: true,
      targetTemperature: options?.temperature,
      defrost: options?.defrost,
    });
  }

  async stopPrecondition(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'cabinPrecondition', { enabled: false });
  }

  async setSeatHeater(
    accessToken: string,
    vehicleId: string,
    seat: 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight',
    level: 0 | 1 | 2 | 3
  ): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'setSeatHeater', { seat, level });
  }

  async setSteeringWheelHeat(
    accessToken: string,
    vehicleId: string,
    enabled: boolean
  ): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'setSteeringWheelHeat', { enabled });
  }

  async enableCampMode(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'enableCampMode', {});
  }

  async disableCampMode(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'disableCampMode', {});
  }

  // ==========================================================================
  // VEHICLE COMMANDS
  // ==========================================================================

  async wake(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'wake', {});
  }

  async lock(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'lock', {});
  }

  async unlock(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'unlock', {});
  }

  async openFrunk(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'openFrunk', {});
  }

  async closeFrunk(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'closeFrunk', {});
  }

  async openTailgate(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'openTailgate', {});
  }

  async closeTailgate(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'closeTailgate', {});
  }

  async enableGearGuard(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'enableGearGuard', {});
  }

  async disableGearGuard(accessToken: string, vehicleId: string): Promise<RivianCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'disableGearGuard', {});
  }

  // ==========================================================================
  // CONVERSION TO INFINITY ASSISTANT TYPES
  // ==========================================================================

  toEVVehicle(rivianVehicle: RivianVehicle, state?: RivianVehicleState): EVVehicle {
    const modelInfo = this.getModelInfo(rivianVehicle.model);

    return {
      id: `rivian_${rivianVehicle.vehicleId}`,
      userId: 'rivian_user',
      vin: rivianVehicle.vin,
      make: 'Rivian',
      model: rivianVehicle.model,
      year: rivianVehicle.modelYear,
      batteryCapacity: modelInfo.capacity,
      maxChargingRate: modelInfo.maxChargingRate,
      currentRange: state?.range.value || 0,
      maxRange: modelInfo.maxRange,
      connectedAt: new Date(),
      lastUpdated: new Date(),
    };
  }

  toBatteryState(vehicleId: string, state: RivianVehicleState): BatteryState {
    const statusMap: Record<string, ChargingStatus> = {
      'disconnected': 'idle',
      'connected': 'idle',
      'charging': 'charging',
      'complete': 'complete',
      'fault': 'idle',
    };

    return {
      vehicleId: `rivian_${vehicleId}`,
      stateOfCharge: state.batteryLevel.value,
      stateOfHealth: 95,
      temperature: state.cabinClimate.interiorTemperature,
      voltage: state.powerState.chargerState.voltage || 400,
      current: state.powerState.chargerState.current || 0,
      chargingStatus: statusMap[state.powerState.chargerState.state] || 'idle',
      estimatedRange: state.range.value,
      degradationRate: 2.0,
      cycleCount: 0,
      timestamp: new Date(state.batteryLevel.timestamp),
    };
  }

  private getModelInfo(model: string): {
    capacity: number;
    maxChargingRate: number;
    maxRange: number;
  } {
    const models: Record<string, { capacity: number; maxChargingRate: number; maxRange: number }> = {
      'R1T': { capacity: 135, maxChargingRate: 220, maxRange: 515 }, // Large pack
      'R1T Max': { capacity: 180, maxChargingRate: 220, maxRange: 660 },
      'R1S': { capacity: 135, maxChargingRate: 220, maxRange: 500 },
      'R1S Max': { capacity: 180, maxChargingRate: 220, maxRange: 640 },
      'R2': { capacity: 90, maxChargingRate: 200, maxRange: 480 },
      'R3': { capacity: 80, maxChargingRate: 180, maxRange: 430 },
      'R3X': { capacity: 80, maxChargingRate: 180, maxRange: 400 },
    };

    const key = Object.keys(models).find(k =>
      model.toLowerCase().includes(k.toLowerCase())
    );

    return key ? models[key] : { capacity: 135, maxChargingRate: 220, maxRange: 500 };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async sendCommand(
    accessToken: string,
    vehicleId: string,
    command: string,
    variables?: Record<string, unknown>
  ): Promise<RivianCommandResult> {
    const mutation = `
      mutation SendCommand($vehicleId: String!, $command: String!, $variables: JSON) {
        sendVehicleCommand(
          vehicleId: $vehicleId
          command: $command
          variables: $variables
        ) {
          commandId
          status
          message
        }
      }
    `;

    const response = await this.graphqlRequest<{
      sendVehicleCommand?: {
        commandId?: string;
        status?: string;
        message?: string;
      }
    }>(accessToken, mutation, {
      vehicleId,
      command,
      variables,
    });

    return {
      commandId: response.data?.sendVehicleCommand?.commandId || '',
      status: (response.data?.sendVehicleCommand?.status as RivianCommandResult['status']) || 'pending',
      message: response.data?.sendVehicleCommand?.message,
    };
  }

  private async graphqlRequest<T = Record<string, unknown>>(
    accessToken: string,
    query: string,
    variables?: Record<string, unknown>
  ): Promise<{ data: T }> {
    const response = await fetch(this.config.graphqlUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('[Rivian] GraphQL error', { status: response.status, error });
      throw new Error(`Rivian API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    if (result.errors) {
      logger.error('[Rivian] GraphQL errors', { errors: result.errors });
      throw new Error(`Rivian GraphQL error: ${result.errors[0]?.message}`);
    }

    return result;
  }

  private getFromCache<T>(cache: Map<string, { data: T; timestamp: number }>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.config.cacheTimeout) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache<T>(cache: Map<string, { data: T; timestamp: number }>, key: string, data: T): void {
    cache.set(key, { data, timestamp: Date.now() });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let rivianServiceInstance: RivianIntegrationService | null = null;

export function getRivianIntegrationService(): RivianIntegrationService {
  if (!rivianServiceInstance) {
    rivianServiceInstance = RivianIntegrationService.getInstance();
  }
  return rivianServiceInstance;
}

export default RivianIntegrationService;
