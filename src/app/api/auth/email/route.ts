/**
 * Email + Password Auth API
 *
 * Proper user authentication with password support.
 * Uses bcrypt-compatible hashing via crypto.scrypt (no native dependency).
 *
 * @since 2025-12-01
 * @updated 2025-12-02 - Added password support
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import { getEmailService } from '@/services/EmailService';
import logger from '@/utils/logger';
import crypto from 'crypto';

// ============================================================================
// VALIDATION
// ============================================================================

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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

// ============================================================================
// PASSWORD HASHING (bcrypt-compatible using scrypt)
// ============================================================================

const SCRYPT_PARAMS = {
  N: 16384, // CPU/memory cost
  r: 8,     // Block size
  p: 1,     // Parallelization
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

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    if (!salt || !key) {
      resolve(false);
      return;
    }
    crypto.scrypt(password, salt, SCRYPT_PARAMS.keyLen, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
    }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex') === key);
    });
  });
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

/**
 * POST /api/auth/email
 * Sign up or sign in with email and password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, action = 'signup' } = body;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // Password is required for new signups and signin
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
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
    const normalizedEmail = email.toLowerCase().trim();
    const emailHash = hashEmail(normalizedEmail);

    // Check if user exists
    const { data: existingUser, error: lookupError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, created_at, tier, password_hash')
      .eq('email', normalizedEmail)
      .single();

    if (lookupError && lookupError.code !== 'PGRST116') {
      logger.error('[EmailAuth] Database lookup error:', lookupError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      // Existing user - verify password
      if (!existingUser.password_hash) {
        // Legacy user without password - allow setting one
        const hashedPassword = await hashPassword(password);
        const { error: updateError } = await supabase
          .from(TABLES.USERS)
          .update({
            password_hash: hashedPassword,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id);

        if (updateError) {
          logger.error('[EmailAuth] Failed to set password:', updateError);
          return NextResponse.json(
            { error: 'Failed to update account' },
            { status: 500 }
          );
        }
        logger.info(`[EmailAuth] Password set for legacy user: ${emailHash.substring(0, 8)}...`);
      } else {
        // Verify password
        const isValid = await verifyPassword(password, existingUser.password_hash);
        if (!isValid) {
          return NextResponse.json(
            { error: 'Invalid email or password' },
            { status: 401 }
          );
        }
      }

      userId = existingUser.id;
      logger.info(`[EmailAuth] User signed in: ${emailHash.substring(0, 8)}...`);
    } else if (action === 'signup') {
      // New user - create account with password
      const newUserId = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const hashedPassword = await hashPassword(password);

      const { error: insertError } = await supabase
        .from(TABLES.USERS)
        .insert({
          id: newUserId,
          email: normalizedEmail,
          password_hash: hashedPassword,
          tier: 'free',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        logger.error('[EmailAuth] Failed to create user:', insertError);
        return NextResponse.json(
          { error: 'Failed to create account' },
          { status: 500 }
        );
      }

      userId = newUserId;
      isNewUser = true;
      logger.info(`[EmailAuth] New user created: ${emailHash.substring(0, 8)}...`);

      // Send welcome email for new users
      try {
        const emailService = getEmailService();
        await emailService.sendWelcomeEmail({
          email: normalizedEmail,
          product: 'assistant' // Default, can be updated later
        });
      } catch (emailError) {
        // Don't fail signup if email fails
        logger.warn('[EmailAuth] Failed to send welcome email:', emailError);
      }
    } else {
      return NextResponse.json(
        { error: 'Account not found. Please sign up first.' },
        { status: 404 }
      );
    }

    // Generate session token
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store session (using preferences table for simplicity)
    const { error: sessionError } = await supabase
      .from(TABLES.PREFERENCES)
      .upsert({
        user_id: userId,
        session_token: sessionToken,
        session_expires: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (sessionError) {
      logger.warn('[EmailAuth] Session storage warning:', sessionError);
      // Continue anyway - session is optional enhancement
    }

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      userId,
      isNewUser,
      tier: existingUser?.tier || 'free',
      message: isNewUser ? 'Account created successfully!' : 'Welcome back!',
    });

    // Set session cookie
    response.cookies.set('infinity_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    // Set user ID cookie (for client access)
    response.cookies.set('infinity_user_id', userId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    logger.error('[EmailAuth] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/email
 * Check current session
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('infinity_session')?.value;
    const userId = request.cookies.get('infinity_user_id')?.value;

    if (!sessionToken || !userId) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const supabase = getSupabaseClient();

    // Get user data
    const { data: user, error } = await supabase
      .from(TABLES.USERS)
      .select('id, email, tier, created_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      // Clear invalid session
      const response = NextResponse.json({
        authenticated: false,
        user: null,
      });
      response.cookies.delete('infinity_session');
      response.cookies.delete('infinity_user_id');
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    logger.error('[EmailAuth] Session check error:', error);
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }
}

/**
 * DELETE /api/auth/email
 * Sign out
 */
export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: 'Signed out successfully',
  });

  response.cookies.delete('infinity_session');
  response.cookies.delete('infinity_user_id');

  return response;
}
