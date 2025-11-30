/**
 * EV Optimization Types for Infinity Assistant
 *
 * Comprehensive type definitions for Electric Vehicle optimization,
 * battery management, charging coordination, and V2X communication.
 *
 * Designed for integration with:
 * - Infinity Assistant Phone App
 * - Direct Car App Integration
 * - V2G Grid Services
 * - Quantum-Enhanced Optimization
 */

// ============================================================================
// CORE EV TYPES
// ============================================================================

export interface EVVehicle {
  id: string;
  userId: string;
  vin?: string;
  make: string;
  model: string;
  year: number;
  batteryCapacity: number; // kWh
  maxChargingRate: number; // kW
  currentRange: number; // km
  maxRange: number; // km
  connectedAt?: Date;
  lastUpdated: Date;
}

export interface BatteryState {
  vehicleId: string;
  stateOfCharge: number; // 0-100%
  stateOfHealth: number; // 0-100%
  temperature: number; // Celsius
  voltage: number; // Volts
  current: number; // Amps
  cellVoltages?: number[]; // Individual cell voltages
  cellTemperatures?: number[]; // Individual cell temperatures
  chargingStatus: ChargingStatus;
  estimatedRange: number; // km
  degradationRate: number; // % per year
  cycleCount: number;
  timestamp: Date;
}

export type ChargingStatus =
  | 'idle'
  | 'charging'
  | 'discharging' // V2G
  | 'scheduled'
  | 'complete'
  | 'error'
  | 'preconditioning';

export interface ChargingSession {
  id: string;
  vehicleId: string;
  stationId?: string;
  startTime: Date;
  endTime?: Date;
  startSoC: number;
  endSoC?: number;
  energyDelivered: number; // kWh
  energyReturned?: number; // kWh (V2G)
  cost?: number;
  revenue?: number; // V2G revenue
  chargingType: ChargingType;
  status: ChargingSessionStatus;
  optimizationApplied: boolean;
  carbonIntensity?: number; // gCO2/kWh
}

export type ChargingType =
  | 'ac_level1' // 120V
  | 'ac_level2' // 240V
  | 'dc_fast' // CCS/CHAdeMO
  | 'ultra_fast' // 350kW+
  | 'wireless' // Inductive
  | 'v2g_bidirectional';

export type ChargingSessionStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'error';

// ============================================================================
// SENSOR & TELEMETRY TYPES
// ============================================================================

export interface VehicleSensors {
  vehicleId: string;
  battery: BatterySensorData;
  motor: MotorSensorData;
  climate: ClimateSensorData;
  tires: TireSensorData;
  driving: DrivingSensorData;
  location: LocationData;
  timestamp: Date;
}

export interface BatterySensorData {
  packVoltage: number;
  packCurrent: number;
  packTemperature: number;
  cellVoltages: number[];
  cellTemperatures: number[];
  insulationResistance: number;
  coolingPumpStatus: boolean;
  heaterStatus: boolean;
  balancingActive: boolean;
}

export interface MotorSensorData {
  rpm: number;
  torque: number;
  temperature: number;
  efficiency: number;
  powerOutput: number; // kW
  regenerativeBraking: boolean;
}

export interface ClimateSensorData {
  cabinTemperature: number;
  outsideTemperature: number;
  humidity: number;
  hvacPower: number; // kW
  hvacMode: 'off' | 'heating' | 'cooling' | 'auto';
  seatHeating: boolean[];
  defrostActive: boolean;
}

export interface TireSensorData {
  pressures: number[]; // PSI for each tire
  temperatures: number[]; // Celsius for each tire
  treadDepth?: number[]; // mm
}

export interface DrivingSensorData {
  speed: number; // km/h
  acceleration: number; // m/s²
  heading: number; // degrees
  elevation: number; // meters
  gradient: number; // degrees
  drivingMode: 'eco' | 'normal' | 'sport' | 'snow';
  regenerationLevel: number; // 0-3
  autonomyLevel: number; // 0-5 (SAE levels)
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: Date;
}

