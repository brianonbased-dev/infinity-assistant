/**
 * BMW Integration Service for Infinity Assistant
 *
 * BMW ConnectedDrive API integration for:
 * - Vehicle status monitoring (battery, range, location)
 * - Charging control and scheduling
 * - Remote climate preconditioning
 * - BMW Charging network access
 *
 * Supports: iX, i4, i5, i7, iX1, iX2, iX3
 *
 * @see https://developer.bmw.com/
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
// BMW API TYPES
// ============================================================================

export interface BMWAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  region: 'na' | 'eu' | 'cn';
}

export interface BMWTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  gcid: string; // Global Customer ID
}

export interface BMWVehicle {
  vin: string;
  model: string;
  modelYear: string;
  brand: string;
  bodyType: string;
  color: string;
  driveTrain: 'BEV' | 'PHEV' | 'CONVENTIONAL';
  hasRex: boolean;
  appVehicleType: string;
  attributes: {
    softwareVersionCurrent: string;
    telematicsUnit: string;
    a4aType: string;
    headUnitType: string;
    hmiVersion: string;
    bodyType: string;
  };
}

export interface BMWVehicleState {
  state: {
    lastFetched: string;
    lastUpdatedAt: string;
    isVehicleDataRequestPending: boolean;
  };
  location: {
    coordinates: {
      latitude: number;
      longitude: number;
    };
    address: {
      formatted: string;
    };
    heading: number;
    lastUpdatedAt: string;
  };
  currentMileage: {
    mileage: number;
    units: string;
  };
  doorsState: {
    combinedSecurityState: string;
    leftFront: string;
    leftRear: string;
    rightFront: string;
    rightRear: string;
    trunk: string;
    hood: string;
    combinedState: string;
  };
  windowsState: {
    combinedState: string;
    leftFront: string;
    leftRear: string;
    rightFront: string;
    rightRear: string;
  };
  roofState?: {
    roofState: string;
    roofStateType: string;
  };
  tireState: {
    frontLeft: { status: string; pressurePsi?: number };
    frontRight: { status: string; pressurePsi?: number };
    rearLeft: { status: string; pressurePsi?: number };
    rearRight: { status: string; pressurePsi?: number };
  };
  electricChargingState: BMWChargingState;
  climateControlState: BMWClimateState;
  checkControlMessages: BMWCheckControlMessage[];
}

export interface BMWChargingState {
  isChargerConnected: boolean;
  chargingStatus: 'NOT_CHARGING' | 'CHARGING' | 'COMPLETE' | 'PLUGGED_IN' | 'ERROR' | 'WAITING_FOR_CHARGING';
  chargingTarget: number;
  chargingLevelPercent: number;
  range: number;
  rangeUnits: string;
  chargingPower: number;
  remainingChargingMinutes: number;
  chargingType: 'AC' | 'DC';
  chargerConnection: {
    chargingConnectionType: string;
    plugState: string;
  };
  chargingProfile: {
    chargingEnabled: boolean;
    preferredChargingWindow: {
      enabled: boolean;
      startTime: string;
      endTime: string;
    };
    climatisationOn: boolean;
    departureTime: string;
  };
  lastChargingEndedAt?: string;
  lastChargingEndedReason?: string;
}

export interface BMWClimateState {
  activity: 'INACTIVE' | 'COOLING' | 'HEATING' | 'PRECONDITIONING' | 'VENTILATING';
  hasAuxiliaryHeater: boolean;
  auxiliaryHeaterActive: boolean;
  auxiliaryHeaterException: string;
}

export interface BMWCheckControlMessage {
  type: string;
  severity: 'UNKNOWN' | 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  mileage?: number;
  date?: string;
}

export interface BMWChargingSession {
  sessionId: string;
  title: string;
  subtitle: string;
  energyCharged: number;
  energyChargedUnit: string;
  status: string;
  isPublic: boolean;
  providerName?: string;
  startedAt: string;
  endedAt?: string;
}

export interface BMWCommandResponse {
  eventId: string;
  createdAt: string;
  eventStatus: string;
}

// ============================================================================
// BMW SERVICE CONFIGURATION
// ============================================================================

interface BMWServiceConfig {
  baseUrls: Record<string, string>;
  authUrls: Record<string, string>;
  wakeTimeout: number;
  pollInterval: number;
  cacheTimeout: number;
}

const defaultConfig: BMWServiceConfig = {
  baseUrls: {
    na: 'https://cocoapi.bmwgroup.us',
    eu: 'https://cocoapi.bmwgroup.com',
    cn: 'https://myprofile.bmw.com.cn',
  },
  authUrls: {
    na: 'https://customer.bmwgroup.us',
    eu: 'https://customer.bmwgroup.com',
    cn: 'https://customer.bmw.com.cn',
  },
  wakeTimeout: 60000,
  pollInterval: 5000,
  cacheTimeout: 60000,
};

// ============================================================================
// BMW INTEGRATION SERVICE
// ============================================================================

export class BMWIntegrationService {
  private config: BMWServiceConfig;
  private region: 'na' | 'eu' | 'cn' = 'na';
  private static instance: BMWIntegrationService;
  private stateCache = new Map<string, { data: BMWVehicleState; timestamp: number }>();

  private constructor(config: Partial<BMWServiceConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  static getInstance(config?: Partial<BMWServiceConfig>): BMWIntegrationService {
    if (!BMWIntegrationService.instance) {
      BMWIntegrationService.instance = new BMWIntegrationService(config);
    }
    return BMWIntegrationService.instance;
  }

  setRegion(region: 'na' | 'eu' | 'cn'): void {
    this.region = region;
  }

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  getAuthorizationUrl(authConfig: BMWAuthConfig, state: string): string {
    const authUrl = this.config.authUrls[authConfig.region];
    const params = new URLSearchParams({
      client_id: authConfig.clientId,
      redirect_uri: authConfig.redirectUri,
      response_type: 'code',
      scope: 'openid profile email offline_access vehicle_data remote_services',
      state,
    });

    return `${authUrl}/gcdm/oauth/authenticate?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    authConfig: BMWAuthConfig
  ): Promise<BMWTokens> {
    this.setRegion(authConfig.region);
    const authUrl = this.config.authUrls[authConfig.region];

    const response = await fetch(`${authUrl}/gcdm/oauth/token`, {
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
      throw new Error(`BMW token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      gcid: data.gcid,
    };
  }

  async refreshTokens(refreshToken: string, authConfig: BMWAuthConfig): Promise<BMWTokens> {
    this.setRegion(authConfig.region);
    const authUrl = this.config.authUrls[authConfig.region];

    const response = await fetch(`${authUrl}/gcdm/oauth/token`, {
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
      throw new Error(`BMW token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      gcid: data.gcid,
    };
  }

  // ==========================================================================
  // VEHICLE DATA
  // ==========================================================================

  async getVehicles(accessToken: string): Promise<BMWVehicle[]> {
    const response = await this.apiRequest(accessToken, '/eadrax-vcs/v4/vehicles');
    return (response as unknown as BMWVehicle[]) || [];
  }

  async getVehicleState(accessToken: string, vin: string): Promise<BMWVehicleState> {
    const cached = this.getFromCache(this.stateCache, vin);
    if (cached) return cached;

    const response = await this.apiRequest(accessToken, `/eadrax-vcs/v4/vehicles/${vin}/state`);
    const state = response as unknown as BMWVehicleState;
    this.setCache(this.stateCache, vin, state);
    return state;
  }

  async getChargingSessions(accessToken: string, vin: string): Promise<BMWChargingSession[]> {
    const response = await this.apiRequest(
      accessToken,
      `/eadrax-chs/v1/charging-sessions?vin=${vin}`
    );
    const data = response as { sessions?: BMWChargingSession[] };
    return data.sessions || [];
  }

  async refreshVehicleData(accessToken: string, vin: string): Promise<BMWCommandResponse> {
    return this.sendCommand(accessToken, vin, 'vehicle-finder');
  }

  // ==========================================================================
  // CHARGING COMMANDS
  // ==========================================================================

  async startCharging(accessToken: string, vin: string): Promise<BMWCommandResponse> {
    return this.sendCommand(accessToken, vin, 'start-charging');
  }

  async stopCharging(accessToken: string, vin: string): Promise<BMWCommandResponse> {
    return this.sendCommand(accessToken, vin, 'stop-charging');
  }

  async setChargeTarget(
    accessToken: string,
    vin: string,
    targetPercent: number
  ): Promise<BMWCommandResponse> {
    return this.sendCommand(accessToken, vin, 'charging-settings', {
      chargingTarget: Math.max(20, Math.min(100, targetPercent)),
    });
  }

  async setChargingProfile(
    accessToken: string,
    vin: string,
    profile: {
      enabled?: boolean;
      windowStart?: string;
      windowEnd?: string;
      climatisation?: boolean;
      departureTime?: string;
    }
  ): Promise<BMWCommandResponse> {
    return this.sendCommand(accessToken, vin, 'charging-profile', profile);
  }

  // ==========================================================================
  // CLIMATE COMMANDS
  // ==========================================================================

  async startClimate(accessToken: string, vin: string): Promise<BMWCommandResponse> {
    return this.sendCommand(accessToken, vin, 'climate-now', { action: 'START' });
  }

  async stopClimate(accessToken: string, vin: string): Promise<BMWCommandResponse> {
    return this.sendCommand(accessToken, vin, 'climate-now', { action: 'STOP' });
  }

  async startVentilation(accessToken: string, vin: string): Promise<BMWCommandResponse> {
    return this.sendCommand(accessToken, vin, 'climate-now', {
      action: 'START',
      mode: 'VENTILATING',
    });
  }

  // ==========================================================================
  // VEHICLE COMMANDS
  // ==========================================================================

  async lock(accessToken: string, vin: string): Promise<BMWCommandResponse> {
    return this.sendCommand(accessToken, vin, 'door-lock');
  }

  async unlock(accessToken: string, vin: string): Promise<BMWCommandResponse> {
    return this.sendCommand(accessToken, vin, 'door-unlock');
  }

  async flashLights(accessToken: string, vin: string): Promise<BMWCommandResponse> {
    return this.sendCommand(accessToken, vin, 'light-flash');
  }

  async honkHorn(accessToken: string, vin: string): Promise<BMWCommandResponse> {
    return this.sendCommand(accessToken, vin, 'horn-blow');
  }

  async getCommandStatus(
    accessToken: string,
    vin: string,
    eventId: string
  ): Promise<{ status: string }> {
    const response = await this.apiRequest(
      accessToken,
      `/eadrax-vrccs/v3/presentation/remote-commands/${vin}/eventStatus/${eventId}`
    );
    return response as { status: string };
  }

  // ==========================================================================
  // CONVERSION TO INFINITY ASSISTANT TYPES
  // ==========================================================================

  toEVVehicle(bmwVehicle: BMWVehicle, state?: BMWVehicleState): EVVehicle {
    const modelInfo = this.getModelInfo(bmwVehicle.model);

    return {
      id: `bmw_${bmwVehicle.vin}`,
      userId: 'bmw_user',
      vin: bmwVehicle.vin,
      make: bmwVehicle.brand || 'BMW',
      model: bmwVehicle.model,
      year: parseInt(bmwVehicle.modelYear) || 2024,
      batteryCapacity: modelInfo.capacity,
      maxChargingRate: modelInfo.maxChargingRate,
      currentRange: state?.electricChargingState.range || 0,
      maxRange: modelInfo.maxRange,
      connectedAt: new Date(),
      lastUpdated: new Date(),
    };
  }

  toBatteryState(vin: string, state: BMWVehicleState): BatteryState {
    const chargingState = state.electricChargingState;
    const statusMap: Record<string, ChargingStatus> = {
      'NOT_CHARGING': 'idle',
      'CHARGING': 'charging',
      'COMPLETE': 'complete',
      'PLUGGED_IN': 'idle',
      'ERROR': 'idle',
      'WAITING_FOR_CHARGING': 'scheduled',
    };

    return {
      vehicleId: `bmw_${vin}`,
      stateOfCharge: chargingState.chargingLevelPercent,
      stateOfHealth: 95,
      temperature: 25,
      voltage: 400,
      current: chargingState.chargingPower ? chargingState.chargingPower * 1000 / 400 : 0,
      chargingStatus: statusMap[chargingState.chargingStatus] || 'idle',
      estimatedRange: chargingState.range,
      degradationRate: 2.0,
      cycleCount: 0,
      timestamp: new Date(state.state.lastUpdatedAt),
    };
  }

  private getModelInfo(model: string): {
    capacity: number;
    maxChargingRate: number;
    maxRange: number;
  } {
    const models: Record<string, { capacity: number; maxChargingRate: number; maxRange: number }> = {
      'iX xDrive40': { capacity: 76.6, maxChargingRate: 150, maxRange: 425 },
      'iX xDrive50': { capacity: 111.5, maxChargingRate: 200, maxRange: 630 },
      'iX M60': { capacity: 111.5, maxChargingRate: 200, maxRange: 566 },
      'i4 eDrive35': { capacity: 66, maxChargingRate: 180, maxRange: 430 },
      'i4 eDrive40': { capacity: 83.9, maxChargingRate: 200, maxRange: 520 },
      'i4 M50': { capacity: 83.9, maxChargingRate: 200, maxRange: 500 },
      'i5 eDrive40': { capacity: 83.9, maxChargingRate: 205, maxRange: 580 },
      'i5 M60': { capacity: 83.9, maxChargingRate: 205, maxRange: 515 },
      'i7 eDrive50': { capacity: 101.7, maxChargingRate: 195, maxRange: 615 },
      'i7 xDrive60': { capacity: 101.7, maxChargingRate: 195, maxRange: 590 },
      'i7 M70': { capacity: 101.7, maxChargingRate: 195, maxRange: 510 },
      'iX1 eDrive20': { capacity: 64.7, maxChargingRate: 130, maxRange: 440 },
      'iX1 xDrive30': { capacity: 64.7, maxChargingRate: 130, maxRange: 420 },
      'iX2 eDrive20': { capacity: 64.7, maxChargingRate: 130, maxRange: 430 },
      'iX2 xDrive30': { capacity: 64.7, maxChargingRate: 130, maxRange: 417 },
      'iX3': { capacity: 80, maxChargingRate: 150, maxRange: 460 },
    };

    const key = Object.keys(models).find(k =>
      model.toLowerCase().includes(k.toLowerCase())
    );

    return key ? models[key] : { capacity: 80, maxChargingRate: 150, maxRange: 450 };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async sendCommand(
    accessToken: string,
    vin: string,
    command: string,
    body?: Record<string, unknown>
  ): Promise<BMWCommandResponse> {
    const response = await this.apiRequest(
      accessToken,
      `/eadrax-vrccs/v3/presentation/remote-commands/${vin}/${command}`,
      'POST',
      body
    );

    return {
      eventId: response.eventId as string,
      createdAt: response.createdAt as string || new Date().toISOString(),
      eventStatus: response.eventStatus as string || 'PENDING',
    };
  }

  private async apiRequest(
    accessToken: string,
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const baseUrl = this.config.baseUrls[this.region];
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-user-agent': 'android(v1.07_20200330);bmw;2.3.0(13603)',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('[BMW] API error', { endpoint, status: response.status, error });
      throw new Error(`BMW API error: ${response.status} - ${error}`);
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

let bmwServiceInstance: BMWIntegrationService | null = null;

export function getBMWIntegrationService(): BMWIntegrationService {
  if (!bmwServiceInstance) {
    bmwServiceInstance = BMWIntegrationService.getInstance();
  }
  return bmwServiceInstance;
}

export default BMWIntegrationService;
