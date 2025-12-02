/**
 * Subscription Status API
 *
 * Check user's current subscription tier and status
 * Returns canonical tier names: free, assistant_pro, builder_pro, builder_business, builder_enterprise
 *
 * Admin users (master tier) get unlimited access to all features.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';
import type { UserTier } from '@/types/agent-capabilities';
import { isAdmin, getAdminRateLimits, getAdminStatusMessage } from '@/lib/admin-access';

/**
 * Normalize legacy tier names to canonical names
 */
function normalizeUserTier(tier: string | null | undefined): UserTier {
  if (!tier) return 'free';

  // Map legacy names to canonical
  const legacyMap: Record<string, UserTier> = {
    'pro': 'builder_pro',
    'business': 'builder_business',
    'enterprise': 'builder_enterprise',
    'paid': 'builder_pro', // Legacy 'paid' tier
    'team': 'builder_business',
    'growth': 'builder_pro',
    'scale': 'builder_business',
  };

  // If already canonical, return as-is
  if (['free', 'assistant_pro', 'builder_pro', 'builder_business', 'builder_enterprise', 'master'].includes(tier)) {
    return tier as UserTier;
  }

  return legacyMap[tier] || 'free';
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({
        tier: 'free',
        status: 'active',
        authenticated: false
      });
    }

    const userId = user.id;

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

    // Normalize tier to canonical name
    const normalizedTier = normalizeUserTier(subscription.tier);

    // Check for admin override
    const adminOverride = isAdmin(normalizedTier);
    const adminRateLimits = getAdminRateLimits(normalizedTier);
    const adminMessage = getAdminStatusMessage(normalizedTier);

    return NextResponse.json({
      tier: normalizedTier,
      status: subscription.status || 'active',
      authenticated: true,
      userId,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      // Admin-specific fields
      isAdmin: adminOverride,
      adminMessage,
      rateLimits: adminRateLimits || undefined,
      unlimitedAccess: adminOverride,
    });
  } catch (error) {
    logger.error('[Subscription Status] Error:', error);
    return NextResponse.json({ error: 'Failed to get subscription status' }, { status: 500 });
  }
}
