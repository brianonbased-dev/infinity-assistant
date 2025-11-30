/**
 * EV Module Index
 *
 * Unified EV functionality - replaces 11 separate services with 1 module.
 */

// Types
export * from './types';

// Adapter pattern
export {
  EVManufacturerAdapter,
  BaseEVAdapter,
  MockEVAdapter,
  registerAdapter,
  getAdapter,
  hasAdapter,
  getRegisteredManufacturers
} from './EVManufacturerAdapter';

// Main service
export {
  UserVehicleConnection,
  EVServiceConfig,
  getEVService,
  evService
} from './EVService';

// Adapters - importing triggers registration
// Use dynamic imports in production for code splitting
export * from './adapters';

// Re-export default
export { default } from './EVService';
