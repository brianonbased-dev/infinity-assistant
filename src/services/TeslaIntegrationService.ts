/**
 * @deprecated This service is deprecated. Use `@/lib/EV` instead.
 *
 * Migration:
 * ```typescript
 * // OLD
 * import { getTeslaIntegrationService } from '@/services/TeslaIntegrationService';
 * const tesla = getTeslaIntegrationService();
 *
 * // NEW
 * import { evService } from '@/lib/EV';
 * // Or for Tesla-specific adapter:
 * import { getAdapter } from '@/lib/EV';
 * const tesla = getAdapter('tesla');
 * ```
 *
 * See `src/services/DEPRECATED.md` for full migration guide.
 *
 * ---
 * Tesla Integration Service for Infinity Assistant
 *
 * Official Tesla Fleet API integration for:
 * - Vehicle state monitoring (battery, climate, location)
 * - Charging control and scheduling
 * - Climate preconditioning
 * - Wake/sleep management
 * - Driving and music integration
 *
 * Uses Tesla Fleet API (2024+) with Vehicle Command SDK
 * Supports: Model S, 3, X, Y, Cybertruck
 *
 * @see https://developer.tesla.com/docs/fleet-api
 * @author Infinity Assistant
 * @version 1.0.0
 */

import logger from '@/utils/logger';
import type {
  EVVehicle,
  BatteryState,
  ChargingSession,
  VehicleSensors,
  ChargingStation,
  LocationData,
  ChargingStatus,
} from '@/types/ev-optimization';

// ============================================================================
// TESLA API TYPES
// ============================================================================

export interface TeslaAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

export interface TeslaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string[];
}

export interface TeslaVehicle {
  id: number;
  vehicleId: number;
  vin: string;
  displayName: string;
  state: 'online' | 'asleep' | 'offline';
  inService: boolean;
  accessType: 'OWNER' | 'DRIVER';
  apiVersion: number;
}

export interface TeslaVehicleData {
  id: number;
  userId: number;
  vehicleId: number;
  vin: string;
  displayName: string;
  state: string;
  chargeState: TeslaChargeState;
  climateState: TeslaClimateState;
  driveState: TeslaDriveState;
  guiSettings: TeslaGuiSettings;
  vehicleConfig: TeslaVehicleConfig;
  vehicleState: TeslaVehicleState;
}

export interface TeslaChargeState {
  batteryLevel: number;
  batteryRange: number;
  chargeAmps: number;
  chargeCurrentRequest: number;
  chargeCurrentRequestMax: number;
  chargeEnableRequest: boolean;
  chargeLimitSoc: number;
  chargeLimitSocMax: number;
  chargeLimitSocMin: number;
  chargeLimitSocStd: number;
  chargePortDoorOpen: boolean;
  chargePortLatch: string;
  chargerActualCurrent: number;
  chargerPilotCurrent: number;
  chargerPower: number;
  chargerVoltage: number;
  chargingState: 'Charging' | 'Complete' | 'Disconnected' | 'Stopped' | 'Starting';
  estBatteryRange: number;
  fastChargerBrand: string;
  fastChargerPresent: boolean;
  fastChargerType: string;
  idealBatteryRange: number;
  minutesToFullCharge: number;
  scheduledChargingPending: boolean;
  scheduledChargingStartTime: number | null;
  timeToFullCharge: number;
  timestamp: number;
  usableBatteryLevel: number;
  batteryHeaterOn: boolean;
}

export interface TeslaClimateState {
  batteryHeater: boolean;
  batteryHeaterNoPower: boolean;
  climateKeeperMode: 'off' | 'keep' | 'dog' | 'camp';
  defrostMode: number;
  driverTempSetting: number;
  fanStatus: number;
  insideTemp: number;
  isAutoConditioningOn: boolean;
  isClimateOn: boolean;
  isFrontDefrosterOn: boolean;
  isPreconditioning: boolean;
  isRearDefrosterOn: boolean;
  outsideTemp: number;
  passengerTempSetting: number;
  seatHeaterLeft: number;
  seatHeaterRearCenter: number;
  seatHeaterRearLeft: number;
  seatHeaterRearRight: number;
  seatHeaterRight: number;
  sideMirrorHeaters: boolean;
  smartPreconditioning: boolean;
  steeringWheelHeater: boolean;
  timestamp: number;
  wiperBladeHeater: boolean;
}

