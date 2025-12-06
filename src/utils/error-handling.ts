/**
 * Enhanced Error Handling Utilities
 * 
 * Provides standardized error responses, user-friendly messages,
 * and proper error recovery guidance.
 */

import { NextResponse } from 'next/server';
import logger from './logger';

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retry_after?: number;
  recovery_guidance?: string;
}

export interface ErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * Get user-friendly error message from error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Error codes for different error types
 */
export enum ErrorCode {
  // Authentication
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  INVALID_TOKEN = 'INVALID_TOKEN',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE',
  MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
  MESSAGE_REQUIRED = 'MESSAGE_REQUIRED',
  
  // Resource
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  
  // Network
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
  REQUEST_CANCELLED = 'REQUEST_CANCELLED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  
  // Agent
  AGENT_ERROR = 'AGENT_ERROR',
  AGENT_TIMEOUT = 'AGENT_TIMEOUT',
}

/**
 * HTTP status codes for error codes
 */
const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.AUTH_REQUIRED]: 401,
  [ErrorCode.INVALID_API_KEY]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FIELD_VALUE]: 400,
  [ErrorCode.MESSAGE_TOO_LONG]: 400,
  [ErrorCode.MESSAGE_REQUIRED]: 400,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.CONVERSATION_NOT_FOUND]: 404,
  [ErrorCode.REQUEST_TIMEOUT]: 408,
  [ErrorCode.REQUEST_CANCELLED]: 499,
  [ErrorCode.NETWORK_ERROR]: 503,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.AGENT_ERROR]: 500,
  [ErrorCode.AGENT_TIMEOUT]: 504,
};

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.AUTH_REQUIRED]: 'Authentication required. Please sign in or provide an API key.',
  [ErrorCode.INVALID_API_KEY]: 'Invalid or expired API key. Please check your API key and try again.',
  [ErrorCode.INVALID_TOKEN]: 'Invalid authentication token. Please sign in again.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded. Please wait a moment and try again.',
  [ErrorCode.VALIDATION_ERROR]: 'Request validation failed. Please check your input and try again.',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Required field is missing. Please check your request.',
  [ErrorCode.INVALID_FIELD_VALUE]: 'Invalid field value. Please check your input.',
  [ErrorCode.MESSAGE_TOO_LONG]: 'Message is too long. Maximum length is 5000 characters.',
  [ErrorCode.MESSAGE_REQUIRED]: 'Message is required and must be a non-empty string.',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCode.CONVERSATION_NOT_FOUND]: 'Conversation not found. Please check the conversation ID.',
  [ErrorCode.REQUEST_TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorCode.REQUEST_CANCELLED]: 'Request was cancelled.',
  [ErrorCode.NETWORK_ERROR]: 'Network error occurred. Please check your connection and try again.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',
  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again later.',
  [ErrorCode.DATABASE_ERROR]: 'Database error occurred. Please try again later.',
  [ErrorCode.AGENT_ERROR]: 'AI agent error occurred. Please try again.',
  [ErrorCode.AGENT_TIMEOUT]: 'AI agent request timed out. Please try again with a shorter message.',
};

/**
 * Recovery guidance for errors
 */
const RECOVERY_GUIDANCE: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Wait for the rate limit to reset, or upgrade to Pro for higher limits.',
  [ErrorCode.INVALID_API_KEY]: 'Check your API key in Settings → API Keys, or create a new one.',
  [ErrorCode.MESSAGE_TOO_LONG]: 'Break your message into smaller parts, or upgrade to Pro for longer messages.',
  [ErrorCode.NETWORK_ERROR]: 'Check your internet connection and try again.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'The service is temporarily down. Check status.infinityassistant.io for updates.',
  [ErrorCode.AGENT_TIMEOUT]: 'Try breaking your request into smaller parts or simplifying your question.',
};

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  details?: Record<string, unknown>,
  retryAfter?: number
): NextResponse<ErrorResponse> {
  const status = ERROR_STATUS_MAP[code];
  const message = ERROR_MESSAGES[code];
  const recoveryGuidance = RECOVERY_GUIDANCE[code];

  const error: ApiError = {
    code,
    message,
    ...(details && { details }),
    ...(retryAfter && { retry_after: retryAfter }),
    ...(recoveryGuidance && { recovery_guidance: recoveryGuidance }),
  };

  const response = NextResponse.json<ErrorResponse>(
    {
      success: false,
      error,
    },
    { status }
  );

  // Add rate limit headers if applicable
  if (code === ErrorCode.RATE_LIMIT_EXCEEDED && retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString());
    response.headers.set('X-RateLimit-Retry-After', retryAfter.toString());
  }

  return response;
}

/**
 * Handle unknown errors and convert to standardized format
 */
export function handleUnknownError(error: unknown, context?: string): NextResponse<ErrorResponse> {
  logger.error(`[ErrorHandler] ${context || 'Unknown error'}:`, error);

  // Check for specific error types
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return createErrorResponse(ErrorCode.NETWORK_ERROR);
    }

    // Timeout errors
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return createErrorResponse(ErrorCode.REQUEST_TIMEOUT);
    }

    // Database errors
    if (error.message.includes('database') || error.message.includes('supabase')) {
      return createErrorResponse(ErrorCode.DATABASE_ERROR);
    }
  }

  // Default to internal error
  return createErrorResponse(ErrorCode.INTERNAL_ERROR);
}

/**
 * Create rate limit error response
 */
export function createRateLimitError(retryAfter: number): NextResponse<ErrorResponse> {
  return createErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, undefined, retryAfter);
}

/**
 * Create validation error response
 */
export function createValidationError(
  field: string,
  reason: string
): NextResponse<ErrorResponse> {
  return createErrorResponse(ErrorCode.VALIDATION_ERROR, {
    field,
    reason,
  });
}

/**
 * Create authentication error response
 */
export function createAuthError(code: ErrorCode = ErrorCode.AUTH_REQUIRED): NextResponse<ErrorResponse> {
  return createErrorResponse(code);
}

/**
 * Wrap async handler with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  context?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error: unknown) {
      return handleUnknownError(error, context);
    }
  }) as T;
}
