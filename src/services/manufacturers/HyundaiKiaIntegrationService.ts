/**
 * Hyundai/Kia Integration Service for Infinity Assistant
 *
 * Unified integration for Hyundai Bluelink and Kia Connect APIs:
 * - Vehicle status monitoring (battery, range, location)
 * - Charging control and scheduling
 * - Remote climate preconditioning
 * - V2L (Vehicle to Load) monitoring
 *
 * Supports:
 * - Hyundai: IONIQ 5, IONIQ 6, Kona Electric
 * - Kia: EV6, EV9, Niro EV
 * - Genesis: GV60, Electrified GV70, Electrified G80
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
// HYUNDAI/KIA API TYPES
// ============================================================================

export type HKBrand = 'hyundai' | 'kia' | 'genesis';

export interface HKAuthConfig {
  brand: HKBrand;
  region: 'us' | 'eu' | 'ca' | 'kr';
  username: string;
  password: string;
  pin: string;
}

export interface HKTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  vehicleRegId: string;
}

export interface HKVehicle {
  vehicleId: string;
  regId: string;
  vin: string;
  vehicleName: string;
  vehicleModel: string;
  modelCode: string;
  modelName: string;
  modelYear: string;
  fuelKindCode: string; // EV, PHEV, etc.
  exteriorColor: string;
  enrollmentStatus: string;
  subscriptionStatus: string;
  generation: number;
  evStatus?: {
    batteryCapacity: number;
    supportV2L: boolean;
    supportChargeSchedule: boolean;
  };
}

export interface HKVehicleStatus {
  vehicleStatus: {
    time: string;
    airCtrl: boolean;
    airTempValue: string;
    batteryStatus: number;
    evStatus: HKEVStatus;
    doorOpen: HKDoorStatus;
    trunkOpen: boolean;
    hoodOpen: boolean;
    lockStatus: string;
    location: HKLocationStatus;
    tirePressure: HKTirePressure;
    defrost: boolean;
    acc: boolean;
    ign1: boolean;
    ign2: boolean;
    transCond: boolean;
    steerWheelHeat: number;
    sideBackWindowHeat: number;
    seatHeaterVentState: HKSeatStatus;
  };
}

export interface HKEVStatus {
  batteryCharge: boolean;
  batteryStatus: number;
  batteryPlugin: number; // 0: unplugged, 1: plugged
  remainChargeTime: HKChargeTime[];
  drvDistance: HKDrvDistance[];
  reservChargeInfos: HKReserveChargeInfo;
  targetSOC: HKTargetSOC[];
  chargePortDoorOpenStatus: number;
  batteryHeaterStatus: number;
  batteryTemperature: number;
  v2lStatus?: HKV2LStatus;
}

export interface HKChargeTime {
  timeUnit: number; // 1: minute, 2: hour
  remainTime: number;
  remainTimeCount: number;
}

export interface HKDrvDistance {
  rangeByFuel: {
    evModeRange: { value: number; unit: number }; // km
    totalAvailableRange: { value: number; unit: number };
  };
}

export interface HKReserveChargeInfo {
  reservChargeInfoDetail: {
    reservInfo: {
      day: number[];
      time: { startTime: string; endTime: string };
    };
    reservChargeSet: boolean;
    reservFatcSet: boolean;
    chargeType: number; // 1: AC, 2: DC
    offPeakPowerInfo?: {
      enabled: boolean;
      startTime: string;
      endTime: string;
    };
  };
}

export interface HKTargetSOC {
  targetSOClevel: number;
  dte: { rangeByFuel: { evModeRange: { value: number } } };
  plugType: number; // 0: slow, 1: fast
}

export interface HKV2LStatus {
  active: boolean;
  outputPower: number;
  totalEnergySupplied: number;
}

export interface HKDoorStatus {
  frontLeft: number;
  frontRight: number;
  backLeft: number;
  backRight: number;
}

export interface HKLocationStatus {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  lastUpdateTime?: string;
}

export interface HKTirePressure {
  frontLeft: { value: number; unit: string; status: number };
  frontRight: { value: number; unit: string; status: number };
  rearLeft: { value: number; unit: string; status: number };
  rearRight: { value: number; unit: string; status: number };
}

export interface HKSeatStatus {
  flSeatHeatState: number;
  frSeatHeatState: number;
  rlSeatHeatState: number;
  rrSeatHeatState: number;
  flSeatVentState?: number;
  frSeatVentState?: number;
}

export interface HKCommandResult {
  responseCode: string;
  responseMessage: string;
  transactionId?: string;
}

// ============================================================================
// BRAND/REGION CONFIGURATIONS
// ============================================================================

const brandConfigs: Record<HKBrand, Record<string, { baseUrl: string; appId: string }>> = {
  hyundai: {
    us: {
      baseUrl: 'https://api.telematics.hyundaiusa.com',
      appId: '014d2225-8495-4735-812d-2f966f5e3e8c',
    },
    eu: {
      baseUrl: 'https://prd.eu-ccapi.hyundai.com:8080',
      appId: '1eb8ceaf-f8c8-4b30-8b66-ef259fc0e3c3',
    },
    ca: {
      baseUrl: 'https://api.telematics.hyundaicanada.com',
      appId: '014d2225-8495-4735-812d-2f966f5e3e8c',
    },
    kr: {
      baseUrl: 'https://prd.kr-ccapi.hyundai.com',
      appId: '1eb8ceaf-f8c8-4b30-8b66-ef259fc0e3c3',
    },
  },
  kia: {
    us: {
      baseUrl: 'https://api.owners.kia.com',
      appId: 'fdc85c00-0a2f-4c64-bcb4-2cfb1500730a',
    },
    eu: {
      baseUrl: 'https://prd.eu-ccapi.kia.com:8080',
      appId: 'e7bcd186-a5fd-410d-92cb-6876a42288bd',
    },
    ca: {
      baseUrl: 'https://apigw.kiaconnect.ca',
      appId: 'fdc85c00-0a2f-4c64-bcb4-2cfb1500730a',
    },
    kr: {
      baseUrl: 'https://prd.kr-ccapi.kia.com',
      appId: 'e7bcd186-a5fd-410d-92cb-6876a42288bd',
    },
  },
  genesis: {
    us: {
      baseUrl: 'https://api.owners.genesis.com',
      appId: '014d2225-8495-4735-812d-2f966f5e3e8c',
    },
    eu: {
      baseUrl: 'https://prd.eu-ccapi.genesis.com:8080',
      appId: '1eb8ceaf-f8c8-4b30-8b66-ef259fc0e3c3',
    },
    ca: {
      baseUrl: 'https://api.owners.genesis.ca',
      appId: '014d2225-8495-4735-812d-2f966f5e3e8c',
    },
    kr: {
      baseUrl: 'https://prd.kr-ccapi.genesis.com',
      appId: '1eb8ceaf-f8c8-4b30-8b66-ef259fc0e3c3',
    },
  },
};

// ============================================================================
// HK SERVICE CONFIGURATION
// ============================================================================

interface HKServiceConfig {
  wakeTimeout: number;
  pollInterval: number;
  cacheTimeout: number;
}

const defaultConfig: HKServiceConfig = {
  wakeTimeout: 60000,
  pollInterval: 5000,
  cacheTimeout: 60000,
};

// ============================================================================
// HYUNDAI/KIA INTEGRATION SERVICE
// ============================================================================

export class HyundaiKiaIntegrationService {
  private config: HKServiceConfig;
  private static instance: HyundaiKiaIntegrationService;
  private statusCache = new Map<string, { data: HKVehicleStatus; timestamp: number }>();

  private constructor(config: Partial<HKServiceConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  static getInstance(config?: Partial<HKServiceConfig>): HyundaiKiaIntegrationService {
    if (!HyundaiKiaIntegrationService.instance) {
      HyundaiKiaIntegrationService.instance = new HyundaiKiaIntegrationService(config);
    }
    return HyundaiKiaIntegrationService.instance;
  }

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  async login(authConfig: HKAuthConfig): Promise<HKTokens> {
    const brandConfig = brandConfigs[authConfig.brand][authConfig.region];

    // Step 1: Get cookies and CSRF token
    const loginResponse = await fetch(`${brandConfig.baseUrl}/v2/ac/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'appId': brandConfig.appId,
      },
      body: JSON.stringify({
        username: authConfig.username,
        password: authConfig.password,
      }),
    });

    if (!loginResponse.ok) {
      throw new Error(`HK login failed: ${loginResponse.statusText}`);
    }

    const data = await loginResponse.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      vehicleRegId: data.vehicle_reg_id || '',
    };
  }

  async refreshTokens(
    refreshToken: string,
    brand: HKBrand,
    region: string
  ): Promise<HKTokens> {
    const brandConfig = brandConfigs[brand][region as keyof typeof brandConfigs[typeof brand]];

    const response = await fetch(`${brandConfig.baseUrl}/v2/ac/oauth/token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'appId': brandConfig.appId,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`HK token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      vehicleRegId: data.vehicle_reg_id || '',
    };
  }

  // ==========================================================================
  // VEHICLE DATA
  // ==========================================================================

  async getVehicles(
    accessToken: string,
    brand: HKBrand,
    region: string
  ): Promise<HKVehicle[]> {
    const response = await this.apiRequest<{ vehicles?: HKVehicle[] }>(accessToken, brand, region, '/v2/vehicles');
    return response.vehicles || [];
  }

  async getVehicleStatus(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string
  ): Promise<HKVehicleStatus> {
    const cached = this.getFromCache(this.statusCache, vehicleId);
    if (cached) return cached;

    const response = await this.apiRequest<HKVehicleStatus>(
      accessToken,
      brand,
      region,
      `/v2/vehicles/${vehicleId}/status`
    );

    const status = response;
    this.setCache(this.statusCache, vehicleId, status);
    return status;
  }

  async refreshVehicleStatus(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string
  ): Promise<HKCommandResult> {
    // Clear cache to force fresh fetch
    this.statusCache.delete(vehicleId);

    return this.sendCommand(accessToken, brand, region, vehicleId, 'status/refresh');
  }

  async getLocation(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string
  ): Promise<HKLocationStatus> {
    const response = await this.apiRequest(
      accessToken,
      brand,
      region,
      `/v2/vehicles/${vehicleId}/location`
    );
    return response.location as HKLocationStatus;
  }

  // ==========================================================================
  // CHARGING COMMANDS
  // ==========================================================================

  async startCharging(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string
  ): Promise<HKCommandResult> {
    return this.sendCommand(accessToken, brand, region, vehicleId, 'charge/start');
  }

  async stopCharging(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string
  ): Promise<HKCommandResult> {
    return this.sendCommand(accessToken, brand, region, vehicleId, 'charge/stop');
  }

  async setChargeLimit(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string,
    acLimit: number,
    dcLimit: number
  ): Promise<HKCommandResult> {
    return this.sendCommand(
      accessToken,
      brand,
      region,
      vehicleId,
      'charge/target',
      {
        targetSOClist: [
          { plugType: 0, targetSOClevel: Math.max(50, Math.min(100, acLimit)) },
          { plugType: 1, targetSOClevel: Math.max(50, Math.min(100, dcLimit)) },
        ],
      }
    );
  }

  async setChargeSchedule(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string,
    schedule: {
      enabled: boolean;
      startTime?: string;
      endTime?: string;
      days?: number[];
      climatisation?: boolean;
    }
  ): Promise<HKCommandResult> {
    return this.sendCommand(
      accessToken,
      brand,
      region,
      vehicleId,
      'charge/schedule',
      {
        reservChargeInfoDetail: {
          reservInfo: {
            day: schedule.days || [0, 1, 2, 3, 4, 5, 6],
            time: {
              startTime: schedule.startTime || '0100',
              endTime: schedule.endTime || '0600',
            },
          },
          reservChargeSet: schedule.enabled,
          reservFatcSet: schedule.climatisation || false,
        },
      }
    );
  }

  // ==========================================================================
  // CLIMATE COMMANDS
  // ==========================================================================

  async startClimate(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string,
    options?: {
      temperature?: number;
      defrost?: boolean;
      heating?: boolean;
    }
  ): Promise<HKCommandResult> {
    return this.sendCommand(
      accessToken,
      brand,
      region,
      vehicleId,
      'climate/start',
      {
        temperature: options?.temperature?.toString() || '21',
        defrost: options?.defrost || false,
        heating: options?.heating || false,
      }
    );
  }

  async stopClimate(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string
  ): Promise<HKCommandResult> {
    return this.sendCommand(accessToken, brand, region, vehicleId, 'climate/stop');
  }

  async setTemperature(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string,
    temperature: number
  ): Promise<HKCommandResult> {
    return this.sendCommand(
      accessToken,
      brand,
      region,
      vehicleId,
      'climate/temperature',
      { temperature: temperature.toString() }
    );
  }

  async setSteeringWheelHeater(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string,
    level: 0 | 1 | 2
  ): Promise<HKCommandResult> {
    return this.sendCommand(
      accessToken,
      brand,
      region,
      vehicleId,
      'climate/steering-heater',
      { level }
    );
  }

  async setSeatHeater(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string,
    seat: 'fl' | 'fr' | 'rl' | 'rr',
    level: 0 | 1 | 2 | 3
  ): Promise<HKCommandResult> {
    return this.sendCommand(
      accessToken,
      brand,
      region,
      vehicleId,
      'climate/seat-heater',
      { seat, level }
    );
  }

  // ==========================================================================
  // VEHICLE COMMANDS
  // ==========================================================================

  async lock(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string
  ): Promise<HKCommandResult> {
    return this.sendCommand(accessToken, brand, region, vehicleId, 'doors/lock');
  }

  async unlock(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string
  ): Promise<HKCommandResult> {
    return this.sendCommand(accessToken, brand, region, vehicleId, 'doors/unlock');
  }

  async honkFlash(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string
  ): Promise<HKCommandResult> {
    return this.sendCommand(accessToken, brand, region, vehicleId, 'horn-lights');
  }

  // ==========================================================================
  // V2L (Vehicle to Load)
  // ==========================================================================

  async getV2LStatus(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string
  ): Promise<HKV2LStatus | null> {
    const status = await this.getVehicleStatus(accessToken, brand, region, vehicleId);
    return status.vehicleStatus.evStatus.v2lStatus || null;
  }

  // ==========================================================================
  // CONVERSION TO INFINITY ASSISTANT TYPES
  // ==========================================================================

  toEVVehicle(hkVehicle: HKVehicle, status?: HKVehicleStatus): EVVehicle {
    const modelInfo = this.getModelInfo(hkVehicle.modelName);

    return {
      id: `hk_${hkVehicle.vehicleId}`,
      userId: 'hk_user',
      vin: hkVehicle.vin,
      make: this.getBrandName(hkVehicle),
      model: hkVehicle.modelName,
      year: parseInt(hkVehicle.modelYear) || 2024,
      batteryCapacity: hkVehicle.evStatus?.batteryCapacity || modelInfo.capacity,
      maxChargingRate: modelInfo.maxChargingRate,
      currentRange: status?.vehicleStatus.evStatus.drvDistance[0]?.rangeByFuel.evModeRange.value || 0,
      maxRange: modelInfo.maxRange,
      connectedAt: new Date(),
      lastUpdated: new Date(),
    };
  }

  toBatteryState(vehicleId: string, status: HKVehicleStatus): BatteryState {
    const evStatus = status.vehicleStatus.evStatus;
    let chargingStatus: ChargingStatus = 'idle';

    if (evStatus.batteryCharge) {
      chargingStatus = 'charging';
    } else if (evStatus.batteryStatus >= 100) {
      chargingStatus = 'complete';
    } else if (evStatus.batteryPlugin === 1) {
      chargingStatus = 'idle';
    }

    return {
      vehicleId: `hk_${vehicleId}`,
      stateOfCharge: evStatus.batteryStatus,
      stateOfHealth: 95,
      temperature: evStatus.batteryTemperature,
      voltage: 800, // E-GMP platform
      current: 0,
      chargingStatus,
      estimatedRange: evStatus.drvDistance[0]?.rangeByFuel.evModeRange.value || 0,
      degradationRate: 1.5,
      cycleCount: 0,
      timestamp: new Date(status.vehicleStatus.time),
    };
  }

  private getBrandName(vehicle: HKVehicle): string {
    const model = vehicle.modelName.toLowerCase();
    if (model.includes('ioniq') || model.includes('kona')) return 'Hyundai';
    if (model.includes('ev6') || model.includes('ev9') || model.includes('niro')) return 'Kia';
    if (model.includes('gv') || model.includes('g80')) return 'Genesis';
    return 'Hyundai';
  }

  private getModelInfo(model: string): {
    capacity: number;
    maxChargingRate: number;
    maxRange: number;
  } {
    const models: Record<string, { capacity: number; maxChargingRate: number; maxRange: number }> = {
      // Hyundai
      'IONIQ 5': { capacity: 77.4, maxChargingRate: 350, maxRange: 500 },
      'IONIQ 5 Long Range': { capacity: 77.4, maxChargingRate: 350, maxRange: 507 },
      'IONIQ 5 N': { capacity: 84, maxChargingRate: 350, maxRange: 448 },
      'IONIQ 6': { capacity: 77.4, maxChargingRate: 350, maxRange: 614 },
      'IONIQ 6 Long Range': { capacity: 77.4, maxChargingRate: 350, maxRange: 614 },
      'Kona Electric': { capacity: 64.8, maxChargingRate: 100, maxRange: 418 },
      // Kia
      'EV6': { capacity: 77.4, maxChargingRate: 350, maxRange: 510 },
      'EV6 Long Range': { capacity: 77.4, maxChargingRate: 350, maxRange: 528 },
      'EV6 GT': { capacity: 77.4, maxChargingRate: 350, maxRange: 446 },
      'EV9': { capacity: 99.8, maxChargingRate: 350, maxRange: 541 },
      'EV9 Long Range': { capacity: 99.8, maxChargingRate: 350, maxRange: 541 },
      'Niro EV': { capacity: 64.8, maxChargingRate: 100, maxRange: 460 },
      // Genesis
      'GV60': { capacity: 77.4, maxChargingRate: 350, maxRange: 466 },
      'GV60 Performance': { capacity: 77.4, maxChargingRate: 350, maxRange: 378 },
      'Electrified GV70': { capacity: 77.4, maxChargingRate: 350, maxRange: 455 },
      'Electrified G80': { capacity: 87.2, maxChargingRate: 350, maxRange: 516 },
    };

    const key = Object.keys(models).find(k =>
      model.toLowerCase().includes(k.toLowerCase())
    );

    return key ? models[key] : { capacity: 77, maxChargingRate: 350, maxRange: 450 };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async sendCommand(
    accessToken: string,
    brand: HKBrand,
    region: string,
    vehicleId: string,
    command: string,
    body?: Record<string, unknown>
  ): Promise<HKCommandResult> {
    const response = await this.apiRequest(
      accessToken,
      brand,
      region,
      `/v2/vehicles/${vehicleId}/${command}`,
      'POST',
      body
    );

    return {
      responseCode: response.responseCode as string || 'SUCCESS',
      responseMessage: response.responseMessage as string || '',
      transactionId: response.transactionId as string,
    };
  }

  private async apiRequest<T = Record<string, unknown>>(
    accessToken: string,
    brand: HKBrand,
    region: string,
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const brandConfig = brandConfigs[brand][region as keyof typeof brandConfigs[typeof brand]];
    const url = `${brandConfig.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'appId': brandConfig.appId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('[HK] API error', { brand, endpoint, status: response.status, error });
      throw new Error(`HK API error: ${response.status} - ${error}`);
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

let hkServiceInstance: HyundaiKiaIntegrationService | null = null;

export function getHyundaiKiaIntegrationService(): HyundaiKiaIntegrationService {
  if (!hkServiceInstance) {
    hkServiceInstance = HyundaiKiaIntegrationService.getInstance();
  }
  return hkServiceInstance;
}

export default HyundaiKiaIntegrationService;
