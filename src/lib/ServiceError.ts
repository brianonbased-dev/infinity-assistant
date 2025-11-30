/**
 * Unified Service Error System
 *
 * Standardizes error handling across all services.
 * Provides consistent error codes, retryability, and HTTP status mapping.
 */

// ============================================================================
// Error Codes
// ============================================================================

export type ErrorCode =
  // Authentication errors (401)
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_EXPIRED_TOKEN'
  | 'AUTH_INSUFFICIENT_PERMISSIONS'
  // Validation errors (400)
  | 'VALIDATION_FAILED'
  | 'VALIDATION_MISSING_FIELD'
  | 'VALIDATION_INVALID_FORMAT'
  | 'VALIDATION_OUT_OF_RANGE'
  // Resource errors (404, 409, 410)
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_ALREADY_EXISTS'
  | 'RESOURCE_DELETED'
  | 'RESOURCE_LOCKED'
  // Rate limiting (429)
  | 'RATE_LIMIT_EXCEEDED'
  | 'QUOTA_EXCEEDED'
  // External service errors (502, 503, 504)
  | 'EXTERNAL_SERVICE_ERROR'
  | 'EXTERNAL_SERVICE_TIMEOUT'
  | 'EXTERNAL_SERVICE_UNAVAILABLE'
  // Database errors (500)
  | 'DATABASE_ERROR'
  | 'DATABASE_CONNECTION_FAILED'
  | 'DATABASE_QUERY_FAILED'
  | 'DATABASE_CONSTRAINT_VIOLATION'
  // Business logic errors (422)
  | 'BUSINESS_RULE_VIOLATION'
  | 'INSUFFICIENT_FUNDS'
  | 'SUBSCRIPTION_REQUIRED'
  | 'FEATURE_DISABLED'
  // Internal errors (500)
  | 'INTERNAL_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'NOT_IMPLEMENTED'
  // EV-specific errors
  | 'VEHICLE_NOT_FOUND'
  | 'VEHICLE_OFFLINE'
  | 'VEHICLE_COMMAND_FAILED'
  | 'CHARGING_ERROR'
  | 'MANUFACTURER_API_ERROR'
  // Build/Deploy errors
  | 'BUILD_FAILED'
  | 'DEPLOYMENT_FAILED'
  | 'ROLLBACK_FAILED';

// ============================================================================
// Error Code Metadata
// ============================================================================

interface ErrorCodeMeta {
  httpStatus: number;
  retryable: boolean;
  retryDelay?: number; // ms
  maxRetries?: number;
  userFacing: boolean;
  category: string;
}

