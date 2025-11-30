/**
 * GM Integration Service for Infinity Assistant
 *
 * General Motors OnStar/myChevrolet/myGMC/myCadillac API integration for:
 * - Vehicle status monitoring (battery, range, location)
 * - Charging control with Ultium platform
 * - Remote start and climate preconditioning
 * - Energy Assist navigation
 *
 * Supports: Chevrolet Bolt EV/EUV, Equinox EV, Blazer EV, Silverado EV,
 *           GMC Hummer EV, Sierra EV, Cadillac LYRIQ, CELESTIQ
 *
 * @see https://developer.gm.com/
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
// GM API TYPES
// ============================================================================

export interface GMAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GMTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  accountId: string;
}

export interface GMVehicle {
  vin: string;
  year: number;
  make: string;
  model: string;
  bodyStyle: string;
  engine: string;
  transmission: string;
  primaryColor: string;
  licensePlate: string;
  nickname: string;
  evDetails?: {
    isElectric: boolean;
    batteryCapacityKwh: number;
    dcFastChargingCapable: boolean;
  };
}

export interface GMVehicleStatus {
  diagnostics: GMDiagnostics;
  location: GMLocation;
  evStatus?: GMEVStatus;
}

export interface GMDiagnostics {
  lastUpdatedDate: string;
  odometer: { value: number; unit: string };
  oilLife: { value: number; status: string };
  tirePressure: {
    frontLeft: { value: number; unit: string; status: string };
    frontRight: { value: number; unit: string; status: string };
    rearLeft: { value: number; unit: string; status: string };
    rearRight: { value: number; unit: string; status: string };
  };
  fuel?: {
    level: number;
    range: number;
    unit: string;
  };
  battery?: {
    voltage: number;
    health: string;
  };
}

export interface GMLocation {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  lastUpdatedDate: string;
}

export interface GMEVStatus {
  batteryLevel: number; // percentage
  estimatedRange: number; // miles
  estimatedRangeUnit: string;
  chargeState: GMChargeState;
  plugState: GMPlugState;
  batteryCondition: {
    stateOfHealth: number;
    temperature: number;
    temperatureUnit: string;
  };
  chargingProfile: {
    targetSoc: number;
    departureTime: string;
    climatePrecondition: boolean;
  };
  energyAssist: {
    enabled: boolean;
    nearbyStations: GMChargingStation[];
  };
}

export interface GMChargeState {
  status: 'NOT_CHARGING' | 'CHARGING' | 'CHARGE_COMPLETE' | 'PLUGGED_IN' | 'INTERRUPTED';
  chargeMode: 'LEVEL_1' | 'LEVEL_2' | 'DC_FAST';
  chargeRate: number; // kW
  timeToFullCharge: number; // minutes
  energyAdded: number; // kWh
  sessionStartTime: string;
}

export interface GMPlugState {
  plugged: boolean;
  portDoorOpen: boolean;
  connectorType: string;
  vehicleAuthorized: boolean;
  chargerCommunicating: boolean;
}

export interface GMChargingStation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance: number;
  distanceUnit: string;
  networkName: string;
  connectorTypes: string[];
  maxPowerKw: number;
  availability: 'AVAILABLE' | 'IN_USE' | 'OFFLINE' | 'UNKNOWN';
  pricing: {
    currency: string;
    perKwh: number;
    sessionFee: number;
  };
}

export interface GMCommandResponse {
  commandId: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILURE';
  statusCode: number;
  message?: string;
}

// ============================================================================
// GM SERVICE CONFIGURATION
// ============================================================================

interface GMServiceConfig {
  baseUrl: string;
  authUrl: string;
  wakeTimeout: number;
  pollInterval: number;
  cacheTimeout: number;
}

const defaultConfig: GMServiceConfig = {
  baseUrl: 'https://api.gm.com/api/v1',
  authUrl: 'https://accounts.gm.com/oauth',
  wakeTimeout: 60000,
  pollInterval: 5000,
  cacheTimeout: 60000,
};

// ============================================================================
// GM INTEGRATION SERVICE
// ============================================================================

export class GMIntegrationService {
  private config: GMServiceConfig;
  private static instance: GMIntegrationService;
  private statusCache = new Map<string, { data: GMVehicleStatus; timestamp: number }>();

  private constructor(config: Partial<GMServiceConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  static getInstance(config?: Partial<GMServiceConfig>): GMIntegrationService {
    if (!GMIntegrationService.instance) {
      GMIntegrationService.instance = new GMIntegrationService(config);
    }
    return GMIntegrationService.instance;
  }

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  getAuthorizationUrl(authConfig: GMAuthConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: authConfig.clientId,
      redirect_uri: authConfig.redirectUri,
      response_type: 'code',
      scope: 'vehicle_data vehicle_commands energy_assist',
      state,
    });

    return `${this.config.authUrl}/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    authConfig: GMAuthConfig
  ): Promise<GMTokens> {
    const response = await fetch(`${this.config.authUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: authConfig.clientId,
        client_secret: authConfig.clientSecret,
        code,
        redirect_uri: authConfig.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`GM token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      accountId: data.account_id,
    };
  }

  async refreshTokens(refreshToken: string, authConfig: GMAuthConfig): Promise<GMTokens> {
    const response = await fetch(`${this.config.authUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: authConfig.clientId,
        client_secret: authConfig.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`GM token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      accountId: data.account_id,
    };
  }

  // ==========================================================================
  // VEHICLE DATA
  // ==========================================================================

  async getVehicles(accessToken: string): Promise<GMVehicle[]> {
    const response = await this.apiRequest(accessToken, '/vehicles');
    return response.vehicles || [];
  }

  async getVehicleStatus(accessToken: string, vin: string): Promise<GMVehicleStatus> {
    const cached = this.getFromCache(this.statusCache, vin);
    if (cached) return cached;

    const [diagnostics, location, evStatus] = await Promise.all([
      this.apiRequest(accessToken, `/vehicles/${vin}/diagnostics`),
      this.apiRequest(accessToken, `/vehicles/${vin}/location`),
      this.apiRequest(accessToken, `/vehicles/${vin}/ev/status`).catch(() => null),
    ]);

    const status: GMVehicleStatus = {
      diagnostics: diagnostics as GMDiagnostics,
      location: location as GMLocation,
      evStatus: evStatus as GMEVStatus | undefined,
    };

    this.setCache(this.statusCache, vin, status);
    return status;
  }

  async getEVStatus(accessToken: string, vin: string): Promise<GMEVStatus> {
    const response = await this.apiRequest(accessToken, `/vehicles/${vin}/ev/status`);
    return response as GMEVStatus;
  }

  async getNearbyChargingStations(
    accessToken: string,
    vin: string,
    latitude?: number,
    longitude?: number
  ): Promise<GMChargingStation[]> {
    const params = new URLSearchParams();
    if (latitude) params.set('latitude', latitude.toString());
    if (longitude) params.set('longitude', longitude.toString());

    const response = await this.apiRequest(
      accessToken,
      `/vehicles/${vin}/ev/energy-assist/stations?${params.toString()}`
    );

    return response.stations || [];
  }

  // ==========================================================================
  // CHARGING COMMANDS
  // ==========================================================================

  async startCharging(accessToken: string, vin: string): Promise<GMCommandResponse> {
    return this.sendCommand(accessToken, vin, 'ev/charge', { action: 'START' });
  }

  async stopCharging(accessToken: string, vin: string): Promise<GMCommandResponse> {
    return this.sendCommand(accessToken, vin, 'ev/charge', { action: 'STOP' });
  }

  async setChargeLimit(
    accessToken: string,
    vin: string,
    targetSoc: number
  ): Promise<GMCommandResponse> {
    return this.sendCommand(accessToken, vin, 'ev/charging-profile', {
      targetSoc: Math.max(50, Math.min(100, targetSoc)),
    });
  }

  async setDepartureTime(
    accessToken: string,
    vin: string,
    departureTime: string,
    precondition: boolean
  ): Promise<GMCommandResponse> {
    return this.sendCommand(accessToken, vin, 'ev/charging-profile', {
      departureTime,
      climatePrecondition: precondition,
    });
  }

  async enableOneWirelessCharging(
    accessToken: string,
    vin: string,
    enable: boolean
  ): Promise<GMCommandResponse> {
    // For vehicles with wireless charging pad support
    return this.sendCommand(accessToken, vin, 'ev/wireless-charging', {
      enabled: enable,
    });
  }

  // ==========================================================================
  // CLIMATE COMMANDS
  // ==========================================================================

  async remoteStart(
    accessToken: string,
    vin: string,
    options?: { temperature?: number; defrost?: boolean }
  ): Promise<GMCommandResponse> {
    return this.sendCommand(accessToken, vin, 'remote-start', {
      action: 'START',
      ...options,
    });
  }

  async remoteStop(accessToken: string, vin: string): Promise<GMCommandResponse> {
    return this.sendCommand(accessToken, vin, 'remote-start', { action: 'STOP' });
  }

  async precondition(
    accessToken: string,
    vin: string,
    options?: { temperature?: number; seatHeating?: boolean }
  ): Promise<GMCommandResponse> {
    return this.sendCommand(accessToken, vin, 'ev/precondition', {
      enabled: true,
      ...options,
    });
  }

  // ==========================================================================
  // VEHICLE COMMANDS
  // ==========================================================================

  async lock(accessToken: string, vin: string): Promise<GMCommandResponse> {
    return this.sendCommand(accessToken, vin, 'doors', { action: 'LOCK' });
  }

  async unlock(accessToken: string, vin: string): Promise<GMCommandResponse> {
    return this.sendCommand(accessToken, vin, 'doors', { action: 'UNLOCK' });
  }

  async honkAndFlash(accessToken: string, vin: string): Promise<GMCommandResponse> {
    return this.sendCommand(accessToken, vin, 'alert', { type: 'HONK_FLASH' });
  }

  async getCommandStatus(
    accessToken: string,
    vin: string,
    commandId: string
  ): Promise<GMCommandResponse> {
    const response = await this.apiRequest(
      accessToken,
      `/vehicles/${vin}/commands/${commandId}/status`
    );
    return response as GMCommandResponse;
  }

  // ==========================================================================
  // CONVERSION TO INFINITY ASSISTANT TYPES
  // ==========================================================================

  toEVVehicle(gmVehicle: GMVehicle, evStatus?: GMEVStatus): EVVehicle {
    const modelInfo = this.getModelInfo(gmVehicle.make, gmVehicle.model);

    return {
      id: `gm_${gmVehicle.vin}`,
      userId: 'gm_user',
      vin: gmVehicle.vin,
      make: gmVehicle.make,
      model: gmVehicle.model,
      year: gmVehicle.year,
      batteryCapacity: gmVehicle.evDetails?.batteryCapacityKwh || modelInfo.capacity,
      maxChargingRate: modelInfo.maxChargingRate,
      currentRange: evStatus?.estimatedRange
        ? evStatus.estimatedRange * 1.60934 // miles to km
        : modelInfo.maxRange * (evStatus?.batteryLevel || 50) / 100,
      maxRange: modelInfo.maxRange,
      connectedAt: new Date(),
      lastUpdated: new Date(),
    };
  }

  toBatteryState(vin: string, evStatus: GMEVStatus): BatteryState {
    const statusMap: Record<string, ChargingStatus> = {
      'NOT_CHARGING': 'idle',
      'CHARGING': 'charging',
      'CHARGE_COMPLETE': 'complete',
      'PLUGGED_IN': 'idle',
      'INTERRUPTED': 'idle',
    };

    return {
      vehicleId: `gm_${vin}`,
      stateOfCharge: evStatus.batteryLevel,
      stateOfHealth: evStatus.batteryCondition?.stateOfHealth || 95,
      temperature: evStatus.batteryCondition?.temperature || 25,
      voltage: 400, // Ultium architecture
      current: evStatus.chargeState.chargeRate * 1000 / 400, // approximate
      chargingStatus: statusMap[evStatus.chargeState.status] || 'idle',
      estimatedRange: evStatus.estimatedRange * 1.60934, // miles to km
      degradationRate: 2.5,
      cycleCount: 0,
      timestamp: new Date(),
    };
  }

  private getModelInfo(make: string, model: string): {
    capacity: number;
    maxChargingRate: number;
    maxRange: number;
  } {
    const models: Record<string, { capacity: number; maxChargingRate: number; maxRange: number }> = {
      // Chevrolet
      'Bolt EV': { capacity: 66, maxChargingRate: 55, maxRange: 417 },
      'Bolt EUV': { capacity: 66, maxChargingRate: 55, maxRange: 397 },
      'Equinox EV': { capacity: 85, maxChargingRate: 150, maxRange: 515 },
      'Blazer EV': { capacity: 102, maxChargingRate: 190, maxRange: 515 },
      'Silverado EV': { capacity: 200, maxChargingRate: 350, maxRange: 640 },
      // GMC
      'Hummer EV': { capacity: 212, maxChargingRate: 350, maxRange: 529 },
      'Hummer EV SUV': { capacity: 212, maxChargingRate: 350, maxRange: 483 },
      'Sierra EV': { capacity: 200, maxChargingRate: 350, maxRange: 640 },
      // Cadillac
      'LYRIQ': { capacity: 102, maxChargingRate: 190, maxRange: 500 },
      'CELESTIQ': { capacity: 111, maxChargingRate: 200, maxRange: 483 },
      'OPTIQ': { capacity: 85, maxChargingRate: 150, maxRange: 480 },
      'ESCALADE IQ': { capacity: 200, maxChargingRate: 350, maxRange: 450 },
    };

    const key = Object.keys(models).find(k =>
      model.toLowerCase().includes(k.toLowerCase())
    );

    return key ? models[key] : { capacity: 100, maxChargingRate: 150, maxRange: 450 };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async sendCommand(
    accessToken: string,
    vin: string,
    command: string,
    params?: Record<string, unknown>
  ): Promise<GMCommandResponse> {
    const response = await this.apiRequest(
      accessToken,
      `/vehicles/${vin}/${command}`,
      'POST',
      params
    );

    return {
      commandId: response.commandId as string || '',
      status: response.status as GMCommandResponse['status'] || 'PENDING',
      statusCode: response.statusCode as number || 200,
      message: response.message as string,
    };
  }

  private async apiRequest(
    accessToken: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' = 'GET',
    body?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('[GM] API error', { endpoint, status: response.status, error });
      throw new Error(`GM API error: ${response.status} - ${error}`);
    }

    return response.json();
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

let gmServiceInstance: GMIntegrationService | null = null;

export function getGMIntegrationService(): GMIntegrationService {
  if (!gmServiceInstance) {
    gmServiceInstance = GMIntegrationService.getInstance();
  }
  return gmServiceInstance;
}

export default GMIntegrationService;
