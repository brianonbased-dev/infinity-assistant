/**
 * EV Manufacturer Adapter Interface
 *
 * Defines the contract for all manufacturer-specific implementations.
 * Replaces 8+ duplicate manufacturer service classes with a single adapter pattern.
 */

import {
  Manufacturer,
  EVAuthConfig,
  EVAuthToken,
  EVAuthResult,
  EVVehicle,
  BatteryState,
  ClimateState,
  VehicleLocation,
  EVCommandRequest,
  EVCommandResult,
  ChargingStation,
  EVError,
  EVErrorCode
} from './types';

// ============================================================================
// Adapter Interface
// ============================================================================

export interface EVManufacturerAdapter {
  /** Manufacturer identifier */
  readonly manufacturer: Manufacturer;

  /** Human-readable name */
  readonly displayName: string;

  /** OAuth/API configuration */
  readonly authConfig: EVAuthConfig;

  // Authentication
  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string;

  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForToken(code: string): Promise<EVAuthResult>;

  /**
   * Refresh an expired token
   */
  refreshToken(refreshToken: string): Promise<EVAuthResult>;

  /**
   * Validate a token is still valid
   */
  validateToken(token: EVAuthToken): Promise<boolean>;

  // Vehicle Management
  /**
   * Get all vehicles for authenticated user
   */
  getVehicles(token: EVAuthToken): Promise<EVVehicle[]>;

  /**
   * Get a specific vehicle by ID
   */
  getVehicle(token: EVAuthToken, vehicleId: string): Promise<EVVehicle | null>;

  /**
   * Wake up a sleeping vehicle
   */
  wakeUpVehicle(token: EVAuthToken, vehicleId: string): Promise<boolean>;

  // Vehicle State
  /**
   * Get battery and charging state
   */
  getBatteryState(token: EVAuthToken, vehicleId: string): Promise<BatteryState>;

  /**
   * Get climate/HVAC state
   */
  getClimateState(token: EVAuthToken, vehicleId: string): Promise<ClimateState>;

  /**
   * Get vehicle location
   */
  getLocation(token: EVAuthToken, vehicleId: string): Promise<VehicleLocation>;

  // Commands
  /**
   * Send a command to the vehicle
   */
  sendCommand(token: EVAuthToken, request: EVCommandRequest): Promise<EVCommandResult>;

  // Charging Stations (if supported by manufacturer API)
  /**
   * Find nearby charging stations
   */
  findChargingStations?(
    token: EVAuthToken,
    latitude: number,
    longitude: number,
    radiusKm: number
  ): Promise<ChargingStation[]>;

  // Error Handling
  /**
   * Transform manufacturer-specific error to standard EVError
   */
  transformError(error: unknown): EVError;
}

// ============================================================================
// Base Adapter Implementation
// ============================================================================

export abstract class BaseEVAdapter implements EVManufacturerAdapter {
  abstract readonly manufacturer: Manufacturer;
  abstract readonly displayName: string;
  abstract readonly authConfig: EVAuthConfig;

  // Default implementations that can be overridden

  getAuthorizationUrl(state: string): string {
    throw new Error(`OAuth not implemented for ${this.manufacturer}`);
  }

  async exchangeCodeForToken(code: string): Promise<EVAuthResult> {
    throw new Error(`OAuth not implemented for ${this.manufacturer}`);
  }

  async refreshToken(refreshToken: string): Promise<EVAuthResult> {
    throw new Error(`Token refresh not implemented for ${this.manufacturer}`);
  }

  async validateToken(token: EVAuthToken): Promise<boolean> {
    return token.expiresAt > new Date();
  }

  abstract getVehicles(token: EVAuthToken): Promise<EVVehicle[]>;

  async getVehicle(token: EVAuthToken, vehicleId: string): Promise<EVVehicle | null> {
    const vehicles = await this.getVehicles(token);
    return vehicles.find(v => v.id === vehicleId) || null;
  }

  async wakeUpVehicle(token: EVAuthToken, vehicleId: string): Promise<boolean> {
    const result = await this.sendCommand(token, {
      command: 'wake_up',
      vehicleId
    });
    return result.success;
  }

