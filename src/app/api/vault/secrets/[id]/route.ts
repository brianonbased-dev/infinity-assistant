/**
 * Individual Secret API
 *
 * GET /api/vault/secrets/[id] - Get a decrypted secret
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserVaultService } from '@/services/UserVaultService';
import { getCurrentUser } from '@/lib/auth';
import logger from '@/utils/logger';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/vault/secrets/[id] - Get decrypted secret value
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const result = await vaultService.getSecret(user.id, id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          secret: result.secret,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[VaultSecretAPI] GET error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
