/**
 * Service Credentials API
 *
 * Assistant-friendly endpoints for managing service credentials.
 * Used by the assistant for auto-fill during builds.
 *
 * GET /api/vault/service?name=github - Get credentials for a service
 * POST /api/vault/service - Store credentials for a service
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserVaultService, generateSecurePassword } from '@/services/UserVaultService';
import { getCurrentUser } from '@/lib/auth';
import logger from '@/utils/logger';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/vault/service - Get credentials for a service
 *
 * Query params:
 * - name: Service name (e.g., "github", "stripe", "supabase")
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const vaultService = getUserVaultService();

    if (!vaultService.isVaultUnlocked(user.id)) {
      return NextResponse.json(
        { error: 'Vault is locked. Please unlock first.' },
        { status: 403, headers: corsHeaders }
      );
    }

    const serviceName = request.nextUrl.searchParams.get('name');

    if (!serviceName) {
      return NextResponse.json(
        { error: 'Service name is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await vaultService.getServiceCredentials(user.id, serviceName);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          suggestion: `Store credentials using POST /api/vault/service with service: "${serviceName}"`,
        },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          service: serviceName,
          credentials: result.credentials,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[VaultServiceAPI] GET error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/vault/service - Store credentials for a service
 *
 * Body:
 * - service: string (required) - Service name
 * - username: string (optional)
 * - password: string (optional, or use generatePassword: true)
 * - apiKey: string (optional)
 * - token: string (optional)
 * - url: string (optional)
 * - generatePassword: boolean (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const vaultService = getUserVaultService();

    if (!vaultService.isVaultUnlocked(user.id)) {
      return NextResponse.json(
        { error: 'Vault is locked. Please unlock first.' },
        { status: 403, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { service, username, password, apiKey, token, url, generatePassword } = body;

    if (!service) {
      return NextResponse.json(
        { error: 'Service name is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Generate password if requested
    let actualPassword = password;
    let generatedPassword: string | undefined;

    if (generatePassword && !password) {
      generatedPassword = generateSecurePassword(24);
      actualPassword = generatedPassword;
    }

    const result = await vaultService.storeServiceCredentials(user.id, service, {
      username,
      password: actualPassword,
      apiKey,
      token,
      url,
    });

    return NextResponse.json(
      {
        success: result.success,
        data: {
          service,
          message: result.message,
          generatedPassword, // Only returned if auto-generated
        },
      },
      { status: result.success ? 201 : 400, headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[VaultServiceAPI] POST error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
