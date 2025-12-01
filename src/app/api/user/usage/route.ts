/**
 * User Usage API
 *
 * Track and retrieve user usage statistics
 * Optimized to reduce database queries (fixed N+1 pattern)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseClient, TABLES, getUsageLimits } from '@/lib/supabase';
import logger from '@/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const anonUserId = request.cookies.get('infinity_anon_user')?.value;
    const effectiveUserId = user?.id || anonUserId;

    const defaultLimits = getUsageLimits('free');

    if (!effectiveUserId) {
      return NextResponse.json({
        usage: { today: 0, thisMonth: 0 },
        limits: defaultLimits,
        tier: 'free',
        remaining: {
          daily: defaultLimits.daily,
          monthly: defaultLimits.monthly,
        },
      });
    }

    const supabase = getSupabaseClient();

    // Calculate date boundaries
    const today = new Date().toISOString().split('T')[0];

    // Execute queries in parallel to reduce latency
    const [subscriptionResult, usageResult] = await Promise.all([
      // Get user's tier from subscription
      supabase
        .from(TABLES.SUBSCRIPTIONS)
        .select('tier')
        .eq('user_id', effectiveUserId)
        .single(),

      // Get today's usage record (contains daily_count and monthly_count)
      supabase
        .from(TABLES.USAGE)
        .select('daily_count, monthly_count, tokens_used')
        .eq('user_id', effectiveUserId)
        .eq('date', today)
        .single(),
    ]);

    const tier = subscriptionResult.data?.tier || 'free';
    const limits = getUsageLimits(tier);
    const todayCount = usageResult.data?.daily_count || 0;
    const monthCount = usageResult.data?.monthly_count || 0;
    const tokensUsed = usageResult.data?.tokens_used || 0;

    return NextResponse.json({
      usage: {
        today: todayCount,
        thisMonth: monthCount,
        tokensUsed,
      },
      limits,
      tier,
      remaining: {
        daily: limits.daily === -1 ? -1 : Math.max(0, limits.daily - todayCount),
        monthly: limits.monthly === -1 ? -1 : Math.max(0, limits.monthly - monthCount),
      },
    });
  } catch (error) {
    logger.error('[User Usage] GET Error:', error);
    return NextResponse.json({ error: 'Failed to get usage stats' }, { status: 500 });
  }
}
