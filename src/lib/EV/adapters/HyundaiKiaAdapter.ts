/**
 * Hyundai/Kia EV Adapter
 *
 * Implements EVManufacturerAdapter for Hyundai and Kia vehicles.
 * Uses Bluelink (Hyundai) and Kia Connect APIs.
 * Supports Ioniq 5/6, EV6, EV9, Niro EV, etc.
 */

import {
  BaseEVAdapter,
  registerAdapter,
} from '../EVManufacturerAdapter';
import {
  EVAuthToken,
  EVAuthResult,
  EVVehicle,
  BatteryState,
  ChargingState,
  ClimateState,
  LocationState,
  EVCommandRequest,
  EVCommandResult,
  ChargingStation,
  Manufacturer,
} from '../types';

// ============================================================================
// Hyundai/Kia API Types
// ============================================================================

interface HKVehicle {
  vehicleId: string;
  vin: string;
  vehicleName: string;
  type: string;
  nickname?: string;
  year: number;
  model: string;
  trim?: string;
  fuelType: 'EV' | 'PHEV' | 'HEV' | 'GAS';
  evBatteryCapacity?: number;
}

interface HKVehicleStatus {
  vehicleId: string;
  lastUpdateTime: string;
  evStatus: {
    batteryCharge: boolean;
    batteryStatus: number;
    batteryPlugin: number; // 0=not plugged, 1=plugged
    remainChargeTime: { hour: number; minute: number }[];
    drvDistance: { value: number; unit: number }[]; // unit: 1=km, 2=miles
    chargeTargetCurrent: number;
    chargingType?: 'AC' | 'DC';
    chargerPower?: number;
    estimatedCurrentChargeDuration?: number;
  };
  vehicleLocation: {
    coord: { lat: number; lon: number; alt: number };
    head: number;
    speed: { value: number; unit: number };
    time: string;
  };
  odometer: { value: number; unit: number };
  vehicleStatus: {
    doorLock: boolean;
    trunkOpen: boolean;
    hoodOpen: boolean;
    doorOpen: { frontLeft: number; frontRight: number; backLeft: number; backRight: number };
    airCtrlOn: boolean;
    defrost: boolean;
    airTemp: { value: string; unit: number };
    steerWheelHeat: number;
    sideBackWindowHeat: number;
    tirePressureLamp: { tirePressureWarningLamp: number };
  };
  climate: {
    airCtrlOn: boolean;
    defrost: boolean;
    airTemp: { value: string; unit: number };
    heatingAccessory?: {
      rearWindow: number;
      steeringWheel: number;
      sideMirror: number;
    };
  };
}

// ============================================================================
// Hyundai/Kia Adapter Implementation
// ============================================================================

export class HyundaiKiaAdapter extends BaseEVAdapter {
  readonly manufacturer: Manufacturer;
  readonly brand: 'hyundai' | 'kia';

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiBaseUrl: string;
  private readonly authBaseUrl: string;
  private readonly appId: string;

