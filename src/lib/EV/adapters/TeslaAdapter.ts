/**
 * Tesla Manufacturer Adapter
 *
 * Implements the EVManufacturerAdapter interface for Tesla vehicles.
 * Uses Tesla Fleet API (formerly Tesla Owner API).
 *
 * Note: Requires Tesla Developer Account and Fleet API access.
 * See: https://developer.tesla.com/
 */

import {
  BaseEVAdapter,
  registerAdapter
} from '../EVManufacturerAdapter';
import {
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
  VehicleCapability,
  ChargerType,
  EVError
} from '../types';

// ============================================================================
// Tesla API Types
// ============================================================================

interface TeslaVehicleResponse {
  id: number;
  vehicle_id: number;
  vin: string;
  display_name: string;
  option_codes: string;
  color: string | null;
  tokens: string[];
  state: string;
  in_service: boolean;
  id_s: string;
  calendar_enabled: boolean;
  api_version: number;
  backseat_token: string | null;
  backseat_token_updated_at: string | null;
}

interface TeslaChargeState {
  battery_level: number;
  usable_battery_level: number;
  battery_range: number;
  est_battery_range: number;
  ideal_battery_range: number;
  charge_current_request: number;
  charge_current_request_max: number;
  charge_enable_request: boolean;
  charge_energy_added: number;
  charge_limit_soc: number;
  charge_limit_soc_max: number;
  charge_limit_soc_min: number;
  charge_limit_soc_std: number;
  charge_miles_added_ideal: number;
  charge_miles_added_rated: number;
  charge_port_cold_weather_mode: boolean;
  charge_port_door_open: boolean;
  charge_port_latch: string;
  charge_rate: number;
  charge_to_max_range: boolean;
  charger_actual_current: number;
  charger_phases: number | null;
  charger_pilot_current: number;
  charger_power: number;
  charger_voltage: number;
  charging_state: string;
  conn_charge_cable: string;
  fast_charger_brand: string;
  fast_charger_present: boolean;
  fast_charger_type: string;
  managed_charging_active: boolean;
  managed_charging_start_time: string | null;
  managed_charging_user_canceled: boolean;
  max_range_charge_counter: number;
  minutes_to_full_charge: number;
  not_enough_power_to_heat: boolean | null;
  off_peak_charging_enabled: boolean;
  off_peak_charging_times: string;
  off_peak_hours_end_time: number;
  preconditioning_enabled: boolean;
  preconditioning_times: string;
  scheduled_charging_mode: string;
  scheduled_charging_pending: boolean;
  scheduled_charging_start_time: number | null;
  scheduled_departure_time: number;
  scheduled_departure_time_minutes: number;
  supercharger_session_trip_planner: boolean;
  time_to_full_charge: number;
  timestamp: number;
  trip_charging: boolean;
  user_charge_enable_request: boolean | null;
}

interface TeslaClimateState {
  battery_heater: boolean;
  battery_heater_no_power: boolean | null;
  cabin_overheat_protection: string;
  cabin_overheat_protection_actively_cooling: boolean;
  climate_keeper_mode: string;
  defrost_mode: number;
  driver_temp_setting: number;
  fan_status: number;
  hvac_auto_request: string;
  inside_temp: number;
  is_auto_conditioning_on: boolean;
  is_climate_on: boolean;
  is_front_defroster_on: boolean;
  is_preconditioning: boolean;
  is_rear_defroster_on: boolean;
  left_temp_direction: number;
  max_avail_temp: number;
  min_avail_temp: number;
  outside_temp: number;
  passenger_temp_setting: number;
  remote_heater_control_enabled: boolean;
  right_temp_direction: number;
  seat_heater_left: number;
  seat_heater_rear_center: number;
  seat_heater_rear_left: number;
  seat_heater_rear_right: number;
  seat_heater_right: number;
  side_mirror_heaters: boolean;
  steering_wheel_heater: boolean;
  timestamp: number;
  wiper_blade_heater: boolean;
}

interface TeslaDriveState {
  gps_as_of: number;
  heading: number;
  latitude: number;
  longitude: number;
  native_latitude: number;
  native_location_supported: number;
  native_longitude: number;
  native_type: string;
  power: number;
  shift_state: string | null;
  speed: number | null;
  timestamp: number;
}

// ============================================================================
// Tesla Adapter Implementation
// ============================================================================

export class TeslaAdapter extends BaseEVAdapter {
  readonly manufacturer = 'tesla' as const;
  readonly displayName = 'Tesla';
  readonly authConfig: EVAuthConfig;

