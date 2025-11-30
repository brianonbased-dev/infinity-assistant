/**
 * EV Manufacturer Adapters Index
 *
 * Auto-registers all adapters when imported.
 * Supports 12+ manufacturers through unified adapter pattern.
 */

// Import adapters to trigger registration
export { TeslaAdapter } from './TeslaAdapter';
export { FordAdapter } from './FordAdapter';
export { BMWAdapter } from './BMWAdapter';
export { GMAdapter } from './GMAdapter';
export { RivianAdapter } from './RivianAdapter';
export { VWGroupAdapter } from './VWGroupAdapter'; // Also registers Audi, Porsche
export { HyundaiKiaAdapter } from './HyundaiKiaAdapter'; // Also registers Kia

// Re-export types and utilities
export {
  registerAdapter,
  getAdapter,
  hasAdapter,
  getRegisteredManufacturers,
} from '../EVManufacturerAdapter';

/**
 * Supported Manufacturers:
 * - Tesla (TeslaAdapter)
 * - Ford (FordAdapter)
 * - BMW (BMWAdapter)
 * - GM/Chevrolet/Cadillac/GMC (GMAdapter)
 * - Rivian (RivianAdapter)
 * - Volkswagen (VWGroupAdapter)
 * - Audi (VWGroupAdapter)
 * - Porsche (VWGroupAdapter)
 * - Hyundai (HyundaiKiaAdapter)
 * - Kia (HyundaiKiaAdapter)
 */