  constructor(brand: 'hyundai' | 'kia' = 'hyundai') {
    super();
    this.brand = brand;
    this.manufacturer = brand;

    if (brand === 'kia') {
      this.clientId = process.env.KIA_CLIENT_ID || '';
      this.clientSecret = process.env.KIA_CLIENT_SECRET || '';
      this.apiBaseUrl = 'https://api.kiaconnect.com';
      this.authBaseUrl = 'https://prd.kiaconnect.com';
      this.appId = process.env.KIA_APP_ID || '';
    } else {
      this.clientId = process.env.HYUNDAI_CLIENT_ID || '';
      this.clientSecret = process.env.HYUNDAI_CLIENT_SECRET || '';
      this.apiBaseUrl = 'https://api.telematics.hyundaiusa.com';
      this.authBaseUrl = 'https://owners.hyundaiusa.com';
      this.appId = process.env.HYUNDAI_APP_ID || '';
    }
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/ev/v2/${this.brand}/callback`,
      scope: 'openid offline_access',
      state,
    });

    return `${this.authBaseUrl}/oauth2/authorize?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<EVAuthResult> {
    try {
      const response = await fetch(`${this.authBaseUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/ev/v2/${this.brand}/callback`,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        return { success: false, error: err.error_description || 'Token exchange failed' };
      }

      const data = await response.json();

      return {
        success: true,
        token: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: new Date(Date.now() + data.expires_in * 1000),
          manufacturer: this.brand,
          scope: data.scope?.split(' '),
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Token exchange failed' };
    }
  }

  async refreshToken(token: EVAuthToken): Promise<EVAuthResult> {
    if (!token.refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    try {
      const response = await fetch(`${this.authBaseUrl}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: token.refreshToken,
        }),
      });

      if (!response.ok) {
        return { success: false, error: 'Token refresh failed' };
      }

      const data = await response.json();

      return {
        success: true,
        token: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || token.refreshToken,
          expiresAt: new Date(Date.now() + data.expires_in * 1000),
          manufacturer: this.brand,
          scope: token.scope,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Token refresh failed' };
    }
  }

  // ============================================================================
  // Vehicle Management
  // ============================================================================

  async getVehicles(token: EVAuthToken): Promise<EVVehicle[]> {
    const response = await this.makeRequest<{ vehicles: HKVehicle[] }>(
      token,
      '/ac/v2/enrollment/details'
    );

    // Filter to EVs only
    const evVehicles = response.vehicles.filter(v => v.fuelType === 'EV' || v.fuelType === 'PHEV');

    return evVehicles.map(v => this.convertVehicle(v));
  }

  private convertVehicle(vehicle: HKVehicle): EVVehicle {
    const modelInfo = this.getModelInfo(vehicle.model, vehicle.year);

    return {
      id: vehicle.vehicleId,
      vin: vehicle.vin,
      manufacturer: this.brand,
      model: vehicle.model,
      year: vehicle.year,
      displayName: vehicle.nickname || `${vehicle.year} ${this.brand === 'kia' ? 'Kia' : 'Hyundai'} ${vehicle.model}`,
      batteryCapacity: vehicle.evBatteryCapacity || modelInfo.batteryCapacity,
      maxRange: modelInfo.maxRange,
      isOnline: true,
      lastSeen: new Date(),
      features: {
        remoteStart: true,
        climateControl: true,
        charging: true,
        location: true,
        lock: true,
        honk: true,
        sentryMode: false,
        speedLimit: false,
        valetMode: false,
      },
      metadata: {
        trim: vehicle.trim,
        fuelType: vehicle.fuelType,
      },
    };
  }

  private getModelInfo(model: string, year: number): { batteryCapacity: number; maxRange: number } {
    const modelLower = model.toLowerCase();

    // Hyundai Models
    if (this.brand === 'hyundai') {
      if (modelLower.includes('ioniq 6')) {
        if (year >= 2024) return { batteryCapacity: 77, maxRange: 361 };
        return { batteryCapacity: 77, maxRange: 361 };
      }
      if (modelLower.includes('ioniq 5')) {
        if (modelLower.includes('long range') || year >= 2024) return { batteryCapacity: 77, maxRange: 303 };
        return { batteryCapacity: 58, maxRange: 220 };
      }
      if (modelLower.includes('kona')) {
        if (year >= 2024) return { batteryCapacity: 65, maxRange: 261 };
        return { batteryCapacity: 64, maxRange: 258 };
      }
    }

    // Kia Models
    if (this.brand === 'kia') {
      if (modelLower.includes('ev9')) {
        if (modelLower.includes('long range')) return { batteryCapacity: 99, maxRange: 304 };
        return { batteryCapacity: 76, maxRange: 230 };
      }
      if (modelLower.includes('ev6')) {
        if (modelLower.includes('long range') || modelLower.includes('gt')) return { batteryCapacity: 77, maxRange: 310 };
        return { batteryCapacity: 58, maxRange: 232 };
      }
      if (modelLower.includes('niro')) {
        return { batteryCapacity: 64, maxRange: 253 };
      }
    }

    return { batteryCapacity: 64, maxRange: 250 };
  }

  // ============================================================================
  // Vehicle State
  // ============================================================================

  async getBatteryState(token: EVAuthToken, vehicleId: string): Promise<BatteryState> {
    const status = await this.makeRequest<HKVehicleStatus>(
      token,
      `/ac/v2/vehicles/${vehicleId}/status`
    );

    const ev = status.evStatus;
    const range = ev.drvDistance?.[0];

    return {
      level: ev.batteryStatus,
      range: range?.unit === 1 ? Math.round(range.value * 0.621) : range?.value || 0,
      rangeUnit: 'miles',
      isCharging: ev.batteryCharge,
      isPluggedIn: ev.batteryPlugin === 1,
      lastUpdated: new Date(status.lastUpdateTime),
    };
  }

  async getChargingState(token: EVAuthToken, vehicleId: string): Promise<ChargingState> {
    const status = await this.makeRequest<HKVehicleStatus>(
      token,
      `/ac/v2/vehicles/${vehicleId}/status`
    );

    const ev = status.evStatus;
    const range = ev.drvDistance?.[0];
    const timeToFull = ev.remainChargeTime?.[0];

    return {
      status: ev.batteryCharge ? 'charging' :
              ev.batteryPlugin === 1 ? 'connected' : 'disconnected',
      isPluggedIn: ev.batteryPlugin === 1,
      batteryLevel: ev.batteryStatus,
      chargeRate: ev.chargerPower,
      chargeRateUnit: 'kW',
      timeToFullCharge: timeToFull ? (timeToFull.hour * 60 + timeToFull.minute) : undefined,
      chargeLimit: ev.chargeTargetCurrent,
      estimatedRange: range?.unit === 1 ? Math.round(range.value * 0.621) : range?.value,
      lastUpdated: new Date(status.lastUpdateTime),
    };
  }

  async getClimateState(token: EVAuthToken, vehicleId: string): Promise<ClimateState> {
    const status = await this.makeRequest<HKVehicleStatus>(
      token,
      `/ac/v2/vehicles/${vehicleId}/status`
    );

    const climate = status.climate || status.vehicleStatus;

    return {
      isOn: climate.airCtrlOn,
      driverTempSetting: parseFloat(climate.airTemp?.value || '0'),
      isPreconditioning: climate.airCtrlOn,
      lastUpdated: new Date(status.lastUpdateTime),
    };
  }

  async getLocation(token: EVAuthToken, vehicleId: string): Promise<LocationState> {
    const status = await this.makeRequest<HKVehicleStatus>(
      token,
      `/ac/v2/vehicles/${vehicleId}/status`
    );

    const loc = status.vehicleLocation;

    return {
      latitude: loc.coord.lat,
      longitude: loc.coord.lon,
      heading: loc.head,
      speed: loc.speed?.unit === 1 ? Math.round(loc.speed.value * 0.621) : loc.speed?.value,
      lastUpdated: new Date(loc.time),
    };
  }

  // ============================================================================
  // Commands
  // ============================================================================

  async sendCommand(token: EVAuthToken, request: EVCommandRequest): Promise<EVCommandResult> {
    const endpoint = this.getCommandEndpoint(request);
    if (!endpoint) {
      return { success: false, error: `Command ${request.command} not supported for ${this.brand}` };
    }

    try {
      const response = await this.makeRequest<{ result: string }>(
        token,
        endpoint.path,
        { method: 'POST', body: endpoint.body }
      );

      return {
        success: response.result === 'success',
        commandId: `${this.brand}_${Date.now()}`,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Command failed' };
    }
  }

  private getCommandEndpoint(request: EVCommandRequest): { path: string; body?: object } | null {
    const { vehicleId, command, params } = request;
    const basePath = `/ac/v2/vehicles/${vehicleId}`;

    switch (command) {
      case 'lock':
        return { path: `${basePath}/control/door`, body: { action: 'close' } };
      case 'unlock':
        return { path: `${basePath}/control/door`, body: { action: 'open' } };
      case 'startCharging':
        return { path: `${basePath}/control/charge`, body: { action: 'start' } };
      case 'stopCharging':
        return { path: `${basePath}/control/charge`, body: { action: 'stop' } };
      case 'startClimate':
        return {
          path: `${basePath}/control/climate`,
          body: {
            action: 'start',
            temperature: params?.temp || 72,
            unit: 'F',
            defrost: false,
          },
        };
      case 'stopClimate':
        return { path: `${basePath}/control/climate`, body: { action: 'stop' } };
      case 'setChargeLimit':
        return {
          path: `${basePath}/control/charge/limit`,
          body: { targetSOC: params?.limit },
        };
      case 'honk':
        return { path: `${basePath}/control/hornlight`, body: { horn: true, light: true } };
      case 'flash':
        return { path: `${basePath}/control/hornlight`, body: { horn: false, light: true } };
      default:
        return null;
    }
  }

  // ============================================================================
  // API Helper
  // ============================================================================

  private async makeRequest<T>(
    token: EVAuthToken,
    endpoint: string,
    options: { method?: string; body?: object } = {}
  ): Promise<T> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const { method = 'GET', body } = options;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'client_id': this.clientId,
        'appId': this.appId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`${this.brand} API error: ${response.status}`);
    }

    return response.json();
  }
}

// Register adapters for both brands
registerAdapter('hyundai', () => new HyundaiKiaAdapter('hyundai'));
registerAdapter('kia', () => new HyundaiKiaAdapter('kia'));

export default HyundaiKiaAdapter;
