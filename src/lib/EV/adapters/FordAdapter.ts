/**
 * Ford EV Adapter
 *
 * Implements EVManufacturerAdapter for Ford vehicles using FordPass Connect API.
 * Supports Mustang Mach-E, F-150 Lightning, E-Transit, etc.
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
// Ford API Types
// ============================================================================

interface FordVehicle {
  vehicleId: string;
  vin: string;
  nickName?: string;
  modelName: string;
  modelYear: string;
  color: string;
  engineType: 'BEV' | 'PHEV' | 'ICE';
  tcuEnabled: boolean;
  capabilities: string[];
}

interface FordVehicleStatus {
  vehicleId: string;
  lastRefresh: string;
  batteryFillLevel: {
    value: number;
    status: string;
    timestamp: string;
  };
  elVehDTE: {
    value: number;
    status: string;
    timestamp: string;
  };
  chargingStatus: {
    value: 'NotReady' | 'ChargingAC' | 'ChargingDCFast' | 'EvseNotDetected' | 'EvseDetected' | 'Complete' | 'Error';
    status: string;
    timestamp: string;
  };
  plugStatus: {
    value: 'Plugged' | 'Unplugged';
    status: string;
    timestamp: string;
  };
  chargeStartTime?: string;
  chargeEndTime?: string;
  chargePower?: number;
  gps: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  remoteStartStatus: {
    value: 'Running' | 'Off';
    status: string;
    timestamp: string;
  };
  doorStatus: {
    driverDoor: string;
    passengerDoor: string;
    rearDriverDoor: string;
    rearPassengerDoor: string;
    hood: string;
    tailgate: string;
  };
  lockStatus: {
    value: 'LOCKED' | 'UNLOCKED';
    status: string;
    timestamp: string;
  };
  tirePressure?: {
    frontLeft: number;
    frontRight: number;
    rearLeft: number;
    rearRight: number;
    unit: string;
  };
  odometer: {
    value: number;
    unit: string;
    status: string;
  };
  firmware?: {
    version: string;
    updateAvailable: boolean;
  };
}

interface FordCommandResponse {
  commandId: string;
  status: 'QUEUED' | 'INPROGRESS' | 'SUCCESS' | 'FAILED';
  message?: string;
}

// ============================================================================
// Ford Adapter Implementation
// ============================================================================

export class FordAdapter extends BaseEVAdapter {
  readonly manufacturer = 'ford' as const;

  private readonly clientId = process.env.FORD_CLIENT_ID || '';
  private readonly clientSecret = process.env.FORD_CLIENT_SECRET || '';
  private readonly apiBaseUrl = 'https://api.mps.ford.com/api';
  private readonly authBaseUrl = 'https://sso.ci.ford.com';
  private readonly applicationId = process.env.FORD_APPLICATION_ID || '';

  // ============================================================================
  // Authentication
  // ============================================================================

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/ev/ford/callback`,
      scope: 'openid access',
      state,
    });

    return `${this.authBaseUrl}/v1.0/endpoint/default/authorize?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<EVAuthResult> {
    try {
      const response = await fetch(`${this.authBaseUrl}/v1.0/endpoint/default/token`, {
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
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/ev/ford/callback`,
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
          manufacturer: 'ford',
          scope: data.scope?.split(' ') || ['access'],
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
      const response = await fetch(`${this.authBaseUrl}/v1.0/endpoint/default/token`, {
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
          manufacturer: 'ford',
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
    const response = await this.makeRequest<{ vehicles: FordVehicle[] }>(
      token,
      '/fordconnect/v3/vehicles'
    );

    if (!response.vehicles) {
      return [];
    }

    // Filter to only EVs and PHEVs
    const evVehicles = response.vehicles.filter(
      v => v.engineType === 'BEV' || v.engineType === 'PHEV'
    );

    return Promise.all(evVehicles.map(v => this.convertVehicle(token, v)));
  }

  private async convertVehicle(token: EVAuthToken, vehicle: FordVehicle): Promise<EVVehicle> {
    // Get detailed status
    let status: FordVehicleStatus | null = null;
    try {
      status = await this.makeRequest<FordVehicleStatus>(
        token,
        `/fordconnect/v3/vehicles/${vehicle.vehicleId}`
      );
    } catch {
      // Status fetch might fail, continue with basic info
    }

    const modelInfo = this.getModelInfo(vehicle.modelName, vehicle.modelYear);

    return {
      id: vehicle.vehicleId,
      vin: vehicle.vin,
      manufacturer: 'ford',
      model: vehicle.modelName,
      year: parseInt(vehicle.modelYear),
      displayName: vehicle.nickName || `${vehicle.modelYear} ${vehicle.modelName}`,
      batteryCapacity: modelInfo.batteryCapacity,
      maxRange: modelInfo.maxRange,
      isOnline: vehicle.tcuEnabled,
      lastSeen: status?.lastRefresh ? new Date(status.lastRefresh) : new Date(),
      features: this.mapCapabilities(vehicle.capabilities),
      metadata: {
        color: vehicle.color,
        engineType: vehicle.engineType,
        tcuEnabled: vehicle.tcuEnabled,
      },
    };
  }

  private getModelInfo(model: string, year: string): { batteryCapacity: number; maxRange: number } {
    const modelLower = model.toLowerCase();
    const modelYear = parseInt(year);

    // Mustang Mach-E
    if (modelLower.includes('mach-e') || modelLower.includes('mache')) {
      if (modelLower.includes('extended') || modelLower.includes('gt')) {
        return { batteryCapacity: 91, maxRange: 312 }; // Extended range
      }
      return { batteryCapacity: 70, maxRange: 247 }; // Standard range
    }

    // F-150 Lightning
    if (modelLower.includes('lightning') || modelLower.includes('f-150')) {
      if (modelLower.includes('extended')) {
        return { batteryCapacity: 131, maxRange: 320 }; // Extended range
      }
      return { batteryCapacity: 98, maxRange: 240 }; // Standard range
    }

    // E-Transit
    if (modelLower.includes('e-transit') || modelLower.includes('etransit')) {
      return { batteryCapacity: 68, maxRange: 126 };
    }

    // Default for unknown models
    return { batteryCapacity: 75, maxRange: 250 };
  }

  private mapCapabilities(capabilities: string[]): EVVehicle['features'] {
    return {
      remoteStart: capabilities.includes('REMOTE_START'),
      climateControl: capabilities.includes('CABIN_CLIMATE'),
      charging: capabilities.includes('EV_CHARGING'),
      location: capabilities.includes('LOCATION'),
      lock: capabilities.includes('DOOR_LOCK'),
      honk: capabilities.includes('HORN_AND_LIGHTS'),
      sentryMode: false, // Ford doesn't have sentry mode
      speedLimit: false,
      valetMode: false,
    };
  }

  // ============================================================================
  // Vehicle State
  // ============================================================================

  async getBatteryState(token: EVAuthToken, vehicleId: string): Promise<BatteryState> {
    const status = await this.makeRequest<FordVehicleStatus>(
      token,
      `/fordconnect/v3/vehicles/${vehicleId}`
    );

    return {
      level: status.batteryFillLevel?.value || 0,
      range: status.elVehDTE?.value || 0,
      rangeUnit: 'miles',
      isCharging: this.isCharging(status.chargingStatus?.value),
      isPluggedIn: status.plugStatus?.value === 'Plugged',
      lastUpdated: new Date(status.batteryFillLevel?.timestamp || Date.now()),
    };
  }

  async getChargingState(token: EVAuthToken, vehicleId: string): Promise<ChargingState> {
    const status = await this.makeRequest<FordVehicleStatus>(
      token,
      `/fordconnect/v3/vehicles/${vehicleId}`
    );

    const isCurrentlyCharging = this.isCharging(status.chargingStatus?.value);

    return {
      status: this.mapChargingStatus(status.chargingStatus?.value),
      isPluggedIn: status.plugStatus?.value === 'Plugged',
      batteryLevel: status.batteryFillLevel?.value || 0,
      chargeRate: status.chargePower,
      chargeRateUnit: 'kW',
      timeToFullCharge: this.calculateTimeToFull(status),
      chargeLimit: 100, // Ford doesn't expose charge limit in API
      scheduledChargingEnabled: false,
      estimatedRange: status.elVehDTE?.value,
      lastUpdated: new Date(status.chargingStatus?.timestamp || Date.now()),
    };
  }

  private isCharging(status?: string): boolean {
    return status === 'ChargingAC' || status === 'ChargingDCFast';
  }

  private mapChargingStatus(status?: string): ChargingState['status'] {
    switch (status) {
      case 'ChargingAC':
      case 'ChargingDCFast':
        return 'charging';
      case 'Complete':
        return 'complete';
      case 'EvseDetected':
        return 'connected';
      case 'Error':
        return 'error';
      case 'NotReady':
      case 'EvseNotDetected':
      default:
        return 'disconnected';
    }
  }

  private calculateTimeToFull(status: FordVehicleStatus): number | undefined {
    if (status.chargeEndTime) {
      const endTime = new Date(status.chargeEndTime).getTime();
      const now = Date.now();
      if (endTime > now) {
        return Math.round((endTime - now) / 60000); // Minutes
      }
    }
    return undefined;
  }

  async getClimateState(token: EVAuthToken, vehicleId: string): Promise<ClimateState> {
    const status = await this.makeRequest<FordVehicleStatus>(
      token,
      `/fordconnect/v3/vehicles/${vehicleId}`
    );

    return {
      isOn: status.remoteStartStatus?.value === 'Running',
      insideTemp: undefined, // Ford doesn't expose cabin temp
      outsideTemp: undefined,
      driverTempSetting: undefined,
      passengerTempSetting: undefined,
      isPreconditioning: status.remoteStartStatus?.value === 'Running',
      lastUpdated: new Date(status.remoteStartStatus?.timestamp || Date.now()),
    };
  }

  async getLocation(token: EVAuthToken, vehicleId: string): Promise<LocationState> {
    const status = await this.makeRequest<FordVehicleStatus>(
      token,
      `/fordconnect/v3/vehicles/${vehicleId}`
    );

    return {
      latitude: status.gps?.latitude || 0,
      longitude: status.gps?.longitude || 0,
      heading: undefined,
      speed: undefined,
      lastUpdated: new Date(status.gps?.timestamp || Date.now()),
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
        error: `Command ${request.command} is not supported for Ford vehicles`,
      };
    }

    try {
      const response = await this.makeRequest<FordCommandResponse>(
        token,
        endpoint.path,
        {
          method: endpoint.method,
          body: endpoint.body,
        }
      );

      // Ford commands are async - poll for status
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

  private getCommandEndpoint(request: EVCommandRequest): { path: string; method: string; body?: object } | null {
    const basePath = `/fordconnect/v3/vehicles/${request.vehicleId}`;

    switch (request.command) {
      case 'lock':
        return { path: `${basePath}/lock`, method: 'POST' };
      case 'unlock':
        return { path: `${basePath}/unlock`, method: 'POST' };
      case 'startCharging':
        return { path: `${basePath}/startCharge`, method: 'POST' };
      case 'stopCharging':
        return { path: `${basePath}/stopCharge`, method: 'POST' };
      case 'startClimate':
        return { path: `${basePath}/startEngine`, method: 'POST' };
      case 'stopClimate':
        return { path: `${basePath}/stopEngine`, method: 'POST' };
      case 'honk':
        return { path: `${basePath}/hornAndLights`, method: 'POST', body: { hornAndLight: true } };
      case 'flash':
        return { path: `${basePath}/hornAndLights`, method: 'POST', body: { hornAndLight: false } };
      case 'refresh':
        return { path: `${basePath}/refresh`, method: 'POST' };
      default:
        return null;
    }
  }

  private async pollCommandStatus(
    token: EVAuthToken,
    vehicleId: string,
    commandId: string,
    maxAttempts = 10
  ): Promise<EVCommandResult> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      try {
        const status = await this.makeRequest<FordCommandResponse>(
          token,
          `/fordconnect/v3/vehicles/${vehicleId}/commandstatus/${commandId}`
        );

        if (status.status === 'SUCCESS') {
          return { success: true, commandId };
        }
        if (status.status === 'FAILED') {
          return { success: false, commandId, error: status.message };
        }
        // QUEUED or INPROGRESS - continue polling
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
  // Charging Stations (BlueOval Charge Network)
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
        `/fordconnect/v3/chargestations?latitude=${latitude}&longitude=${longitude}&radius=${radius}`
      );

      return (response.stations || []).map(station => ({
        id: station.id,
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
        address: station.address,
        network: station.network || 'BlueOval',
        connectors: (station.connectors || []).map((c: any) => ({
          type: c.type,
          power: c.power,
          available: c.available,
        })),
        pricing: station.pricing,
        amenities: station.amenities || [],
        available: station.available ?? true,
        totalStalls: station.totalStalls,
        availableStalls: station.availableStalls,
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
        'Application-Id': this.applicationId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Ford API error: ${response.status}`);
    }

    return response.json();
  }
}

// Register the adapter
registerAdapter('ford', () => new FordAdapter());

export default FordAdapter;
