/**
 * Password Reset API
 *
 * Handles password reset token generation and password updates.
 * Tokens are stored in preferences table for simplicity.
 *
 * @since 2025-12-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';
import crypto from 'crypto';

// ============================================================================
// PASSWORD HASHING (same as email route)
// ============================================================================

const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 64,
};

async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, SCRYPT_PARAMS.keyLen, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
    }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

function isValidPassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password too long' };
  }
  return { valid: true };
}

function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/auth/reset-password
 * Request password reset (generates token)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const { data: user, error: lookupError } = await supabase
      .from(TABLES.USERS)
      .select('id, email')
      .eq('email', normalizedEmail)
      .single();

    // Always return success to prevent email enumeration
    if (lookupError || !user) {
      logger.info(`[ResetPassword] Reset requested for unknown email`);
      return NextResponse.json({
        success: true,
        message: 'If an account exists, a reset link has been sent.',
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in preferences
    const { error: updateError } = await supabase
      .from(TABLES.PREFERENCES)
      .upsert({
        user_id: user.id,
        reset_token: resetToken,
        reset_token_expires: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (updateError) {
      logger.error('[ResetPassword] Failed to store reset token:', updateError);
      return NextResponse.json(
        { error: 'Failed to process request' },
        { status: 500 }
      );
    }

    // In production, you would send an email here
    // For now, log the reset link (remove in production!)
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://infinityassistant.io'}/reset-password?token=${resetToken}`;
    logger.info(`[ResetPassword] Reset link generated for user ${user.id.substring(0, 8)}...`);

    // TODO: Integrate email service (SendGrid, Resend, etc.)
    // await sendPasswordResetEmail(user.email, resetUrl);

    return NextResponse.json({
      success: true,
      message: 'If an account exists, a reset link has been sent.',
      // DEV ONLY: Include token in response for testing
      ...(process.env.NODE_ENV === 'development' && { resetToken, resetUrl }),
    });
  } catch (error) {
    logger.error('[ResetPassword] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/reset-password
 * Reset password with token
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Reset token is required' },
        { status: 400 }
      );
    }

    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Find user with valid reset token
    const { data: prefs, error: lookupError } = await supabase
      .from(TABLES.PREFERENCES)
      .select('user_id, reset_token_expires')
      .eq('reset_token', token)
      .single();

    if (lookupError || !prefs) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date(prefs.reset_token_expires) < new Date()) {
      return NextResponse.json(
        { error: 'Reset token has expired' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update password
    const { error: updateError } = await supabase
      .from(TABLES.USERS)
      .update({
        password_hash: hashedPassword,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prefs.user_id);

    if (updateError) {
      logger.error('[ResetPassword] Failed to update password:', updateError);
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      );
    }

    // Clear reset token
    await supabase
      .from(TABLES.PREFERENCES)
      .update({
        reset_token: null,
        reset_token_expires: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', prefs.user_id);

    logger.info(`[ResetPassword] Password reset successful for user ${prefs.user_id.substring(0, 8)}...`);

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. Please sign in.',
    });
  } catch (error) {
    logger.error('[ResetPassword] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
