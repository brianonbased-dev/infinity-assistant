/**
 * BMW EV Adapter
 *
 * Implements EVManufacturerAdapter for BMW/MINI vehicles using BMW Connected Drive API.
 * Supports i4, iX, i7, iX1, iX3, MINI Cooper SE, etc.
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
// BMW API Types
// ============================================================================

interface BMWVehicle {
  vin: string;
  model: string;
  year: number;
  brand: 'BMW' | 'MINI';
  bodyType: string;
  color: string;
  driveTrain: 'BEV' | 'PHEV' | 'MHEV' | 'CONV';
  hasAlarmSystem: boolean;
  capabilities: {
    isRemoteServicesBookingRequired: boolean;
    isRemoteServicesActivationRequired: boolean;
    lock: boolean;
    unlock: boolean;
    lights: boolean;
    horn: boolean;
    climateNow: boolean;
    sendPoi: boolean;
    vehicleFinder: boolean;
    chargingControl: boolean;
    rangeMap: boolean;
  };
  telematicsUnit?: {
    state: string;
    connectionStatus: string;
  };
}

interface BMWVehicleState {
  vin: string;
  timestamp: string;
  state: {
    electricChargingState?: {
      chargingLevelPercent: number;
      range: number;
      isChargerConnected: boolean;
      chargingStatus: 'NOT_CHARGING' | 'CHARGING' | 'FULLY_CHARGED' | 'WAITING_FOR_CHARGING' | 'TARGET_REACHED' | 'ERROR';
      chargingTarget: number;
      remainingChargingMinutes?: number;
      chargeRate?: {
        value: number;
        unit: string;
      };
    };
    combustionFuelLevel?: {
      percent: number;
      range: number;
    };
    currentMileage: {
      mileage: number;
      units: string;
    };
    location?: {
      coordinates: {
        latitude: number;
        longitude: number;
      };
      heading: number;
      address: {
        formatted: string;
      };
    };
    climateControl?: {
      activity: 'INACTIVE' | 'HEATING' | 'COOLING' | 'VENTILATING' | 'PRECONDITIONING';
    };
    doorsState: {
      combinedSecurityState: 'LOCKED' | 'UNLOCKED' | 'SECURED' | 'SELECTIVLY_LOCKED';
      leftFront: 'OPEN' | 'CLOSED';
      rightFront: 'OPEN' | 'CLOSED';
      leftRear: 'OPEN' | 'CLOSED';
      rightRear: 'OPEN' | 'CLOSED';
      trunk: 'OPEN' | 'CLOSED';
      hood: 'OPEN' | 'CLOSED';
    };
    windowsState: {
      combinedState: 'OPEN' | 'CLOSED' | 'INTERMEDIATE';
    };
    roofState?: {
      roofState: 'OPEN' | 'CLOSED' | 'INTERMEDIATE';
    };
    checkControlMessages: Array<{
      type: string;
      severity: string;
      description: string;
    }>;
  };
}

interface BMWCommandResponse {
  eventId: string;
  creationTime: string;
  eventStatus: 'PENDING' | 'DELIVERED' | 'EXECUTED' | 'ERROR' | 'TIMEOUT';
}

// ============================================================================
// BMW Adapter Implementation
// ============================================================================

export class BMWAdapter extends BaseEVAdapter {
  readonly manufacturer = 'bmw' as const;

  private readonly clientId = process.env.BMW_CLIENT_ID || '';
  private readonly clientSecret = process.env.BMW_CLIENT_SECRET || '';
  private readonly apiBaseUrl = 'https://cocoapi.bmwgroup.com';
  private readonly authBaseUrl = 'https://customer.bmwgroup.com/gcdm';

  // BMW regions
  private readonly regions = {
    row: 'cocoapi.bmwgroup.com', // Rest of World
    us: 'cocoapi.bmwgroup.us',   // North America
    cn: 'myprofile.bmw.com.cn',  // China
  };

  // ============================================================================
  // Authentication
  // ============================================================================

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/ev/bmw/callback`,
      scope: 'openid profile vehicle_data remote_services',
      state,
    });

    return `${this.authBaseUrl}/oauth/authenticate?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<EVAuthResult> {
    try {
      const response = await fetch(`${this.authBaseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/ev/bmw/callback`,
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
          manufacturer: 'bmw',
          scope: data.scope?.split(' ') || ['vehicle_data', 'remote_services'],
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
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
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
          manufacturer: 'bmw',
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
    const response = await this.makeRequest<BMWVehicle[]>(
      token,
      '/eadrax-vcs/v4/vehicles'
    );

    if (!Array.isArray(response)) {
      return [];
    }

    // Filter to EVs and PHEVs
    const evVehicles = response.filter(
      v => v.driveTrain === 'BEV' || v.driveTrain === 'PHEV'
    );

    return Promise.all(evVehicles.map(v => this.convertVehicle(token, v)));
  }

  private async convertVehicle(token: EVAuthToken, vehicle: BMWVehicle): Promise<EVVehicle> {
    // Get current state
    let state: BMWVehicleState | null = null;
    try {
      state = await this.makeRequest<BMWVehicleState>(
        token,
        `/eadrax-vcs/v4/vehicles/${vehicle.vin}/state`
      );
    } catch {
      // State fetch might fail
    }

    const modelInfo = this.getModelInfo(vehicle.model, vehicle.year, vehicle.brand);

    return {
      id: vehicle.vin,
      vin: vehicle.vin,
      manufacturer: vehicle.brand.toLowerCase() === 'mini' ? 'other' : 'bmw',
      model: vehicle.model,
      year: vehicle.year,
      displayName: `${vehicle.year} ${vehicle.brand} ${vehicle.model}`,
      batteryCapacity: modelInfo.batteryCapacity,
      maxRange: modelInfo.maxRange,
      isOnline: vehicle.telematicsUnit?.connectionStatus === 'CONNECTED',
      lastSeen: state?.timestamp ? new Date(state.timestamp) : new Date(),
      features: {
        remoteStart: false, // BMW EVs don't have traditional remote start
        climateControl: vehicle.capabilities.climateNow,
        charging: vehicle.capabilities.chargingControl,
        location: vehicle.capabilities.vehicleFinder,
        lock: vehicle.capabilities.lock,
        honk: vehicle.capabilities.horn,
        sentryMode: false,
        speedLimit: false,
        valetMode: false,
      },
      metadata: {
        brand: vehicle.brand,
        bodyType: vehicle.bodyType,
        color: vehicle.color,
        driveTrain: vehicle.driveTrain,
        hasAlarm: vehicle.hasAlarmSystem,
        mileage: state?.state.currentMileage?.mileage,
      },
    };
  }

  private getModelInfo(model: string, year: number, brand: string): { batteryCapacity: number; maxRange: number } {
    const modelLower = model.toLowerCase();

    // BMW Models
    if (brand === 'BMW') {
      // i4
      if (modelLower.includes('i4')) {
        if (modelLower.includes('edrive35')) return { batteryCapacity: 66, maxRange: 270 };
        if (modelLower.includes('edrive40')) return { batteryCapacity: 84, maxRange: 301 };
        if (modelLower.includes('m50')) return { batteryCapacity: 84, maxRange: 270 };
        return { batteryCapacity: 84, maxRange: 301 };
      }

      // iX
      if (modelLower.includes('ix')) {
        if (modelLower.includes('xdrive40')) return { batteryCapacity: 77, maxRange: 324 };
        if (modelLower.includes('xdrive50')) return { batteryCapacity: 112, maxRange: 380 };
        if (modelLower.includes('m60')) return { batteryCapacity: 112, maxRange: 357 };
        return { batteryCapacity: 112, maxRange: 380 };
      }

      // i7
      if (modelLower.includes('i7')) {
        if (modelLower.includes('edrive50')) return { batteryCapacity: 102, maxRange: 318 };
        if (modelLower.includes('xdrive60')) return { batteryCapacity: 102, maxRange: 310 };
        if (modelLower.includes('m70')) return { batteryCapacity: 102, maxRange: 295 };
        return { batteryCapacity: 102, maxRange: 318 };
      }

      // iX1
      if (modelLower.includes('ix1')) {
        return { batteryCapacity: 65, maxRange: 272 };
      }

      // iX3
      if (modelLower.includes('ix3')) {
        return { batteryCapacity: 80, maxRange: 285 };
      }

      // i5
      if (modelLower.includes('i5')) {
        if (modelLower.includes('edrive40')) return { batteryCapacity: 84, maxRange: 295 };
        if (modelLower.includes('m60')) return { batteryCapacity: 84, maxRange: 256 };
        return { batteryCapacity: 84, maxRange: 295 };
      }
    }

    // MINI Models
    if (brand === 'MINI') {
      if (modelLower.includes('cooper se') || modelLower.includes('electric')) {
        if (year >= 2024) return { batteryCapacity: 54, maxRange: 250 }; // New gen
        return { batteryCapacity: 33, maxRange: 114 }; // Old gen
      }
      if (modelLower.includes('countryman')) {
        return { batteryCapacity: 65, maxRange: 250 };
      }
    }

    // Default
    return { batteryCapacity: 70, maxRange: 250 };
  }

  // ============================================================================
  // Vehicle State
  // ============================================================================

  async getBatteryState(token: EVAuthToken, vehicleId: string): Promise<BatteryState> {
    const state = await this.makeRequest<BMWVehicleState>(
      token,
      `/eadrax-vcs/v4/vehicles/${vehicleId}/state`
    );

    const charging = state.state.electricChargingState;

    return {
      level: charging?.chargingLevelPercent || 0,
      range: charging?.range || 0,
      rangeUnit: 'miles',
      isCharging: charging?.chargingStatus === 'CHARGING',
      isPluggedIn: charging?.isChargerConnected || false,
      lastUpdated: new Date(state.timestamp),
    };
  }

  async getChargingState(token: EVAuthToken, vehicleId: string): Promise<ChargingState> {
    const state = await this.makeRequest<BMWVehicleState>(
      token,
      `/eadrax-vcs/v4/vehicles/${vehicleId}/state`
    );

    const charging = state.state.electricChargingState;

    return {
      status: this.mapChargingStatus(charging?.chargingStatus),
      isPluggedIn: charging?.isChargerConnected || false,
      batteryLevel: charging?.chargingLevelPercent || 0,
      chargeRate: charging?.chargeRate?.value,
      chargeRateUnit: charging?.chargeRate?.unit || 'kW',
      timeToFullCharge: charging?.remainingChargingMinutes,
      chargeLimit: charging?.chargingTarget,
      scheduledChargingEnabled: false,
      estimatedRange: charging?.range,
      lastUpdated: new Date(state.timestamp),
    };
  }

  private mapChargingStatus(status?: string): ChargingState['status'] {
    switch (status) {
      case 'CHARGING':
        return 'charging';
      case 'FULLY_CHARGED':
      case 'TARGET_REACHED':
        return 'complete';
      case 'WAITING_FOR_CHARGING':
        return 'scheduled';
      case 'ERROR':
        return 'error';
      case 'NOT_CHARGING':
      default:
        return 'disconnected';
    }
  }

  async getClimateState(token: EVAuthToken, vehicleId: string): Promise<ClimateState> {
    const state = await this.makeRequest<BMWVehicleState>(
      token,
      `/eadrax-vcs/v4/vehicles/${vehicleId}/state`
    );

    const climate = state.state.climateControl;

    return {
      isOn: climate?.activity !== 'INACTIVE',
      insideTemp: undefined, // BMW API doesn't expose temperatures
      outsideTemp: undefined,
      driverTempSetting: undefined,
      passengerTempSetting: undefined,
      isPreconditioning: climate?.activity === 'PRECONDITIONING',
      lastUpdated: new Date(state.timestamp),
    };
  }

  async getLocation(token: EVAuthToken, vehicleId: string): Promise<LocationState> {
    const state = await this.makeRequest<BMWVehicleState>(
      token,
      `/eadrax-vcs/v4/vehicles/${vehicleId}/state`
    );

    const location = state.state.location;

    return {
      latitude: location?.coordinates?.latitude || 0,
      longitude: location?.coordinates?.longitude || 0,
      heading: location?.heading,
      speed: undefined,
      address: location?.address?.formatted,
      lastUpdated: new Date(state.timestamp),
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
        error: `Command ${request.command} is not supported for BMW vehicles`,
      };
    }

    try {
      const response = await this.makeRequest<BMWCommandResponse>(
        token,
        endpoint.path,
        {
          method: 'POST',
          body: endpoint.body,
        }
      );

      // Poll for command completion
      if (response.eventId) {
        return await this.pollCommandStatus(token, request.vehicleId, response.eventId);
      }

      return {
        success: response.eventStatus === 'EXECUTED',
        commandId: response.eventId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command failed',
      };
    }
  }

  private getCommandEndpoint(request: EVCommandRequest): { path: string; body?: object } | null {
    const basePath = `/eadrax-vrccs/v3/vehicles/${request.vehicleId}`;

    switch (request.command) {
      case 'lock':
        return { path: `${basePath}/remote-commands/lock-doors` };
      case 'unlock':
        return { path: `${basePath}/remote-commands/unlock-doors` };
      case 'startClimate':
        return { path: `${basePath}/remote-commands/climate-now` };
      case 'stopClimate':
        return { path: `${basePath}/remote-commands/climate-stop` };
      case 'startCharging':
        return { path: `${basePath}/remote-commands/charge-now` };
      case 'stopCharging':
        return { path: `${basePath}/remote-commands/charge-stop` };
      case 'honk':
        return { path: `${basePath}/remote-commands/horn-blow` };
      case 'flash':
        return { path: `${basePath}/remote-commands/light-flash` };
      case 'setChargeLimit':
        return {
          path: `${basePath}/remote-commands/charging-settings`,
          body: { targetSoc: request.params?.limit },
        };
      default:
        return null;
    }
  }

  private async pollCommandStatus(
    token: EVAuthToken,
    vehicleId: string,
    eventId: string,
    maxAttempts = 15
  ): Promise<EVCommandResult> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const status = await this.makeRequest<BMWCommandResponse>(
          token,
          `/eadrax-vrccs/v3/vehicles/${vehicleId}/remote-commands/event/${eventId}`
        );

        if (status.eventStatus === 'EXECUTED') {
          return { success: true, commandId: eventId };
        }
        if (status.eventStatus === 'ERROR' || status.eventStatus === 'TIMEOUT') {
          return { success: false, commandId: eventId, error: 'Command failed' };
        }
      } catch {
        // Continue polling
      }
    }

    return {
      success: false,
      commandId: eventId,
      error: 'Command timed out',
    };
  }

  // ============================================================================
  // Charging Stations (ChargeNow)
  // ============================================================================

  async getNearbyChargingStations(
    token: EVAuthToken,
    latitude: number,
    longitude: number,
    radius: number = 25
  ): Promise<ChargingStation[]> {
    try {
      const response = await this.makeRequest<{ chargingStations: any[] }>(
        token,
        `/eadrax-poc/v1/charging-stations?lat=${latitude}&lon=${longitude}&radius=${radius * 1.6}` // Convert miles to km
      );

      return (response.chargingStations || []).map(station => ({
        id: station.id,
        name: station.name,
        latitude: station.location.coordinates.latitude,
        longitude: station.location.coordinates.longitude,
        address: station.address?.formatted,
        network: station.operator || 'ChargeNow',
        connectors: (station.evses || []).flatMap((evse: any) =>
          (evse.connectors || []).map((c: any) => ({
            type: this.mapConnectorType(c.standard),
            power: c.maxElectricPower,
            available: evse.status === 'AVAILABLE',
          }))
        ),
        pricing: station.pricing,
        amenities: station.amenities || [],
        available: station.evses?.some((e: any) => e.status === 'AVAILABLE') ?? true,
        totalStalls: station.evses?.length,
        availableStalls: station.evses?.filter((e: any) => e.status === 'AVAILABLE').length,
      }));
    } catch {
      return [];
    }
  }

  private mapConnectorType(standard?: string): string {
    switch (standard) {
      case 'IEC_62196_T2':
        return 'Type 2';
      case 'IEC_62196_T2_COMBO':
        return 'CCS';
      case 'CHADEMO':
        return 'CHAdeMO';
      case 'IEC_62196_T1':
        return 'Type 1';
      default:
        return standard || 'Unknown';
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
        'x-user-agent': 'android(v1.07_20200330);bmw;1.7.0(11152)',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `BMW API error: ${response.status}`);
    }

    return response.json();
  }
}

// Register the adapter
registerAdapter('bmw', () => new BMWAdapter());

export default BMWAdapter;
