/**
 * GM EV Adapter
 *
 * Implements EVManufacturerAdapter for General Motors vehicles using OnStar API.
 * Supports Chevrolet Bolt, Blazer EV, Equinox EV, Silverado EV, GMC Hummer EV, Cadillac Lyriq, etc.
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
} from '../types';

// ============================================================================
// GM/OnStar API Types
// ============================================================================

interface GMVehicle {
  vin: string;
  make: 'CHEVROLET' | 'GMC' | 'CADILLAC' | 'BUICK';
  model: string;
  year: number;
  bodyStyle: string;
  fuelType: 'ELECTRIC' | 'PHEV' | 'GASOLINE' | 'DIESEL' | 'HYBRID';
  engineDescription: string;
  transmission: string;
  exteriorColor: string;
  interiorColor: string;
  status: {
    connected: boolean;
    lastUpdated: string;
  };
  capabilities: {
    remoteStart: boolean;
    remoteLock: boolean;
    remoteHorn: boolean;
    remoteLights: boolean;
    evChargeControl: boolean;
    evChargeProfile: boolean;
    diagnostics: boolean;
    location: boolean;
    cabinConditioning: boolean;
    evPlugStatus: boolean;
  };
  subscription?: {
    status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
    type: string;
  };
}

interface GMVehicleStatus {
  vin: string;
  timestamp: string;
  evBatteryLevel: {
    value: number;
    unit: string;
  };
  evRange: {
    value: number;
    unit: string;
  };
  evChargeState: {
    chargingMode: 'NO_CHARGE' | 'AC_CHARGE' | 'DC_CHARGE' | 'CHARGE_COMPLETE';
    chargerPowerLevel: 'LEVEL_1' | 'LEVEL_2' | 'DC_FAST' | 'NOT_CHARGING';
    rateOfCharge?: number;
    timeToFullCharge?: number;
    pluggedIn: boolean;
    chargeTargetPercent?: number;
    scheduledChargeEnabled?: boolean;
    scheduledDepartureTime?: string;
  };
  fuelTankInfo?: {
    fuelAmount: number;
    fuelAmountUnit: string;
    fuelRange: number;
    fuelRangeUnit: string;
  };
  odometer: {
    value: number;
    unit: string;
  };
  tirePressure?: {
    frontLeft: number;
    frontRight: number;
    rearLeft: number;
    rearRight: number;
    unit: string;
  };
  oilLife?: {
    value: number;
  };
  location?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  doors: {
    driver: 'OPEN' | 'CLOSED';
    passenger: 'OPEN' | 'CLOSED';
    rearDriver: 'OPEN' | 'CLOSED';
    rearPassenger: 'OPEN' | 'CLOSED';
    trunk: 'OPEN' | 'CLOSED';
    hood: 'OPEN' | 'CLOSED';
  };
  locks: {
    overall: 'LOCKED' | 'UNLOCKED';
  };
  climateStatus?: {
    running: boolean;
    mode: 'HEAT' | 'COOL' | 'AUTO' | 'OFF';
    targetTemp?: number;
  };
  ignition: 'ON' | 'OFF' | 'ACCESSORY';
}

interface GMCommandResponse {
  commandId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  message?: string;
  completedTime?: string;
}

// ============================================================================
// GM Adapter Implementation
// ============================================================================

export class GMAdapter extends BaseEVAdapter {
  readonly manufacturer = 'gm' as const;

  private readonly clientId = process.env.GM_CLIENT_ID || '';
  private readonly clientSecret = process.env.GM_CLIENT_SECRET || '';
  private readonly apiBaseUrl = 'https://api.gm.com/v1';
  private readonly authBaseUrl = 'https://id.gm.com';

  // ============================================================================
  // Authentication (GM OAuth)
  // ============================================================================

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/ev/gm/callback`,
      scope: 'openid onstar user_data vehicle_data remote_control location',
      state,
    });

    return `${this.authBaseUrl}/oauth/authorize?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<EVAuthResult> {
    try {
      const response = await fetch(`${this.authBaseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/ev/gm/callback`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error_description || 'Failed to exchange code for token',
        };
      }

      const data = await response.json();

      return {
        success: true,
        token: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: new Date(Date.now() + data.expires_in * 1000),
          manufacturer: 'gm',
          scope: data.scope?.split(' ') || ['onstar', 'vehicle_data'],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token exchange failed',
      };
    }
  }

  async refreshToken(token: EVAuthToken): Promise<EVAuthResult> {
    if (!token.refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    try {
      const response = await fetch(`${this.authBaseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: token.refreshToken,
        }),
      });

      if (!response.ok) {
        return { success: false, error: 'Failed to refresh token' };
      }

      const data = await response.json();

      return {
        success: true,
        token: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || token.refreshToken,
          expiresAt: new Date(Date.now() + data.expires_in * 1000),
          manufacturer: 'gm',
          scope: data.scope?.split(' ') || token.scope,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      };
    }
  }

  // ============================================================================
  // Vehicle Management
  // ============================================================================

  async getVehicles(token: EVAuthToken): Promise<EVVehicle[]> {
    const response = await this.makeRequest<{ vehicles: GMVehicle[] }>(
      token,
      '/account/vehicles'
    );

    if (!response.vehicles) {
      return [];
    }

    // Filter to EVs and PHEVs
    const evVehicles = response.vehicles.filter(
      v => v.fuelType === 'ELECTRIC' || v.fuelType === 'PHEV'
    );

    return Promise.all(evVehicles.map(v => this.convertVehicle(token, v)));
  }

  private async convertVehicle(token: EVAuthToken, vehicle: GMVehicle): Promise<EVVehicle> {
    // Get current status
    let status: GMVehicleStatus | null = null;
    try {
      status = await this.makeRequest<GMVehicleStatus>(
        token,
        `/vehicles/${vehicle.vin}/status`
      );
    } catch {
      // Status fetch might fail
    }

    const modelInfo = this.getModelInfo(vehicle.make, vehicle.model, vehicle.year);

    return {
      id: vehicle.vin,
      vin: vehicle.vin,
      manufacturer: 'gm',
      model: `${vehicle.make} ${vehicle.model}`,
      year: vehicle.year,
      displayName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      batteryCapacity: modelInfo.batteryCapacity,
      maxRange: modelInfo.maxRange,
      isOnline: vehicle.status.connected,
      lastSeen: status?.timestamp ? new Date(status.timestamp) : new Date(vehicle.status.lastUpdated),
      features: {
        remoteStart: vehicle.capabilities.remoteStart,
        climateControl: vehicle.capabilities.cabinConditioning,
        charging: vehicle.capabilities.evChargeControl,
        location: vehicle.capabilities.location,
        lock: vehicle.capabilities.remoteLock,
        honk: vehicle.capabilities.remoteHorn,
        sentryMode: false,
        speedLimit: false,
        valetMode: false,
      },
      metadata: {
        make: vehicle.make,
        bodyStyle: vehicle.bodyStyle,
        fuelType: vehicle.fuelType,
        exteriorColor: vehicle.exteriorColor,
        interiorColor: vehicle.interiorColor,
        subscription: vehicle.subscription,
        mileage: status?.odometer?.value,
      },
    };
  }

  private getModelInfo(make: string, model: string, year: number): { batteryCapacity: number; maxRange: number } {
    const modelLower = model.toLowerCase();

    // Chevrolet
    if (make === 'CHEVROLET') {
      // Bolt EV/EUV
      if (modelLower.includes('bolt')) {
        if (year >= 2022) {
          if (modelLower.includes('euv')) return { batteryCapacity: 65, maxRange: 247 };
          return { batteryCapacity: 65, maxRange: 259 };
        }
        return { batteryCapacity: 60, maxRange: 238 }; // Older Bolt
      }
      // Blazer EV
      if (modelLower.includes('blazer')) {
        if (modelLower.includes('rs') || modelLower.includes('ss')) return { batteryCapacity: 102, maxRange: 283 };
        return { batteryCapacity: 85, maxRange: 293 }; // LT/2LT
      }
      // Equinox EV
      if (modelLower.includes('equinox')) {
        if (modelLower.includes('rs')) return { batteryCapacity: 85, maxRange: 280 };
        return { batteryCapacity: 85, maxRange: 319 }; // 1LT/2LT
      }
      // Silverado EV
      if (modelLower.includes('silverado')) {
        return { batteryCapacity: 200, maxRange: 450 }; // RST First Edition
      }
    }

    // GMC
    if (make === 'GMC') {
      // Hummer EV
      if (modelLower.includes('hummer')) {
        if (modelLower.includes('suv')) return { batteryCapacity: 170, maxRange: 303 };
        return { batteryCapacity: 213, maxRange: 329 }; // Truck
      }
      // Sierra EV
      if (modelLower.includes('sierra')) {
        return { batteryCapacity: 200, maxRange: 440 };
      }
    }

    // Cadillac
    if (make === 'CADILLAC') {
      // Lyriq
      if (modelLower.includes('lyriq')) {
        if (modelLower.includes('awd')) return { batteryCapacity: 102, maxRange: 307 };
        return { batteryCapacity: 102, maxRange: 314 }; // RWD
      }
      // Celestiq
      if (modelLower.includes('celestiq')) {
        return { batteryCapacity: 111, maxRange: 300 };
      }
      // Optiq
      if (modelLower.includes('optiq')) {
        return { batteryCapacity: 85, maxRange: 300 };
      }
    }

    // Default
    return { batteryCapacity: 80, maxRange: 250 };
  }

  // ============================================================================
  // Vehicle State
  // ============================================================================

  async getBatteryState(token: EVAuthToken, vehicleId: string): Promise<BatteryState> {
    const status = await this.makeRequest<GMVehicleStatus>(
      token,
      `/vehicles/${vehicleId}/status`
    );

    return {
      level: status.evBatteryLevel?.value || 0,
      range: status.evRange?.value || 0,
      rangeUnit: (status.evRange?.unit || 'miles').toLowerCase() as 'miles' | 'km',
      isCharging: this.isCharging(status.evChargeState?.chargingMode),
      isPluggedIn: status.evChargeState?.pluggedIn || false,
      lastUpdated: new Date(status.timestamp),
    };
  }

  async getChargingState(token: EVAuthToken, vehicleId: string): Promise<ChargingState> {
    const status = await this.makeRequest<GMVehicleStatus>(
      token,
      `/vehicles/${vehicleId}/status`
    );

    const chargeState = status.evChargeState;

    return {
      status: this.mapChargingStatus(chargeState?.chargingMode),
      isPluggedIn: chargeState?.pluggedIn || false,
      batteryLevel: status.evBatteryLevel?.value || 0,
      chargeRate: chargeState?.rateOfCharge,
      chargeRateUnit: 'miles/hr',
      timeToFullCharge: chargeState?.timeToFullCharge,
      chargeLimit: chargeState?.chargeTargetPercent,
      scheduledChargingEnabled: chargeState?.scheduledChargeEnabled,
      scheduledDepartureTime: chargeState?.scheduledDepartureTime,
      estimatedRange: status.evRange?.value,
      chargerPowerLevel: chargeState?.chargerPowerLevel,
      lastUpdated: new Date(status.timestamp),
    };
  }

  private isCharging(mode?: string): boolean {
    return mode === 'AC_CHARGE' || mode === 'DC_CHARGE';
  }

  private mapChargingStatus(mode?: string): ChargingState['status'] {
    switch (mode) {
      case 'AC_CHARGE':
      case 'DC_CHARGE':
        return 'charging';
      case 'CHARGE_COMPLETE':
        return 'complete';
      case 'NO_CHARGE':
      default:
        return 'disconnected';
    }
  }

  async getClimateState(token: EVAuthToken, vehicleId: string): Promise<ClimateState> {
    const status = await this.makeRequest<GMVehicleStatus>(
      token,
      `/vehicles/${vehicleId}/status`
    );

    const climate = status.climateStatus;

    return {
      isOn: climate?.running || false,
      insideTemp: undefined,
      outsideTemp: undefined,
      driverTempSetting: climate?.targetTemp,
      passengerTempSetting: undefined,
      isPreconditioning: climate?.running && status.ignition === 'OFF',
      lastUpdated: new Date(status.timestamp),
    };
  }

  async getLocation(token: EVAuthToken, vehicleId: string): Promise<LocationState> {
    const status = await this.makeRequest<GMVehicleStatus>(
      token,
      `/vehicles/${vehicleId}/status`
    );

    const location = status.location;

    return {
      latitude: location?.latitude || 0,
      longitude: location?.longitude || 0,
      heading: undefined,
      speed: undefined,
      lastUpdated: new Date(location?.timestamp || status.timestamp),
    };
  }

  // ============================================================================
  // Commands
  // ============================================================================

  async sendCommand(token: EVAuthToken, request: EVCommandRequest): Promise<EVCommandResult> {
    const endpoint = this.getCommandEndpoint(request);
    if (!endpoint) {
      return {
        success: false,
        error: `Command ${request.command} is not supported for GM vehicles`,
      };
    }

    try {
      const response = await this.makeRequest<GMCommandResponse>(
        token,
        endpoint.path,
        {
          method: 'POST',
          body: endpoint.body,
        }
      );

      // GM commands are async - poll for status
      if (response.commandId) {
        return await this.pollCommandStatus(token, request.vehicleId, response.commandId);
      }

      return {
        success: response.status === 'SUCCESS',
        commandId: response.commandId,
        error: response.status === 'FAILED' ? response.message : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command failed',
      };
    }
  }

  private getCommandEndpoint(request: EVCommandRequest): { path: string; body?: object } | null {
    const basePath = `/vehicles/${request.vehicleId}/commands`;

    switch (request.command) {
      case 'lock':
        return { path: `${basePath}/lockDoor` };
      case 'unlock':
        return { path: `${basePath}/unlockDoor` };
      case 'startCharging':
        return { path: `${basePath}/startCharge` };
      case 'stopCharging':
        return { path: `${basePath}/stopCharge` };
      case 'startClimate':
        return {
          path: `${basePath}/start`,
          body: request.params?.temp ? { targetTemp: request.params.temp } : undefined,
        };
      case 'stopClimate':
        return { path: `${basePath}/cancelStart` };
      case 'honk':
        return { path: `${basePath}/hornAndLights`, body: { horn: true, lights: true } };
      case 'flash':
        return { path: `${basePath}/hornAndLights`, body: { horn: false, lights: true } };
      case 'setChargeLimit':
        return {
          path: `${basePath}/setChargeMode`,
          body: { chargeTargetPercent: request.params?.limit },
        };
      case 'refresh':
        return { path: `${basePath}/diagnostics` };
      default:
        return null;
    }
  }

  private async pollCommandStatus(
    token: EVAuthToken,
    vehicleId: string,
    commandId: string,
    maxAttempts = 15
  ): Promise<EVCommandResult> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const status = await this.makeRequest<GMCommandResponse>(
          token,
          `/vehicles/${vehicleId}/commands/${commandId}`
        );

        if (status.status === 'SUCCESS') {
          return { success: true, commandId };
        }
        if (status.status === 'FAILED' || status.status === 'CANCELLED') {
          return { success: false, commandId, error: status.message };
        }
      } catch {
        // Continue polling
      }
    }

    return {
      success: false,
      commandId,
      error: 'Command timed out',
    };
  }

  // ============================================================================
  // Charging Stations (Ultium Charge 360)
  // ============================================================================

  async getNearbyChargingStations(
    token: EVAuthToken,
    latitude: number,
    longitude: number,
    radius: number = 25
  ): Promise<ChargingStation[]> {
    try {
      const response = await this.makeRequest<{ stations: any[] }>(
        token,
        `/charging/stations?lat=${latitude}&lng=${longitude}&radius=${radius}&networks=evgo,chargepoint,electrify_america`
      );

      return (response.stations || []).map(station => ({
        id: station.id,
        name: station.name,
        latitude: station.location.latitude,
        longitude: station.location.longitude,
        address: station.address,
        network: station.network,
        connectors: (station.connectors || []).map((c: any) => ({
          type: c.connectorType,
          power: c.power,
          available: c.status === 'AVAILABLE',
        })),
        pricing: station.pricing,
        amenities: station.amenities || [],
        available: station.status === 'AVAILABLE',
        totalStalls: station.totalConnectors,
        availableStalls: station.availableConnectors,
      }));
    } catch {
      return [];
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
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `GM API error: ${response.status}`);
    }

    return response.json();
  }
}

// Register the adapter
registerAdapter('gm', () => new GMAdapter());

export default GMAdapter;
