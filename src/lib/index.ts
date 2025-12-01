/**
 * Shared Library Index
 *
 * Central exports for all shared utilities.
 * These replace duplicate patterns across 43+ services.
 */

// Cache Service - replaces 16 duplicate cache implementations
export {
  CacheService,
  MultiKeyCache,
  cacheRegistry,
  getCache,
  vehicleCache,
  userCache,
  apiCache,
  sessionCache
} from './CacheService';

export type {
  CacheEntry,
  CacheOptions,
  CacheStats
} from './CacheService';

// Event Bus - replaces fragmented event systems
export {
  eventBus,
  getEventBus,
  createPayload
} from './EventBus';

export type {
  EventType,
  EventCategory,
  EventPayloadMap,
  EventHandler,
  WildcardHandler,
  Event,
  Subscription,
  EventBusOptions,
  // Payload types
  BaseEventPayload,
  VehicleEventPayload,
  ChargingEventPayload,
  BuildEventPayload,
  DeploymentEventPayload,
  UserEventPayload,
  BillingEventPayload,
  AgentEventPayload,
  SystemEventPayload,
  ErrorEventPayload
} from './EventBus';

// Service Error - standardizes error handling
export {
  ServiceError,
  // Factory functions
  createError,
  authRequired,
  authInvalidToken,
  authExpiredToken,
  authInsufficientPermissions,
  validationFailed,
  validationMissingField,
  validationInvalidFormat,
  resourceNotFound,
  resourceAlreadyExists,
  rateLimitExceeded,
  externalServiceError,
  externalServiceTimeout,
  databaseError,
  businessRuleViolation,
  subscriptionRequired,
  vehicleNotFound,
  vehicleOffline,
  vehicleCommandFailed,
  manufacturerApiError,
  buildFailed,
  deploymentFailed,
  internalError,
  notImplemented,
  // Utilities
  isServiceError,
  wrapError,
  errorResponse,
  withRetry
} from './ServiceError';

export type { ServiceErrorOptions, ErrorCode } from './ServiceError';

// Singleton Factory - replaces 25 duplicate singleton patterns
export {
  createSingleton,
  createAsyncSingleton,
  createConfigurableSingleton,
  createRegisteredSingleton,
  singletonRegistry,
  ServiceContainer,
  serviceContainer
} from './createSingleton';

export type {
  SingletonOptions,
  SingletonAccessor
} from './createSingleton';

// API Middleware - standardizes route handling
export {
  withMiddleware,
  withAuth,
  withPublic,
  withRateLimit,
  json,
  success,
  error,
  parseBody,
  getQuery,
  getParams
} from './apiMiddleware';

export type {
  ApiContext,
  AuthenticatedContext,
  ApiHandler,
  RouteOptions,
  ValidationSchema,
  ApiResponse
} from './apiMiddleware';

// EV Module - disabled for initial release (Phase 2)
// export * from './EV';

// Build Module - consolidated build/deployment functionality
export * from './build';

// Cross-Service Integrations - disabled for initial release (Phase 2)
// export * from './integrations';
