/**
 * Subscription Status API
 *
 * Check user's current subscription tier and status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({
        tier: 'free',
        status: 'active',
        authenticated: false
      });
    }

    const supabase = getSupabaseClient();
    const { data: subscription, error } = await supabase
      .from(TABLES.SUBSCRIPTIONS)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !subscription) {
      return NextResponse.json({
        tier: 'free',
        status: 'active',
        authenticated: true,
        userId,
      });
    }

    return NextResponse.json({
      tier: subscription.tier || 'free',
      status: subscription.status || 'active',
      authenticated: true,
      userId,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  } catch (error) {
    logger.error('[Subscription Status] Error:', error);
    return NextResponse.json({ error: 'Failed to get subscription status' }, { status: 500 });
  }
}
