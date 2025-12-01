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
  CacheEntry,
  CacheOptions,
  CacheStats,
  cacheRegistry,
  getCache,
  vehicleCache,
  userCache,
  apiCache,
  sessionCache
} from './CacheService';

// Event Bus - replaces fragmented event systems
export {
  EventType,
  EventCategory,
  EventPayloadMap,
  EventHandler,
  WildcardHandler,
  Event,
  Subscription,
  EventBusOptions,
  eventBus,
  getEventBus,
  createPayload,
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
  ErrorCode,
  ServiceErrorOptions,
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

// Singleton Factory - replaces 25 duplicate singleton patterns
export {
  createSingleton,
  createAsyncSingleton,
  createConfigurableSingleton,
  createRegisteredSingleton,
  SingletonOptions,
  SingletonAccessor,
  singletonRegistry,
  ServiceContainer,
  serviceContainer
} from './createSingleton';

// API Middleware - standardizes route handling
export {
  withMiddleware,
  withAuth,
  withPublic,
  withRateLimit,
  ApiContext,
  AuthenticatedContext,
  ApiHandler,
  RouteOptions,
  ValidationSchema,
  ApiResponse,
  json,
  success,
  error,
  parseBody,
  getQuery,
  getParams
} from './apiMiddleware';

// EV Module - disabled for initial release (Phase 2)
// export * from './EV';

// Build Module - consolidated build/deployment functionality
export * from './build';

// Cross-Service Integrations - disabled for initial release (Phase 2)
// export * from './integrations';
