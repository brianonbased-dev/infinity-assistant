/**
 * Unified EV Service
 *
 * Single entry point for all EV operations across manufacturers.
 * Replaces 11 separate manufacturer services with one unified service.
 */

import { CacheService, getCache } from '../CacheService';
import { eventBus, createPayload } from '../EventBus';
import { createSingleton } from '../createSingleton';
import {
  ServiceError,
  vehicleNotFound,
  vehicleOffline,
  manufacturerApiError,
  withRetry
} from '../ServiceError';
import {
  Manufacturer,
  EVAuthToken,
  EVAuthResult,
  EVVehicle,
  BatteryState,
  ClimateState,
  VehicleLocation,
  EVCommand,
  EVCommandResult,
  ChargingStation,
  ChargingSchedule,
  ChargingSlot
} from './types';
import {
  EVManufacturerAdapter,
  getAdapter,
  hasAdapter,
  getRegisteredManufacturers
} from './EVManufacturerAdapter';

// ============================================================================
// Types
// ============================================================================

export interface UserVehicleConnection {
  userId: string;
  vehicleId: string;
  manufacturer: Manufacturer;
  token: EVAuthToken;
  vehicle?: EVVehicle;
  isActive: boolean;
  connectedAt: Date;
  lastRefreshed?: Date;
}

export interface EVServiceConfig {
  /** Cache TTL for vehicle data in ms (default: 30s) */
  vehicleCacheTtl: number;
  /** Cache TTL for charging stations in ms (default: 5min) */
  stationCacheTtl: number;
  /** Auto-refresh token before expiry */
  autoRefreshTokens: boolean;
  /** Enable event emissions */
  emitEvents: boolean;
  /** Retry configuration */
  retryConfig: {
    maxRetries: number;
    baseDelay: number;
  };
}

const DEFAULT_CONFIG: EVServiceConfig = {
  vehicleCacheTtl: 30 * 1000,
  stationCacheTtl: 5 * 60 * 1000,
  autoRefreshTokens: true,
  emitEvents: true,
  retryConfig: {
    maxRetries: 3,
    baseDelay: 1000
  }
};

// ============================================================================
// EV Service Implementation
// ============================================================================

class EVServiceImpl {
  private config: EVServiceConfig;
  private connections = new Map<string, UserVehicleConnection>(); // `${userId}:${vehicleId}` -> connection
  private vehicleCache: CacheService<EVVehicle>;
  private batteryCache: CacheService<BatteryState>;
  private stationCache: CacheService<ChargingStation[]>;

  constructor(config: Partial<EVServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize caches
    this.vehicleCache = getCache<EVVehicle>('ev:vehicles', {
      ttl: this.config.vehicleCacheTtl,
      maxSize: 500
    });
    this.batteryCache = getCache<BatteryState>('ev:battery', {
      ttl: this.config.vehicleCacheTtl,
      maxSize: 500
    });
    this.stationCache = getCache<ChargingStation[]>('ev:stations', {
      ttl: this.config.stationCacheTtl,
      maxSize: 100
    });
  }

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  /**
   * Get OAuth URL for a manufacturer
   */
  getAuthorizationUrl(manufacturer: Manufacturer, state: string): string {
    const adapter = getAdapter(manufacturer);
    return adapter.getAuthorizationUrl(state);
  }

  /**
   * Complete OAuth flow with authorization code
   */
  async completeOAuth(
    manufacturer: Manufacturer,
    code: string,
    userId: string
  ): Promise<EVAuthResult> {
    const adapter = getAdapter(manufacturer);
    const result = await adapter.exchangeCodeForToken(code);

    if (result.success && result.token) {
      // Store initial connection (without vehicle yet)
      const connectionKey = `${userId}:pending:${manufacturer}`;
      this.connections.set(connectionKey, {
        userId,
        vehicleId: 'pending',
        manufacturer,
        token: result.token,
        isActive: true,
        connectedAt: new Date()
      });
    }

    return result;
  }

