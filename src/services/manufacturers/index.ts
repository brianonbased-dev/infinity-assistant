/**
 * EV Manufacturer Integrations Index
 *
 * Exports all manufacturer-specific integration services and the unified service.
 *
 * Supported Manufacturers:
 * - Tesla: Model S, 3, X, Y, Cybertruck
 * - Ford: Mustang Mach-E, F-150 Lightning, E-Transit
 * - GM: Bolt EV/EUV, Equinox EV, Blazer EV, Silverado EV, Hummer EV, LYRIQ
 * - Rivian: R1T, R1S, R2, R3
 * - BMW: iX, i4, i5, i7, iX1, iX2, iX3
 * - Volkswagen: ID.3, ID.4, ID.5, ID.7, ID.Buzz
 * - Audi: e-tron, Q4 e-tron, Q6 e-tron, Q8 e-tron, e-tron GT
 * - Porsche: Taycan, Macan Electric
 * - Hyundai: IONIQ 5, IONIQ 6, Kona Electric
 * - Kia: EV6, EV9, Niro EV
 * - Genesis: GV60, Electrified GV70, Electrified G80
 *
 * @author Infinity Assistant
 * @version 1.0.0
 */

// Tesla
export {
  TeslaIntegrationService,
  getTeslaIntegrationService,
  type TeslaAuthConfig,
  type TeslaTokens,
  type TeslaVehicle,
  type TeslaVehicleData,
  type TeslaChargeState,
  type TeslaClimateState,
  type TeslaDriveState,
  type TeslaCommandResult,
} from '../TeslaIntegrationService';

// Ford
export {
  FordIntegrationService,
  getFordIntegrationService,
  type FordAuthConfig,
  type FordTokens,
  type FordVehicle,
  type FordVehicleStatus,
  type FordEVStatus,
  type FordCommandResponse,
} from './FordIntegrationService';

// GM (Chevrolet, GMC, Cadillac)
export {
  GMIntegrationService,
  getGMIntegrationService,
  type GMAuthConfig,
  type GMTokens,
  type GMVehicle,
  type GMVehicleStatus,
  type GMEVStatus,
  type GMCommandResponse,
} from './GMIntegrationService';

// Rivian
export {
  RivianIntegrationService,
  getRivianIntegrationService,
  type RivianAuthConfig,
  type RivianTokens,
  type RivianVehicle,
  type RivianVehicleState,
  type RivianChargerState,
  type RivianCommandResult,
} from './RivianIntegrationService';

// BMW
export {
  BMWIntegrationService,
  getBMWIntegrationService,
  type BMWAuthConfig,
  type BMWTokens,
  type BMWVehicle,
  type BMWVehicleState,
  type BMWChargingState,
  type BMWCommandResponse,
} from './BMWIntegrationService';

// Volkswagen Group (VW, Audi, Porsche, Skoda, SEAT, CUPRA)
export {
  VWGroupIntegrationService,
  getVWGroupIntegrationService,
  type VWBrand,
  type VWAuthConfig,
  type VWTokens,
  type VWVehicle,
  type VWVehicleStatus,
  type VWChargingStatus,
  type VWCommandResult,
} from './VWGroupIntegrationService';

// Hyundai/Kia/Genesis
export {
  HyundaiKiaIntegrationService,
  getHyundaiKiaIntegrationService,
  type HKBrand,
  type HKAuthConfig,
  type HKTokens,
  type HKVehicle,
  type HKVehicleStatus,
  type HKEVStatus,
  type HKCommandResult,
} from './HyundaiKiaIntegrationService';

// Unified EV Service (cross-manufacturer)
export {
  UnifiedEVService,
  getUnifiedEVService,
  type Manufacturer,
  type UnifiedVehicle,
  type UnifiedVehicleStatus,
  type UnifiedCommandResult,
  type ManufacturerCredentials,
  type VehicleCapability,
} from './UnifiedEVService';

// ============================================================================
// MANUFACTURER REGISTRY
// ============================================================================

export const SUPPORTED_MANUFACTURERS = [
  'tesla',
  'ford',
  'gm',
  'rivian',
  'bmw',
  'volkswagen',
  'audi',
  'porsche',
  'hyundai',
  'kia',
  'genesis',
] as const;

export const MANUFACTURER_INFO: Record<
  string,
  {
    name: string;
    displayName: string;
    region: string[];
    apiType: string;
    supportsV2G: boolean;
    supportsV2L: boolean;
    maxChargingRate: number;
  }
> = {
  tesla: {
    name: 'tesla',
    displayName: 'Tesla',
    region: ['global'],
    apiType: 'Fleet API',
    supportsV2G: false,
    supportsV2L: false,
    maxChargingRate: 350,
  },
  ford: {
    name: 'ford',
    displayName: 'Ford',
    region: ['us', 'ca', 'eu'],
    apiType: 'FordPass Connect',
    supportsV2G: false,
    supportsV2L: true, // F-150 Lightning Pro Power
    maxChargingRate: 150,
  },
  gm: {
    name: 'gm',
    displayName: 'General Motors',
    region: ['us', 'ca'],
    apiType: 'OnStar',
    supportsV2G: false,
    supportsV2L: true, // PowerBank
    maxChargingRate: 350,
  },
  rivian: {
    name: 'rivian',
    displayName: 'Rivian',
    region: ['us'],
    apiType: 'Rivian API',
    supportsV2G: false,
    supportsV2L: true, // Camp Mode
    maxChargingRate: 220,
  },
  bmw: {
    name: 'bmw',
    displayName: 'BMW',
    region: ['global'],
    apiType: 'ConnectedDrive',
    supportsV2G: false,
    supportsV2L: false,
    maxChargingRate: 200,
  },
  volkswagen: {
    name: 'volkswagen',
    displayName: 'Volkswagen',
    region: ['global'],
    apiType: 'We Connect',
    supportsV2G: true, // ID.4 V2G pilot
    supportsV2L: true, // ID.Buzz bidirectional
    maxChargingRate: 200,
  },
  audi: {
    name: 'audi',
    displayName: 'Audi',
    region: ['global'],
    apiType: 'Audi Connect',
    supportsV2G: false,
    supportsV2L: false,
    maxChargingRate: 270,
  },
  porsche: {
    name: 'porsche',
    displayName: 'Porsche',
    region: ['global'],
    apiType: 'Porsche Connect',
    supportsV2G: false,
    supportsV2L: false,
    maxChargingRate: 270,
  },
  hyundai: {
    name: 'hyundai',
    displayName: 'Hyundai',
    region: ['global'],
    apiType: 'Bluelink',
    supportsV2G: true, // IONIQ 5/6 V2G capable
    supportsV2L: true, // IONIQ 5/6 V2L
    maxChargingRate: 350,
  },
  kia: {
    name: 'kia',
    displayName: 'Kia',
    region: ['global'],
    apiType: 'Kia Connect',
    supportsV2G: true, // EV6/EV9 V2G capable
    supportsV2L: true, // EV6/EV9 V2L
    maxChargingRate: 350,
  },
  genesis: {
    name: 'genesis',
    displayName: 'Genesis',
    region: ['global'],
    apiType: 'Genesis Connected',
    supportsV2G: true,
    supportsV2L: true, // GV60 V2L
    maxChargingRate: 350,
  },
};
