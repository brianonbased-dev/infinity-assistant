/**
 * API Keys Management
 * 
 * Generate and manage API keys for Infinity Assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserService } from '@/services/UserService';
import { getApiKeyService } from '@/lib/api-keys/ApiKeyService';
import logger from '@/utils/logger';
import crypto from 'crypto';

interface ApiKey {
  id: string;
  name: string;
  key: string; // Only shown once on creation
  prefix: string; // First 8 chars for display
  userId: string;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

// Note: API key storage is now handled by ApiKeyService

/**
 * Generate a secure API key
 */
function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32);
  return `ia_${randomBytes.toString('base64url')}`;
}

/**
 * POST /api/api-keys
 * 
 * Create a new API key
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      );
    }

    // Get user ID from auth
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Check auth (should verify user is authenticated)
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/email`);
    const authData = await authResponse.json();
    
    if (!authData.authenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const actualUserId = authData.user?.id || userId;

    // Generate API key
    const fullKey = generateApiKey();
    const prefix = fullKey.substring(0, 12); // ia_ + 8 chars

    const apiKey: ApiKey = {
      id: crypto.randomUUID(),
      name: name.trim(),
      key: fullKey, // Only returned on creation
      prefix,
      userId: actualUserId,
      createdAt: new Date(),
      isActive: true
    };

    // Store in API key service (for validation)
    const apiKeyService = getApiKeyService();
    await apiKeyService.storeApiKey(actualUserId, apiKey.id, fullKey, apiKey.name, prefix);

    logger.info('[API Keys] Created new API key:', {
      userId: actualUserId,
      keyId: apiKey.id,
      name: apiKey.name
    });

    return NextResponse.json({
      success: true,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key: fullKey, // Only shown once
        prefix: apiKey.prefix,
        createdAt: apiKey.createdAt.toISOString()
      },
      message: 'API key created. Save this key - it will not be shown again.'
    });
  } catch (error: unknown) {
    logger.error('[API Keys] Error creating key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/api-keys
 * 
 * List user's API keys
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from auth
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Check auth
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/email`);
    const authData = await authResponse.json();
    
    if (!authData.authenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const actualUserId = authData.user?.id || userId;
    const apiKeyService = getApiKeyService();
    const userKeys = await apiKeyService.getUserKeys(actualUserId);

    return NextResponse.json({
      success: true,
      apiKeys: userKeys.map(key => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        createdAt: key.createdAt.toISOString(),
        lastUsed: key.lastUsed?.toISOString(),
        isActive: key.isActive
      }))
    });
  } catch (error: unknown) {
    logger.error('[API Keys] Error listing keys:', error);
    return NextResponse.json(
      { error: 'Failed to list API keys' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/api-keys
 * 
 * Revoke an API key
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      );
    }

    // Get user ID from auth
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Check auth
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/email`);
    const authData = await authResponse.json();
    
    if (!authData.authenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const actualUserId = authData.user?.id || userId;
    const apiKeyService = getApiKeyService();
    
    const revoked = await apiKeyService.revokeApiKey(actualUserId, keyId);
    if (!revoked) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    logger.info('[API Keys] Revoked API key:', {
      userId: actualUserId,
      keyId
    });

    return NextResponse.json({
      success: true,
      message: 'API key revoked'
    });
  } catch (error: unknown) {
    logger.error('[API Keys] Error revoking key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}

