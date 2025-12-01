/**
 * API Middleware Utilities
 *
 * Standardizes API route handling across 39+ routes.
 * Provides auth, validation, error handling, and rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServiceError, wrapError, errorResponse, authRequired, validationFailed } from './ServiceError';

// ============================================================================
// Types
// ============================================================================

export interface ApiContext {
  userId?: string;
  sessionId?: string;
  requestId: string;
  startTime: number;
}

export interface AuthenticatedContext extends ApiContext {
  userId: string;
  email?: string;
  plan?: string;
}

export type ApiHandler<T extends ApiContext = ApiContext> = (
  req: NextRequest,
  ctx: T
) => Promise<NextResponse>;

export interface RouteOptions {
  /** Require authentication */
  requireAuth?: boolean;
  /** Required user plan levels */
  requiredPlans?: string[];
  /** Rate limit (requests per minute) */
  rateLimit?: number;
  /** Request body validation schema */
  bodySchema?: ValidationSchema;
  /** Query param validation schema */
  querySchema?: ValidationSchema;
  /** Enable request logging */
  logging?: boolean;
  /** Custom error handler */
  onError?: (error: Error, ctx: ApiContext) => NextResponse | void;
}

export interface ValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: (string | number)[];
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    duration?: number;
  };
}

// ============================================================================
// Rate Limiting
// ============================================================================

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

// ============================================================================
// Validation
// ============================================================================

function validateData(
  data: Record<string, unknown>,
  schema: ValidationSchema
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors[key] = `${key} is required`;
      continue;
    }

    // Skip validation if not provided and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type check
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rules.type) {
      errors[key] = `${key} must be a ${rules.type}`;
      continue;
    }

    // String validations
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors[key] = `${key} must be at least ${rules.minLength} characters`;
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors[key] = `${key} must be at most ${rules.maxLength} characters`;
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors[key] = `${key} has invalid format`;
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors[key] = `${key} must be one of: ${rules.enum.join(', ')}`;
      }
    }

    // Number validations
    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors[key] = `${key} must be at least ${rules.min}`;
      }
      if (rules.max !== undefined && value > rules.max) {
        errors[key] = `${key} must be at most ${rules.max}`;
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors[key] = `${key} must be one of: ${rules.enum.join(', ')}`;
      }
    }

    // Array validations
    if (rules.type === 'array' && Array.isArray(value)) {
      if (rules.minLength && value.length < rules.minLength) {
        errors[key] = `${key} must have at least ${rules.minLength} items`;
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors[key] = `${key} must have at most ${rules.maxLength} items`;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ============================================================================
// Authentication
// ============================================================================

async function getUser(req: NextRequest): Promise<{ userId: string; email?: string; plan?: string } | null> {
  // Check Authorization header
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // In production, validate JWT/session token here
    // For now, decode a simple format or use mock
    if (token.startsWith('user_')) {
      return { userId: token, plan: 'free' };
    }
  }

  // Check cookie
  const sessionCookie = req.cookies.get('session');
  if (sessionCookie?.value) {
    // Validate session
    return { userId: sessionCookie.value, plan: 'free' };
  }

  return null;
}

// ============================================================================
// Response Helpers
// ============================================================================

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function success<T>(data: T, ctx?: ApiContext): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: ctx ? {
      requestId: ctx.requestId,
      timestamp: new Date().toISOString(),
      duration: Date.now() - ctx.startTime
    } : undefined
  };
  return json(response);
}

export function error(code: string, message: string, status: number = 400, details?: Record<string, unknown>): NextResponse {
  const response: ApiResponse = {
    success: false,
    error: { code, message, details }
  };
  return json(response, { status });
}

// ============================================================================
// Main Middleware Factory
// ============================================================================

/**
 * Create a wrapped API handler with middleware
 */
export function withMiddleware(
  handler: ApiHandler<AuthenticatedContext>,
  options: RouteOptions & { requireAuth: true }
): (req: NextRequest) => Promise<NextResponse>;

export function withMiddleware(
  handler: ApiHandler<ApiContext>,
  options?: RouteOptions
): (req: NextRequest) => Promise<NextResponse>;

