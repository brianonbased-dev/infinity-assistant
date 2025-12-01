/**
 * EV Optimization Service V2
 *
 * Refactored to use shared lib utilities:
 * - CacheService instead of manual Map caches
 * - EventBus for cross-service events
 * - ServiceError for standardized errors
 * - createSingleton for singleton pattern
 * - Unified EV module for manufacturer interactions
 *
 * This replaces the original EVOptimizationService with cleaner architecture.
 */

import { getCache, CacheService } from '@/lib/CacheService';
import { eventBus, createPayload } from '@/lib/EventBus';
import { createSingleton } from '@/lib/createSingleton';
import {
  ServiceError,
  vehicleNotFound,
  externalServiceError,
  withRetry
} from '@/lib/ServiceError';
import { evService, EVVehicle, BatteryState, ChargingSchedule } from '@/lib/EV';

// ============================================================================
// Types (simplified from original 40+ types)
// ============================================================================

export interface OptimizationConfig {
  enableV2G: boolean;
  enableSmartScheduling: boolean;
  defaultTargetSoC: number;
  offPeakStartHour: number;
  offPeakEndHour: number;
}

export interface WeatherConditions {
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  visibility: number;
}

export interface GridStatus {
  regionId: string;
  pricePerKwh: number;
  carbonIntensity: number;
  isPeakHour: boolean;
  renewablePercent: number;
}

export interface RangePrediction {
  vehicleId: string;
  currentRange: number;
  predictedRange: number;
  confidence: number;
  factors: {
    weather: number;
    traffic: number;
    driving: number;
    battery: number;
  };
}

export interface ChargingRecommendation {
  vehicleId: string;
  shouldChargeNow: boolean;
  reason: string;
  optimalStartTime?: Date;
  estimatedCost: number;
  estimatedSavings: number;
  schedule?: ChargingSchedule;
}

export interface OptimizationRequest {
  vehicleId: string;
  userId: string;
  action: 'get_recommendation' | 'predict_range' | 'optimize_schedule' | 'start_charging' | 'stop_charging';
  params?: Record<string, unknown>;
}

export interface OptimizationResponse {
  success: boolean;
  action: string;
  data?: unknown;
  error?: string;
  processingTime: number;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: OptimizationConfig = {
  enableV2G: true,
  enableSmartScheduling: true,
  defaultTargetSoC: 80,
  offPeakStartHour: 23,
  offPeakEndHour: 7
};

// ============================================================================
// EV Optimization Service V2
// ============================================================================

class EVOptimizationServiceV2 {
  private config: OptimizationConfig;
  private weatherCache: CacheService<WeatherConditions>;
  private gridCache: CacheService<GridStatus>;
  private predictionCache: CacheService<RangePrediction>;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Use shared cache service instead of manual Map caches
    this.weatherCache = getCache<WeatherConditions>('ev:weather', {
      ttl: 10 * 60 * 1000, // 10 minutes
      maxSize: 50
    });

    this.gridCache = getCache<GridStatus>('ev:grid', {
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 10
    });

    this.predictionCache = getCache<RangePrediction>('ev:predictions', {
      ttl: 2 * 60 * 1000, // 2 minutes
      maxSize: 100
    });
  }

  // ---------------------------------------------------------------------------
  // Main Request Handler
  // ---------------------------------------------------------------------------