export interface TeslaDriveState {
  gpsAsOf: number;
  heading: number;
  latitude: number;
  longitude: number;
  nativeLatitude: number;
  nativeLongitude: number;
  nativeLocationSupported: number;
  nativeType: string;
  power: number;
  shiftState: string | null;
  speed: number | null;
  timestamp: number;
}

export interface TeslaGuiSettings {
  gui24HourTime: boolean;
  guiChargeRateUnits: string;
  guiDistanceUnits: string;
  guiRangeDisplay: string;
  guiTemperatureUnits: string;
  showRangeUnits: boolean;
  timestamp: number;
}

export interface TeslaVehicleConfig {
  canAcceptNavigationRequests: boolean;
  canActuateTrunks: boolean;
  carSpecialType: string;
  carType: string;
  chargePortType: string;
  eceRestrictions: boolean;
  euVehicle: boolean;
  exteriorColor: string;
  hasAirSuspension: boolean;
  hasSeatCooling: boolean;
  headlampType: string;
  interiorTrimType: string;
  motorizedChargePort: boolean;
  plg: boolean;
  rearSeatHeaters: number;
  rearSeatType: number;
  rhd: boolean;
  roofColor: string;
  seatType: number | null;
  spoilerType: string;
  sunRoofInstalled: number | null;
  thirdRowSeats: string;
  timestamp: number;
  trimBadging: string;
  useRangeBadging: boolean;
  wheelType: string;
}

export interface TeslaVehicleState {
  apiVersion: number;
  autoparkState: string;
  autoparkStateV2: string;
  autoparkStyle: string;
  calendarSupported: boolean;
  carVersion: string;
  centerDisplayState: number;
  dashcamClipSaveAvailable: boolean;
  dashcamState: string;
  df: number;
  dr: number;
  fdWindow: number;
  fpWindow: number;
  ft: number;
  homelinkDeviceCount: number;
  homelinkNearby: boolean;
  isUserPresent: boolean;
  lastAutoparkError: string;
  locked: boolean;
  mediaState: TeslaMediaState;
  notificationsSupported: boolean;
  odometer: number;
  parsedCalendarSupported: boolean;
  pf: number;
  pr: number;
  rdWindow: number;
  remoteStart: boolean;
  remoteStartEnabled: boolean;
  remoteStartSupported: boolean;
  rpWindow: number;
  rt: number;
  sentryMode: boolean;
  sentryModeAvailable: boolean;
  smartSummonAvailable: boolean;
  softwareUpdate: TeslaSoftwareUpdate;
  speedLimitMode: TeslaSpeedLimitMode;
  timestamp: number;
  valetMode: boolean;
  valetPinNeeded: boolean;
  vehicleName: string;
}

export interface TeslaMediaState {
  remoteControlEnabled: boolean;
}

export interface TeslaSoftwareUpdate {
  downloadPerc: number;
  expectedDurationSec: number;
  installPerc: number;
  status: string;
  version: string;
}

export interface TeslaSpeedLimitMode {
  active: boolean;
  currentLimitMph: number;
  maxLimitMph: number;
  minLimitMph: number;
  pinCodeSet: boolean;
}

export interface TeslaChargingStation {
  location: {
    lat: number;
    long: number;
  };
  name: string;
  type: 'supercharger' | 'destination';
  distanceMiles: number;
  availableStalls?: number;
  totalStalls?: number;
  siteClosed?: boolean;
}

export interface TeslaCommandResult {
  result: boolean;
  reason?: string;
}

// ============================================================================
// TESLA SERVICE CONFIGURATION
// ============================================================================

interface TeslaServiceConfig {
  baseUrl: string;
  commandProxyUrl?: string;
  useVehicleCommandSDK: boolean;
  wakeTimeout: number; // ms
  pollInterval: number; // ms
  cacheTimeout: number; // ms
}

const defaultConfig: TeslaServiceConfig = {
  baseUrl: 'https://fleet-api.prd.na.vn.cloud.tesla.com',
  commandProxyUrl: process.env.TESLA_COMMAND_PROXY_URL,
  useVehicleCommandSDK: true,
  wakeTimeout: 30000, // 30 seconds
  pollInterval: 5000, // 5 seconds
  cacheTimeout: 60000, // 1 minute
};

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const vehicleDataCache = new Map<string, CacheEntry<TeslaVehicleData>>();
const vehicleListCache = new Map<string, CacheEntry<TeslaVehicle[]>>();

// ============================================================================
// TESLA INTEGRATION SERVICE
// ============================================================================

export class TeslaIntegrationService {
  private config: TeslaServiceConfig;
  private static instance: TeslaIntegrationService;

