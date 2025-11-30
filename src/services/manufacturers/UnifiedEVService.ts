/**
 * Unified EV Service for Infinity Assistant
 *
 * Provides a single interface to interact with all supported EV manufacturers:
 * - Tesla, Ford, GM, Rivian, BMW, VW Group (VW, Audi, Porsche), Hyundai/Kia/Genesis
 *
 * Features:
 * - Unified vehicle status API
 * - Cross-manufacturer charging control
 * - Consistent data types across all brands
 * - Automatic token refresh and caching
 * - Manufacturer-agnostic commands
 *
 * @author Infinity Assistant
 * @version 1.0.0
 */

import logger from '@/utils/logger';
import type {
  EVVehicle,
  BatteryState,
  ChargingStation,
} from '@/types/ev-optimization';

// Import all manufacturer services
import { getTeslaIntegrationService, TeslaIntegrationService } from '../TeslaIntegrationService';
import { getFordIntegrationService, FordIntegrationService } from './FordIntegrationService';
import { getGMIntegrationService, GMIntegrationService } from './GMIntegrationService';
import { getRivianIntegrationService, RivianIntegrationService } from './RivianIntegrationService';
import { getBMWIntegrationService, BMWIntegrationService } from './BMWIntegrationService';
import { getVWGroupIntegrationService, VWGroupIntegrationService, VWBrand } from './VWGroupIntegrationService';
import { getHyundaiKiaIntegrationService, HyundaiKiaIntegrationService, HKBrand } from './HyundaiKiaIntegrationService';

// ============================================================================
// TYPES
// ============================================================================

export type Manufacturer =
  | 'tesla'
  | 'ford'
  | 'gm'
  | 'rivian'
  | 'bmw'
  | 'volkswagen'
  | 'audi'
  | 'porsche'
  | 'hyundai'
  | 'kia'
  | 'genesis';

export interface UnifiedVehicle extends EVVehicle {
  manufacturer: Manufacturer;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  manufacturerVehicleId: string;
  capabilities: VehicleCapability[];
}

export type VehicleCapability =
  | 'charging_control'
  | 'charging_schedule'
  | 'climate_control'
  | 'climate_schedule'
  | 'lock_unlock'
  | 'location'
  | 'v2g'
  | 'v2l'
  | 'media_control'
  | 'preconditioning'
  | 'sentry_mode'
  | 'camp_mode';

export interface UnifiedVehicleStatus {
  vehicleId: string;
  manufacturer: Manufacturer;
  timestamp: Date;
  battery: BatteryState;
  location?: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    lastUpdated: Date;
  };
  climate?: {
    isActive: boolean;
    interiorTemp?: number;
    exteriorTemp?: number;
    targetTemp?: number;
    isPreconditioning: boolean;
    seatHeaters?: Record<string, number>;
    steeringWheelHeater?: boolean;
  };
  doors?: {
    locked: boolean;
    frontLeft: boolean;
    frontRight: boolean;
    rearLeft: boolean;
    rearRight: boolean;
    trunk: boolean;
    frunk?: boolean;
  };
  charging?: {
    isPluggedIn: boolean;
    isCharging: boolean;
    chargerType?: 'AC' | 'DC';
    power?: number;
    timeToFull?: number;
    energyAdded?: number;
    limit: number;
    scheduledStart?: Date;
  };
  odometer?: number;
  softwareVersion?: string;
}

export interface UnifiedCommandResult {
  success: boolean;
  commandId?: string;
  message?: string;
  manufacturer: Manufacturer;
}

export interface ManufacturerCredentials {
  manufacturer: Manufacturer;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  region?: string;
  brand?: string; // For VW Group and HK brands
  additionalConfig?: Record<string, unknown>;
}

// ============================================================================
// UNIFIED EV SERVICE
// ============================================================================

export class UnifiedEVService {
  private static instance: UnifiedEVService;
  private tesla: TeslaIntegrationService;
  private ford: FordIntegrationService;
  private gm: GMIntegrationService;
  private rivian: RivianIntegrationService;
  private bmw: BMWIntegrationService;
  private vwGroup: VWGroupIntegrationService;
  private hk: HyundaiKiaIntegrationService;

  private vehicleRegistry = new Map<string, UnifiedVehicle>();

