/**
 * Provider Keys Management
 * 
 * Allow users to add their own LLM provider API keys (BYOK)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserService } from '@/services/UserService';
import { getProviderKeyService } from '@/lib/provider-keys/ProviderKeyService';
import { maskApiKey } from '@/lib/encryption';
import logger from '@/utils/logger';

interface ProviderKey {
  id: string;
  userId: string;
  provider: string;
  name: string;
  keyHash: string; // Hashed for storage
  maskedKey: string; // For display
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}


/**
 * Validate API key format
 */
function validateApiKeyFormat(provider: string, key: string): boolean {
  if (!key || key.length < 10) return false;

  switch (provider) {
    case 'openai':
      return key.startsWith('sk-');
    case 'anthropic':
      return key.startsWith('sk-ant-');
    case 'google':
      return key.startsWith('AIza');
    case 'cohere':
      return key.startsWith('co-');
    case 'mistral':
      return key.length > 20;
    default:
      return key.length > 10;
  }
}

/**
 * POST /api/provider-keys
 * 
 * Add a new provider API key
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, name, apiKey } = body;

    if (!provider || !name || !apiKey) {
      return NextResponse.json(
        { error: 'Provider, name, and API key are required' },
        { status: 400 }
      );
    }

    if (!validateApiKeyFormat(provider, apiKey)) {
      return NextResponse.json(
        { error: `Invalid ${provider} API key format` },
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

    // Check if user already has a key for this provider
    const providerKeyService = getProviderKeyService();
    const existingKey = await providerKeyService.getActiveProviderKey(actualUserId, provider);

    if (existingKey) {
      return NextResponse.json(
        { error: `You already have an active ${provider} key. Delete it first to add a new one.` },
        { status: 400 }
      );
    }

    // Validate and store provider key (includes API validation)
    logger.info(`[Provider Keys] Validating ${provider} key for user ${actualUserId}...`);
    const result = await providerKeyService.validateAndStoreKey(
      actualUserId,
      provider,
      apiKey,
      name.trim()
    );

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || 'Failed to validate or store key',
          validationError: result.validationResult?.error,
        },
        { status: 400 }
      );
    }

    logger.info('[Provider Keys] Added provider key:', {
      userId: actualUserId,
      provider,
      keyId: result.keyId,
      validated: true,
    });

    const maskedKey = maskApiKey(apiKey);

    return NextResponse.json({
      success: true,
      providerKey: {
        id: result.keyId,
        provider,
        name: name.trim(),
        maskedKey,
        createdAt: new Date().toISOString(),
        isActive: true,
      },
      validation: result.validationResult,
    });
  } catch (error: unknown) {
    logger.error('[Provider Keys] Error adding key:', error);
    return NextResponse.json(
      { error: 'Failed to add provider key' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/provider-keys
 * 
 * List user's provider keys
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
    const providerKeyService = getProviderKeyService();
    const userKeys = await providerKeyService.getUserProviderKeys(actualUserId);

    return NextResponse.json({
      success: true,
      providerKeys: userKeys.map(key => ({
        id: key.id,
        provider: key.provider,
        name: key.name,
        maskedKey: key.maskedKey,
        createdAt: key.createdAt.toISOString(),
        lastUsed: key.lastUsed?.toISOString(),
        isActive: key.isActive,
      })),
    });
  } catch (error: unknown) {
    logger.error('[Provider Keys] Error listing keys:', error);
    return NextResponse.json(
      { error: 'Failed to list provider keys' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/provider-keys
 * 
 * Delete a provider key
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json(
        { error: 'Provider key ID is required' },
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
    const providerKeyService = getProviderKeyService();
    
    const deleted = await providerKeyService.deleteProviderKey(actualUserId, keyId);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Provider key not found' },
        { status: 404 }
      );
    }

    logger.info('[Provider Keys] Deleted provider key:', {
      userId: actualUserId,
      keyId,
    });

    return NextResponse.json({
      success: true,
      message: 'Provider key deleted',
    });
  } catch (error: unknown) {
    logger.error('[Provider Keys] Error deleting key:', error);
    return NextResponse.json(
      { error: 'Failed to delete provider key' },
      { status: 500 }
    );
  }
}