// ============================================================================
// WEATHER & ENVIRONMENT TYPES
// ============================================================================

export interface WeatherConditions {
  temperature: number; // Celsius
  feelsLike: number;
  humidity: number; // %
  windSpeed: number; // km/h
  windDirection: number; // degrees
  precipitation: number; // mm/h
  precipitationType: 'none' | 'rain' | 'snow' | 'sleet' | 'hail';
  visibility: number; // km
  cloudCover: number; // %
  uvIndex: number;
  airQuality: number; // AQI
  pressure: number; // hPa
  sunrise: Date;
  sunset: Date;
}

export interface WeatherForecast {
  location: LocationData;
  current: WeatherConditions;
  hourly: WeatherConditions[];
  daily: DailyWeatherForecast[];
  alerts: WeatherAlert[];
}

export interface DailyWeatherForecast {
  date: Date;
  high: number;
  low: number;
  conditions: string;
  precipitationChance: number;
  sunrise: Date;
  sunset: Date;
}

export interface WeatherAlert {
  type: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  headline: string;
  description: string;
  startTime: Date;
  endTime: Date;
}

// ============================================================================
// GRID & V2X TYPES
// ============================================================================

export interface GridStatus {
  regionId: string;
  frequency: number; // Hz (target: 50 or 60)
  load: number; // MW
  capacity: number; // MW
  renewablePercentage: number; // %
  carbonIntensity: number; // gCO2/kWh
  pricePerKwh: number;
  peakStatus: 'off_peak' | 'mid_peak' | 'on_peak' | 'critical';
  v2gSignal: V2GSignal;
  timestamp: Date;
}

export interface V2GSignal {
  requestType: 'charge' | 'discharge' | 'idle' | 'standby';
  targetPower: number; // kW (positive = charge, negative = discharge)
  duration: number; // minutes
  priceSignal: number; // $/kWh
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  reason?: string;
}

export interface V2XMessage {
  id: string;
  type: V2XMessageType;
  source: V2XEndpoint;
  destination: V2XEndpoint;
  payload: unknown;
  priority: number; // 0-7
  timestamp: Date;
  ttl: number; // milliseconds
  protocol: 'dsrc' | 'cv2x_pc5' | 'cv2x_uu' | '6g';
}

export type V2XMessageType =
  | 'bsm' // Basic Safety Message
  | 'spat' // Signal Phase and Timing
  | 'map' // Map Data
  | 'tim' // Traveler Information
  | 'psm' // Personal Safety Message
  | 'pvd' // Probe Vehicle Data
  | 'v2g_schedule' // V2G Charging Schedule
  | 'v2g_status' // V2G Status Update
  | 'emergency' // Emergency Alert
  | 'cooperative_perception'; // Sensor sharing

export interface V2XEndpoint {
  type: 'vehicle' | 'infrastructure' | 'pedestrian' | 'grid' | 'cloud';
  id: string;
  location?: LocationData;
}

// ============================================================================
// CHARGING STATION TYPES
// ============================================================================

export interface ChargingStation {
  id: string;
  name: string;
  location: LocationData;
  address: string;
  operator: string;
  connectors: ChargingConnector[];
  status: StationStatus;
  pricing: ChargingPricing;
  amenities: string[];
  accessibility: boolean;
  renewable: boolean;
  v2gCapable: boolean;
  reservable: boolean;
  rating: number;
  reviewCount: number;
  lastUpdated: Date;
}

export interface ChargingConnector {
  id: string;
  type: ConnectorType;
  maxPower: number; // kW
  status: 'available' | 'occupied' | 'reserved' | 'out_of_service';
  currentPower?: number;
  vehicleId?: string;
}

export type ConnectorType =
  | 'j1772' // Type 1
  | 'mennekes' // Type 2
  | 'ccs1' // CCS Combo 1
  | 'ccs2' // CCS Combo 2
  | 'chademo'
  | 'tesla_supercharger'
  | 'nacs' // North American Charging Standard
  | 'gb_t' // Chinese standard
  | 'wireless';

export type StationStatus =
  | 'operational'
  | 'partial' // Some connectors available
  | 'offline'
  | 'maintenance';

