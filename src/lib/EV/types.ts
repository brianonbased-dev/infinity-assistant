/**
 * Unified EV Types
 *
 * Single source of truth for all EV-related types.
 * Replaces duplicate type definitions across 11 manufacturer services.
 */

// ============================================================================
// Manufacturer Types
// ============================================================================

export type Manufacturer =
  | 'tesla'
  | 'ford'
  | 'gm'
  | 'bmw'
  | 'volkswagen'
  | 'audi'
  | 'porsche'
  | 'rivian'
  | 'lucid'
  | 'hyundai'
  | 'kia'
  | 'mercedes'
  | 'nissan'
  | 'chevrolet'
  | 'polestar';

export const MANUFACTURER_DISPLAY_NAMES: Record<Manufacturer, string> = {
  tesla: 'Tesla',
  ford: 'Ford',
  gm: 'General Motors',
  bmw: 'BMW',
  volkswagen: 'Volkswagen',
  audi: 'Audi',
  porsche: 'Porsche',
  rivian: 'Rivian',
  lucid: 'Lucid',
  hyundai: 'Hyundai',
  kia: 'Kia',
  mercedes: 'Mercedes-Benz',
  nissan: 'Nissan',
  chevrolet: 'Chevrolet',
  polestar: 'Polestar'
};

// ============================================================================
// Authentication Types
// ============================================================================

export interface EVAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  region?: 'na' | 'eu' | 'cn' | 'global';
}

export interface EVAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: string;
  scope?: string[];
}

export interface EVAuthResult {
  success: boolean;
  token?: EVAuthToken;
  error?: string;
  authUrl?: string; // For OAuth flows
}

// ============================================================================
// Vehicle Types
// ============================================================================

export interface EVVehicle {
  id: string;
  vin?: string;
  manufacturer: Manufacturer;
  model: string;
  year: number;
  displayName?: string;
  color?: string;
  licensePlate?: string;

  // Battery specs
  batteryCapacity: number; // kWh
  maxChargingRate: number; // kW

  // Current state
  isOnline: boolean;
  lastSeen: Date;

  // Capabilities
  capabilities: VehicleCapability[];

  // Raw manufacturer data
  rawData?: Record<string, unknown>;
}

export type VehicleCapability =
  | 'remote_start'
  | 'climate_control'
  | 'charging_control'
  | 'door_lock'
  | 'trunk_open'
  | 'frunk_open'
  | 'horn'
  | 'flash_lights'
  | 'location'
  | 'sentry_mode'
  | 'valet_mode'
  | 'speed_limit'
  | 'scheduled_charging'
  | 'scheduled_departure'
  | 'v2g' // Vehicle-to-grid
  | 'v2h' // Vehicle-to-home
  | 'battery_preconditioning';

// ============================================================================
// Battery & Charging Types
// ============================================================================

export interface BatteryState {
  vehicleId: string;
  timestamp: Date;

  // Battery level
  stateOfCharge: number; // 0-100%
  usableStateOfCharge?: number; // May differ from SOC
  energyRemaining: number; // kWh

  // Range
  estimatedRange: number; // km or miles
  rangeUnit: 'km' | 'mi';
  idealRange?: number;

  // Health
  batteryHealth?: number; // 0-100%
  degradation?: number; // %

  // Temperature
  batteryTemp?: number; // Celsius
  isPreconditioning?: boolean;

  // Charging state
  chargingState: ChargingState;
}

export interface ChargingState {
  isCharging: boolean;
  isPluggedIn: boolean;

  // Current session
  chargeRate?: number; // kW
  voltage?: number; // V
  amperage?: number; // A

  // Limits
  chargeLimit: number; // Target SOC %
  chargeLimitMin?: number;
  chargeLimitMax?: number;

  // Time
  minutesToFull?: number;
  scheduledStart?: Date;

  // Charger info
  chargerType?: ChargerType;
  chargerLocation?: string;

  // Cost tracking
  energyAdded?: number; // kWh this session
  cost?: number;
  costCurrency?: string;
}

export type ChargerType =
  | 'ac_level1' // 120V
  | 'ac_level2' // 240V
  | 'dc_fast' // CCS/CHAdeMO
  | 'supercharger' // Tesla
  | 'destination' // Tesla destination
  | 'home' // Home charger
  | 'unknown';

// ============================================================================
// Climate Types
// ============================================================================

export interface ClimateState {
  vehicleId: string;
  timestamp: Date;

  isClimateOn: boolean;

  // Temperature
  insideTemp?: number; // Celsius
  outsideTemp?: number;
  driverTempSetting?: number;
  passengerTempSetting?: number;

  // Features
  isFrontDefrosterOn?: boolean;
  isRearDefrosterOn?: boolean;
  seatHeaterFrontLeft?: number; // 0-3
  seatHeaterFrontRight?: number;
  seatHeaterRearLeft?: number;
  seatHeaterRearRight?: number;
  steeringWheelHeater?: boolean;

  // Battery preconditioning
  isBatteryPreconditioning?: boolean;
  preconditioningEndTime?: Date;
}

// ============================================================================
// Location Types
// ============================================================================

