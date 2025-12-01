/**
 * Subscription API v2
 *
 * Unified subscription management using middleware pattern.
 *
 * @route /api/v2/subscription
 */

import { NextRequest } from 'next/server';
import { withAuth, withPublic, success, error, parseBody, getQuery, type AuthenticatedContext } from '@/lib/apiMiddleware';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import { eventBus, createPayload } from '@/lib/EventBus';

// ============================================================================
// Types
// ============================================================================

interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'team' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  authenticated: boolean;
  userId?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  features?: string[];
}

interface UpdateSubscriptionRequest {
  action: 'upgrade' | 'downgrade' | 'cancel' | 'reactivate';
  tier?: string;
  priceId?: string;
}

// ============================================================================
// Tier Features
// ============================================================================

const TIER_FEATURES: Record<string, string[]> = {
  free: [
    'basic_chat',
    'limited_memory',
    'community_support',
  ],
  pro: [
    'unlimited_chat',
    'full_memory',
    'ev_integration',
    'priority_support',
    'api_access',
    'custom_personas',
  ],
  team: [
    'all_pro_features',
    'team_collaboration',
    'shared_workspaces',
    'admin_dashboard',
    'sso_integration',
  ],
  enterprise: [
    'all_team_features',
    'dedicated_support',
    'custom_integrations',
    'sla_guarantee',
    'on_premise_option',
  ],
};

// ============================================================================
// GET - Subscription Status (Public - returns free tier if not authenticated)
// ============================================================================

export const GET = withPublic(async (req: NextRequest, ctx) => {
  // Try to get user from context (may not be authenticated)
  const userId = (ctx as any).userId;

  if (!userId) {
    return success<SubscriptionStatus>({
      tier: 'free',
      status: 'active',
      authenticated: false,
      features: TIER_FEATURES.free,
    }, ctx);
  }

  try {
    const supabase = getSupabaseClient();
    const { data: subscription, error: dbError } = await supabase
      .from(TABLES.SUBSCRIPTIONS)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (dbError || !subscription) {
      return success<SubscriptionStatus>({
        tier: 'free',
        status: 'active',
        authenticated: true,
        userId,
        features: TIER_FEATURES.free,
      }, ctx);
    }

    const tier = subscription.tier || 'free';

    return success<SubscriptionStatus>({
      tier,
      status: subscription.status || 'active',
      authenticated: true,
      userId,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      features: TIER_FEATURES[tier] || TIER_FEATURES.free,
    }, ctx);
  } catch (err) {
    return error('DATABASE_ERROR', 'Failed to fetch subscription status', 500);
  }
}, {
  logging: true,
});

// ============================================================================
// POST - Update Subscription (Authenticated)
// ============================================================================

export const POST = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const body = await parseBody<UpdateSubscriptionRequest>(req);

  if (!body?.action) {
    return error('VALIDATION_FAILED', 'Action is required', 400);
  }

  const { action, tier, priceId } = body;

  try {
    const supabase = getSupabaseClient();

    // Get current subscription
    const { data: current } = await supabase
      .from(TABLES.SUBSCRIPTIONS)
      .select('*')
      .eq('user_id', ctx.userId)
      .single();

    switch (action) {
      case 'upgrade':
      case 'downgrade': {
        if (!tier && !priceId) {
          return error('VALIDATION_FAILED', 'tier or priceId required for upgrade/downgrade', 400);
        }

        // In production, this would integrate with Stripe
        const newTier = tier || 'pro';

        const { error: updateError } = await supabase
          .from(TABLES.SUBSCRIPTIONS)
          .upsert({
            user_id: ctx.userId,
            tier: newTier,
            status: 'active',
            updated_at: new Date().toISOString(),
          });

        if (updateError) {
          return error('DATABASE_ERROR', 'Failed to update subscription', 500);
        }

        eventBus.emit('subscription.changed' as any, {
          source: 'Subscription API',
          timestamp: Date.now(),
          userId: ctx.userId,
          action,
          fromTier: current?.tier || 'free',
          toTier: newTier,
        } as any);

        return success({
          success: true,
          action,
          newTier,
          features: TIER_FEATURES[newTier],
        }, ctx);
      }

      case 'cancel': {
        if (!current) {
          return error('NOT_FOUND', 'No subscription to cancel', 404);
        }

        const { error: cancelError } = await supabase
          .from(TABLES.SUBSCRIPTIONS)
          .update({
            cancel_at_period_end: true,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', ctx.userId);

        if (cancelError) {
          return error('DATABASE_ERROR', 'Failed to cancel subscription', 500);
        }

        eventBus.emit('subscription.canceled' as any, {
          source: 'Subscription API',
          timestamp: Date.now(),
          userId: ctx.userId,
          tier: current.tier,
        } as any);

        return success({
          success: true,
          action: 'cancel',
          message: 'Subscription will be canceled at end of billing period',
          currentPeriodEnd: current.current_period_end,
        }, ctx);
      }

      case 'reactivate': {
        if (!current?.cancel_at_period_end) {
          return error('INVALID_STATE', 'Subscription is not scheduled for cancellation', 400);
        }

        const { error: reactivateError } = await supabase
          .from(TABLES.SUBSCRIPTIONS)
          .update({
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', ctx.userId);

        if (reactivateError) {
          return error('DATABASE_ERROR', 'Failed to reactivate subscription', 500);
        }

        eventBus.emit('subscription.reactivated' as any, {
          source: 'Subscription API',
          timestamp: Date.now(),
          userId: ctx.userId,
          tier: current.tier,
        } as any);

        return success({
          success: true,
          action: 'reactivate',
          message: 'Subscription reactivated',
        }, ctx);
      }

      default:
        return error('INVALID_ACTION', `Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return error('INTERNAL_ERROR', 'Failed to process subscription request', 500);
  }
}, {
  rateLimit: 10,
  logging: true,
});