/**
 * User Usage API
 *
 * Track and retrieve user usage statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import logger from '@/utils/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.UAA2_SUPABASE_SERVICE_KEY!
);

// Usage limits per tier
const USAGE_LIMITS: Record<string, { daily: number; monthly: number }> = {
  free: { daily: 10, monthly: 100 },
  pro: { daily: 100, monthly: 3000 },
  business: { daily: 500, monthly: 15000 },
  enterprise: { daily: -1, monthly: -1 }, // Unlimited
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const anonUserId = request.cookies.get('infinity_anon_user')?.value;
    const effectiveUserId = userId || anonUserId;

    if (!effectiveUserId) {
      return NextResponse.json({
        usage: { today: 0, thisMonth: 0 },
        limits: USAGE_LIMITS.free,
        tier: 'free',
      });
    }

    // Get user's tier
    const { data: subscription } = await supabase
      .from('infinity_assistant_subscriptions')
      .select('tier')
      .eq('user_id', effectiveUserId)
      .single();

    const tier = subscription?.tier || 'free';
    const limits = USAGE_LIMITS[tier] || USAGE_LIMITS.free;

    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const { count: todayCount } = await supabase
      .from('infinity_assistant_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', effectiveUserId)
      .gte('created_at', `${today}T00:00:00Z`);

    // Get this month's usage
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const { count: monthCount } = await supabase
      .from('infinity_assistant_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', effectiveUserId)
      .gte('created_at', firstOfMonth.toISOString());

    return NextResponse.json({
      usage: {
        today: todayCount || 0,
        thisMonth: monthCount || 0,
      },
      limits,
      tier,
      remaining: {
        daily: limits.daily === -1 ? -1 : Math.max(0, limits.daily - (todayCount || 0)),
        monthly: limits.monthly === -1 ? -1 : Math.max(0, limits.monthly - (monthCount || 0)),
      },
    });
  } catch (error) {
    logger.error('[User Usage] GET Error:', error);
    return NextResponse.json({ error: 'Failed to get usage stats' }, { status: 500 });
  }
}