export interface VehicleLocation {
  vehicleId: string;
  timestamp: Date;

  latitude: number;
  longitude: number;
  altitude?: number;

  heading?: number; // 0-360 degrees
  speed?: number; // km/h or mph
  speedUnit?: 'kmh' | 'mph';

  // Address (reverse geocoded)
  address?: string;
  city?: string;
  state?: string;
  country?: string;

  // Geofence
  isHome?: boolean;
  isWork?: boolean;
  geofenceName?: string;
}

// ============================================================================
// Command Types
// ============================================================================

export type EVCommand =
  | 'wake_up'
  | 'start_charging'
  | 'stop_charging'
  | 'set_charge_limit'
  | 'open_charge_port'
  | 'close_charge_port'
  | 'climate_on'
  | 'climate_off'
  | 'set_temperature'
  | 'lock_doors'
  | 'unlock_doors'
  | 'open_trunk'
  | 'open_frunk'
  | 'flash_lights'
  | 'honk_horn'
  | 'remote_start'
  | 'set_sentry_mode'
  | 'set_valet_mode'
  | 'schedule_charging'
  | 'cancel_scheduled_charging';

export interface EVCommandRequest {
  command: EVCommand;
  vehicleId: string;
  params?: Record<string, unknown>;
}

export interface EVCommandResult {
  success: boolean;
  command: EVCommand;
  vehicleId: string;
  timestamp: Date;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  rawResponse?: unknown;
}

// ============================================================================
// Charging Station Types
// ============================================================================

export interface ChargingStation {
  id: string;
  name: string;
  network: ChargingNetwork;

  // Location
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  country: string;

  // Distance (calculated)
  distance?: number;
  distanceUnit?: 'km' | 'mi';

  // Chargers
  chargers: ChargingStationCharger[];
  totalChargers: number;
  availableChargers: number;

  // Pricing
  pricing?: ChargingPricing;

  // Amenities
  amenities?: string[];

  // Hours
  is24Hours: boolean;
  operatingHours?: string;

  // Status
  status: 'available' | 'busy' | 'offline' | 'unknown';
  lastUpdated: Date;
}

export type ChargingNetwork =
  | 'tesla_supercharger'
  | 'tesla_destination'
  | 'chargepoint'
  | 'electrify_america'
  | 'evgo'
  | 'ionity'
  | 'shell_recharge'
  | 'bp_pulse'
  | 'gridserve'
  | 'other';

export interface ChargingStationCharger {
  id: string;
  type: ChargerType;
  maxPower: number; // kW
  connectorType: ConnectorType;
  status: 'available' | 'in_use' | 'offline' | 'reserved';
}

export type ConnectorType =
  | 'j1772'
  | 'ccs1'
  | 'ccs2'
  | 'chademo'
  | 'tesla'
  | 'nacs'
  | 'type2'
  | 'gbt';

export interface ChargingPricing {
  type: 'per_kwh' | 'per_minute' | 'per_session' | 'free';
  amount?: number;
  currency?: string;
  idleFee?: number;
  memberDiscount?: number;
}

// ============================================================================
// Optimization Types
// ============================================================================

export interface ChargingSchedule {
  vehicleId: string;

  // Schedule
  slots: ChargingSlot[];

  // Optimization factors
  targetSoC: number;
  readyBy?: Date;

  // Cost optimization
  estimatedCost?: number;
  costSavings?: number;

  // Grid optimization
  isGridFriendly?: boolean;
  co2Avoided?: number; // kg

  // V2G/V2H
  dischargeSlots?: DischargeSlot[];
}

export interface ChargingSlot {
  startTime: Date;
  endTime: Date;
  targetPower: number; // kW
  pricePerKwh?: number;
  isOffPeak?: boolean;
}

export interface DischargeSlot {
  startTime: Date;
  endTime: Date;
  maxPower: number; // kW
  minSoC: number; // Don't go below this
  revenuePerKwh?: number;
}

// ============================================================================
// Error Types
// ============================================================================

export interface EVError {
  code: EVErrorCode;
  message: string;
  manufacturer?: Manufacturer;
  vehicleId?: string;
  retryable: boolean;
  retryAfter?: number; // ms
  rawError?: unknown;
}

export type EVErrorCode =
  | 'AUTH_FAILED'
  | 'AUTH_EXPIRED'
  | 'VEHICLE_OFFLINE'
  | 'VEHICLE_ASLEEP'
  | 'VEHICLE_NOT_FOUND'
  | 'COMMAND_FAILED'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_REQUEST'
  | 'NOT_SUPPORTED'
  | 'TIMEOUT';

// ============================================================================
// Event Types (for EventBus integration)
// ============================================================================

export interface EVEventPayload {
  vehicleId: string;
  manufacturer: Manufacturer;
  userId?: string;
  timestamp: Date;
}

export interface ChargingEventPayload extends EVEventPayload {
  batteryPercent: number;
  chargeRate?: number;
  estimatedCompletion?: Date;
}

export interface VehicleStatusPayload extends EVEventPayload {
  isOnline: boolean;
  batteryPercent: number;
  range: number;
  rangeUnit: 'km' | 'mi';
}
