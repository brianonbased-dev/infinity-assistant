/**
 * API Key Authentication Middleware
 * 
 * Validates API keys for programmatic access
 */

import { NextRequest } from 'next/server';
import { getApiKeyService } from '@/lib/api-keys/ApiKeyService';
import logger from '@/utils/logger';

/**
 * Get API key from request
 */
function getApiKeyFromRequest(request: NextRequest): string | null {
  // Check X-API-Key header
  const headerKey = request.headers.get('X-API-Key');
  if (headerKey) {
    return headerKey;
  }

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Validate API key and return user ID
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; userId?: string; keyId?: string }> {
  if (!apiKey || !apiKey.startsWith('ia_')) {
    return { valid: false };
  }

  const apiKeyService = getApiKeyService();
  return apiKeyService.validateApiKey(apiKey);
}

/**
 * API Key Authentication Middleware
 */
export async function withApiKeyAuth(
  request: NextRequest,
  handler: (request: NextRequest, userId: string) => Promise<Response>
): Promise<Response> {
  const apiKey = getApiKeyFromRequest(request);

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'API key required',
        message: 'Please provide an API key in the X-API-Key header or Authorization: Bearer header'
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const validation = await validateApiKey(apiKey);

  if (!validation.valid) {
    return new Response(
      JSON.stringify({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or has been revoked'
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Last used timestamp is updated in validateApiKey

  logger.debug('[API Key Auth] Valid API key used:', {
    keyId: validation.keyId,
    userId: validation.userId
  });

  return handler(request, validation.userId!);
}

/**
 * Optional API Key Auth - allows both API key and session auth
 */
export async function withOptionalApiKeyAuth(
  request: NextRequest,
  handler: (request: NextRequest, userId?: string, authMethod?: 'api_key' | 'session') => Promise<Response>
): Promise<Response> {
  const apiKey = getApiKeyFromRequest(request);

  if (apiKey) {
    const validation = await validateApiKey(apiKey);
    if (validation.valid && validation.userId) {
      // Last used timestamp is updated in validateApiKey
      return handler(request, validation.userId, 'api_key');
    }
    // If API key is invalid, fall through to session auth
  }

  // No API key or invalid - try session auth
  return handler(request, undefined, 'session');
}

