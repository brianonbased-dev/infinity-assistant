/**
 * Ford Integration Service for Infinity Assistant
 *
 * FordPass Connect API integration for:
 * - Vehicle status monitoring (battery, range, location)
 * - Charging control and scheduling
 * - Remote start and climate preconditioning
 * - Ford Power-Up software updates
 *
 * Supports: Mustang Mach-E, F-150 Lightning, E-Transit
 *
 * @see https://developer.ford.com/
 * @author Infinity Assistant
 * @version 1.0.0
 */

import logger from '@/utils/logger';
import type {
  EVVehicle,
  BatteryState,
  ChargingSession,
  ChargingStation,
  ChargingStatus,
} from '@/types/ev-optimization';

// ============================================================================
// FORD API TYPES
// ============================================================================

export interface FordAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface FordTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  fordConsumerId: string;
}

export interface FordVehicle {
  vehicleId: string;
  make: string;
  modelName: string;
  modelYear: string;
  color: string;
  nickname: string;
  modemEnabled: boolean;
  vehicleAuthorizationIndicator: number;
  serviceCompatible: boolean;
  tcuEnabled: boolean;
}

export interface FordVehicleStatus {
  vehiclestatus: {
    vin: string;
    lockStatus: { value: string; timestamp: string };
    alarm: { value: string; timestamp: string };
    odometer: { value: number; timestamp: string };
    fuel: { fuelLevel: number; timestamp: string };
    gps: {
      latitude: string;
      longitude: string;
      gpsState: string;
      timestamp: string;
    };
    remoteStart: { remoteStartDuration: number; status: number };
    remoteStartStatus: { value: number; timestamp: string };
    battery: {
      batteryHealth: { value: string };
      batteryStatusActual: { value: number };
    };
    oil: { oilLife: string; timestamp: string };
    tirePressure: {
      value: string;
      timestamp: string;
    };
    authorization: string;
    TPMS: {
      leftFrontTireStatus: { value: string };
      leftFrontTirePressure: { value: string };
      rightFrontTireStatus: { value: string };
      rightFrontTirePressure: { value: string };
      leftRearTireStatus: { value: string };
      leftRearTirePressure: { value: string };
      rightRearTireStatus: { value: string };
      rightRearTirePressure: { value: string };
    };
    firmwareUpgrade: { upgradeAvailable: boolean; firmwareVersion: string };
    deepSleepInProgress: { value: boolean };
    ccsSettings: { timestamp: string; location: number; vehicleConnectivity: number };
    lastRefresh: string;
    lastModifiedDate: string;
    serverTime: string;
  };
}

export interface FordEVStatus {
  xevBatteryStatus: {
    xevBatteryStateOfCharge: number; // percentage
    xevBatteryActualStateOfCharge: number;
    xevBatteryVoltage: number;
    xevBatteryIoCurrent: number;
    xevBatteryTemperature: number;
    xevBatteryChargeDisplayStatus: string;
  };
  xevPlugStatus: {
    xevPlugChargerStatus: string;
    xevChargeStationCommunicationStatus: string;
    xevChargeStationPowerType: string;
    xevBatteryChargerCurrentOutput: number;
    xevBatteryChargerVoltageOutput: number;
    xevBatteryPredictedEndTime: string;
    xevBatteryTimeToFullCharge: number; // minutes
    xevBatteryChargeEvent: string;
    xevDCFastChargeData: {
      dcFastChargeRequestReceived: boolean;
      dcFastChargePrecheckComplete: boolean;
    };
  };
  xevBatteryRange: {
    xevBatteryRangePreferred: number; // km
    xevBatteryMaxRange: number;
    xevBatteryActualRange: number;
    xevBatteryCapacity: number; // kWh
    xevBatteryPerformanceStatus: string;
    xevOneWayMaxRange: string;
  };
  xevChargeSchedule: {
    xevChargeScheduleEnabled: boolean;
    xevChargeScheduleTimes: FordChargeSchedule[];
    xevDepartureTime: string;
    xevPreconditioningEnabled: boolean;
  };
}

export interface FordChargeSchedule {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  enabled: boolean;
  chargeLevel: number;
}

export interface FordCommandResponse {
  commandId: string;
  status: 'QUEUED' | 'PENDINGRESPONSE' | 'COMPLETED' | 'FAILED';
  message?: string;
}

// ============================================================================
// FORD SERVICE CONFIGURATION
// ============================================================================

interface FordServiceConfig {
  baseUrl: string;
  authUrl: string;
  applicationId: string;
  wakeTimeout: number;
  pollInterval: number;
  cacheTimeout: number;
}

const defaultConfig: FordServiceConfig = {
  baseUrl: 'https://usapi.cv.ford.com/api',
  authUrl: 'https://sso.ci.ford.com',
  applicationId: process.env.FORD_APPLICATION_ID || '',
  wakeTimeout: 60000,
  pollInterval: 5000,
  cacheTimeout: 60000,
};

// ============================================================================
// FORD INTEGRATION SERVICE
// ============================================================================