  private constructor(config: Partial<TeslaServiceConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  static getInstance(config?: Partial<TeslaServiceConfig>): TeslaIntegrationService {
    if (!TeslaIntegrationService.instance) {
      TeslaIntegrationService.instance = new TeslaIntegrationService(config);
    }
    return TeslaIntegrationService.instance;
  }

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  /**
   * Generate OAuth authorization URL for Tesla login
   */
  getAuthorizationUrl(authConfig: TeslaAuthConfig, state: string): string {
    const scopes = authConfig.scope.join(' ');
    const params = new URLSearchParams({
      client_id: authConfig.clientId,
      redirect_uri: authConfig.redirectUri,
      response_type: 'code',
      scope: scopes,
      state,
    });

    return `https://auth.tesla.com/oauth2/v3/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    authConfig: TeslaAuthConfig
  ): Promise<TeslaTokens> {
    const response = await fetch('https://auth.tesla.com/oauth2/v3/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: authConfig.clientId,
        client_secret: authConfig.clientSecret,
        code,
        redirect_uri: authConfig.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope.split(' '),
    };
  }

  /**
   * Refresh access token
   */
  async refreshTokens(refreshToken: string, clientId: string): Promise<TeslaTokens> {
    const response = await fetch('https://auth.tesla.com/oauth2/v3/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope.split(' '),
    };
  }

  // ==========================================================================
  // VEHICLE LIST
  // ==========================================================================

  /**
   * Get list of vehicles for authenticated user
   */
  async getVehicles(accessToken: string): Promise<TeslaVehicle[]> {
    const cacheKey = accessToken.slice(-10);
    const cached = this.getFromCache(vehicleListCache, cacheKey);
    if (cached) return cached;

    const response = await this.apiRequest(accessToken, '/api/1/vehicles');
    const vehicles = (response.response as unknown) as TeslaVehicle[];

    this.setCache(vehicleListCache, cacheKey, vehicles);
    return vehicles;
  }

  // ==========================================================================
  // VEHICLE DATA
  // ==========================================================================

  /**
   * Get comprehensive vehicle data
   */
  async getVehicleData(
    accessToken: string,
    vehicleId: string,
    endpoints?: string[]
  ): Promise<TeslaVehicleData> {
    const cacheKey = vehicleId;
    const cached = this.getFromCache(vehicleDataCache, cacheKey);
    if (cached) return cached;

    // Ensure vehicle is awake
    await this.wakeVehicle(accessToken, vehicleId);

    const endpointParam = endpoints?.join(';') ||
      'charge_state;climate_state;drive_state;gui_settings;vehicle_config;vehicle_state';

    const response = await this.apiRequest(
      accessToken,
      `/api/1/vehicles/${vehicleId}/vehicle_data?endpoints=${endpointParam}`
    );

    const data = this.transformVehicleData(response.response);
    this.setCache(vehicleDataCache, cacheKey, data);

    return data;
  }

  /**
   * Convert Tesla API response to our format
   */
  private transformVehicleData(raw: Record<string, unknown>): TeslaVehicleData {
    return {
      id: raw.id as number,
      userId: raw.user_id as number,
      vehicleId: raw.vehicle_id as number,
      vin: raw.vin as string,
      displayName: raw.display_name as string,
      state: raw.state as string,
      chargeState: this.transformChargeState(raw.charge_state as Record<string, unknown>),
      climateState: this.transformClimateState(raw.climate_state as Record<string, unknown>),
      driveState: this.transformDriveState(raw.drive_state as Record<string, unknown>),
      guiSettings: this.transformGuiSettings(raw.gui_settings as Record<string, unknown>),
      vehicleConfig: this.transformVehicleConfig(raw.vehicle_config as Record<string, unknown>),
      vehicleState: this.transformVehicleState(raw.vehicle_state as Record<string, unknown>),
    };
  }

  private transformChargeState(raw: Record<string, unknown>): TeslaChargeState {
    return {
      batteryLevel: raw.battery_level as number,
      batteryRange: raw.battery_range as number,
      chargeAmps: raw.charge_amps as number,
      chargeCurrentRequest: raw.charge_current_request as number,
      chargeCurrentRequestMax: raw.charge_current_request_max as number,
      chargeEnableRequest: raw.charge_enable_request as boolean,
      chargeLimitSoc: raw.charge_limit_soc as number,
      chargeLimitSocMax: raw.charge_limit_soc_max as number,
      chargeLimitSocMin: raw.charge_limit_soc_min as number,
      chargeLimitSocStd: raw.charge_limit_soc_std as number,
      chargePortDoorOpen: raw.charge_port_door_open as boolean,
      chargePortLatch: raw.charge_port_latch as string,
      chargerActualCurrent: raw.charger_actual_current as number,
      chargerPilotCurrent: raw.charger_pilot_current as number,
      chargerPower: raw.charger_power as number,
      chargerVoltage: raw.charger_voltage as number,
      chargingState: raw.charging_state as TeslaChargeState['chargingState'],
      estBatteryRange: raw.est_battery_range as number,
      fastChargerBrand: raw.fast_charger_brand as string,
      fastChargerPresent: raw.fast_charger_present as boolean,
      fastChargerType: raw.fast_charger_type as string,
      idealBatteryRange: raw.ideal_battery_range as number,
      minutesToFullCharge: raw.minutes_to_full_charge as number,
      scheduledChargingPending: raw.scheduled_charging_pending as boolean,
      scheduledChargingStartTime: raw.scheduled_charging_start_time as number | null,
      timeToFullCharge: raw.time_to_full_charge as number,
      timestamp: raw.timestamp as number,
      usableBatteryLevel: raw.usable_battery_level as number,
      batteryHeaterOn: raw.battery_heater_on as boolean,
    };
  }

  private transformClimateState(raw: Record<string, unknown>): TeslaClimateState {
    return {
      batteryHeater: raw.battery_heater as boolean,
      batteryHeaterNoPower: raw.battery_heater_no_power as boolean,
      climateKeeperMode: raw.climate_keeper_mode as TeslaClimateState['climateKeeperMode'],
      defrostMode: raw.defrost_mode as number,
      driverTempSetting: raw.driver_temp_setting as number,
      fanStatus: raw.fan_status as number,
      insideTemp: raw.inside_temp as number,
      isAutoConditioningOn: raw.is_auto_conditioning_on as boolean,
      isClimateOn: raw.is_climate_on as boolean,
      isFrontDefrosterOn: raw.is_front_defroster_on as boolean,
      isPreconditioning: raw.is_preconditioning as boolean,
      isRearDefrosterOn: raw.is_rear_defroster_on as boolean,
      outsideTemp: raw.outside_temp as number,
      passengerTempSetting: raw.passenger_temp_setting as number,
      seatHeaterLeft: raw.seat_heater_left as number,
      seatHeaterRearCenter: raw.seat_heater_rear_center as number,
      seatHeaterRearLeft: raw.seat_heater_rear_left as number,
      seatHeaterRearRight: raw.seat_heater_rear_right as number,
      seatHeaterRight: raw.seat_heater_right as number,
      sideMirrorHeaters: raw.side_mirror_heaters as boolean,
      smartPreconditioning: raw.smart_preconditioning as boolean,
      steeringWheelHeater: raw.steering_wheel_heater as boolean,
      timestamp: raw.timestamp as number,
      wiperBladeHeater: raw.wiper_blade_heater as boolean,
    };
  }

  private transformDriveState(raw: Record<string, unknown>): TeslaDriveState {
    return {
      gpsAsOf: raw.gps_as_of as number,
      heading: raw.heading as number,
      latitude: raw.latitude as number,
      longitude: raw.longitude as number,
      nativeLatitude: raw.native_latitude as number,
      nativeLongitude: raw.native_longitude as number,
      nativeLocationSupported: raw.native_location_supported as number,
      nativeType: raw.native_type as string,
      power: raw.power as number,
      shiftState: raw.shift_state as string | null,
      speed: raw.speed as number | null,
      timestamp: raw.timestamp as number,
    };
  }

  private transformGuiSettings(raw: Record<string, unknown>): TeslaGuiSettings {
    return {
      gui24HourTime: raw.gui_24_hour_time as boolean,
      guiChargeRateUnits: raw.gui_charge_rate_units as string,
      guiDistanceUnits: raw.gui_distance_units as string,
      guiRangeDisplay: raw.gui_range_display as string,
      guiTemperatureUnits: raw.gui_temperature_units as string,
      showRangeUnits: raw.show_range_units as boolean,
      timestamp: raw.timestamp as number,
    };
  }

  private transformVehicleConfig(raw: Record<string, unknown>): TeslaVehicleConfig {
    return {
      canAcceptNavigationRequests: raw.can_accept_navigation_requests as boolean,
      canActuateTrunks: raw.can_actuate_trunks as boolean,
      carSpecialType: raw.car_special_type as string,
      carType: raw.car_type as string,
      chargePortType: raw.charge_port_type as string,
      eceRestrictions: raw.ece_restrictions as boolean,
      euVehicle: raw.eu_vehicle as boolean,
      exteriorColor: raw.exterior_color as string,
      hasAirSuspension: raw.has_air_suspension as boolean,
      hasSeatCooling: raw.has_seat_cooling as boolean,
      headlampType: raw.headlamp_type as string,
      interiorTrimType: raw.interior_trim_type as string,
      motorizedChargePort: raw.motorized_charge_port as boolean,
      plg: raw.plg as boolean,
      rearSeatHeaters: raw.rear_seat_heaters as number,
      rearSeatType: raw.rear_seat_type as number,
      rhd: raw.rhd as boolean,
      roofColor: raw.roof_color as string,
      seatType: raw.seat_type as number | null,
      spoilerType: raw.spoiler_type as string,
      sunRoofInstalled: raw.sun_roof_installed as number | null,
      thirdRowSeats: raw.third_row_seats as string,
      timestamp: raw.timestamp as number,
      trimBadging: raw.trim_badging as string,
      useRangeBadging: raw.use_range_badging as boolean,
      wheelType: raw.wheel_type as string,
    };
  }

  private transformVehicleState(raw: Record<string, unknown>): TeslaVehicleState {
    return {
      apiVersion: raw.api_version as number,
      autoparkState: raw.autopark_state as string,
      autoparkStateV2: raw.autopark_state_v2 as string,
      autoparkStyle: raw.autopark_style as string,
      calendarSupported: raw.calendar_supported as boolean,
      carVersion: raw.car_version as string,
      centerDisplayState: raw.center_display_state as number,
      dashcamClipSaveAvailable: raw.dashcam_clip_save_available as boolean,
      dashcamState: raw.dashcam_state as string,
      df: raw.df as number,
      dr: raw.dr as number,
      fdWindow: raw.fd_window as number,
      fpWindow: raw.fp_window as number,
      ft: raw.ft as number,
      homelinkDeviceCount: raw.homelink_device_count as number,
      homelinkNearby: raw.homelink_nearby as boolean,
      isUserPresent: raw.is_user_present as boolean,
      lastAutoparkError: raw.last_autopark_error as string,
      locked: raw.locked as boolean,
      mediaState: raw.media_state as TeslaMediaState,
      notificationsSupported: raw.notifications_supported as boolean,
      odometer: raw.odometer as number,
      parsedCalendarSupported: raw.parsed_calendar_supported as boolean,
      pf: raw.pf as number,
      pr: raw.pr as number,
      rdWindow: raw.rd_window as number,
      remoteStart: raw.remote_start as boolean,
      remoteStartEnabled: raw.remote_start_enabled as boolean,
      remoteStartSupported: raw.remote_start_supported as boolean,
      rpWindow: raw.rp_window as number,
      rt: raw.rt as number,
      sentryMode: raw.sentry_mode as boolean,
      sentryModeAvailable: raw.sentry_mode_available as boolean,
      smartSummonAvailable: raw.smart_summon_available as boolean,
      softwareUpdate: raw.software_update as TeslaSoftwareUpdate,
      speedLimitMode: raw.speed_limit_mode as TeslaSpeedLimitMode,
      timestamp: raw.timestamp as number,
      valetMode: raw.valet_mode as boolean,
      valetPinNeeded: raw.valet_pin_needed as boolean,
      vehicleName: raw.vehicle_name as string,
    };
  }

  // ==========================================================================
  // VEHICLE COMMANDS
  // ==========================================================================

  /**
   * Wake up the vehicle
   */
  async wakeVehicle(accessToken: string, vehicleId: string): Promise<boolean> {
    const startTime = Date.now();
    const maxAttempts = Math.ceil(this.config.wakeTimeout / this.config.pollInterval);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.apiRequest(
          accessToken,
          `/api/1/vehicles/${vehicleId}/wake_up`,
          'POST'
        );

        const vehicle = (response.response as unknown) as TeslaVehicle;
        if (vehicle.state === 'online') {
          logger.info('[Tesla] Vehicle awake', {
            vehicleId,
            attempts: attempt + 1,
            timeMs: Date.now() - startTime,
          });
          return true;
        }

        await this.sleep(this.config.pollInterval);
      } catch (error) {
        logger.warn('[Tesla] Wake attempt failed', { attempt, error });
        await this.sleep(this.config.pollInterval);
      }
    }

    logger.warn('[Tesla] Vehicle wake timeout', { vehicleId });
    return false;
  }

  /**
   * Start charging
   */
  async startCharging(accessToken: string, vehicleId: string): Promise<TeslaCommandResult> {
    await this.wakeVehicle(accessToken, vehicleId);
    return this.sendCommand(accessToken, vehicleId, 'charge_start');
  }

  /**
   * Stop charging
   */
  async stopCharging(accessToken: string, vehicleId: string): Promise<TeslaCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'charge_stop');
  }

  /**
   * Set charge limit
   */
  async setChargeLimit(
    accessToken: string,
    vehicleId: string,
    percent: number
  ): Promise<TeslaCommandResult> {
    await this.wakeVehicle(accessToken, vehicleId);
    return this.sendCommand(accessToken, vehicleId, 'set_charge_limit', {
      percent: Math.max(50, Math.min(100, percent)),
    });
  }

  /**
   * Set charging amps
   */
  async setChargingAmps(
    accessToken: string,
    vehicleId: string,
    amps: number
  ): Promise<TeslaCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'set_charging_amps', {
      charging_amps: amps,
    });
  }

  /**
   * Open charge port
   */
  async openChargePort(accessToken: string, vehicleId: string): Promise<TeslaCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'charge_port_door_open');
  }

  /**
   * Close charge port
   */
  async closeChargePort(accessToken: string, vehicleId: string): Promise<TeslaCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'charge_port_door_close');
  }

  /**
   * Schedule charging
   */
  async scheduleCharging(
    accessToken: string,
    vehicleId: string,
    enable: boolean,
    time?: number // minutes after midnight
  ): Promise<TeslaCommandResult> {
    await this.wakeVehicle(accessToken, vehicleId);
    return this.sendCommand(accessToken, vehicleId, 'set_scheduled_charging', {
      enable,
      time: time ?? 0,
    });
  }

  // ==========================================================================
  // CLIMATE COMMANDS
  // ==========================================================================

  /**
   * Start climate preconditioning
   */
  async startClimate(accessToken: string, vehicleId: string): Promise<TeslaCommandResult> {
    await this.wakeVehicle(accessToken, vehicleId);
    return this.sendCommand(accessToken, vehicleId, 'auto_conditioning_start');
  }

  /**
   * Stop climate
   */
  async stopClimate(accessToken: string, vehicleId: string): Promise<TeslaCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'auto_conditioning_stop');
  }

  /**
   * Set temperature
   */
  async setTemperature(
    accessToken: string,
    vehicleId: string,
    driverTemp: number,
    passengerTemp?: number
  ): Promise<TeslaCommandResult> {
    await this.wakeVehicle(accessToken, vehicleId);
    return this.sendCommand(accessToken, vehicleId, 'set_temps', {
      driver_temp: driverTemp,
      passenger_temp: passengerTemp ?? driverTemp,
    });
  }

  /**
   * Set seat heater
   */
  async setSeatHeater(
    accessToken: string,
    vehicleId: string,
    heater: 0 | 1 | 2 | 4 | 5, // 0=driver, 1=passenger, 2=rear left, 4=rear center, 5=rear right
    level: 0 | 1 | 2 | 3
  ): Promise<TeslaCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'remote_seat_heater_request', {
      heater,
      level,
    });
  }

  /**
   * Set steering wheel heater
   */
  async setSteeringWheelHeater(
    accessToken: string,
    vehicleId: string,
    on: boolean
  ): Promise<TeslaCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'remote_steering_wheel_heater_request', {
      on,
    });
  }

  /**
   * Set climate keeper mode (Dog Mode, Camp Mode)
   */
  async setClimateKeeperMode(
    accessToken: string,
    vehicleId: string,
    mode: 0 | 1 | 2 | 3 // 0=off, 1=keep, 2=dog, 3=camp
  ): Promise<TeslaCommandResult> {
    await this.wakeVehicle(accessToken, vehicleId);
    return this.sendCommand(accessToken, vehicleId, 'set_climate_keeper_mode', {
      climate_keeper_mode: mode,
    });
  }

  /**
   * Precondition battery for departure
   */
  async scheduleDeparture(
    accessToken: string,
    vehicleId: string,
    departureTime: number, // minutes after midnight
    preconditioningEnabled: boolean,
    offPeakChargingEnabled: boolean
  ): Promise<TeslaCommandResult> {
    await this.wakeVehicle(accessToken, vehicleId);
    return this.sendCommand(accessToken, vehicleId, 'set_scheduled_departure', {
      enable: true,
      departure_time: departureTime,
      preconditioning_enabled: preconditioningEnabled,
      off_peak_charging_enabled: offPeakChargingEnabled,
    });
  }

  // ==========================================================================
  // MEDIA COMMANDS (for Driving Music integration)
  // ==========================================================================

  /**
   * Play media
   */
  async mediaPlay(accessToken: string, vehicleId: string): Promise<TeslaCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'media_toggle_playback');
  }

  /**
   * Next track
   */
  async mediaNextTrack(accessToken: string, vehicleId: string): Promise<TeslaCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'media_next_track');
  }

  /**
   * Previous track
   */
  async mediaPrevTrack(accessToken: string, vehicleId: string): Promise<TeslaCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'media_prev_track');
  }

  /**
   * Adjust volume
   */
  async mediaVolumeUp(accessToken: string, vehicleId: string): Promise<TeslaCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'media_volume_up');
  }

  async mediaVolumeDown(accessToken: string, vehicleId: string): Promise<TeslaCommandResult> {
    return this.sendCommand(accessToken, vehicleId, 'media_volume_down');
  }

  // ==========================================================================
  // CHARGING STATIONS
  // ==========================================================================

  /**
   * Get nearby Superchargers and destination chargers
   */
  async getNearbyChargingSites(
    accessToken: string,
    vehicleId: string
  ): Promise<TeslaChargingStation[]> {
    await this.wakeVehicle(accessToken, vehicleId);

    const response = await this.apiRequest(
      accessToken,
      `/api/1/vehicles/${vehicleId}/nearby_charging_sites`
    );

    const sites: TeslaChargingStation[] = [];

    // Superchargers
    const responseData = response.response as { superchargers?: unknown[]; destination_charging?: unknown[] };
    if (responseData.superchargers) {
      for (const sc of responseData.superchargers as Array<{ location: { lat: number; long: number }; name: string; distance_miles: number; available_stalls?: number; total_stalls?: number; site_closed?: boolean }>) {
        sites.push({
          location: { lat: sc.location.lat, long: sc.location.long },
          name: sc.name,
          type: 'supercharger',
          distanceMiles: sc.distance_miles,
          availableStalls: sc.available_stalls,
          totalStalls: sc.total_stalls,
          siteClosed: sc.site_closed,
        });
      }
    }

    // Destination chargers
    if (responseData.destination_charging) {
      for (const dc of responseData.destination_charging as Array<{ location: { lat: number; long: number }; name: string; distance_miles: number }>) {
        sites.push({
          location: { lat: dc.location.lat, long: dc.location.long },
          name: dc.name,
          type: 'destination',
          distanceMiles: dc.distance_miles,
        });
      }
    }

    return sites;
  }

  // ==========================================================================
  // CONVERSION TO INFINITY ASSISTANT TYPES
  // ==========================================================================

  /**
   * Convert Tesla vehicle data to Infinity Assistant EVVehicle format
   */
  toEVVehicle(teslaVehicle: TeslaVehicle, teslaData?: TeslaVehicleData): EVVehicle {
    const modelInfo = this.parseModelFromVin(teslaVehicle.vin);

    return {
      id: `tesla_${teslaVehicle.vehicleId}`,
      userId: 'tesla_user',
      vin: teslaVehicle.vin,
      make: 'Tesla',
      model: modelInfo.model,
      year: modelInfo.year,
      batteryCapacity: modelInfo.batteryCapacity,
      maxChargingRate: modelInfo.maxChargingRate,
      currentRange: teslaData?.chargeState.batteryRange
        ? teslaData.chargeState.batteryRange * 1.60934 // miles to km
        : modelInfo.maxRange * (teslaData?.chargeState.batteryLevel || 50) / 100,
      maxRange: modelInfo.maxRange,
      connectedAt: new Date(),
      lastUpdated: new Date(),
    };
  }

  /**
   * Convert Tesla charge state to Infinity Assistant BatteryState format
   */
  toBatteryState(vehicleId: string, chargeState: TeslaChargeState, climateState?: TeslaClimateState): BatteryState {
    const chargingStatusMap: Record<string, ChargingStatus> = {
      'Charging': 'charging',
      'Complete': 'complete',
      'Disconnected': 'idle',
      'Stopped': 'idle',
      'Starting': 'charging',
    };

    return {
      vehicleId: `tesla_${vehicleId}`,
      stateOfCharge: chargeState.batteryLevel,
      stateOfHealth: 100, // Tesla doesn't expose SoH directly
      temperature: climateState?.insideTemp || 20,
      voltage: chargeState.chargerVoltage || 400,
      current: chargeState.chargerActualCurrent || 0,
      chargingStatus: chargingStatusMap[chargeState.chargingState] || 'idle',
      estimatedRange: chargeState.estBatteryRange * 1.60934, // miles to km
      degradationRate: 2.5, // Estimated average
      cycleCount: 0, // Not exposed by Tesla API
      timestamp: new Date(chargeState.timestamp),
    };
  }

  /**
   * Convert Tesla charging stations to Infinity Assistant format
   */
  toChargingStations(teslaSites: TeslaChargingStation[]): ChargingStation[] {
    return teslaSites.map((site, index) => ({
      id: `tesla_${site.type}_${index}`,
      name: site.name,
      location: {
        latitude: site.location.lat,
        longitude: site.location.long,
        accuracy: 10,
        timestamp: new Date(),
      },
      address: site.name,
      operator: 'Tesla',
      connectors: site.type === 'supercharger'
        ? [
            {
              id: `conn_${index}`,
              type: 'tesla_supercharger',
              maxPower: 250,
              status: site.siteClosed ? 'out_of_service' : 'available',
            },
          ]
        : [
            {
              id: `conn_${index}`,
              type: 'tesla_supercharger',
              maxPower: 22,
              status: 'available',
            },
          ],
      status: site.siteClosed ? 'offline' : 'operational',
      pricing: {
        currency: 'USD',
        perKwh: site.type === 'supercharger' ? 0.35 : 0,
      },
      amenities: site.type === 'supercharger' ? ['Restroom', 'WiFi'] : [],
      accessibility: true,
      renewable: true,
      v2gCapable: false,
      reservable: false,
      rating: 4.5,
      reviewCount: 0,
      lastUpdated: new Date(),
    }));
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private parseModelFromVin(vin: string): {
    model: string;
    year: number;
    batteryCapacity: number;
    maxChargingRate: number;
    maxRange: number;
  } {
    // Tesla VIN decoding (simplified)
    const modelCode = vin.charAt(3);
    const yearCode = vin.charAt(9);

    const models: Record<string, { name: string; capacity: number; rate: number; range: number }> = {
      'S': { name: 'Model S', capacity: 100, rate: 250, range: 650 },
      '3': { name: 'Model 3', capacity: 82, rate: 250, range: 500 },
      'X': { name: 'Model X', capacity: 100, rate: 250, range: 560 },
      'Y': { name: 'Model Y', capacity: 82, rate: 250, range: 500 },
      'C': { name: 'Cybertruck', capacity: 123, rate: 350, range: 550 },
    };

    const yearCodes: Record<string, number> = {
      'R': 2024, 'S': 2025, 'T': 2026, 'V': 2027,
      'P': 2023, 'N': 2022, 'M': 2021, 'L': 2020,
    };

    const modelInfo = models[modelCode] || models['3'];
    const year = yearCodes[yearCode] || 2024;

    return {
      model: modelInfo.name,
      year,
      batteryCapacity: modelInfo.capacity,
      maxChargingRate: modelInfo.rate,
      maxRange: modelInfo.range,
    };
  }

  private async sendCommand(
    accessToken: string,
    vehicleId: string,
    command: string,
    params?: Record<string, unknown>
  ): Promise<TeslaCommandResult> {
    const endpoint = `/api/1/vehicles/${vehicleId}/command/${command}`;

    try {
      const response = await this.apiRequest(accessToken, endpoint, 'POST', params);

      const commandResponse = response.response as { result?: boolean; reason?: string } | undefined;
      return {
        result: commandResponse?.result ?? true,
        reason: commandResponse?.reason,
      };
    } catch (error) {
      logger.error('[Tesla] Command failed', { command, error });
      return {
        result: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async apiRequest(
    accessToken: string,
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, unknown>
  ): Promise<{ response: Record<string, unknown> }> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Tesla API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private getFromCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.config.cacheTimeout) {
      cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
    cache.set(key, { data, timestamp: Date.now() });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let teslaServiceInstance: TeslaIntegrationService | null = null;

export function getTeslaIntegrationService(): TeslaIntegrationService {
  if (!teslaServiceInstance) {
    teslaServiceInstance = TeslaIntegrationService.getInstance();
  }
  return teslaServiceInstance;
}

export default TeslaIntegrationService;
