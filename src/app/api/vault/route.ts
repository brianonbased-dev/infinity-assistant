/**
 * User Vault API
 *
 * Secure password and secrets management endpoints.
 * The assistant handles all passwords and private data.
 *
 * POST /api/vault/init - Initialize vault with master password
 * POST /api/vault/unlock - Unlock vault
 * POST /api/vault/lock - Lock vault
 * GET /api/vault/status - Get vault status and stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserVaultService } from '@/services/UserVaultService';
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
 * GET /api/vault - Get vault status
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
    const isUnlocked = vaultService.isVaultUnlocked(user.id);

    if (!isUnlocked) {
      return NextResponse.json(
        {
          success: true,
          data: {
            status: 'locked',
            message: 'Vault is locked. Use POST /api/vault with action "unlock" to unlock.',
          },
        },
        { headers: corsHeaders }
      );
    }

    const stats = await vaultService.getVaultStats(user.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          status: 'unlocked',
          stats,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[VaultAPI] GET error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/vault - Vault operations
 *
 * Body:
 * - action: 'init' | 'unlock' | 'lock' | 'change_password'
 * - masterPassword: string (for init, unlock, change_password)
 * - newPassword: string (for change_password)
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

    const body = await request.json();
    const { action, masterPassword, newPassword } = body;

    const vaultService = getUserVaultService();
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

    switch (action) {
      case 'init': {
        if (!masterPassword) {
          return NextResponse.json(
            { error: 'Master password is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        if (masterPassword.length < 8) {
          return NextResponse.json(
            { error: 'Master password must be at least 8 characters' },
            { status: 400, headers: corsHeaders }
          );
        }

        const result = await vaultService.initializeVault(user.id, masterPassword);

        return NextResponse.json(
          {
            success: result.success,
            data: {
              message: result.message,
              instructions: result.success
                ? {
                    important: 'Your master password is NOT stored. If you forget it, your secrets cannot be recovered.',
                    next: 'You can now store secrets using POST /api/vault/secrets',
                  }
                : undefined,
            },
          },
          { status: result.success ? 200 : 400, headers: corsHeaders }
        );
      }

      case 'unlock': {
        if (!masterPassword) {
          return NextResponse.json(
            { error: 'Master password is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const result = await vaultService.unlockVault(user.id, masterPassword, ipAddress);

        return NextResponse.json(
          {
            success: result.success,
            data: {
              message: result.message,
              timeout: result.success ? '30 minutes of inactivity' : undefined,
            },
          },
          { status: result.success ? 200 : 401, headers: corsHeaders }
        );
      }

      case 'lock': {
        await vaultService.lockVault(user.id);

        return NextResponse.json(
          {
            success: true,
            data: { message: 'Vault locked' },
          },
          { headers: corsHeaders }
        );
      }

      case 'change_password': {
        if (!masterPassword || !newPassword) {
          return NextResponse.json(
            { error: 'Current and new password are required' },
            { status: 400, headers: corsHeaders }
          );
        }

        if (newPassword.length < 8) {
          return NextResponse.json(
            { error: 'New password must be at least 8 characters' },
            { status: 400, headers: corsHeaders }
          );
        }

        const result = await vaultService.changeMasterPassword(user.id, masterPassword, newPassword);

        return NextResponse.json(
          {
            success: result.success,
            data: { message: result.message },
          },
          { status: result.success ? 200 : 400, headers: corsHeaders }
        );
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: init, unlock, lock, change_password' },
          { status: 400, headers: corsHeaders }
        );
    }
  } catch (error) {
    logger.error('[VaultAPI] POST error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
