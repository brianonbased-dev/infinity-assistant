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
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    // Execute all queries in parallel to reduce latency (fixes N+1 pattern)
    const [subscriptionResult, todayUsageResult, monthUsageResult] = await Promise.all([
      // Get user's tier
      supabase
        .from(TABLES.SUBSCRIPTIONS)
        .select('tier')
        .eq('user_id', effectiveUserId)
        .single(),

      // Get today's usage count
      supabase
        .from(TABLES.USAGE)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId)
        .gte('created_at', `${today}T00:00:00Z`),

      // Get this month's usage count
      supabase
        .from(TABLES.USAGE)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId)
        .gte('created_at', firstOfMonth.toISOString()),
    ]);

    const tier = subscriptionResult.data?.tier || 'free';
    const limits = getUsageLimits(tier);
    const todayCount = todayUsageResult.count || 0;
    const monthCount = monthUsageResult.count || 0;

    return NextResponse.json({
      usage: {
        today: todayCount,
        thisMonth: monthCount,
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