export interface ChargingPricing {
  currency: string;
  perKwh?: number;
  perMinute?: number;
  connectionFee?: number;
  idleFee?: number;
  memberDiscount?: number;
  v2gRate?: number; // Revenue per kWh discharged
}

// ============================================================================
// OPTIMIZATION & PREDICTION TYPES
// ============================================================================

export interface RangePrediction {
  vehicleId: string;
  currentRange: number; // km
  predictedRange: number; // km
  confidence: number; // 0-1
  factors: RangeFactor[];
  scenarios: RangeScenario[];
  timestamp: Date;
}

export interface RangeFactor {
  name: string;
  impact: number; // km change
  percentage: number; // % of base range
  adjustable: boolean;
  recommendation?: string;
}

export interface RangeScenario {
  name: string;
  description: string;
  predictedRange: number;
  probability: number;
  conditions: string[];
}

export interface ChargingOptimization {
  vehicleId: string;
  targetSoC: number;
  targetTime: Date;
  recommendations: ChargingRecommendation[];
  schedule: ChargingScheduleSlot[];
  estimatedCost: number;
  estimatedCarbonSaved: number; // kg CO2
  v2gRevenue?: number;
  optimizationType: OptimizationType;
}

export interface ChargingRecommendation {
  type: 'timing' | 'location' | 'rate' | 'v2g' | 'preconditioning';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  savings?: number;
  action?: string;
}

export interface ChargingScheduleSlot {
  startTime: Date;
  endTime: Date;
  targetPower: number; // kW
  action: 'charge' | 'discharge' | 'idle';
  reason: string;
  pricePerKwh: number;
  carbonIntensity: number;
}

export type OptimizationType =
  | 'cost' // Minimize cost
  | 'time' // Minimize charging time
  | 'battery' // Maximize battery health
  | 'green' // Minimize carbon
  | 'v2g' // Maximize V2G revenue
  | 'balanced'; // Multi-objective

// ============================================================================
// BATTERY HEALTH & ML TYPES
// ============================================================================

export interface BatteryHealthPrediction {
  vehicleId: string;
  currentSoH: number; // %
  predictedSoH1Year: number;
  predictedSoH3Year: number;
  remainingUsefulLife: number; // cycles
  degradationFactors: DegradationFactor[];
  recommendations: HealthRecommendation[];
  confidenceInterval: [number, number]; // 95% CI
  modelVersion: string;
  timestamp: Date;
}

export interface DegradationFactor {
  name: string;
  contribution: number; // %
  severity: 'low' | 'medium' | 'high';
  actionable: boolean;
  mitigation?: string;
}

export interface HealthRecommendation {
  category: 'charging' | 'usage' | 'storage' | 'maintenance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  action: string;
}

export interface MLModelPrediction {
  modelType: 'range' | 'soh' | 'rul' | 'charging' | 'v2g';
  modelVersion: string;
  prediction: number | number[];
  confidence: number;
  features: Record<string, number>;
  explanations?: FeatureExplanation[];
  timestamp: Date;
}

export interface FeatureExplanation {
  feature: string;
  value: number;
  importance: number;
  direction: 'positive' | 'negative';
}

// ============================================================================
// QUANTUM OPTIMIZATION TYPES
// ============================================================================

export interface QuantumOptimizationRequest {
  problemType: 'charging_schedule' | 'station_placement' | 'v2g_coordination' | 'fleet_routing';
  constraints: OptimizationConstraint[];
  objectives: OptimizationObjective[];
  variables: OptimizationVariable[];
  timeHorizon: number; // minutes
  quantumBackend: 'simulator' | 'dwave' | 'ibm' | 'ionq';
}

export interface OptimizationConstraint {
  name: string;
  type: 'equality' | 'inequality';
  expression: string;
  bound: number;
}

export interface OptimizationObjective {
  name: string;
  type: 'minimize' | 'maximize';
  weight: number;
  expression: string;
}

export interface OptimizationVariable {
  name: string;
  type: 'binary' | 'integer' | 'continuous';
  lowerBound?: number;
  upperBound?: number;
}