  /**
   * Refresh an expired token
   */
  async refreshToken(
    userId: string,
    vehicleId: string
  ): Promise<EVAuthResult> {
    const connection = this.getConnection(userId, vehicleId);
    if (!connection) {
      throw vehicleNotFound(vehicleId);
    }

    if (!connection.token.refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    const adapter = getAdapter(connection.manufacturer);
    const result = await adapter.refreshToken(connection.token.refreshToken);

    if (result.success && result.token) {
      connection.token = result.token;
      connection.lastRefreshed = new Date();
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Vehicle Management
  // ---------------------------------------------------------------------------

  /**
   * Get all vehicles for a user across all connected manufacturers
   */
  async getUserVehicles(userId: string): Promise<EVVehicle[]> {
    const vehicles: EVVehicle[] = [];
    const connections = this.getUserConnections(userId);

    for (const connection of connections) {
      try {
        const adapter = getAdapter(connection.manufacturer);
        const token = await this.ensureValidToken(connection);
        const manufacturerVehicles = await adapter.getVehicles(token);

        vehicles.push(...manufacturerVehicles);

        // Update connections with vehicle info
        for (const vehicle of manufacturerVehicles) {
          const key = `${userId}:${vehicle.id}`;
          this.connections.set(key, {
            ...connection,
            vehicleId: vehicle.id,
            vehicle
          });
        }
      } catch (error) {
        console.error(`[EV] Failed to get vehicles from ${connection.manufacturer}:`, error);
      }
    }

    return vehicles;
  }

  /**
   * Get a specific vehicle
   */
  async getVehicle(userId: string, vehicleId: string): Promise<EVVehicle> {
    // Check cache first
    const cached = this.vehicleCache.get(`${userId}:${vehicleId}`);
    if (cached) return cached;

    const connection = this.getConnection(userId, vehicleId);
    if (!connection) {
      throw vehicleNotFound(vehicleId);
    }

    const adapter = getAdapter(connection.manufacturer);
    const token = await this.ensureValidToken(connection);
    const vehicle = await adapter.getVehicle(token, vehicleId);

    if (!vehicle) {
      throw vehicleNotFound(vehicleId);
    }

    this.vehicleCache.set(`${userId}:${vehicleId}`, vehicle);
    return vehicle;
  }

  /**
   * Wake up a sleeping vehicle
   */
  async wakeUpVehicle(userId: string, vehicleId: string): Promise<boolean> {
    const connection = this.getConnection(userId, vehicleId);
    if (!connection) {
      throw vehicleNotFound(vehicleId);
    }

    const adapter = getAdapter(connection.manufacturer);
    const token = await this.ensureValidToken(connection);

    return withRetry(
      () => adapter.wakeUpVehicle(token, vehicleId),
      {
        maxRetries: this.config.retryConfig.maxRetries,
        baseDelay: this.config.retryConfig.baseDelay,
        onRetry: (err, attempt) => {
          console.log(`[EV] Wake up retry ${attempt} for ${vehicleId}:`, err.message);
        }
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Vehicle State
  // ---------------------------------------------------------------------------

  /**
   * Get battery and charging state
   */
  async getBatteryState(userId: string, vehicleId: string): Promise<BatteryState> {
    // Check cache
    const cached = this.batteryCache.get(`${userId}:${vehicleId}`);
    if (cached) return cached;

    const connection = this.getConnection(userId, vehicleId);
    if (!connection) {
      throw vehicleNotFound(vehicleId);
    }

    const adapter = getAdapter(connection.manufacturer);
    const token = await this.ensureValidToken(connection);
    const state = await adapter.getBatteryState(token, vehicleId);

    this.batteryCache.set(`${userId}:${vehicleId}`, state);

    // Emit event
    if (this.config.emitEvents) {
      eventBus.emit('vehicle.status_updated', createPayload('EVService', {
        vehicleId,
        userId,
        manufacturer: connection.manufacturer
      }));
    }

    return state;
  }

  /**
   * Get climate state
   */
  async getClimateState(userId: string, vehicleId: string): Promise<ClimateState> {
    const connection = this.getConnection(userId, vehicleId);
    if (!connection) {
      throw vehicleNotFound(vehicleId);
    }

    const adapter = getAdapter(connection.manufacturer);
    const token = await this.ensureValidToken(connection);
    return adapter.getClimateState(token, vehicleId);
  }

  /**
   * Get vehicle location
   */
  async getLocation(userId: string, vehicleId: string): Promise<VehicleLocation> {
    const connection = this.getConnection(userId, vehicleId);
    if (!connection) {
      throw vehicleNotFound(vehicleId);
    }

    const adapter = getAdapter(connection.manufacturer);
    const token = await this.ensureValidToken(connection);
    return adapter.getLocation(token, vehicleId);
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  /**
   * Send a command to a vehicle
   */
  async sendCommand(
    userId: string,
    vehicleId: string,
    command: EVCommand,
    params?: Record<string, unknown>
  ): Promise<EVCommandResult> {
    const connection = this.getConnection(userId, vehicleId);
    if (!connection) {
      throw vehicleNotFound(vehicleId);
    }

    const adapter = getAdapter(connection.manufacturer);
    const token = await this.ensureValidToken(connection);

    // Emit command sent event
    if (this.config.emitEvents) {
      eventBus.emit('vehicle.command_sent', createPayload('EVService', {
        vehicleId,
        userId,
        manufacturer: connection.manufacturer
      }));
    }

    const result = await withRetry(
      () => adapter.sendCommand(token, { command, vehicleId, params }),
      {
        maxRetries: command === 'wake_up' ? 5 : this.config.retryConfig.maxRetries,
        baseDelay: this.config.retryConfig.baseDelay
      }
    );

    // Emit command completed event
    if (this.config.emitEvents) {
      eventBus.emit('vehicle.command_completed', createPayload('EVService', {
        vehicleId,
        userId,
        manufacturer: connection.manufacturer
      }));
    }

    // Invalidate caches after state-changing commands
    if (['start_charging', 'stop_charging', 'set_charge_limit', 'climate_on', 'climate_off'].includes(command)) {
      this.batteryCache.delete(`${userId}:${vehicleId}`);
    }

    return result;
  }

  // Convenience command methods
  async startCharging(userId: string, vehicleId: string): Promise<EVCommandResult> {
    const result = await this.sendCommand(userId, vehicleId, 'start_charging');

    if (result.success && this.config.emitEvents) {
      const battery = await this.getBatteryState(userId, vehicleId);
      eventBus.emit('charging.started', createPayload('EVService', {
        vehicleId,
        userId,
        batteryPercent: battery.stateOfCharge,
        chargeRate: battery.chargingState.chargeRate
      }));
    }

    return result;
  }

  async stopCharging(userId: string, vehicleId: string): Promise<EVCommandResult> {
    const result = await this.sendCommand(userId, vehicleId, 'stop_charging');

    if (result.success && this.config.emitEvents) {
      eventBus.emit('charging.stopped', createPayload('EVService', {
        vehicleId,
        userId,
        batteryPercent: 0 // Will be updated
      }));
    }

    return result;
  }

  async setChargeLimit(userId: string, vehicleId: string, limit: number): Promise<EVCommandResult> {
    return this.sendCommand(userId, vehicleId, 'set_charge_limit', { limit });
  }

  async setClimate(userId: string, vehicleId: string, on: boolean, temp?: number): Promise<EVCommandResult> {
    const command = on ? 'climate_on' : 'climate_off';
    return this.sendCommand(userId, vehicleId, command, temp ? { temperature: temp } : undefined);
  }

  async lockDoors(userId: string, vehicleId: string): Promise<EVCommandResult> {
    return this.sendCommand(userId, vehicleId, 'lock_doors');
  }

  async unlockDoors(userId: string, vehicleId: string): Promise<EVCommandResult> {
    return this.sendCommand(userId, vehicleId, 'unlock_doors');
  }

  // ---------------------------------------------------------------------------
  // Charging Stations
  // ---------------------------------------------------------------------------

  /**
   * Find nearby charging stations
   */
  async findChargingStations(
    userId: string,
    vehicleId: string,
    latitude: number,
    longitude: number,
    radiusKm: number = 25
  ): Promise<ChargingStation[]> {
    const cacheKey = `${latitude.toFixed(3)}:${longitude.toFixed(3)}:${radiusKm}`;
    const cached = this.stationCache.get(cacheKey);
    if (cached) return cached;

    const connection = this.getConnection(userId, vehicleId);
    if (!connection) {
      throw vehicleNotFound(vehicleId);
    }

    const adapter = getAdapter(connection.manufacturer);
    const token = await this.ensureValidToken(connection);

    if (!adapter.findChargingStations) {
      // Manufacturer doesn't support station lookup, return empty
      return [];
    }

    const stations = await adapter.findChargingStations(token, latitude, longitude, radiusKm);
    this.stationCache.set(cacheKey, stations);

    return stations;
  }

  // ---------------------------------------------------------------------------
  // Charging Optimization
  // ---------------------------------------------------------------------------

  /**
   * Generate optimal charging schedule
   */
  async generateChargingSchedule(
    userId: string,
    vehicleId: string,
    options: {
      targetSoC: number;
      readyBy?: Date;
      minimizeCost?: boolean;
      useGridPricing?: boolean;
    }
  ): Promise<ChargingSchedule> {
    const battery = await this.getBatteryState(userId, vehicleId);
    const connection = this.getConnection(userId, vehicleId);

    if (!connection?.vehicle) {
      throw vehicleNotFound(vehicleId);
    }

    const currentSoC = battery.stateOfCharge;
    const targetSoC = Math.min(options.targetSoC, 100);
    const energyNeeded = ((targetSoC - currentSoC) / 100) * connection.vehicle.batteryCapacity;

    // Simple scheduling: charge during off-peak hours if cost optimization enabled
    const now = new Date();
    const readyBy = options.readyBy || new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours default

    const slots: ChargingSlot[] = [];

    if (options.minimizeCost && options.useGridPricing) {
      // Off-peak: 11pm - 7am (simplified)
      const offPeakStart = new Date(now);
      offPeakStart.setHours(23, 0, 0, 0);
      if (offPeakStart < now) {
        offPeakStart.setDate(offPeakStart.getDate() + 1);
      }

      const offPeakEnd = new Date(offPeakStart);
      offPeakEnd.setHours(7, 0, 0, 0);
      offPeakEnd.setDate(offPeakEnd.getDate() + 1);

      // Calculate charging duration at max rate
      const maxRate = Math.min(connection.vehicle.maxChargingRate, 11); // Assume home charging max 11kW
      const hoursNeeded = energyNeeded / maxRate;
      const msNeeded = hoursNeeded * 60 * 60 * 1000;

      slots.push({
        startTime: offPeakStart,
        endTime: new Date(Math.min(offPeakStart.getTime() + msNeeded, offPeakEnd.getTime())),
        targetPower: maxRate,
        pricePerKwh: 0.08, // Off-peak rate
        isOffPeak: true
      });
    } else {
      // Immediate charging
      const maxRate = Math.min(connection.vehicle.maxChargingRate, 11);
      const hoursNeeded = energyNeeded / maxRate;
      const msNeeded = hoursNeeded * 60 * 60 * 1000;

      slots.push({
        startTime: now,
        endTime: new Date(now.getTime() + msNeeded),
        targetPower: maxRate,
        pricePerKwh: 0.15
      });
    }

    const estimatedCost = slots.reduce((sum, slot) => {
      const hours = (slot.endTime.getTime() - slot.startTime.getTime()) / (60 * 60 * 1000);
      return sum + hours * slot.targetPower * (slot.pricePerKwh || 0.15);
    }, 0);

    return {
      vehicleId,
      slots,
      targetSoC,
      readyBy,
      estimatedCost,
      costSavings: options.minimizeCost ? estimatedCost * 0.3 : 0, // ~30% savings with off-peak
      isGridFriendly: options.minimizeCost
    };
  }

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  /**
   * Add a vehicle connection
   */
  addConnection(connection: UserVehicleConnection): void {
    const key = `${connection.userId}:${connection.vehicleId}`;
    this.connections.set(key, connection);

    if (this.config.emitEvents) {
      eventBus.emit('vehicle.connected', createPayload('EVService', {
        vehicleId: connection.vehicleId,
        userId: connection.userId,
        manufacturer: connection.manufacturer
      }));
    }
  }

  /**
   * Remove a vehicle connection
   */
  removeConnection(userId: string, vehicleId: string): boolean {
    const key = `${userId}:${vehicleId}`;
    const connection = this.connections.get(key);

    if (connection && this.config.emitEvents) {
      eventBus.emit('vehicle.disconnected', createPayload('EVService', {
        vehicleId,
        userId,
        manufacturer: connection.manufacturer
      }));
    }

    this.vehicleCache.delete(key);
    this.batteryCache.delete(key);

    return this.connections.delete(key);
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): UserVehicleConnection[] {
    const connections: UserVehicleConnection[] = [];
    for (const [key, connection] of this.connections) {
      if (key.startsWith(`${userId}:`)) {
        connections.push(connection);
      }
    }
    return connections;
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Get supported manufacturers
   */
  getSupportedManufacturers(): Manufacturer[] {
    return getRegisteredManufacturers();
  }

  /**
   * Check if manufacturer is supported
   */
  isManufacturerSupported(manufacturer: Manufacturer): boolean {
    return hasAdapter(manufacturer);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): Record<string, unknown> {
    return {
      vehicles: this.vehicleCache.getStats(),
      battery: this.batteryCache.getStats(),
      stations: this.stationCache.getStats()
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.vehicleCache.clear();
    this.batteryCache.clear();
    this.stationCache.clear();
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private getConnection(userId: string, vehicleId: string): UserVehicleConnection | undefined {
    return this.connections.get(`${userId}:${vehicleId}`);
  }

  private async ensureValidToken(connection: UserVehicleConnection): Promise<EVAuthToken> {
    if (this.config.autoRefreshTokens && this.isTokenExpiringSoon(connection.token)) {
      const result = await this.refreshToken(connection.userId, connection.vehicleId);
      if (result.success && result.token) {
        return result.token;
      }
    }
    return connection.token;
  }

  private isTokenExpiringSoon(token: EVAuthToken): boolean {
    const buffer = 5 * 60 * 1000; // 5 minutes
    return new Date(token.expiresAt.getTime() - buffer) < new Date();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const getEVService = createSingleton(
  () => new EVServiceImpl(),
  { name: 'EVService', logging: true }
);

// Default export
export const evService = getEVService();

export default evService;