export class FordIntegrationService {
  private config: FordServiceConfig;
  private static instance: FordIntegrationService;
  private vehicleCache = new Map<string, { data: FordVehicleStatus; timestamp: number }>();
  private evStatusCache = new Map<string, { data: FordEVStatus; timestamp: number }>();

  private constructor(config: Partial<FordServiceConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  static getInstance(config?: Partial<FordServiceConfig>): FordIntegrationService {
    if (!FordIntegrationService.instance) {
      FordIntegrationService.instance = new FordIntegrationService(config);
    }
    return FordIntegrationService.instance;
  }

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  getAuthorizationUrl(authConfig: FordAuthConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: authConfig.clientId,
      redirect_uri: authConfig.redirectUri,
      response_type: 'code',
      scope: 'access openid',
      state,
    });

    return `${this.config.authUrl}/v1.0/endpoint/default/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    authConfig: FordAuthConfig
  ): Promise<FordTokens> {
    const response = await fetch(`${this.config.authUrl}/v1.0/endpoint/default/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: authConfig.clientId,
        client_secret: authConfig.clientSecret,
        code,
        redirect_uri: authConfig.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ford token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      fordConsumerId: data.ford_consumer_id,
    };
  }

  async refreshTokens(refreshToken: string, authConfig: FordAuthConfig): Promise<FordTokens> {
    const response = await fetch(`${this.config.authUrl}/v1.0/endpoint/default/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: authConfig.clientId,
        client_secret: authConfig.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ford token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      fordConsumerId: data.ford_consumer_id,
    };
  }

  // ==========================================================================
  // VEHICLE DATA
  // ==========================================================================

  async getVehicles(accessToken: string): Promise<FordVehicle[]> {
    const response = await this.apiRequest<{ vehicles: FordVehicle[] }>(accessToken, '/users/vehicles');
    return response.vehicles || [];
  }

  async getVehicleStatus(accessToken: string, vehicleId: string): Promise<FordVehicleStatus> {
    const cached = this.getFromCache(this.vehicleCache, vehicleId);
    if (cached) return cached;

    const response = await this.apiRequest<FordVehicleStatus>(accessToken, `/vehicles/v5/${vehicleId}/status`);
    this.setCache(this.vehicleCache, vehicleId, response);
    return response;
  }

  async getEVStatus(accessToken: string, vehicleId: string): Promise<FordEVStatus> {
    const cached = this.getFromCache(this.evStatusCache, vehicleId);
    if (cached) return cached;

    const response = await this.apiRequest<FordEVStatus>(accessToken, `/vehicles/v5/${vehicleId}/xevstatus`);
    this.setCache(this.evStatusCache, vehicleId, response);
    return response;
  }

  // ==========================================================================
  // CHARGING COMMANDS
  // ==========================================================================

  async startCharging(accessToken: string, vehicleId: string): Promise<FordCommandResponse> {
    return this.sendCommand(accessToken, vehicleId, 'chargeStart');
  }

  async stopCharging(accessToken: string, vehicleId: string): Promise<FordCommandResponse> {
    return this.sendCommand(accessToken, vehicleId, 'chargeStop');
  }

  async setChargeSchedule(
    accessToken: string,
    vehicleId: string,
    schedule: FordChargeSchedule[]
  ): Promise<FordCommandResponse> {
    return this.apiRequest<FordCommandResponse>(
      accessToken,
      `/vehicles/v5/${vehicleId}/xevchargeschedule`,
      'PUT',
      { xevChargeScheduleTimes: schedule }
    );
  }

  async setDepartureTime(
    accessToken: string,
    vehicleId: string,
    departureTime: string,
    preconditioningEnabled: boolean
  ): Promise<FordCommandResponse> {
    return this.apiRequest<FordCommandResponse>(
      accessToken,
      `/vehicles/v5/${vehicleId}/xevdeparturetime`,
      'PUT',
      {
        xevDepartureTime: departureTime,
        xevPreconditioningEnabled: preconditioningEnabled,
      }
    );
  }

  // ==========================================================================
  // CLIMATE COMMANDS
  // ==========================================================================

  async remoteStart(accessToken: string, vehicleId: string): Promise<FordCommandResponse> {
    return this.sendCommand(accessToken, vehicleId, 'remoteStart');
  }

  async remoteStop(accessToken: string, vehicleId: string): Promise<FordCommandResponse> {
    return this.sendCommand(accessToken, vehicleId, 'remoteStop');
  }

  async startPrecondition(accessToken: string, vehicleId: string): Promise<FordCommandResponse> {
    return this.sendCommand(accessToken, vehicleId, 'precondition', { action: 'start' });
  }

  async stopPrecondition(accessToken: string, vehicleId: string): Promise<FordCommandResponse> {
    return this.sendCommand(accessToken, vehicleId, 'precondition', { action: 'stop' });
  }

  async setZoneLighting(
    accessToken: string,
    vehicleId: string,
    zones: Record<string, boolean>
  ): Promise<FordCommandResponse> {
    // F-150 Lightning zone lighting control
    return this.apiRequest<FordCommandResponse>(
      accessToken,
      `/vehicles/v5/${vehicleId}/zonelighting`,
      'PUT',
      zones
    );
  }

  // ==========================================================================
  // VEHICLE COMMANDS
  // ==========================================================================

  async lock(accessToken: string, vehicleId: string): Promise<FordCommandResponse> {
    return this.sendCommand(accessToken, vehicleId, 'lock');
  }

  async unlock(accessToken: string, vehicleId: string): Promise<FordCommandResponse> {
    return this.sendCommand(accessToken, vehicleId, 'unlock');
  }

  async getCommandStatus(
    accessToken: string,
    vehicleId: string,
    commandId: string
  ): Promise<FordCommandResponse> {
    return this.apiRequest<FordCommandResponse>(
      accessToken,
      `/vehicles/v5/${vehicleId}/commands/${commandId}`
    );
  }

  // ==========================================================================
  // CONVERSION TO INFINITY ASSISTANT TYPES
  // ==========================================================================

  toEVVehicle(fordVehicle: FordVehicle, evStatus?: FordEVStatus): EVVehicle {
    const modelInfo = this.getModelInfo(fordVehicle.modelName);

    return {
      id: `ford_${fordVehicle.vehicleId}`,
      userId: 'ford_user',
      vin: fordVehicle.vehicleId,
      make: 'Ford',
      model: fordVehicle.modelName,
      year: parseInt(fordVehicle.modelYear) || 2024,
      batteryCapacity: evStatus?.xevBatteryRange.xevBatteryCapacity || modelInfo.capacity,
      maxChargingRate: modelInfo.maxChargingRate,
      currentRange: evStatus?.xevBatteryRange.xevBatteryRangePreferred || 0,
      maxRange: evStatus?.xevBatteryRange.xevBatteryMaxRange || modelInfo.maxRange,
      connectedAt: new Date(),
      lastUpdated: new Date(),
    };
  }

  toBatteryState(vehicleId: string, evStatus: FordEVStatus): BatteryState {
    const chargeStatusMap: Record<string, ChargingStatus> = {
      'NotReady': 'idle',
      'ChargingAC': 'charging',
      'ChargingDC': 'charging',
      'ChargeComplete': 'complete',
      'EVScheduledCharge': 'scheduled',
      'NotConnected': 'idle',
    };

    return {
      vehicleId: `ford_${vehicleId}`,
      stateOfCharge: evStatus.xevBatteryStatus.xevBatteryStateOfCharge,
      stateOfHealth: evStatus.xevBatteryRange.xevBatteryPerformanceStatus === 'Normal' ? 95 : 85,
      temperature: evStatus.xevBatteryStatus.xevBatteryTemperature,
      voltage: evStatus.xevBatteryStatus.xevBatteryVoltage,
      current: evStatus.xevBatteryStatus.xevBatteryIoCurrent,
      chargingStatus: chargeStatusMap[evStatus.xevBatteryStatus.xevBatteryChargeDisplayStatus] || 'idle',
      estimatedRange: evStatus.xevBatteryRange.xevBatteryRangePreferred,
      degradationRate: 2.5,
      cycleCount: 0,
      timestamp: new Date(),
    };
  }

  private getModelInfo(modelName: string): {
    capacity: number;
    maxChargingRate: number;
    maxRange: number;
  } {
    const models: Record<string, { capacity: number; maxChargingRate: number; maxRange: number }> = {
      'Mustang Mach-E': { capacity: 91, maxChargingRate: 150, maxRange: 500 },
      'Mach-E': { capacity: 91, maxChargingRate: 150, maxRange: 500 },
      'F-150 Lightning': { capacity: 131, maxChargingRate: 150, maxRange: 515 },
      'Lightning': { capacity: 131, maxChargingRate: 150, maxRange: 515 },
      'E-Transit': { capacity: 89, maxChargingRate: 115, maxRange: 203 },
    };

    for (const [key, value] of Object.entries(models)) {
      if (modelName.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    return { capacity: 80, maxChargingRate: 150, maxRange: 400 };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async sendCommand(
    accessToken: string,
    vehicleId: string,
    command: string,
    params?: Record<string, unknown>
  ): Promise<FordCommandResponse> {
    const response = await this.apiRequest<{
      commandId?: string;
      status?: FordCommandResponse['status'];
      message?: string;
    }>(
      accessToken,
      `/vehicles/v5/${vehicleId}/${command}`,
      'POST',
      params
    );

    return {
      commandId: response.commandId || '',
      status: response.status || 'QUEUED',
      message: response.message,
    };
  }

  private async apiRequest<T = Record<string, unknown>>(
    accessToken: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Application-Id': this.config.applicationId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('[Ford] API error', { endpoint, status: response.status, error });
      throw new Error(`Ford API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
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

let fordServiceInstance: FordIntegrationService | null = null;

export function getFordIntegrationService(): FordIntegrationService {
  if (!fordServiceInstance) {
    fordServiceInstance = FordIntegrationService.getInstance();
  }
  return fordServiceInstance;
}

export default FordIntegrationService;
