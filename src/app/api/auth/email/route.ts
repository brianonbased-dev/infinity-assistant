/**
 * Simple Email Auth API
 *
 * Database-based email signup/signin for Cyber Monday launch.
 * Uses Supabase for storage, no external auth provider needed.
 *
 * @since 2025-12-01
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';
import crypto from 'crypto';

// Simple email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Generate session token
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Hash for simple verification (not password - just email verification)
function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

/**
 * POST /api/auth/email
 * Sign up or sign in with email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, action = 'signup' } = body;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const normalizedEmail = email.toLowerCase().trim();
    const emailHash = hashEmail(normalizedEmail);

    // Check if user exists
    const { data: existingUser, error: lookupError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, created_at, tier')
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
      // Existing user - sign in
      userId = existingUser.id;
      logger.info(`[EmailAuth] User signed in: ${emailHash.substring(0, 8)}...`);
    } else if (action === 'signup') {
      // New user - create account
      const newUserId = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const { error: insertError } = await supabase
        .from(TABLES.USERS)
        .insert({
          id: newUserId,
          email: normalizedEmail,
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