  abstract getBatteryState(token: EVAuthToken, vehicleId: string): Promise<BatteryState>;
  abstract getClimateState(token: EVAuthToken, vehicleId: string): Promise<ClimateState>;
  abstract getLocation(token: EVAuthToken, vehicleId: string): Promise<VehicleLocation>;
  abstract sendCommand(token: EVAuthToken, request: EVCommandRequest): Promise<EVCommandResult>;

  findChargingStations?(
    token: EVAuthToken,
    latitude: number,
    longitude: number,
    radiusKm: number
  ): Promise<ChargingStation[]>;

  transformError(error: unknown): EVError {
    if (error instanceof Error) {
      return {
        code: 'API_ERROR',
        message: error.message,
        manufacturer: this.manufacturer,
        retryable: true,
        rawError: error
      };
    }
    return {
      code: 'API_ERROR',
      message: String(error),
      manufacturer: this.manufacturer,
      retryable: true,
      rawError: error
    };
  }

  // Helper methods for subclasses

  protected async makeRequest<T>(
    url: string,
    options: RequestInit,
    token?: EVAuthToken
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw this.createApiError(response.status, errorBody);
    }

    return response.json();
  }

  protected createApiError(statusCode: number, message: string): EVError {
    let code: EVErrorCode = 'API_ERROR';
    let retryable = true;

    switch (statusCode) {
      case 401:
        code = 'AUTH_FAILED';
        retryable = false;
        break;
      case 403:
        code = 'AUTH_EXPIRED';
        retryable = true;
        break;
      case 404:
        code = 'VEHICLE_NOT_FOUND';
        retryable = false;
        break;
      case 408:
        code = 'VEHICLE_ASLEEP';
        retryable = true;
        break;
      case 429:
        code = 'RATE_LIMITED';
        retryable = true;
        break;
      case 503:
        code = 'VEHICLE_OFFLINE';
        retryable = true;
        break;
    }

    return {
      code,
      message,
      manufacturer: this.manufacturer,
      retryable
    };
  }

  protected isTokenExpired(token: EVAuthToken): boolean {
    // Add 5 minute buffer
    const buffer = 5 * 60 * 1000;
    return new Date(token.expiresAt.getTime() - buffer) < new Date();
  }
}

// ============================================================================
// Mock Adapter (For Development/Testing)
// ============================================================================

export class MockEVAdapter extends BaseEVAdapter {
  readonly manufacturer: Manufacturer;
  readonly displayName: string;
  readonly authConfig: EVAuthConfig;

  private mockVehicles: EVVehicle[] = [];

  constructor(manufacturer: Manufacturer, displayName: string) {
    super();
    this.manufacturer = manufacturer;
    this.displayName = displayName;
    this.authConfig = {
      clientId: 'mock-client',
      clientSecret: 'mock-secret'
    };

    // Initialize mock vehicles
    this.mockVehicles = [
      {
        id: `${manufacturer}-vehicle-1`,
        vin: 'MOCK123456789',
        manufacturer,
        model: 'Model X',
        year: 2024,
        displayName: `My ${displayName}`,
        batteryCapacity: 100,
        maxChargingRate: 250,
        isOnline: true,
        lastSeen: new Date(),
        capabilities: [
          'remote_start',
          'climate_control',
          'charging_control',
          'door_lock',
          'location'
        ]
      }
    ];
  }

  getAuthorizationUrl(state: string): string {
    return `https://mock-auth.${this.manufacturer}.com/oauth?state=${state}`;
  }

  async exchangeCodeForToken(code: string): Promise<EVAuthResult> {
    return {
      success: true,
      token: {
        accessToken: `mock-token-${Date.now()}`,
        refreshToken: `mock-refresh-${Date.now()}`,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        tokenType: 'Bearer'
      }
    };
  }

  async refreshToken(refreshToken: string): Promise<EVAuthResult> {
    return this.exchangeCodeForToken('refresh');
  }

  async getVehicles(token: EVAuthToken): Promise<EVVehicle[]> {
    return this.mockVehicles;
  }

  async getBatteryState(token: EVAuthToken, vehicleId: string): Promise<BatteryState> {
    return {
      vehicleId,
      timestamp: new Date(),
      stateOfCharge: 75,
      energyRemaining: 75,
      estimatedRange: 280,
      rangeUnit: 'mi',
      batteryHealth: 98,
      batteryTemp: 25,
      chargingState: {
        isCharging: false,
        isPluggedIn: false,
        chargeLimit: 80
      }
    };
  }