const ERROR_CODE_META: Record<ErrorCode, ErrorCodeMeta> = {
  // Authentication (401)
  AUTH_REQUIRED: { httpStatus: 401, retryable: false, userFacing: true, category: 'auth' },
  AUTH_INVALID_TOKEN: { httpStatus: 401, retryable: false, userFacing: true, category: 'auth' },
  AUTH_EXPIRED_TOKEN: { httpStatus: 401, retryable: true, retryDelay: 0, maxRetries: 1, userFacing: true, category: 'auth' },
  AUTH_INSUFFICIENT_PERMISSIONS: { httpStatus: 403, retryable: false, userFacing: true, category: 'auth' },

  // Validation (400)
  VALIDATION_FAILED: { httpStatus: 400, retryable: false, userFacing: true, category: 'validation' },
  VALIDATION_MISSING_FIELD: { httpStatus: 400, retryable: false, userFacing: true, category: 'validation' },
  VALIDATION_INVALID_FORMAT: { httpStatus: 400, retryable: false, userFacing: true, category: 'validation' },
  VALIDATION_OUT_OF_RANGE: { httpStatus: 400, retryable: false, userFacing: true, category: 'validation' },

  // Resources (404, 409, 410)
  RESOURCE_NOT_FOUND: { httpStatus: 404, retryable: false, userFacing: true, category: 'resource' },
  RESOURCE_ALREADY_EXISTS: { httpStatus: 409, retryable: false, userFacing: true, category: 'resource' },
  RESOURCE_DELETED: { httpStatus: 410, retryable: false, userFacing: true, category: 'resource' },
  RESOURCE_LOCKED: { httpStatus: 423, retryable: true, retryDelay: 1000, maxRetries: 3, userFacing: true, category: 'resource' },

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: { httpStatus: 429, retryable: true, retryDelay: 60000, maxRetries: 3, userFacing: true, category: 'rate_limit' },
  QUOTA_EXCEEDED: { httpStatus: 429, retryable: false, userFacing: true, category: 'rate_limit' },

  // External services (502, 503, 504)
  EXTERNAL_SERVICE_ERROR: { httpStatus: 502, retryable: true, retryDelay: 1000, maxRetries: 3, userFacing: false, category: 'external' },
  EXTERNAL_SERVICE_TIMEOUT: { httpStatus: 504, retryable: true, retryDelay: 2000, maxRetries: 2, userFacing: false, category: 'external' },
  EXTERNAL_SERVICE_UNAVAILABLE: { httpStatus: 503, retryable: true, retryDelay: 5000, maxRetries: 3, userFacing: false, category: 'external' },

  // Database (500)
  DATABASE_ERROR: { httpStatus: 500, retryable: true, retryDelay: 500, maxRetries: 2, userFacing: false, category: 'database' },
  DATABASE_CONNECTION_FAILED: { httpStatus: 503, retryable: true, retryDelay: 1000, maxRetries: 3, userFacing: false, category: 'database' },
  DATABASE_QUERY_FAILED: { httpStatus: 500, retryable: false, userFacing: false, category: 'database' },
  DATABASE_CONSTRAINT_VIOLATION: { httpStatus: 409, retryable: false, userFacing: true, category: 'database' },

  // Business logic (422)
  BUSINESS_RULE_VIOLATION: { httpStatus: 422, retryable: false, userFacing: true, category: 'business' },
  INSUFFICIENT_FUNDS: { httpStatus: 402, retryable: false, userFacing: true, category: 'business' },
  SUBSCRIPTION_REQUIRED: { httpStatus: 402, retryable: false, userFacing: true, category: 'business' },
  FEATURE_DISABLED: { httpStatus: 403, retryable: false, userFacing: true, category: 'business' },

  // Internal (500)
  INTERNAL_ERROR: { httpStatus: 500, retryable: true, retryDelay: 1000, maxRetries: 1, userFacing: false, category: 'internal' },
  CONFIGURATION_ERROR: { httpStatus: 500, retryable: false, userFacing: false, category: 'internal' },
  NOT_IMPLEMENTED: { httpStatus: 501, retryable: false, userFacing: true, category: 'internal' },

  // EV-specific
  VEHICLE_NOT_FOUND: { httpStatus: 404, retryable: false, userFacing: true, category: 'ev' },
  VEHICLE_OFFLINE: { httpStatus: 503, retryable: true, retryDelay: 5000, maxRetries: 3, userFacing: true, category: 'ev' },
  VEHICLE_COMMAND_FAILED: { httpStatus: 500, retryable: true, retryDelay: 2000, maxRetries: 2, userFacing: true, category: 'ev' },
  CHARGING_ERROR: { httpStatus: 500, retryable: true, retryDelay: 3000, maxRetries: 2, userFacing: true, category: 'ev' },
  MANUFACTURER_API_ERROR: { httpStatus: 502, retryable: true, retryDelay: 2000, maxRetries: 3, userFacing: false, category: 'ev' },

  // Build/Deploy
  BUILD_FAILED: { httpStatus: 500, retryable: true, retryDelay: 0, maxRetries: 1, userFacing: true, category: 'build' },
  DEPLOYMENT_FAILED: { httpStatus: 500, retryable: true, retryDelay: 5000, maxRetries: 2, userFacing: true, category: 'deploy' },
  ROLLBACK_FAILED: { httpStatus: 500, retryable: true, retryDelay: 5000, maxRetries: 1, userFacing: true, category: 'deploy' }
};