export function withMiddleware(
  handler: ApiHandler<any>,
  options: RouteOptions = {}
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    const ctx: ApiContext = {
      requestId,
      startTime
    };

    try {
      // Logging
      if (options.logging) {
        console.log(`[API] ${req.method} ${req.url} - ${requestId}`);
      }

      // Rate limiting
      if (options.rateLimit) {
        const rateLimitKey = req.headers.get('x-forwarded-for') || (req as any).ip || 'unknown';
        if (!checkRateLimit(rateLimitKey, options.rateLimit)) {
          return error('RATE_LIMIT_EXCEEDED', 'Too many requests', 429);
        }
      }

      // Authentication
      if (options.requireAuth) {
        const user = await getUser(req);
        if (!user) {
          return error('AUTH_REQUIRED', 'Authentication required', 401);
        }

        (ctx as AuthenticatedContext).userId = user.userId;
        (ctx as AuthenticatedContext).email = user.email;
        (ctx as AuthenticatedContext).plan = user.plan;

        // Plan check
        if (options.requiredPlans && options.requiredPlans.length > 0) {
          if (!user.plan || !options.requiredPlans.includes(user.plan)) {
            return error('SUBSCRIPTION_REQUIRED', `This feature requires: ${options.requiredPlans.join(' or ')}`, 403);
          }
        }
      }

      // Body validation
      if (options.bodySchema && ['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
        try {
          const body = await req.json();
          const validation = validateData(body, options.bodySchema);
          if (!validation.valid) {
            return error('VALIDATION_FAILED', 'Invalid request body', 400, validation.errors);
          }
        } catch {
          return error('INVALID_JSON', 'Request body must be valid JSON', 400);
        }
      }

      // Query validation
      if (options.querySchema) {
        const query: Record<string, string> = {};
        req.nextUrl.searchParams.forEach((value, key) => {
          query[key] = value;
        });
        const validation = validateData(query, options.querySchema);
        if (!validation.valid) {
          return error('VALIDATION_FAILED', 'Invalid query parameters', 400, validation.errors);
        }
      }

      // Call handler
      const response = await handler(req, ctx as any);

      // Logging
      if (options.logging) {
        const duration = Date.now() - startTime;
        console.log(`[API] ${req.method} ${req.url} - ${response.status} (${duration}ms)`);
      }

      return response;
    } catch (err) {
      // Custom error handler
      if (options.onError) {
        const customResponse = options.onError(err as Error, ctx);
        if (customResponse) return customResponse;
      }

      // Standard error handling
      const serviceError = wrapError(err);

      if (options.logging) {
        console.error(`[API] Error in ${req.url}:`, serviceError.toDetailedJSON());
      }

      return json(serviceError.toJSON(), { status: serviceError.httpStatus });
    }
  };
}

// ============================================================================
// Convenience Wrappers
// ============================================================================

/**
 * Create authenticated route handler
 */
export function withAuth(handler: ApiHandler<AuthenticatedContext>, options?: Omit<RouteOptions, 'requireAuth'>) {
  return withMiddleware(handler, { ...options, requireAuth: true });
}

/**
 * Create public route handler
 */
export function withPublic(handler: ApiHandler<ApiContext>, options?: Omit<RouteOptions, 'requireAuth'>) {
  return withMiddleware(handler, { ...options, requireAuth: false });
}

/**
 * Create rate-limited route handler
 */
export function withRateLimit(limit: number, handler: ApiHandler<ApiContext>, options?: RouteOptions) {
  return withMiddleware(handler, { ...options, rateLimit: limit });
}

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Parse JSON body safely
 */
export async function parseBody<T = unknown>(req: NextRequest): Promise<T | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * Get query parameters as object
 */
export function getQuery(req: NextRequest): Record<string, string> {
  const query: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return query;
}

/**
 * Get path parameters from URL
 */
export function getParams(req: NextRequest, pattern: string): Record<string, string> | null {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);

  if (pathParts.length !== patternParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith('[') && patternParts[i].endsWith(']')) {
      const paramName = patternParts[i].slice(1, -1);
      params[paramName] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return params;
}

export default withMiddleware;