  async getClimateState(token: EVAuthToken, vehicleId: string): Promise<ClimateState> {
    return {
      vehicleId,
      timestamp: new Date(),
      isClimateOn: false,
      insideTemp: 22,
      outsideTemp: 18,
      driverTempSetting: 21,
      passengerTempSetting: 21
    };
  }

  async getLocation(token: EVAuthToken, vehicleId: string): Promise<VehicleLocation> {
    return {
      vehicleId,
      timestamp: new Date(),
      latitude: 37.7749,
      longitude: -122.4194,
      heading: 90,
      speed: 0,
      speedUnit: 'mph',
      address: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
      isHome: true
    };
  }

  async sendCommand(token: EVAuthToken, request: EVCommandRequest): Promise<EVCommandResult> {
    // Simulate command execution
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      success: true,
      command: request.command,
      vehicleId: request.vehicleId,
      timestamp: new Date()
    };
  }

  async findChargingStations(
    token: EVAuthToken,
    latitude: number,
    longitude: number,
    radiusKm: number
  ): Promise<ChargingStation[]> {
    return [
      {
        id: 'station-1',
        name: 'Supercharger - Highway Plaza',
        network: 'tesla_supercharger',
        latitude: latitude + 0.01,
        longitude: longitude + 0.01,
        address: '100 Highway Plaza',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        distance: 2.5,
        distanceUnit: 'mi',
        chargers: [
          {
            id: 'charger-1',
            type: 'supercharger',
            maxPower: 250,
            connectorType: 'tesla',
            status: 'available'
          }
        ],
        totalChargers: 12,
        availableChargers: 8,
        pricing: {
          type: 'per_kwh',
          amount: 0.38,
          currency: 'USD'
        },
        is24Hours: true,
        status: 'available',
        lastUpdated: new Date()
      }
    ];
  }
}

// ============================================================================
// Adapter Factory
// ============================================================================

const adapterRegistry = new Map<Manufacturer, () => EVManufacturerAdapter>();

/**
 * Register a manufacturer adapter
 */
export function registerAdapter(
  manufacturer: Manufacturer,
  factory: () => EVManufacturerAdapter
): void {
  adapterRegistry.set(manufacturer, factory);
}

/**
 * Get adapter for a manufacturer
 */
export function getAdapter(manufacturer: Manufacturer): EVManufacturerAdapter {
  const factory = adapterRegistry.get(manufacturer);
  if (!factory) {
    // Return mock adapter for unregistered manufacturers
    console.warn(`[EV] No adapter registered for ${manufacturer}, using mock`);
    return new MockEVAdapter(manufacturer, manufacturer);
  }
  return factory();
}

/**
 * Check if adapter is registered
 */
export function hasAdapter(manufacturer: Manufacturer): boolean {
  return adapterRegistry.has(manufacturer);
}

/**
 * Get all registered manufacturers
 */
export function getRegisteredManufacturers(): Manufacturer[] {
  return Array.from(adapterRegistry.keys());
}

// Register mock adapters for development
// In production, these would be replaced with real implementations
if (process.env.NODE_ENV !== 'production' || process.env.USE_MOCK_EV === 'true') {
  registerAdapter('tesla', () => new MockEVAdapter('tesla', 'Tesla'));
  registerAdapter('ford', () => new MockEVAdapter('ford', 'Ford'));
  registerAdapter('bmw', () => new MockEVAdapter('bmw', 'BMW'));
  registerAdapter('gm', () => new MockEVAdapter('gm', 'General Motors'));
  registerAdapter('volkswagen', () => new MockEVAdapter('volkswagen', 'Volkswagen'));
  registerAdapter('rivian', () => new MockEVAdapter('rivian', 'Rivian'));
  registerAdapter('hyundai', () => new MockEVAdapter('hyundai', 'Hyundai'));
  registerAdapter('kia', () => new MockEVAdapter('kia', 'Kia'));
}

export default { getAdapter, registerAdapter, hasAdapter, getRegisteredManufacturers };