  private constructor() {
    this.tesla = getTeslaIntegrationService();
    this.ford = getFordIntegrationService();
    this.gm = getGMIntegrationService();
    this.rivian = getRivianIntegrationService();
    this.bmw = getBMWIntegrationService();
    this.vwGroup = getVWGroupIntegrationService();
    this.hk = getHyundaiKiaIntegrationService();
  }

  static getInstance(): UnifiedEVService {
    if (!UnifiedEVService.instance) {
      UnifiedEVService.instance = new UnifiedEVService();
    }
    return UnifiedEVService.instance;
  }

  // ==========================================================================
  // VEHICLE DISCOVERY
  // ==========================================================================

  async discoverVehicles(credentials: ManufacturerCredentials): Promise<UnifiedVehicle[]> {
    const { manufacturer, accessToken, region } = credentials;
    const vehicles: UnifiedVehicle[] = [];

    try {
      switch (manufacturer) {
        case 'tesla': {
          const teslaVehicles = await this.tesla.getVehicles(accessToken);
          for (const v of teslaVehicles) {
            const data = await this.tesla.getVehicleData(accessToken, v.vehicleId.toString()).catch(() => null);
            const evVehicle = this.tesla.toEVVehicle(v, data || undefined);
            vehicles.push(this.createUnifiedVehicle(evVehicle, manufacturer, v.vehicleId.toString(), credentials, [
              'charging_control', 'charging_schedule', 'climate_control', 'climate_schedule',
              'lock_unlock', 'location', 'media_control', 'preconditioning', 'sentry_mode', 'camp_mode',
            ]));
          }
          break;
        }
        case 'ford': {
          const fordVehicles = await this.ford.getVehicles(accessToken);
          for (const v of fordVehicles) {
            const evStatus = await this.ford.getEVStatus(accessToken, v.vehicleId).catch(() => null);
            const evVehicle = this.ford.toEVVehicle(v, evStatus || undefined);
            vehicles.push(this.createUnifiedVehicle(evVehicle, manufacturer, v.vehicleId, credentials, [
              'charging_control', 'charging_schedule', 'climate_control', 'lock_unlock', 'location', 'preconditioning',
            ]));
          }
          break;
        }
        case 'gm': {
          const gmVehicles = await this.gm.getVehicles(accessToken);
          for (const v of gmVehicles) {
            if (v.evDetails?.isElectric) {
              const evStatus = await this.gm.getEVStatus(accessToken, v.vin).catch(() => null);
              const evVehicle = this.gm.toEVVehicle(v, evStatus || undefined);
              vehicles.push(this.createUnifiedVehicle(evVehicle, manufacturer, v.vin, credentials, [
                'charging_control', 'charging_schedule', 'climate_control', 'lock_unlock', 'location', 'preconditioning',
              ]));
            }
          }
          break;
        }
        case 'rivian': {
          const rivianVehicles = await this.rivian.getVehicles(accessToken);
          for (const v of rivianVehicles) {
            const state = await this.rivian.getVehicleState(accessToken, v.vehicleId).catch(() => null);
            const evVehicle = this.rivian.toEVVehicle(v, state || undefined);
            vehicles.push(this.createUnifiedVehicle(evVehicle, manufacturer, v.vehicleId, credentials, [
              'charging_control', 'charging_schedule', 'climate_control', 'lock_unlock', 'location', 'preconditioning', 'camp_mode',
            ]));
          }
          break;
        }
        case 'bmw': {
          const bmwVehicles = await this.bmw.getVehicles(accessToken);
          for (const v of bmwVehicles) {
            if (v.driveTrain === 'BEV' || v.driveTrain === 'PHEV') {
              const state = await this.bmw.getVehicleState(accessToken, v.vin).catch(() => null);
              const evVehicle = this.bmw.toEVVehicle(v, state || undefined);
              vehicles.push(this.createUnifiedVehicle(evVehicle, manufacturer, v.vin, credentials, [
                'charging_control', 'charging_schedule', 'climate_control', 'lock_unlock', 'location', 'preconditioning',
              ]));
            }
          }
          break;
        }
        case 'volkswagen':
        case 'audi':
        case 'porsche': {
          const brand = manufacturer as VWBrand;
          const vwVehicles = await this.vwGroup.getVehicles(accessToken, brand);
          for (const v of vwVehicles) {
            const status = await this.vwGroup.getVehicleStatus(accessToken, brand, v.vin).catch(() => null);
            const evVehicle = this.vwGroup.toEVVehicle(v, status || undefined, brand);
            vehicles.push(this.createUnifiedVehicle(evVehicle, manufacturer, v.vin, credentials, [
              'charging_control', 'charging_schedule', 'climate_control', 'lock_unlock', 'location', 'preconditioning',
            ]));
          }
          break;
        }
        case 'hyundai':
        case 'kia':
        case 'genesis': {
          const brand = manufacturer as HKBrand;
          const hkVehicles = await this.hk.getVehicles(accessToken, brand, region || 'us');
          for (const v of hkVehicles) {
            if (v.fuelKindCode === 'EV') {
              const status = await this.hk.getVehicleStatus(accessToken, brand, region || 'us', v.vehicleId).catch(() => null);
              const evVehicle = this.hk.toEVVehicle(v, status || undefined);
              const capabilities: VehicleCapability[] = [
                'charging_control', 'charging_schedule', 'climate_control', 'lock_unlock', 'location', 'preconditioning',
              ];
              if (v.evStatus?.supportV2L) capabilities.push('v2l');
              vehicles.push(this.createUnifiedVehicle(evVehicle, manufacturer, v.vehicleId, credentials, capabilities));
            }
          }
          break;
        }
      }

      // Register all discovered vehicles
      for (const vehicle of vehicles) {
        this.vehicleRegistry.set(vehicle.id, vehicle);
      }

      logger.info('[UnifiedEV] Discovered vehicles', {
        manufacturer,
        count: vehicles.length,
      });

      return vehicles;
    } catch (error) {
      logger.error('[UnifiedEV] Vehicle discovery failed', { manufacturer, error });
      throw error;
    }
  }

