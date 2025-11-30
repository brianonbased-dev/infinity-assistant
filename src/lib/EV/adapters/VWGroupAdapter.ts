/**
 * VW Group EV Adapter
 *
 * Implements EVManufacturerAdapter for Volkswagen Group vehicles.
 * Supports VW (ID.4, ID.Buzz), Audi (e-tron, Q4 e-tron), Porsche (Taycan).
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
// VW Group API Types
// ============================================================================

interface VWVehicle {
  vin: string;
  nickname?: string;
  brand: 'VW' | 'Audi' | 'Porsche' | 'Skoda' | 'Seat' | 'Cupra';
  model: string;
  modelYear: number;
  enrollmentStatus: string;
  capabilities: string[];
}

interface VWVehicleStatus {
  vin: string;
  timestamp: string;
  batteryStatus: {
    currentSOC_pct: number;
    cruisingRangeElectric_km: number;
    chargingStatus: 'notReadyForCharging' | 'readyForCharging' | 'charging' | 'chargePurposeReachedAndConservation' | 'error';
    chargingRemainingTime_min?: number;
    chargeType?: 'ac' | 'dc';
    chargePower_kW?: number;
    chargeRate_kmph?: number;
    targetSOC_pct?: number;
    plugStatus: 'connected' | 'disconnected';
  };
  climatisationStatus: {
    active: boolean;
    remainingTime_min?: number;
    targetTemperature_C?: number;
    climatisationState: 'off' | 'heating' | 'cooling' | 'ventilation';
  };
  parkingPosition?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  vehicleHealthStatus: {
    mileage_km: number;
    oilLevel?: string;
    serviceInspection?: {
      daysUntilDue?: number;
      kmUntilDue?: number;
    };
  };
  accessStatus: {
    overallStatus: 'locked' | 'unlocked' | 'unknown';
    doors: {
      frontLeft: 'open' | 'closed';
      frontRight: 'open' | 'closed';
      rearLeft: 'open' | 'closed';
      rearRight: 'open' | 'closed';
      trunk: 'open' | 'closed';
      bonnet: 'open' | 'closed';
    };
    windows: {
      frontLeft: 'open' | 'closed' | 'unsupported';
      frontRight: 'open' | 'closed' | 'unsupported';
      rearLeft: 'open' | 'closed' | 'unsupported';
      rearRight: 'open' | 'closed' | 'unsupported';
    };
  };
}

// ============================================================================
// VW Group Adapter Implementation
// ============================================================================

export class VWGroupAdapter extends BaseEVAdapter {
  readonly manufacturer = 'volkswagen' as const;

  private readonly brand: 'VW' | 'Audi' | 'Porsche';
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiBaseUrl: string;
  private readonly authBaseUrl: string;

  constructor(brand: 'VW' | 'Audi' | 'Porsche' = 'VW') {
    super();
    this.brand = brand;

    // Different credentials per brand
    switch (brand) {
      case 'Audi':
        this.clientId = process.env.AUDI_CLIENT_ID || '';
        this.clientSecret = process.env.AUDI_CLIENT_SECRET || '';
        this.apiBaseUrl = 'https://msg.audi.de/fs-car';
        this.authBaseUrl = 'https://id.audi.com';
        break;
      case 'Porsche':
        this.clientId = process.env.PORSCHE_CLIENT_ID || '';
        this.clientSecret = process.env.PORSCHE_CLIENT_SECRET || '';
        this.apiBaseUrl = 'https://api.porsche.com';
        this.authBaseUrl = 'https://login.porsche.com';
        break;
      default:
        this.clientId = process.env.VW_CLIENT_ID || '';
        this.clientSecret = process.env.VW_CLIENT_SECRET || '';
        this.apiBaseUrl = 'https://msg.volkswagen.de/fs-car';
        this.authBaseUrl = 'https://identity.vwgroup.io';
    }
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  getAuthorizationUrl(state: string): string {
    const brandPath = this.brand.toLowerCase();
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/ev/v2/${brandPath}/callback`,
      scope: 'openid profile cars',
      state,
    });

    return `${this.authBaseUrl}/oidc/v1/authorize?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<EVAuthResult> {
    try {
      const brandPath = this.brand.toLowerCase();
      const response = await fetch(`${this.authBaseUrl}/oidc/v1/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/ev/v2/${brandPath}/callback`,
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
          manufacturer: 'volkswagen',
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
      const response = await fetch(`${this.authBaseUrl}/oidc/v1/token`, {
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
          manufacturer: 'volkswagen',
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
    const response = await this.makeRequest<{ data: VWVehicle[] }>(
      token,
      '/vehicleMgmt/v2/vehicles'
    );

    // Filter to only EVs from the specified brand
    const evVehicles = response.data.filter(v =>
      v.brand === this.brand && v.capabilities.includes('BATTERY_STATUS')
    );

    return Promise.all(evVehicles.map(v => this.convertVehicle(token, v)));
  }

  private async convertVehicle(token: EVAuthToken, vehicle: VWVehicle): Promise<EVVehicle> {
    const modelInfo = this.getModelInfo(vehicle.brand, vehicle.model, vehicle.modelYear);

    return {
      id: vehicle.vin,
      vin: vehicle.vin,
      manufacturer: this.mapBrandToManufacturer(vehicle.brand),
      model: vehicle.model,
      year: vehicle.modelYear,
      displayName: vehicle.nickname || `${vehicle.modelYear} ${vehicle.brand} ${vehicle.model}`,
      batteryCapacity: modelInfo.batteryCapacity,
      maxRange: modelInfo.maxRange,
      isOnline: vehicle.enrollmentStatus === 'ENROLLED',
      lastSeen: new Date(),
      features: {
        remoteStart: false,
        climateControl: vehicle.capabilities.includes('CLIMATISATION'),
        charging: vehicle.capabilities.includes('CHARGING'),
        location: vehicle.capabilities.includes('PARKING_POSITION'),
        lock: vehicle.capabilities.includes('ACCESS'),
        honk: vehicle.capabilities.includes('HONK_AND_FLASH'),
        sentryMode: false,
        speedLimit: false,
        valetMode: false,
      },
      metadata: {
        brand: vehicle.brand,
        capabilities: vehicle.capabilities,
      },
    };
  }

  private mapBrandToManufacturer(brand: string): Manufacturer {
    switch (brand) {
      case 'Audi': return 'audi';
      case 'Porsche': return 'porsche';
      default: return 'volkswagen';
    }
  }

  private getModelInfo(brand: string, model: string, year: number): { batteryCapacity: number; maxRange: number } {
    const modelLower = model.toLowerCase();

    // VW Models
    if (brand === 'VW') {
      if (modelLower.includes('id.4')) {
        if (modelLower.includes('pro s') || modelLower.includes('82')) return { batteryCapacity: 82, maxRange: 275 };
        return { batteryCapacity: 62, maxRange: 209 };
      }
      if (modelLower.includes('id.buzz')) return { batteryCapacity: 82, maxRange: 234 };
      if (modelLower.includes('id.3')) return { batteryCapacity: 77, maxRange: 260 };
      if (modelLower.includes('id.7')) return { batteryCapacity: 86, maxRange: 386 };
    }

    // Audi Models
    if (brand === 'Audi') {
      if (modelLower.includes('e-tron gt')) return { batteryCapacity: 93, maxRange: 238 };
      if (modelLower.includes('q8 e-tron')) return { batteryCapacity: 114, maxRange: 285 };
      if (modelLower.includes('q4 e-tron')) {
        if (modelLower.includes('55')) return { batteryCapacity: 82, maxRange: 265 };
        return { batteryCapacity: 77, maxRange: 236 };
      }
      if (modelLower.includes('e-tron')) return { batteryCapacity: 95, maxRange: 222 };
    }

    // Porsche Models
    if (brand === 'Porsche') {
      if (modelLower.includes('taycan')) {
        if (modelLower.includes('turbo s')) return { batteryCapacity: 93, maxRange: 260 };
        if (modelLower.includes('turbo')) return { batteryCapacity: 93, maxRange: 280 };
        if (modelLower.includes('gts')) return { batteryCapacity: 93, maxRange: 300 };
        if (modelLower.includes('4s')) return { batteryCapacity: 93, maxRange: 320 };
        return { batteryCapacity: 79, maxRange: 287 };
      }
      if (modelLower.includes('macan')) return { batteryCapacity: 100, maxRange: 308 };
    }

    return { batteryCapacity: 77, maxRange: 250 };
  }

  // ============================================================================
  // Vehicle State
  // ============================================================================

  async getBatteryState(token: EVAuthToken, vehicleId: string): Promise<BatteryState> {
    const status = await this.makeRequest<VWVehicleStatus>(
      token,
      `/bs/batterycharge/v1/${this.brand}/${vehicleId}/charger`
    );

    return {
      level: status.batteryStatus.currentSOC_pct,
      range: Math.round(status.batteryStatus.cruisingRangeElectric_km * 0.621), // km to miles
      rangeUnit: 'miles',
      isCharging: status.batteryStatus.chargingStatus === 'charging',
      isPluggedIn: status.batteryStatus.plugStatus === 'connected',
      lastUpdated: new Date(status.timestamp),
    };
  }

  async getChargingState(token: EVAuthToken, vehicleId: string): Promise<ChargingState> {
    const status = await this.makeRequest<VWVehicleStatus>(
      token,
      `/bs/batterycharge/v1/${this.brand}/${vehicleId}/charger`
    );

    const battery = status.batteryStatus;

    return {
      status: this.mapChargingStatus(battery.chargingStatus),
      isPluggedIn: battery.plugStatus === 'connected',
      batteryLevel: battery.currentSOC_pct,
      chargeRate: battery.chargePower_kW,
      chargeRateUnit: 'kW',
      timeToFullCharge: battery.chargingRemainingTime_min,
      chargeLimit: battery.targetSOC_pct,
      estimatedRange: Math.round(battery.cruisingRangeElectric_km * 0.621),
      lastUpdated: new Date(status.timestamp),
    };
  }

  private mapChargingStatus(status: string): ChargingState['status'] {
    switch (status) {
      case 'charging': return 'charging';
      case 'chargePurposeReachedAndConservation': return 'complete';
      case 'readyForCharging': return 'connected';
      case 'error': return 'error';
      default: return 'disconnected';
    }
  }

  async getClimateState(token: EVAuthToken, vehicleId: string): Promise<ClimateState> {
    const status = await this.makeRequest<VWVehicleStatus>(
      token,
      `/bs/climatisation/v1/${this.brand}/${vehicleId}/climater`
    );

    const climate = status.climatisationStatus;

    return {
      isOn: climate.active,
      driverTempSetting: climate.targetTemperature_C,
      isPreconditioning: climate.active && climate.climatisationState !== 'off',
      lastUpdated: new Date(status.timestamp),
    };
  }

  async getLocation(token: EVAuthToken, vehicleId: string): Promise<LocationState> {
    const status = await this.makeRequest<VWVehicleStatus>(
      token,
      `/bs/cf/v1/${this.brand}/${vehicleId}/position`
    );

    const pos = status.parkingPosition;

    return {
      latitude: pos?.latitude || 0,
      longitude: pos?.longitude || 0,
      lastUpdated: new Date(pos?.timestamp || status.timestamp),
    };
  }

  // ============================================================================
  // Commands
  // ============================================================================

  async sendCommand(token: EVAuthToken, request: EVCommandRequest): Promise<EVCommandResult> {
    const endpoint = this.getCommandEndpoint(request);
    if (!endpoint) {
      return { success: false, error: `Command ${request.command} not supported for VW Group` };
    }

    try {
      await this.makeRequest(token, endpoint.path, {
        method: 'POST',
        body: endpoint.body,
      });

      return { success: true, commandId: `vw_${Date.now()}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Command failed' };
    }
  }

  private getCommandEndpoint(request: EVCommandRequest): { path: string; body?: object } | null {
    const basePath = `/bs`;
    const { vehicleId, command, params } = request;

    switch (command) {
      case 'lock':
        return { path: `${basePath}/rlu/v1/${this.brand}/${vehicleId}/actions`, body: { action: 'lock' } };
      case 'unlock':
        return { path: `${basePath}/rlu/v1/${this.brand}/${vehicleId}/actions`, body: { action: 'unlock' } };
      case 'startCharging':
        return { path: `${basePath}/batterycharge/v1/${this.brand}/${vehicleId}/charger/actions`, body: { action: 'start' } };
      case 'stopCharging':
        return { path: `${basePath}/batterycharge/v1/${this.brand}/${vehicleId}/charger/actions`, body: { action: 'stop' } };
      case 'startClimate':
        return { path: `${basePath}/climatisation/v1/${this.brand}/${vehicleId}/climater/actions`, body: { action: 'start' } };
      case 'stopClimate':
        return { path: `${basePath}/climatisation/v1/${this.brand}/${vehicleId}/climater/actions`, body: { action: 'stop' } };
      case 'setChargeLimit':
        return { path: `${basePath}/batterycharge/v1/${this.brand}/${vehicleId}/charger/settings`, body: { targetSOC_pct: params?.limit } };
      case 'honk':
        return { path: `${basePath}/rhf/v1/${this.brand}/${vehicleId}/honkAndFlash`, body: { honk: true, flash: true, duration: 3 } };
      case 'flash':
        return { path: `${basePath}/rhf/v1/${this.brand}/${vehicleId}/honkAndFlash`, body: { honk: false, flash: true, duration: 5 } };
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
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`VW API error: ${response.status}`);
    }

    return response.json();
  }
}

// Register adapters for each brand
registerAdapter('volkswagen', () => new VWGroupAdapter('VW'));
registerAdapter('audi', () => new VWGroupAdapter('Audi'));
registerAdapter('porsche', () => new VWGroupAdapter('Porsche'));

export default VWGroupAdapter;
