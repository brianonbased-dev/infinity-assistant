/**
 * Beta Registration API
 *
 * Handles beta user registration and tracking.
 *
 * POST /api/beta/register
 * - Register a new beta user
 * - Returns beta status and user info
 *
 * GET /api/beta/register
 * - Get beta status for existing user
 *
 * @since 2025-11-29
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  registerBetaUser,
  getBetaUser,
  getBetaStatus,
  checkBetaUsageLimit,
  getAllBetaUsageLimits,
} from '@/services/BetaWrapperService';
import logger from '@/utils/logger';

interface RegisterRequest {
  email: string;
  userId?: string;
  name?: string;
  source?: string; // Where they signed up from
}

/**
 * POST /api/beta/register
 *
 * Register a new beta user
 */
export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();
    const { email, userId, name, source } = body;

    // Validate email
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // Check if already registered
    const existingUser = getBetaUser(email);
    if (existingUser) {
      const betaStatus = getBetaStatus();
      const usageLimits = getAllBetaUsageLimits(existingUser.id);

      return NextResponse.json({
        success: true,
        isNewUser: false,
        user: existingUser,
        betaStatus: {
          isActive: betaStatus.isBeta,
          daysRemaining: betaStatus.daysRemaining,
          endDate: betaStatus.endDate.toISOString(),
          version: betaStatus.version,
        },
        usageLimits,
        message: 'Welcome back! You are already registered for the beta.',
      });
    }

    // Register new user
    const newUser = registerBetaUser(email, userId);
    const betaStatus = getBetaStatus();
    const usageLimits = getAllBetaUsageLimits(newUser.id);

    logger.info('[Beta API] New user registered', {
      userId: newUser.id,
      email: email.substring(0, 3) + '***',
      source,
      isBetaPeriod: betaStatus.isBeta,
    });

    return NextResponse.json({
      success: true,
      isNewUser: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        signedUpAt: newUser.signedUpAt.toISOString(),
        betaParticipant: newUser.betaParticipant,
      },
      betaStatus: {
        isActive: betaStatus.isBeta,
        daysRemaining: betaStatus.daysRemaining,
        endDate: betaStatus.endDate.toISOString(),
        version: betaStatus.version,
        features: betaStatus.features,
      },
      usageLimits,
      message: betaStatus.isBeta
        ? `Welcome to the Infinity Assistant Beta! All features are FREE for ${betaStatus.daysRemaining} days.`
        : 'The beta period has ended. Subscribe to access pro features.',
    });
  } catch (error) {
    logger.error('[Beta API] Registration error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Registration failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/beta/register?email=...
 *
 * Check beta status for a user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const userId = searchParams.get('userId');

    if (!email && !userId) {
      // Return general beta status
      const betaStatus = getBetaStatus();

      return NextResponse.json({
        success: true,
        betaStatus: {
          isActive: betaStatus.isBeta,
          daysRemaining: betaStatus.daysRemaining,
          endDate: betaStatus.endDate.toISOString(),
          version: betaStatus.version,
          features: betaStatus.features,
          showExpiryWarning: betaStatus.showExpiryWarning,
          bannerText: betaStatus.bannerText,
        },
      });
    }

    // Look up user
    const user = getBetaUser(email || userId || '');
    const betaStatus = getBetaStatus();

    if (!user) {
      return NextResponse.json({
        success: true,
        isRegistered: false,
        betaStatus: {
          isActive: betaStatus.isBeta,
          daysRemaining: betaStatus.daysRemaining,
          endDate: betaStatus.endDate.toISOString(),
        },
        message: 'User not registered for beta. Register to get free access!',
      });
    }

    const usageLimits = getAllBetaUsageLimits(user.id);

    return NextResponse.json({
      success: true,
      isRegistered: true,
      user: {
        id: user.id,
        signedUpAt: user.signedUpAt.toISOString(),
        betaParticipant: user.betaParticipant,
        convertedToSubscription: user.convertedToSubscription,
        subscriptionTier: user.subscriptionTier,
      },
      betaStatus: {
        isActive: betaStatus.isBeta,
        daysRemaining: betaStatus.daysRemaining,
        endDate: betaStatus.endDate.toISOString(),
        features: betaStatus.features,
      },
      usageLimits,
    });
  } catch (error) {
    logger.error('[Beta API] Status check error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check status',
      },
      { status: 500 }
    );
  }
}