export interface QuantumOptimizationResult {
  requestId: string;
  status: 'success' | 'partial' | 'failed';
  solution: Record<string, number>;
  objectiveValue: number;
  executionTime: number; // ms
  quantumTime?: number; // ms on quantum hardware
  iterationsUsed: number;
  algorithm: 'qaoa' | 'vqe' | 'grover' | 'annealing';
  confidence: number;
}

// ============================================================================
// EDGE COMPUTING TYPES
// ============================================================================

export interface EdgeComputeTask {
  id: string;
  type: 'inference' | 'fusion' | 'optimization' | 'communication';
  priority: number;
  inputData: unknown;
  modelId?: string;
  deadline?: Date;
  requirements: EdgeRequirements;
}

export interface EdgeRequirements {
  minTops: number; // Required TOPS
  maxLatency: number; // ms
  maxPower: number; // Watts
  accelerator: 'gpu' | 'npu' | 'tpu' | 'any';
}

export interface EdgeComputeResult {
  taskId: string;
  status: 'success' | 'failed' | 'timeout';
  result: unknown;
  latency: number; // ms
  powerUsed: number; // Watts
  acceleratorUsed: string;
  timestamp: Date;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface EVOptimizationRequest {
  userId: string;
  vehicleId: string;
  action: EVOptimizationAction;
  parameters?: Record<string, unknown>;
  preferences?: EVUserPreferences;
}

export type EVOptimizationAction =
  | 'get_status'
  | 'predict_range'
  | 'optimize_charging'
  | 'schedule_v2g'
  | 'find_stations'
  | 'get_health'
  | 'update_preferences'
  | 'start_charging'
  | 'stop_charging'
  | 'precondition';

export interface EVUserPreferences {
  defaultTargetSoC: number;
  preferredDepartureTime?: string; // HH:MM format
  preferLowCarbon: boolean;
  enableV2G: boolean;
  maxV2GDischarge: number; // Minimum SoC to maintain
  chargingBudget?: number; // Monthly budget
  preferredStations?: string[];
  homeLocation?: LocationData;
  workLocation?: LocationData;
  notificationPreferences: NotificationPreferences;
}

export interface NotificationPreferences {
  chargingComplete: boolean;
  lowBattery: boolean;
  lowBatteryThreshold: number;
  v2gOpportunity: boolean;
  priceAlert: boolean;
  priceThreshold: number;
  maintenanceReminder: boolean;
}

export interface EVOptimizationResponse {
  success: boolean;
  action: EVOptimizationAction;
  data?: unknown;
  recommendations?: ChargingRecommendation[];
  error?: string;
  metadata: {
    processingTime: number;
    modelVersion?: string;
    quantumEnhanced?: boolean;
  };
}

// ============================================================================
// SOLID-STATE BATTERY TYPES (Future)
// ============================================================================

export interface SolidStateBatteryMetrics {
  type: 'solid_state';
  chemistry: 'lithium_metal' | 'sulfide' | 'oxide' | 'polymer';
  energyDensity: number; // Wh/kg
  chargingSpeed: number; // C-rate
  cycleLife: number; // Expected cycles
  operatingTempRange: [number, number]; // Celsius
  safetyRating: 'standard' | 'enhanced' | 'fire_resistant';
  degradationProfile: 'linear' | 'accelerated_end' | 'minimal';
}

// ============================================================================
// 6G V2X TYPES (Future)
// ============================================================================

export interface SixGV2XCapabilities {
  terahertzEnabled: boolean;
  maxDataRate: number; // Gbps
  latency: number; // microseconds
  reliabilityTarget: number; // 99.999...%
  aiNative: boolean;
  semanticCommunication: boolean;
  holisticSensing: boolean;
  computeOffloading: boolean;
}

export interface SemanticV2XMessage {
  id: string;
  semanticType: 'perception' | 'intention' | 'prediction' | 'coordination';
  encodedFeatures: Float32Array;
  compressionRatio: number;
  aiModelId: string;
  timestamp: Date;
}
