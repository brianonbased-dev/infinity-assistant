/**
 * Beta Usage API
 *
 * Track and check usage limits for beta users.
 *
 * GET /api/beta/usage?userId=...
 * - Get usage limits for a user
 *
 * POST /api/beta/usage
 * - Record a usage action
 *
 * @since 2025-11-29
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkBetaUsageLimit,
  recordBetaUsage,
  getAllBetaUsageLimits,
  isBetaPeriod,
} from '@/services/BetaWrapperService';
import logger from '@/utils/logger';

type UsageAction = 'search' | 'assist' | 'build' | 'deepResearch' | 'comprehensive';

interface RecordUsageRequest {
  userId: string;
  action: UsageAction;
}

/**
 * GET /api/beta/usage?userId=...&action=...
 *
 * Check if user can perform an action (within limits)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || 'anonymous';
    const action = searchParams.get('action') as UsageAction | null;

    if (action) {
      // Check specific action
      const limit = checkBetaUsageLimit(userId, action);

      return NextResponse.json({
        success: true,
        isBeta: isBetaPeriod(),
        action,
        ...limit,
      });
    }

    // Return all limits
    const allLimits = getAllBetaUsageLimits(userId);

    return NextResponse.json({
      success: true,
      isBeta: isBetaPeriod(),
      userId,
      limits: allLimits,
    });
  } catch (error) {
    logger.error('[Beta Usage API] Check error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check usage',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/beta/usage
 *
 * Record a usage action
 */
export async function POST(request: NextRequest) {
  try {
    const body: RecordUsageRequest = await request.json();
    const { userId, action } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: 'userId and action are required' },
        { status: 400 }
      );
    }

    // Validate action
    const validActions: UsageAction[] = ['search', 'assist', 'build', 'deepResearch', 'comprehensive'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Check limit first
    const limitCheck = checkBetaUsageLimit(userId, action);

    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Usage limit exceeded',
          message: `You've reached your daily limit for ${action}. Limits reset at midnight UTC.`,
          limit: limitCheck,
        },
        { status: 429 }
      );
    }

    // Record usage
    const usage = recordBetaUsage(userId, action);

    // Get updated limit
    const newLimit = checkBetaUsageLimit(userId, action);

    logger.debug('[Beta Usage API] Usage recorded', {
      userId,
      action,
      remaining: newLimit.remaining,
    });

    return NextResponse.json({
      success: true,
      isBeta: isBetaPeriod(),
      action,
      recorded: true,
      limit: newLimit,
    });
  } catch (error) {
    logger.error('[Beta Usage API] Record error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record usage',
      },
      { status: 500 }
    );
  }
}
