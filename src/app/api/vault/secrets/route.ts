/**
 * Vault Secrets API
 *
 * CRUD operations for user secrets.
 *
 * GET /api/vault/secrets - List all secrets (metadata only)
 * POST /api/vault/secrets - Store a new secret
 * PUT /api/vault/secrets - Update a secret
 * DELETE /api/vault/secrets - Delete a secret
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserVaultService,
  generateSecurePassword,
  type SecretCategory,
  type SecretMetadata,
} from '@/services/UserVaultService';
import { getCurrentUser } from '@/lib/auth';
import logger from '@/utils/logger';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/vault/secrets - List secrets (metadata only)
 *
 * Query params:
 * - category: Filter by category
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

    const category = request.nextUrl.searchParams.get('category') as SecretCategory | null;
    const result = await vaultService.listSecrets(user.id, category || undefined);

    return NextResponse.json(
      {
        success: result.success,
        data: {
          secrets: result.secrets,
          total: result.secrets.length,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[VaultSecretsAPI] GET error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/vault/secrets - Store a new secret
 *
 * Body:
 * - name: string (required)
 * - value: string (required, or use generatePassword: true)
 * - category: SecretCategory (required)
 * - metadata: SecretMetadata (optional)
 * - expiresAt: string ISO date (optional)
 * - generatePassword: boolean (optional, auto-generate secure password)
 * - passwordOptions: { length, uppercase, lowercase, numbers, symbols } (optional)
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
    const {
      name,
      value,
      category,
      metadata = {},
      expiresAt,
      generatePassword,
      passwordOptions,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Generate password if requested
    let secretValue = value;
    let generatedPassword: string | undefined;

    if (generatePassword) {
      generatedPassword = generateSecurePassword(
        passwordOptions?.length || 24,
        passwordOptions
      );
      secretValue = generatedPassword;
    }

    if (!secretValue) {
      return NextResponse.json(
        { error: 'Value is required (or set generatePassword: true)' },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await vaultService.storeSecret(
      user.id,
      name,
      secretValue,
      category as SecretCategory,
      metadata as SecretMetadata,
      expiresAt ? new Date(expiresAt) : undefined
    );

    return NextResponse.json(
      {
        success: result.success,
        data: {
          secretId: result.secretId,
          message: result.message,
          generatedPassword: generatedPassword, // Only returned if auto-generated
        },
      },
      { status: result.success ? 201 : 400, headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[VaultSecretsAPI] POST error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/vault/secrets - Update a secret
 *
 * Body:
 * - secretId: string (required)
 * - name: string (optional)
 * - value: string (optional)
 * - metadata: SecretMetadata (optional)
 * - expiresAt: string ISO date (optional)
 */
export async function PUT(request: NextRequest) {
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
    const { secretId, name, value, metadata, expiresAt } = body;

    if (!secretId) {
      return NextResponse.json(
        { error: 'Secret ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await vaultService.updateSecret(user.id, secretId, {
      name,
      value,
      metadata,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return NextResponse.json(
      {
        success: result.success,
        data: { message: result.message },
      },
      { status: result.success ? 200 : 400, headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[VaultSecretsAPI] PUT error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/vault/secrets - Delete a secret
 *
 * Query params:
 * - id: Secret ID to delete
 */
export async function DELETE(request: NextRequest) {
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

    const secretId = request.nextUrl.searchParams.get('id');

    if (!secretId) {
      return NextResponse.json(
        { error: 'Secret ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await vaultService.deleteSecret(user.id, secretId);

    return NextResponse.json(
      {
        success: result.success,
        data: { message: result.message },
      },
      { status: result.success ? 200 : 400, headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[VaultSecretsAPI] DELETE error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