  private readonly baseUrl = 'https://fleet-api.prd.na.vn.cloud.tesla.com';
  private readonly authUrl = 'https://auth.tesla.com';

  constructor() {
    super();
    this.authConfig = {
      clientId: process.env.TESLA_CLIENT_ID || '',
      clientSecret: process.env.TESLA_CLIENT_SECRET || '',
      redirectUri: process.env.TESLA_REDIRECT_URI || 'https://infinityassistant.io/api/ev/tesla/callback',
      scopes: [
        'openid',
        'offline_access',
        'user_data',
        'vehicle_device_data',
        'vehicle_cmds',
        'vehicle_charging_cmds'
      ],
      region: 'na'
    };
  }

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.authConfig.clientId,
      redirect_uri: this.authConfig.redirectUri || '',
      response_type: 'code',
      scope: this.authConfig.scopes?.join(' ') || '',
      state,
      locale: 'en-US'
    });

    return `${this.authUrl}/oauth2/v3/authorize?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<EVAuthResult> {
    try {
      const response = await fetch(`${this.authUrl}/oauth2/v3/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.authConfig.clientId,
          client_secret: this.authConfig.clientSecret || '',
          code,
          redirect_uri: this.authConfig.redirectUri || ''
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Token exchange failed: ${error}` };
      }

      const data = await response.json();

      return {
        success: true,
        token: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: new Date(Date.now() + data.expires_in * 1000),
          tokenType: data.token_type,
          scope: data.scope?.split(' ')
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token exchange failed'
      };
    }
  }

  async refreshToken(refreshToken: string): Promise<EVAuthResult> {
    try {
      const response = await fetch(`${this.authUrl}/oauth2/v3/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.authConfig.clientId,
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Token refresh failed: ${error}` };
      }

      const data = await response.json();

      return {
        success: true,
        token: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || refreshToken,
          expiresAt: new Date(Date.now() + data.expires_in * 1000),
          tokenType: data.token_type
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Vehicle Management
  // ---------------------------------------------------------------------------

  async getVehicles(token: EVAuthToken): Promise<EVVehicle[]> {
    const response = await this.makeRequest<{ response: TeslaVehicleResponse[] }>(
      `${this.baseUrl}/api/1/vehicles`,
      { method: 'GET' },
      token
    );

    return response.response.map(v => this.transformVehicle(v));
  }

  async wakeUpVehicle(token: EVAuthToken, vehicleId: string): Promise<boolean> {
    try {
      await this.makeRequest(
        `${this.baseUrl}/api/1/vehicles/${vehicleId}/wake_up`,
        { method: 'POST' },
        token
      );

      // Poll for wake status
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const vehicles = await this.getVehicles(token);
        const vehicle = vehicles.find(v => v.id === vehicleId);
        if (vehicle?.isOnline) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('[Tesla] Wake up failed:', error);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Vehicle State
  // ---------------------------------------------------------------------------

  async getBatteryState(token: EVAuthToken, vehicleId: string): Promise<BatteryState> {
    const response = await this.makeRequest<{ response: TeslaChargeState }>(
      `${this.baseUrl}/api/1/vehicles/${vehicleId}/data_request/charge_state`,
      { method: 'GET' },
      token
    );

    return this.transformChargeState(vehicleId, response.response);
  }

  async getClimateState(token: EVAuthToken, vehicleId: string): Promise<ClimateState> {
    const response = await this.makeRequest<{ response: TeslaClimateState }>(
      `${this.baseUrl}/api/1/vehicles/${vehicleId}/data_request/climate_state`,
      { method: 'GET' },
      token
    );

    return this.transformClimateState(vehicleId, response.response);
  }

  async getLocation(token: EVAuthToken, vehicleId: string): Promise<VehicleLocation> {
    const response = await this.makeRequest<{ response: TeslaDriveState }>(
      `${this.baseUrl}/api/1/vehicles/${vehicleId}/data_request/drive_state`,
      { method: 'GET' },
      token
    );

    return this.transformDriveState(vehicleId, response.response);
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  async sendCommand(token: EVAuthToken, request: EVCommandRequest): Promise<EVCommandResult> {
    const { command, vehicleId, params } = request;

    const commandMap: Record<string, { endpoint: string; body?: Record<string, unknown> }> = {
      wake_up: { endpoint: 'wake_up' },
      start_charging: { endpoint: 'command/charge_start' },
      stop_charging: { endpoint: 'command/charge_stop' },
      set_charge_limit: { endpoint: 'command/set_charge_limit', body: { percent: params?.limit } },
      open_charge_port: { endpoint: 'command/charge_port_door_open' },
      close_charge_port: { endpoint: 'command/charge_port_door_close' },
      climate_on: { endpoint: 'command/auto_conditioning_start' },
      climate_off: { endpoint: 'command/auto_conditioning_stop' },
      set_temperature: { endpoint: 'command/set_temps', body: { driver_temp: params?.temperature, passenger_temp: params?.temperature } },
      lock_doors: { endpoint: 'command/door_lock' },
      unlock_doors: { endpoint: 'command/door_unlock' },
      open_trunk: { endpoint: 'command/actuate_trunk', body: { which_trunk: 'rear' } },
      open_frunk: { endpoint: 'command/actuate_trunk', body: { which_trunk: 'front' } },
      flash_lights: { endpoint: 'command/flash_lights' },
      honk_horn: { endpoint: 'command/honk_horn' },
      remote_start: { endpoint: 'command/remote_start_drive' },
      set_sentry_mode: { endpoint: 'command/set_sentry_mode', body: { on: params?.enabled } },
      set_valet_mode: { endpoint: 'command/set_valet_mode', body: { on: params?.enabled, password: params?.pin } }
    };

    const cmd = commandMap[command];
    if (!cmd) {
      return {
        success: false,
        command,
        vehicleId,
        timestamp: new Date(),
        error: `Unknown command: ${command}`
      };
    }

    try {
      const response = await this.makeRequest<{ response: { result: boolean; reason?: string } }>(
        `${this.baseUrl}/api/1/vehicles/${vehicleId}/${cmd.endpoint}`,
        {
          method: 'POST',
          body: cmd.body ? JSON.stringify(cmd.body) : undefined
        },
        token
      );

      return {
        success: response.response.result,
        command,
        vehicleId,
        timestamp: new Date(),
        error: response.response.reason,
        rawResponse: response
      };
    } catch (error) {
      const evError = this.transformError(error);
      return {
        success: false,
        command,
        vehicleId,
        timestamp: new Date(),
        error: evError.message,
        retryable: evError.retryable
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Charging Stations (Tesla Supercharger network)
  // ---------------------------------------------------------------------------

  async findChargingStations(
    token: EVAuthToken,
    latitude: number,
    longitude: number,
    radiusKm: number
  ): Promise<ChargingStation[]> {
    // Tesla doesn't have a public API for Supercharger locations
    // In production, you would use a third-party service or scrape tesla.com/findus
    // For now, return mock data

    console.log('[Tesla] Supercharger lookup not available via API');

    return [
      {
        id: 'sc-mock-1',
        name: 'Tesla Supercharger',
        network: 'tesla_supercharger',
        latitude: latitude + 0.01,
        longitude: longitude + 0.01,
        address: '123 Charging Lane',
        city: 'Unknown',
        state: 'Unknown',
        country: 'USA',
        distance: 5,
        distanceUnit: 'km',
        chargers: [
          { id: 'c1', type: 'supercharger', maxPower: 250, connectorType: 'tesla', status: 'available' }
        ],
        totalChargers: 8,
        availableChargers: 5,
        pricing: { type: 'per_kwh', amount: 0.38, currency: 'USD' },
        is24Hours: true,
        status: 'available',
        lastUpdated: new Date()
      }
    ];
  }

  // ---------------------------------------------------------------------------
  // Transform Helpers
  // ---------------------------------------------------------------------------

  private transformVehicle(tesla: TeslaVehicleResponse): EVVehicle {
    const model = this.parseModelFromOptions(tesla.option_codes);
    const batteryCapacity = this.getBatteryCapacity(model);

    return {
      id: tesla.id_s,
      vin: tesla.vin,
      manufacturer: 'tesla',
      model,
      year: this.getYearFromVin(tesla.vin),
      displayName: tesla.display_name || `Tesla ${model}`,
      color: tesla.color || undefined,
      batteryCapacity,
      maxChargingRate: this.getMaxChargingRate(model),
      isOnline: tesla.state === 'online',
      lastSeen: new Date(),
      capabilities: this.getCapabilities(model),
      rawData: tesla
    };
  }

  private transformChargeState(vehicleId: string, state: TeslaChargeState): BatteryState {
    const chargerType = this.determineChargerType(state);

    return {
      vehicleId,
      timestamp: new Date(state.timestamp),
      stateOfCharge: state.battery_level,
      usableStateOfCharge: state.usable_battery_level,
      energyRemaining: state.battery_range * 0.3, // Rough estimate
      estimatedRange: state.battery_range,
      rangeUnit: 'mi',
      idealRange: state.ideal_battery_range,
      batteryTemp: undefined, // Not directly available
      isPreconditioning: state.preconditioning_enabled,
      chargingState: {
        isCharging: state.charging_state === 'Charging',
        isPluggedIn: state.charge_port_door_open && state.charge_port_latch === 'Engaged',
        chargeRate: state.charger_power,
        voltage: state.charger_voltage,
        amperage: state.charger_actual_current,
        chargeLimit: state.charge_limit_soc,
        chargeLimitMin: state.charge_limit_soc_min,
        chargeLimitMax: state.charge_limit_soc_max,
        minutesToFull: state.minutes_to_full_charge,
        scheduledStart: state.scheduled_charging_start_time
          ? new Date(state.scheduled_charging_start_time * 1000)
          : undefined,
        chargerType,
        energyAdded: state.charge_energy_added
      }
    };
  }

  private transformClimateState(vehicleId: string, state: TeslaClimateState): ClimateState {
    return {
      vehicleId,
      timestamp: new Date(state.timestamp),
      isClimateOn: state.is_climate_on,
      insideTemp: state.inside_temp,
      outsideTemp: state.outside_temp,
      driverTempSetting: state.driver_temp_setting,
      passengerTempSetting: state.passenger_temp_setting,
      isFrontDefrosterOn: state.is_front_defroster_on,
      isRearDefrosterOn: state.is_rear_defroster_on,
      seatHeaterFrontLeft: state.seat_heater_left,
      seatHeaterFrontRight: state.seat_heater_right,
      seatHeaterRearLeft: state.seat_heater_rear_left,
      seatHeaterRearRight: state.seat_heater_rear_right,
      steeringWheelHeater: state.steering_wheel_heater,
      isBatteryPreconditioning: state.battery_heater
    };
  }

  private transformDriveState(vehicleId: string, state: TeslaDriveState): VehicleLocation {
    return {
      vehicleId,
      timestamp: new Date(state.timestamp),
      latitude: state.latitude,
      longitude: state.longitude,
      heading: state.heading,
      speed: state.speed || 0,
      speedUnit: 'mph'
    };
  }

  private parseModelFromOptions(optionCodes: string): string {
    if (optionCodes.includes('MDLS') || optionCodes.includes('MS')) return 'Model S';
    if (optionCodes.includes('MDL3') || optionCodes.includes('M3')) return 'Model 3';
    if (optionCodes.includes('MDLX') || optionCodes.includes('MX')) return 'Model X';
    if (optionCodes.includes('MDLY') || optionCodes.includes('MY')) return 'Model Y';
    return 'Unknown Model';
  }

  private getBatteryCapacity(model: string): number {
    const capacities: Record<string, number> = {
      'Model S': 100,
      'Model 3': 82,
      'Model X': 100,
      'Model Y': 82
    };
    return capacities[model] || 75;
  }

  private getMaxChargingRate(model: string): number {
    const rates: Record<string, number> = {
      'Model S': 250,
      'Model 3': 250,
      'Model X': 250,
      'Model Y': 250
    };
    return rates[model] || 150;
  }

  private getYearFromVin(vin: string): number {
    const yearCode = vin[9];
    const yearMap: Record<string, number> = {
      'J': 2018, 'K': 2019, 'L': 2020, 'M': 2021,
      'N': 2022, 'P': 2023, 'R': 2024, 'S': 2025
    };
    return yearMap[yearCode] || 2020;
  }

  private getCapabilities(model: string): VehicleCapability[] {
    return [
      'remote_start',
      'climate_control',
      'charging_control',
      'door_lock',
      'trunk_open',
      'frunk_open',
      'horn',
      'flash_lights',
      'location',
      'sentry_mode',
      'valet_mode',
      'speed_limit',
      'scheduled_charging',
      'scheduled_departure',
      'battery_preconditioning'
    ];
  }

  private determineChargerType(state: TeslaChargeState): ChargerType {
    if (state.fast_charger_present) {
      if (state.fast_charger_brand?.toLowerCase().includes('tesla')) {
        return 'supercharger';
      }
      return 'dc_fast';
    }
    if (state.charger_voltage > 200) {
      return 'ac_level2';
    }
    return 'ac_level1';
  }

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------

  transformError(error: unknown): EVError {
    const baseError = super.transformError(error);

    // Tesla-specific error handling
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('vehicle unavailable') || message.includes('408')) {
        return { ...baseError, code: 'VEHICLE_ASLEEP', retryable: true };
      }
      if (message.includes('mobile access')) {
        return { ...baseError, code: 'AUTH_FAILED', message: 'Mobile access disabled in vehicle', retryable: false };
      }
    }

    return baseError;
  }
}

// Register the adapter
registerAdapter('tesla', () => new TeslaAdapter());

export default TeslaAdapter;