// ============================================================================
// ServiceError Class
// ============================================================================

export interface ServiceErrorOptions {
  code: ErrorCode;
  message: string;
  cause?: Error;
  context?: Record<string, unknown>;
  userMessage?: string;
}

export class ServiceError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly retryable: boolean;
  public readonly retryDelay?: number;
  public readonly maxRetries?: number;
  public readonly userFacing: boolean;
  public readonly category: string;
  public readonly context?: Record<string, unknown>;
  public readonly userMessage?: string;
  public readonly timestamp: Date;
  public readonly cause?: Error;

  constructor(options: ServiceErrorOptions) {
    super(options.message);
    this.name = 'ServiceError';
    this.code = options.code;
    this.cause = options.cause;
    this.context = options.context;
    this.userMessage = options.userMessage;
    this.timestamp = new Date();

    const meta = ERROR_CODE_META[options.code];
    this.httpStatus = meta.httpStatus;
    this.retryable = meta.retryable;
    this.retryDelay = meta.retryDelay;
    this.maxRetries = meta.maxRetries;
    this.userFacing = meta.userFacing;
    this.category = meta.category;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ServiceError);
    }
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.userFacing ? this.message : this.userMessage || 'An error occurred',
        ...(this.context && this.userFacing ? { context: this.context } : {}),
        timestamp: this.timestamp.toISOString()
      }
    };
  }

  /**
   * Convert to detailed JSON for logging
   */
  toDetailedJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      retryable: this.retryable,
      retryDelay: this.retryDelay,
      maxRetries: this.maxRetries,
      category: this.category,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : undefined
    };
  }

  /**
   * Check if error is of a specific category
   */
  isCategory(category: string): boolean {
    return this.category === category;
  }

  /**
   * Create a new error with additional context
   */
  withContext(additionalContext: Record<string, unknown>): ServiceError {
    return new ServiceError({
      code: this.code,
      message: this.message,
      cause: this.cause,
      context: { ...this.context, ...additionalContext },
      userMessage: this.userMessage
    });
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

export function createError(code: ErrorCode, message: string, context?: Record<string, unknown>): ServiceError {
  return new ServiceError({ code, message, context });
}

// Auth errors
export function authRequired(message = 'Authentication required'): ServiceError {
  return createError('AUTH_REQUIRED', message);
}

export function authInvalidToken(message = 'Invalid authentication token'): ServiceError {
  return createError('AUTH_INVALID_TOKEN', message);
}

export function authExpiredToken(message = 'Authentication token has expired'): ServiceError {
  return createError('AUTH_EXPIRED_TOKEN', message);
}

export function authInsufficientPermissions(required?: string): ServiceError {
  return createError('AUTH_INSUFFICIENT_PERMISSIONS', `Insufficient permissions${required ? `: requires ${required}` : ''}`, { required });
}

// Validation errors
export function validationFailed(message: string, errors?: Record<string, string>): ServiceError {
  return createError('VALIDATION_FAILED', message, { errors });
}

export function validationMissingField(field: string): ServiceError {
  return createError('VALIDATION_MISSING_FIELD', `Missing required field: ${field}`, { field });
}

export function validationInvalidFormat(field: string, expected: string): ServiceError {
  return createError('VALIDATION_INVALID_FORMAT', `Invalid format for ${field}: expected ${expected}`, { field, expected });
}

// Resource errors
export function resourceNotFound(resourceType: string, id?: string): ServiceError {
  return createError('RESOURCE_NOT_FOUND', `${resourceType} not found${id ? `: ${id}` : ''}`, { resourceType, id });
}

export function resourceAlreadyExists(resourceType: string, id?: string): ServiceError {
  return createError('RESOURCE_ALREADY_EXISTS', `${resourceType} already exists${id ? `: ${id}` : ''}`, { resourceType, id });
}

// Rate limiting
export function rateLimitExceeded(retryAfter?: number): ServiceError {
  return createError('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded', { retryAfter });
}

// External service errors
export function externalServiceError(service: string, message: string, cause?: Error): ServiceError {
  return new ServiceError({
    code: 'EXTERNAL_SERVICE_ERROR',
    message: `External service error (${service}): ${message}`,
    cause,
    context: { service }
  });
}

export function externalServiceTimeout(service: string, timeoutMs: number): ServiceError {
  return createError('EXTERNAL_SERVICE_TIMEOUT', `External service timeout (${service}): ${timeoutMs}ms`, { service, timeoutMs });
}

// Database errors
export function databaseError(operation: string, cause?: Error): ServiceError {
  return new ServiceError({
    code: 'DATABASE_ERROR',
    message: `Database error during ${operation}`,
    cause,
    context: { operation }
  });
}

// Business logic errors
export function businessRuleViolation(rule: string, message: string): ServiceError {
  return createError('BUSINESS_RULE_VIOLATION', message, { rule });
}

export function subscriptionRequired(feature: string): ServiceError {
  return createError('SUBSCRIPTION_REQUIRED', `Subscription required for: ${feature}`, { feature });
}

// EV-specific errors
export function vehicleNotFound(vehicleId: string): ServiceError {
  return createError('VEHICLE_NOT_FOUND', `Vehicle not found: ${vehicleId}`, { vehicleId });
}

export function vehicleOffline(vehicleId: string): ServiceError {
  return createError('VEHICLE_OFFLINE', `Vehicle is offline: ${vehicleId}`, { vehicleId });
}

export function vehicleCommandFailed(vehicleId: string, command: string, reason?: string): ServiceError {
  return createError('VEHICLE_COMMAND_FAILED', `Vehicle command failed: ${command}${reason ? ` - ${reason}` : ''}`, { vehicleId, command, reason });
}

export function manufacturerApiError(manufacturer: string, message: string, cause?: Error): ServiceError {
  return new ServiceError({
    code: 'MANUFACTURER_API_ERROR',
    message: `${manufacturer} API error: ${message}`,
    cause,
    context: { manufacturer }
  });
}

// Build/Deploy errors
export function buildFailed(projectId: string, phase: string, reason: string): ServiceError {
  return createError('BUILD_FAILED', `Build failed at ${phase}: ${reason}`, { projectId, phase, reason });
}

export function deploymentFailed(deploymentId: string, platform: string, reason: string): ServiceError {
  return createError('DEPLOYMENT_FAILED', `Deployment failed on ${platform}: ${reason}`, { deploymentId, platform, reason });
}

// Internal errors
export function internalError(message: string, cause?: Error): ServiceError {
  return new ServiceError({
    code: 'INTERNAL_ERROR',
    message,
    cause,
    userMessage: 'An unexpected error occurred'
  });
}

export function notImplemented(feature: string): ServiceError {
  return createError('NOT_IMPLEMENTED', `Feature not implemented: ${feature}`, { feature });
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Check if an error is a ServiceError
 */
export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}

/**
 * Wrap unknown errors as ServiceError
 */
export function wrapError(error: unknown, defaultCode: ErrorCode = 'INTERNAL_ERROR'): ServiceError {
  if (error instanceof ServiceError) {
    return error;
  }

  if (error instanceof Error) {
    return new ServiceError({
      code: defaultCode,
      message: error.message,
      cause: error,
      userMessage: 'An unexpected error occurred'
    });
  }

  return new ServiceError({
    code: defaultCode,
    message: String(error),
    userMessage: 'An unexpected error occurred'
  });
}

/**
 * Create error response for API
 */
export function errorResponse(error: unknown): { status: number; body: Record<string, unknown> } {
  const serviceError = wrapError(error);
  return {
    status: serviceError.httpStatus,
    body: serviceError.toJSON()
  };
}

/**
 * Retry helper with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (error: Error, attempt: number) => void;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.baseDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 30000;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (error instanceof ServiceError && !error.retryable) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      if (options?.onRetry) {
        options.onRetry(lastError, attempt + 1);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export default ServiceError;
