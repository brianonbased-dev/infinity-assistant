/**
 * Rivian EV Adapter
 *
 * Implements EVManufacturerAdapter for Rivian vehicles.
 * Supports R1T, R1S, and commercial vehicles.
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
// Rivian API Types
// ============================================================================

interface RivianVehicle {
  id: string;
  vin: string;
  name: string;
  model: 'R1T' | 'R1S' | 'RCV' | 'EDV';
  modelYear: number;
  exteriorColor: string;
  interiorColor: string;
  vehicleState: {
    powerState: 'sleep' | 'standby' | 'driving' | 'charging';
    driveMode: 'conserve' | 'all_purpose' | 'sport' | 'off_road';
    gearStatus: 'park' | 'reverse' | 'neutral' | 'drive';
  };
}

interface RivianVehicleState {
  vehicleId: string;
  timestamp: string;
  batteryLevel: number;
  batteryLimit: number;
  estimatedRange: number;
  chargingState: {
    isCharging: boolean;
    isPluggedIn: boolean;
    chargeRate: number;
    timeToFull: number;
    sessionEnergy: number;
  };
  climateState: {
    cabinTemp: number;
    outsideTemp: number;
    hvacOn: boolean;
    hvacMode: 'heat' | 'cool' | 'auto' | 'off';
    defrostOn: boolean;
    preconditioningEnabled: boolean;
  };
  location: {
    latitude: number;
    longitude: number;
    heading: number;
    speed: number;
    timestamp: string;
  };
  vehicleState: {
    odometer: number;
    locked: boolean;
    windowsOpen: boolean;
    trunkOpen: boolean;
    frunkOpen: boolean;
    gearTunnelOpen: boolean;
    tirePressure: {
      frontLeft: number;
      frontRight: number;
      rearLeft: number;
      rearRight: number;
    };
  };
}

// ============================================================================
// Rivian Adapter Implementation
// ============================================================================

export class RivianAdapter extends BaseEVAdapter {
  readonly manufacturer = 'rivian' as const;

  private readonly clientId = process.env.RIVIAN_CLIENT_ID || '';
  private readonly clientSecret = process.env.RIVIAN_CLIENT_SECRET || '';
  private readonly apiBaseUrl = 'https://rivian.com/api/gql/gateway/graphql';
  private readonly authBaseUrl = 'https://auth.rivianservices.com';

  // ============================================================================
  // Authentication
  // ============================================================================

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/ev/v2/rivian/callback`,
      scope: 'openid offline_access vehicle:all',
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
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/ev/v2/rivian/callback`,
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
          manufacturer: 'rivian',
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
          manufacturer: 'rivian',
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
    const query = `
      query GetVehicles {
        currentUser {
          vehicles {
            id
            vin
            name
            model
            modelYear
            exteriorColor
            interiorColor
            vehicleState {
              powerState
              driveMode
              gearStatus
            }
          }
        }
      }
    `;

    const response = await this.graphqlRequest<{ currentUser: { vehicles: RivianVehicle[] } }>(
      token,
      query
    );

    return response.currentUser.vehicles.map(v => this.convertVehicle(v));
  }

  private convertVehicle(vehicle: RivianVehicle): EVVehicle {
    const modelInfo = this.getModelInfo(vehicle.model, vehicle.modelYear);

    return {
      id: vehicle.id,
      vin: vehicle.vin,
      manufacturer: 'rivian',
      model: vehicle.model,
      year: vehicle.modelYear,
      displayName: vehicle.name || `${vehicle.modelYear} Rivian ${vehicle.model}`,
      batteryCapacity: modelInfo.batteryCapacity,
      maxRange: modelInfo.maxRange,
      isOnline: vehicle.vehicleState.powerState !== 'sleep',
      lastSeen: new Date(),
      features: {
        remoteStart: true,
        climateControl: true,
        charging: true,
        location: true,
        lock: true,
        honk: true,
        sentryMode: true,
        speedLimit: false,
        valetMode: false,
      },
      metadata: {
        exteriorColor: vehicle.exteriorColor,
        interiorColor: vehicle.interiorColor,
        powerState: vehicle.vehicleState.powerState,
        driveMode: vehicle.vehicleState.driveMode,
      },
    };
  }

  private getModelInfo(model: string, year: number): { batteryCapacity: number; maxRange: number } {
    switch (model) {
      case 'R1T':
        if (year >= 2024) return { batteryCapacity: 135, maxRange: 352 }; // Max pack
        return { batteryCapacity: 135, maxRange: 328 };
      case 'R1S':
        if (year >= 2024) return { batteryCapacity: 135, maxRange: 352 };
        return { batteryCapacity: 135, maxRange: 316 };
      case 'RCV':
      case 'EDV':
        return { batteryCapacity: 135, maxRange: 150 }; // Commercial
      default:
        return { batteryCapacity: 135, maxRange: 300 };
    }
  }

  // ============================================================================
  // Vehicle State
  // ============================================================================

  async getBatteryState(token: EVAuthToken, vehicleId: string): Promise<BatteryState> {
    const query = `
      query GetVehicleState($vehicleId: String!) {
        vehicleState(id: $vehicleId) {
          batteryLevel
          batteryLimit
          estimatedRange
          chargingState {
            isCharging
            isPluggedIn
            chargeRate
            timeToFull
          }
        }
      }
    `;

    const response = await this.graphqlRequest<{ vehicleState: RivianVehicleState }>(
      token,
      query,
      { vehicleId }
    );

    const state = response.vehicleState;

    return {
      level: state.batteryLevel,
      range: state.estimatedRange,
      rangeUnit: 'miles',
      isCharging: state.chargingState.isCharging,
      isPluggedIn: state.chargingState.isPluggedIn,
      lastUpdated: new Date(state.timestamp),
    };
  }

  async getChargingState(token: EVAuthToken, vehicleId: string): Promise<ChargingState> {
    const query = `
      query GetChargingState($vehicleId: String!) {
        vehicleState(id: $vehicleId) {
          batteryLevel
          batteryLimit
          estimatedRange
          chargingState {
            isCharging
            isPluggedIn
            chargeRate
            timeToFull
            sessionEnergy
          }
        }
      }
    `;

    const response = await this.graphqlRequest<{ vehicleState: RivianVehicleState }>(
      token,
      query,
      { vehicleId }
    );

    const state = response.vehicleState;

    return {
      status: state.chargingState.isCharging ? 'charging' :
              state.chargingState.isPluggedIn ? 'connected' : 'disconnected',
      isPluggedIn: state.chargingState.isPluggedIn,
      batteryLevel: state.batteryLevel,
      chargeRate: state.chargingState.chargeRate,
      chargeRateUnit: 'kW',
      timeToFullCharge: state.chargingState.timeToFull,
      chargeLimit: state.batteryLimit,
      estimatedRange: state.estimatedRange,
      lastUpdated: new Date(state.timestamp),
    };
  }

  async getClimateState(token: EVAuthToken, vehicleId: string): Promise<ClimateState> {
    const query = `
      query GetClimateState($vehicleId: String!) {
        vehicleState(id: $vehicleId) {
          climateState {
            cabinTemp
            outsideTemp
            hvacOn
            hvacMode
            defrostOn
            preconditioningEnabled
          }
        }
      }
    `;

    const response = await this.graphqlRequest<{ vehicleState: RivianVehicleState }>(
      token,
      query,
      { vehicleId }
    );

    const climate = response.vehicleState.climateState;

    return {
      isOn: climate.hvacOn,
      insideTemp: climate.cabinTemp,
      outsideTemp: climate.outsideTemp,
      isPreconditioning: climate.preconditioningEnabled,
      lastUpdated: new Date(),
    };
  }

  async getLocation(token: EVAuthToken, vehicleId: string): Promise<LocationState> {
    const query = `
      query GetLocation($vehicleId: String!) {
        vehicleState(id: $vehicleId) {
          location {
            latitude
            longitude
            heading
            speed
            timestamp
          }
        }
      }
    `;

    const response = await this.graphqlRequest<{ vehicleState: RivianVehicleState }>(
      token,
      query,
      { vehicleId }
    );

    const loc = response.vehicleState.location;

    return {
      latitude: loc.latitude,
      longitude: loc.longitude,
      heading: loc.heading,
      speed: loc.speed,
      lastUpdated: new Date(loc.timestamp),
    };
  }

  // ============================================================================
  // Commands
  // ============================================================================

  async sendCommand(token: EVAuthToken, request: EVCommandRequest): Promise<EVCommandResult> {
    const mutation = this.getCommandMutation(request);
    if (!mutation) {
      return { success: false, error: `Command ${request.command} not supported for Rivian` };
    }

    try {
      await this.graphqlRequest(token, mutation.query, {
        vehicleId: request.vehicleId,
        ...mutation.variables,
      });

      return { success: true, commandId: `rivian_${Date.now()}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Command failed' };
    }
  }

  private getCommandMutation(request: EVCommandRequest): { query: string; variables?: object } | null {
    switch (request.command) {
      case 'lock':
        return {
          query: `mutation LockVehicle($vehicleId: String!) { lockVehicle(vehicleId: $vehicleId) { success } }`,
        };
      case 'unlock':
        return {
          query: `mutation UnlockVehicle($vehicleId: String!) { unlockVehicle(vehicleId: $vehicleId) { success } }`,
        };
      case 'startCharging':
        return {
          query: `mutation StartCharging($vehicleId: String!) { startCharging(vehicleId: $vehicleId) { success } }`,
        };
      case 'stopCharging':
        return {
          query: `mutation StopCharging($vehicleId: String!) { stopCharging(vehicleId: $vehicleId) { success } }`,
        };
      case 'startClimate':
        return {
          query: `mutation StartClimate($vehicleId: String!) { preconditionVehicle(vehicleId: $vehicleId, enable: true) { success } }`,
        };
      case 'stopClimate':
        return {
          query: `mutation StopClimate($vehicleId: String!) { preconditionVehicle(vehicleId: $vehicleId, enable: false) { success } }`,
        };
      case 'honk':
        return {
          query: `mutation HonkHorn($vehicleId: String!) { honkHorn(vehicleId: $vehicleId) { success } }`,
        };
      case 'flash':
        return {
          query: `mutation FlashLights($vehicleId: String!) { flashLights(vehicleId: $vehicleId) { success } }`,
        };
      case 'setChargeLimit':
        return {
          query: `mutation SetChargeLimit($vehicleId: String!, $limit: Int!) { setChargeLimit(vehicleId: $vehicleId, limit: $limit) { success } }`,
          variables: { limit: request.params?.limit },
        };
      default:
        return null;
    }
  }

  // ============================================================================
  // Charging Stations (Rivian Adventure Network)
  // ============================================================================

  async getNearbyChargingStations(
    token: EVAuthToken,
    latitude: number,
    longitude: number,
    radius: number = 25
  ): Promise<ChargingStation[]> {
    const query = `
      query GetChargingStations($lat: Float!, $lng: Float!, $radius: Float!) {
        chargingStations(latitude: $lat, longitude: $lng, radiusMiles: $radius) {
          id
          name
          latitude
          longitude
          address
          city
          state
          network
          chargers {
            id
            type
            power
            status
          }
          amenities
        }
      }
    `;

    try {
      const response = await this.graphqlRequest<{ chargingStations: any[] }>(
        token,
        query,
        { lat: latitude, lng: longitude, radius }
      );

      return response.chargingStations.map(station => ({
        id: station.id,
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
        address: `${station.address}, ${station.city}, ${station.state}`,
        network: station.network || 'Rivian Adventure Network',
        connectors: station.chargers.map((c: any) => ({
          type: c.type,
          power: c.power,
          available: c.status === 'available',
        })),
        amenities: station.amenities || [],
        available: station.chargers.some((c: any) => c.status === 'available'),
        totalStalls: station.chargers.length,
        availableStalls: station.chargers.filter((c: any) => c.status === 'available').length,
      }));
    } catch {
      return [];
    }
  }

  // ============================================================================
  // GraphQL Helper
  // ============================================================================

  private async graphqlRequest<T>(
    token: EVAuthToken,
    query: string,
    variables?: object
  ): Promise<T> {
    const response = await fetch(this.apiBaseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Rivian API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors?.length > 0) {
      throw new Error(result.errors[0].message);
    }

    return result.data;
  }
}

// Register the adapter
registerAdapter('rivian', () => new RivianAdapter());

export default RivianAdapter;