  async handleRequest(request: OptimizationRequest): Promise<OptimizationResponse> {
    const startTime = Date.now();

    try {
      let data: unknown;

      switch (request.action) {
        case 'get_recommendation':
          data = await this.getChargingRecommendation(request.userId, request.vehicleId);
          break;

        case 'predict_range':
          data = await this.predictRange(request.userId, request.vehicleId, request.params);
          break;

        case 'optimize_schedule':
          data = await this.optimizeChargingSchedule(
            request.userId,
            request.vehicleId,
            request.params
          );
          break;

        case 'start_charging':
          data = await this.startCharging(request.userId, request.vehicleId);
          break;

        case 'stop_charging':
          data = await this.stopCharging(request.userId, request.vehicleId);
          break;

        default:
          throw new ServiceError({
            code: 'VALIDATION_FAILED',
            message: `Unknown action: ${request.action}`
          });
      }

      return {
        success: true,
        action: request.action,
        data,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      const serviceError = error instanceof ServiceError ? error : new ServiceError({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        cause: error instanceof Error ? error : undefined
      });

      return {
        success: false,
        action: request.action,
        error: serviceError.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Charging Recommendations
  // ---------------------------------------------------------------------------

  async getChargingRecommendation(
    userId: string,
    vehicleId: string
  ): Promise<ChargingRecommendation> {
    // Get vehicle and battery state from unified EV service
    const battery = await evService.getBatteryState(userId, vehicleId);
    const grid = await this.getGridStatus();

    const currentSoC = battery.stateOfCharge;
    const targetSoC = this.config.defaultTargetSoC;
    const needsCharge = currentSoC < targetSoC - 10;

    // Determine if now is a good time to charge
    const hour = new Date().getHours();
    const isOffPeak = hour >= this.config.offPeakStartHour || hour < this.config.offPeakEndHour;

    let shouldChargeNow = false;
    let reason = '';
    let optimalStartTime: Date | undefined;

    if (currentSoC < 20) {
      // Critical - charge immediately
      shouldChargeNow = true;
      reason = 'Battery critically low. Charge immediately recommended.';
    } else if (needsCharge && isOffPeak) {
      // Good time to charge
      shouldChargeNow = true;
      reason = 'Off-peak hours. Optimal time for charging.';
    } else if (needsCharge && !isOffPeak) {
      // Wait for off-peak
      shouldChargeNow = false;
      reason = 'Consider waiting for off-peak hours to save on electricity costs.';
      optimalStartTime = this.getNextOffPeakTime();
    } else {
      // No charge needed
      shouldChargeNow = false;
      reason = `Battery at ${currentSoC}%. No charging needed at this time.`;
    }

    // Estimate costs
    const energyNeeded = ((targetSoC - currentSoC) / 100) * 82; // Assume 82 kWh battery
    const peakCost = energyNeeded * grid.pricePerKwh;
    const offPeakCost = energyNeeded * grid.pricePerKwh * 0.5;
    const estimatedCost = isOffPeak ? offPeakCost : peakCost;
    const estimatedSavings = shouldChargeNow && isOffPeak ? peakCost - offPeakCost : 0;

    const recommendation: ChargingRecommendation = {
      vehicleId,
      shouldChargeNow,
      reason,
      optimalStartTime,
      estimatedCost,
      estimatedSavings
    };

    // Emit event for analytics
    eventBus.emit('vehicle.status_updated', createPayload('EVOptimizationV2', {
      vehicleId,
      userId,
      manufacturer: 'unknown' as const
    }));

    return recommendation;
  }

  // ---------------------------------------------------------------------------
  // Range Prediction
  // ---------------------------------------------------------------------------

  async predictRange(
    userId: string,
    vehicleId: string,
    params?: Record<string, unknown>
  ): Promise<RangePrediction> {
    // Check cache first
    const cached = this.predictionCache.get(vehicleId);
    if (cached) return cached;

    const battery = await evService.getBatteryState(userId, vehicleId);
    const weather = await this.getWeather(params?.location as { lat: number; lon: number } | undefined);

    const baseRange = battery.estimatedRange;

    // Calculate adjustment factors
    const weatherFactor = this.calculateWeatherImpact(weather);
    const trafficFactor = 0.95; // Assume 5% reduction for traffic
    const drivingFactor = params?.aggressiveDriving ? 0.85 : 1.0;
    const batteryFactor = (battery.batteryHealth || 100) / 100;

    const combinedFactor = weatherFactor * trafficFactor * drivingFactor * batteryFactor;
    const predictedRange = Math.round(baseRange * combinedFactor);

    const prediction: RangePrediction = {
      vehicleId,
      currentRange: baseRange,
      predictedRange,
      confidence: 0.85,
      factors: {
        weather: weatherFactor,
        traffic: trafficFactor,
        driving: drivingFactor,
        battery: batteryFactor
      }
    };

    this.predictionCache.set(vehicleId, prediction);
    return prediction;
  }

  // ---------------------------------------------------------------------------
  // Charging Schedule Optimization
  // ---------------------------------------------------------------------------

  async optimizeChargingSchedule(
    userId: string,
    vehicleId: string,
    params?: Record<string, unknown>
  ): Promise<ChargingSchedule> {
    const targetSoC = (params?.targetSoC as number) || this.config.defaultTargetSoC;
    const readyBy = params?.readyBy ? new Date(params.readyBy as string) : undefined;

    // Use the unified EV service's scheduling
    return evService.generateChargingSchedule(userId, vehicleId, {
      targetSoC,
      readyBy,
      minimizeCost: this.config.enableSmartScheduling,
      useGridPricing: true
    });
  }

  // ---------------------------------------------------------------------------
  // Charging Control
  // ---------------------------------------------------------------------------

  async startCharging(userId: string, vehicleId: string): Promise<{ success: boolean; message: string }> {
    const result = await evService.startCharging(userId, vehicleId);

    if (result.success) {
      // Emit charging started event
      eventBus.emit('charging.started', createPayload('EVOptimizationV2', {
        vehicleId,
        userId,
        batteryPercent: 0 // Will be updated by the event handler
      }));
    }

    return {
      success: result.success,
      message: result.success ? 'Charging started' : `Failed: ${result.error}`
    };
  }

  async stopCharging(userId: string, vehicleId: string): Promise<{ success: boolean; message: string }> {
    const result = await evService.stopCharging(userId, vehicleId);

    if (result.success) {
      eventBus.emit('charging.stopped', createPayload('EVOptimizationV2', {
        vehicleId,
        userId,
        batteryPercent: 0
      }));
    }

    return {
      success: result.success,
      message: result.success ? 'Charging stopped' : `Failed: ${result.error}`
    };
  }

  // ---------------------------------------------------------------------------
  // External Data (with proper caching)
  // ---------------------------------------------------------------------------

  private async getWeather(location?: { lat: number; lon: number }): Promise<WeatherConditions> {
    const loc = location || { lat: 40.7128, lon: -74.0060 };
    const cacheKey = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;

    return this.weatherCache.getOrSet(cacheKey, async () => {
      // In production, fetch from weather API
      // For now, return reasonable defaults with environment check
      if (process.env.WEATHER_API_KEY) {
        // TODO: Implement real weather API call
        console.log('[EVOptimizationV2] Weather API configured but not implemented');
      }

      return {
        temperature: 20,
        humidity: 60,
        windSpeed: 10,
        precipitation: 0,
        visibility: 10
      };
    });
  }

  private async getGridStatus(): Promise<GridStatus> {
    return this.gridCache.getOrSet('default', async () => {
      const hour = new Date().getHours();
      const isPeakHour = hour >= 16 && hour <= 20;

      // In production, fetch from grid API
      if (process.env.GRID_API_KEY) {
        // TODO: Implement real grid API call
        console.log('[EVOptimizationV2] Grid API configured but not implemented');
      }

      return {
        regionId: 'US-DEFAULT',
        pricePerKwh: isPeakHour ? 0.25 : 0.12,
        carbonIntensity: isPeakHour ? 450 : 280,
        isPeakHour,
        renewablePercent: isPeakHour ? 25 : 45
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Helper Methods
  // ---------------------------------------------------------------------------

  private calculateWeatherImpact(weather: WeatherConditions): number {
    let factor = 1.0;

    // Temperature impact (EVs lose range in extreme temps)
    if (weather.temperature < 0) {
      factor *= 0.7; // 30% reduction in freezing
    } else if (weather.temperature < 10) {
      factor *= 0.85; // 15% reduction in cold
    } else if (weather.temperature > 35) {
      factor *= 0.9; // 10% reduction in heat
    }

    // Wind impact
    if (weather.windSpeed > 30) {
      factor *= 0.9; // 10% reduction for strong headwinds
    } else if (weather.windSpeed > 20) {
      factor *= 0.95;
    }

    // Precipitation impact
    if (weather.precipitation > 0) {
      factor *= 0.95; // 5% reduction for rain/snow
    }

    return factor;
  }

  private getNextOffPeakTime(): Date {
    const now = new Date();
    const offPeakStart = new Date(now);
    offPeakStart.setHours(this.config.offPeakStartHour, 0, 0, 0);

    if (offPeakStart <= now) {
      offPeakStart.setDate(offPeakStart.getDate() + 1);
    }

    return offPeakStart;
  }

  // ---------------------------------------------------------------------------
  // Cache Stats (for monitoring)
  // ---------------------------------------------------------------------------

  getCacheStats(): Record<string, unknown> {
    return {
      weather: this.weatherCache.getStats(),
      grid: this.gridCache.getStats(),
      predictions: this.predictionCache.getStats()
    };
  }

  clearCaches(): void {
    this.weatherCache.clear();
    this.gridCache.clear();
    this.predictionCache.clear();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const getEVOptimizationService = createSingleton(
  () => new EVOptimizationServiceV2(),
  { name: 'EVOptimizationServiceV2', logging: true }
);

export const evOptimizationService = getEVOptimizationService();

export default evOptimizationService;