  // ==========================================================================
  // VEHICLE STATUS
  // ==========================================================================

  async getVehicleStatus(vehicleId: string): Promise<UnifiedVehicleStatus> {
    const vehicle = this.vehicleRegistry.get(vehicleId);
    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found in registry`);
    }

    const { manufacturer, accessToken, manufacturerVehicleId } = vehicle;

    switch (manufacturer) {
      case 'tesla': {
        const data = await this.tesla.getVehicleData(accessToken, manufacturerVehicleId);
        const battery = this.tesla.toBatteryState(manufacturerVehicleId, data.chargeState, data.climateState);
        return this.createUnifiedStatus(vehicleId, manufacturer, battery, {
          location: {
            latitude: data.driveState.latitude,
            longitude: data.driveState.longitude,
            heading: data.driveState.heading,
            speed: data.driveState.speed || undefined,
            lastUpdated: new Date(data.driveState.timestamp),
          },
          climate: {
            isActive: data.climateState.isClimateOn,
            interiorTemp: data.climateState.insideTemp,
            exteriorTemp: data.climateState.outsideTemp,
            targetTemp: data.climateState.driverTempSetting,
            isPreconditioning: data.climateState.isPreconditioning,
          },
          charging: {
            isPluggedIn: data.chargeState.chargePortDoorOpen,
            isCharging: data.chargeState.chargingState === 'Charging',
            chargerType: data.chargeState.fastChargerPresent ? 'DC' : 'AC',
            power: data.chargeState.chargerPower,
            timeToFull: data.chargeState.minutesToFullCharge,
            limit: data.chargeState.chargeLimitSoc,
          },
          odometer: data.vehicleState.odometer,
          softwareVersion: data.vehicleState.carVersion,
        });
      }
      case 'ford': {
        const evStatus = await this.ford.getEVStatus(accessToken, manufacturerVehicleId);
        const battery = this.ford.toBatteryState(manufacturerVehicleId, evStatus);
        return this.createUnifiedStatus(vehicleId, manufacturer, battery, {
          charging: {
            isPluggedIn: evStatus.xevPlugStatus.xevPlugChargerStatus !== 'NotConnected',
            isCharging: evStatus.xevBatteryStatus.xevBatteryChargeDisplayStatus.includes('Charging'),
            power: evStatus.xevPlugStatus.xevBatteryChargerVoltageOutput * evStatus.xevPlugStatus.xevBatteryChargerCurrentOutput / 1000,
            timeToFull: evStatus.xevPlugStatus.xevBatteryTimeToFullCharge,
            limit: 100,
          },
        });
      }
      case 'gm': {
        const evStatus = await this.gm.getEVStatus(accessToken, manufacturerVehicleId);
        const battery = this.gm.toBatteryState(manufacturerVehicleId, evStatus);
        return this.createUnifiedStatus(vehicleId, manufacturer, battery, {
          charging: {
            isPluggedIn: evStatus.plugState.plugged,
            isCharging: evStatus.chargeState.status === 'CHARGING',
            chargerType: evStatus.chargeState.chargeMode === 'DC_FAST' ? 'DC' : 'AC',
            power: evStatus.chargeState.chargeRate,
            timeToFull: evStatus.chargeState.timeToFullCharge,
            limit: evStatus.chargingProfile.targetSoc,
          },
        });
      }
      case 'rivian': {
        const state = await this.rivian.getVehicleState(accessToken, manufacturerVehicleId);
        const battery = this.rivian.toBatteryState(manufacturerVehicleId, state);
        return this.createUnifiedStatus(vehicleId, manufacturer, battery, {
          location: {
            latitude: state.location.latitude,
            longitude: state.location.longitude,
            heading: state.location.bearing,
            lastUpdated: new Date(state.location.timestamp),
          },
          climate: {
            isActive: state.cabinClimate.hvacPower,
            interiorTemp: state.cabinClimate.interiorTemperature,
            isPreconditioning: state.cabinClimate.cabinPreconditioning,
          },
          charging: {
            isPluggedIn: state.powerState.chargerState.state !== 'disconnected',
            isCharging: state.powerState.chargerState.state === 'charging',
            power: state.powerState.chargerState.power,
            timeToFull: state.powerState.chargerState.timeToFull,
            limit: state.batteryLimit.socLimit,
          },
          odometer: state.odometer.value,
        });
      }
      case 'bmw': {
        const state = await this.bmw.getVehicleState(accessToken, manufacturerVehicleId);
        const battery = this.bmw.toBatteryState(manufacturerVehicleId, state);
        return this.createUnifiedStatus(vehicleId, manufacturer, battery, {
          location: state.location ? {
            latitude: state.location.coordinates.latitude,
            longitude: state.location.coordinates.longitude,
            heading: state.location.heading,
            lastUpdated: new Date(state.location.lastUpdatedAt),
          } : undefined,
          climate: {
            isActive: state.climateControlState.activity !== 'INACTIVE',
            isPreconditioning: state.climateControlState.activity === 'PRECONDITIONING',
          },
          charging: {
            isPluggedIn: state.electricChargingState.isChargerConnected,
            isCharging: state.electricChargingState.chargingStatus === 'CHARGING',
            chargerType: state.electricChargingState.chargingType,
            power: state.electricChargingState.chargingPower,
            timeToFull: state.electricChargingState.remainingChargingMinutes,
            limit: state.electricChargingState.chargingTarget,
          },
          odometer: state.currentMileage.mileage,
          softwareVersion: undefined,
        });
      }
      case 'volkswagen':
      case 'audi':
      case 'porsche': {
        const brand = manufacturer as VWBrand;
        const status = await this.vwGroup.getVehicleStatus(accessToken, brand, manufacturerVehicleId);
        const battery = this.vwGroup.toBatteryState(manufacturerVehicleId, status);
        return this.createUnifiedStatus(vehicleId, manufacturer, battery, {
          location: status.parking ? {
            latitude: status.parking.latitude,
            longitude: status.parking.longitude,
            lastUpdated: new Date(status.parking.parkingTime),
          } : undefined,
          climate: {
            isActive: status.climate.hvacState !== 'off',
            targetTemp: status.climate.targetTemperature,
            isPreconditioning: false,
          },
          charging: {
            isPluggedIn: status.charging.plugConnectionState === 'connected',
            isCharging: status.charging.state === 'charging',
            power: status.charging.chargePower,
            timeToFull: status.charging.remainingTime,
            limit: status.charging.targetSoc,
          },
          odometer: status.mileage.value,
        });
      }
      case 'hyundai':
      case 'kia':
      case 'genesis': {
        const brand = manufacturer as HKBrand;
        const region = (vehicle as UnifiedVehicle & { region?: string }).region || 'us';
        const status = await this.hk.getVehicleStatus(accessToken, brand, region, manufacturerVehicleId);
        const battery = this.hk.toBatteryState(manufacturerVehicleId, status);
        return this.createUnifiedStatus(vehicleId, manufacturer, battery, {
          location: status.vehicleStatus.location ? {
            latitude: status.vehicleStatus.location.latitude,
            longitude: status.vehicleStatus.location.longitude,
            heading: status.vehicleStatus.location.heading,
            speed: status.vehicleStatus.location.speed,
            lastUpdated: new Date(status.vehicleStatus.location.lastUpdateTime || ''),
          } : undefined,
          climate: {
            isActive: status.vehicleStatus.airCtrl,
            targetTemp: parseFloat(status.vehicleStatus.airTempValue),
            isPreconditioning: false,
          },
          charging: {
            isPluggedIn: status.vehicleStatus.evStatus.batteryPlugin === 1,
            isCharging: status.vehicleStatus.evStatus.batteryCharge,
            timeToFull: status.vehicleStatus.evStatus.remainChargeTime[0]?.remainTimeCount,
            limit: status.vehicleStatus.evStatus.targetSOC[0]?.targetSOClevel || 80,
          },
        });
      }
      default:
        throw new Error(`Unsupported manufacturer: ${manufacturer}`);
    }
  }

  // ==========================================================================
  // CHARGING COMMANDS
  // ==========================================================================

  async startCharging(vehicleId: string): Promise<UnifiedCommandResult> {
    const vehicle = this.vehicleRegistry.get(vehicleId);
    if (!vehicle) throw new Error(`Vehicle ${vehicleId} not found`);

    const { manufacturer, accessToken, manufacturerVehicleId } = vehicle;

    try {
      switch (manufacturer) {
        case 'tesla':
          await this.tesla.startCharging(accessToken, manufacturerVehicleId);
          break;
        case 'ford':
          await this.ford.startCharging(accessToken, manufacturerVehicleId);
          break;
        case 'gm':
          await this.gm.startCharging(accessToken, manufacturerVehicleId);
          break;
        case 'rivian':
          await this.rivian.startCharging(accessToken, manufacturerVehicleId);
          break;
        case 'bmw':
          await this.bmw.startCharging(accessToken, manufacturerVehicleId);
          break;
        case 'volkswagen':
        case 'audi':
        case 'porsche':
          await this.vwGroup.startCharging(accessToken, manufacturer as VWBrand, manufacturerVehicleId);
          break;
        case 'hyundai':
        case 'kia':
        case 'genesis':
          await this.hk.startCharging(accessToken, manufacturer as HKBrand, 'us', manufacturerVehicleId);
          break;
      }

      return { success: true, manufacturer };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        manufacturer,
      };
    }
  }

  async stopCharging(vehicleId: string): Promise<UnifiedCommandResult> {
    const vehicle = this.vehicleRegistry.get(vehicleId);
    if (!vehicle) throw new Error(`Vehicle ${vehicleId} not found`);

    const { manufacturer, accessToken, manufacturerVehicleId } = vehicle;

    try {
      switch (manufacturer) {
        case 'tesla':
          await this.tesla.stopCharging(accessToken, manufacturerVehicleId);
          break;
        case 'ford':
          await this.ford.stopCharging(accessToken, manufacturerVehicleId);
          break;
        case 'gm':
          await this.gm.stopCharging(accessToken, manufacturerVehicleId);
          break;
        case 'rivian':
          await this.rivian.stopCharging(accessToken, manufacturerVehicleId);
          break;
        case 'bmw':
          await this.bmw.stopCharging(accessToken, manufacturerVehicleId);
          break;
        case 'volkswagen':
        case 'audi':
        case 'porsche':
          await this.vwGroup.stopCharging(accessToken, manufacturer as VWBrand, manufacturerVehicleId);
          break;
        case 'hyundai':
        case 'kia':
        case 'genesis':
          await this.hk.stopCharging(accessToken, manufacturer as HKBrand, 'us', manufacturerVehicleId);
          break;
      }

      return { success: true, manufacturer };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        manufacturer,
      };
    }
  }

  async setChargeLimit(vehicleId: string, limit: number): Promise<UnifiedCommandResult> {
    const vehicle = this.vehicleRegistry.get(vehicleId);
    if (!vehicle) throw new Error(`Vehicle ${vehicleId} not found`);

    const { manufacturer, accessToken, manufacturerVehicleId } = vehicle;
    const clampedLimit = Math.max(50, Math.min(100, limit));

    try {
      switch (manufacturer) {
        case 'tesla':
          await this.tesla.setChargeLimit(accessToken, manufacturerVehicleId, clampedLimit);
          break;
        case 'gm':
          await this.gm.setChargeLimit(accessToken, manufacturerVehicleId, clampedLimit);
          break;
        case 'rivian':
          await this.rivian.setChargeLimit(accessToken, manufacturerVehicleId, clampedLimit);
          break;
        case 'bmw':
          await this.bmw.setChargeTarget(accessToken, manufacturerVehicleId, clampedLimit);
          break;
        case 'volkswagen':
        case 'audi':
        case 'porsche':
          await this.vwGroup.setChargeLimit(accessToken, manufacturer as VWBrand, manufacturerVehicleId, clampedLimit);
          break;
        case 'hyundai':
        case 'kia':
        case 'genesis':
          await this.hk.setChargeLimit(accessToken, manufacturer as HKBrand, 'us', manufacturerVehicleId, clampedLimit, clampedLimit);
          break;
        default:
          throw new Error('Charge limit not supported for this manufacturer');
      }

      return { success: true, manufacturer };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        manufacturer,
      };
    }
  }

  // ==========================================================================
  // CLIMATE COMMANDS
  // ==========================================================================

  async startClimate(vehicleId: string, temperature?: number): Promise<UnifiedCommandResult> {
    const vehicle = this.vehicleRegistry.get(vehicleId);
    if (!vehicle) throw new Error(`Vehicle ${vehicleId} not found`);

    const { manufacturer, accessToken, manufacturerVehicleId } = vehicle;

    try {
      switch (manufacturer) {
        case 'tesla':
          if (temperature) await this.tesla.setTemperature(accessToken, manufacturerVehicleId, temperature);
          await this.tesla.startClimate(accessToken, manufacturerVehicleId);
          break;
        case 'ford':
          await this.ford.startPrecondition(accessToken, manufacturerVehicleId);
          break;
        case 'gm':
          await this.gm.remoteStart(accessToken, manufacturerVehicleId, { temperature });
          break;
        case 'rivian':
          await this.rivian.precondition(accessToken, manufacturerVehicleId, { temperature });
          break;
        case 'bmw':
          await this.bmw.startClimate(accessToken, manufacturerVehicleId);
          break;
        case 'volkswagen':
        case 'audi':
        case 'porsche':
          await this.vwGroup.startClimate(accessToken, manufacturer as VWBrand, manufacturerVehicleId, { temperature });
          break;
        case 'hyundai':
        case 'kia':
        case 'genesis':
          await this.hk.startClimate(accessToken, manufacturer as HKBrand, 'us', manufacturerVehicleId, { temperature });
          break;
      }

      return { success: true, manufacturer };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        manufacturer,
      };
    }
  }

  async stopClimate(vehicleId: string): Promise<UnifiedCommandResult> {
    const vehicle = this.vehicleRegistry.get(vehicleId);
    if (!vehicle) throw new Error(`Vehicle ${vehicleId} not found`);

    const { manufacturer, accessToken, manufacturerVehicleId } = vehicle;

    try {
      switch (manufacturer) {
        case 'tesla':
          await this.tesla.stopClimate(accessToken, manufacturerVehicleId);
          break;
        case 'ford':
          await this.ford.stopPrecondition(accessToken, manufacturerVehicleId);
          break;
        case 'gm':
          await this.gm.remoteStop(accessToken, manufacturerVehicleId);
          break;
        case 'rivian':
          await this.rivian.stopPrecondition(accessToken, manufacturerVehicleId);
          break;
        case 'bmw':
          await this.bmw.stopClimate(accessToken, manufacturerVehicleId);
          break;
        case 'volkswagen':
        case 'audi':
        case 'porsche':
          await this.vwGroup.stopClimate(accessToken, manufacturer as VWBrand, manufacturerVehicleId);
          break;
        case 'hyundai':
        case 'kia':
        case 'genesis':
          await this.hk.stopClimate(accessToken, manufacturer as HKBrand, 'us', manufacturerVehicleId);
          break;
      }

      return { success: true, manufacturer };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        manufacturer,
      };
    }
  }

  // ==========================================================================
  // LOCK/UNLOCK
  // ==========================================================================

  async lock(vehicleId: string): Promise<UnifiedCommandResult> {
    const vehicle = this.vehicleRegistry.get(vehicleId);
    if (!vehicle) throw new Error(`Vehicle ${vehicleId} not found`);

    const { manufacturer, accessToken, manufacturerVehicleId } = vehicle;

    try {
      switch (manufacturer) {
        case 'ford':
          await this.ford.lock(accessToken, manufacturerVehicleId);
          break;
        case 'gm':
          await this.gm.lock(accessToken, manufacturerVehicleId);
          break;
        case 'rivian':
          await this.rivian.lock(accessToken, manufacturerVehicleId);
          break;
        case 'bmw':
          await this.bmw.lock(accessToken, manufacturerVehicleId);
          break;
        case 'volkswagen':
        case 'audi':
        case 'porsche':
          await this.vwGroup.lock(accessToken, manufacturer as VWBrand, manufacturerVehicleId);
          break;
        case 'hyundai':
        case 'kia':
        case 'genesis':
          await this.hk.lock(accessToken, manufacturer as HKBrand, 'us', manufacturerVehicleId);
          break;
        default:
          throw new Error('Lock not supported for this manufacturer');
      }

      return { success: true, manufacturer };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        manufacturer,
      };
    }
  }

  async unlock(vehicleId: string): Promise<UnifiedCommandResult> {
    const vehicle = this.vehicleRegistry.get(vehicleId);
    if (!vehicle) throw new Error(`Vehicle ${vehicleId} not found`);

    const { manufacturer, accessToken, manufacturerVehicleId } = vehicle;

    try {
      switch (manufacturer) {
        case 'ford':
          await this.ford.unlock(accessToken, manufacturerVehicleId);
          break;
        case 'gm':
          await this.gm.unlock(accessToken, manufacturerVehicleId);
          break;
        case 'rivian':
          await this.rivian.unlock(accessToken, manufacturerVehicleId);
          break;
        case 'bmw':
          await this.bmw.unlock(accessToken, manufacturerVehicleId);
          break;
        case 'volkswagen':
        case 'audi':
        case 'porsche':
          await this.vwGroup.unlock(accessToken, manufacturer as VWBrand, manufacturerVehicleId);
          break;
        case 'hyundai':
        case 'kia':
        case 'genesis':
          await this.hk.unlock(accessToken, manufacturer as HKBrand, 'us', manufacturerVehicleId);
          break;
        default:
          throw new Error('Unlock not supported for this manufacturer');
      }

      return { success: true, manufacturer };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        manufacturer,
      };
    }
  }

  // ==========================================================================
  // REGISTRY MANAGEMENT
  // ==========================================================================

  getRegisteredVehicles(): UnifiedVehicle[] {
    return Array.from(this.vehicleRegistry.values());
  }

  getVehicle(vehicleId: string): UnifiedVehicle | undefined {
    return this.vehicleRegistry.get(vehicleId);
  }

  removeVehicle(vehicleId: string): boolean {
    return this.vehicleRegistry.delete(vehicleId);
  }

  clearRegistry(): void {
    this.vehicleRegistry.clear();
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private createUnifiedVehicle(
    evVehicle: EVVehicle,
    manufacturer: Manufacturer,
    manufacturerVehicleId: string,
    credentials: ManufacturerCredentials,
    capabilities: VehicleCapability[]
  ): UnifiedVehicle {
    return {
      ...evVehicle,
      manufacturer,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      tokenExpiresAt: credentials.expiresAt,
      manufacturerVehicleId,
      capabilities,
    };
  }

  private createUnifiedStatus(
    vehicleId: string,
    manufacturer: Manufacturer,
    battery: BatteryState,
    extras: Partial<Omit<UnifiedVehicleStatus, 'vehicleId' | 'manufacturer' | 'timestamp' | 'battery'>>
  ): UnifiedVehicleStatus {
    return {
      vehicleId,
      manufacturer,
      timestamp: new Date(),
      battery,
      ...extras,
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let unifiedEVServiceInstance: UnifiedEVService | null = null;

export function getUnifiedEVService(): UnifiedEVService {
  if (!unifiedEVServiceInstance) {
    unifiedEVServiceInstance = UnifiedEVService.getInstance();
  }
  return unifiedEVServiceInstance;
}

export default UnifiedEVService;
