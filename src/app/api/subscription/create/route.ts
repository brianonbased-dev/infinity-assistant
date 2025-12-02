/**
 * Create Subscription API
 *
 * Creates Stripe checkout session for subscription upgrade
 * Uses canonical tier names: free, assistant_pro, builder_pro, builder_business, builder_enterprise
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getStripeClient, STRIPE_PRICE_IDS } from '@/lib/stripe';
import logger from '@/utils/logger';
import type { UserTier } from '@/types/agent-capabilities';

/**
 * Canonical tier names used throughout the system
 */
type CanonicalTier = 'assistant_pro' | 'builder_pro' | 'builder_business' | 'builder_enterprise';

/**
 * Legacy tier names for backwards compatibility
 */
type LegacyTier = 'pro' | 'business' | 'enterprise';

/**
 * Normalize legacy tier names to canonical names
 */
function normalizeToCanonicalTier(tier: string): CanonicalTier {
  const legacyMap: Record<LegacyTier, CanonicalTier> = {
    'pro': 'builder_pro', // Default 'pro' maps to builder_pro (most common upgrade)
    'business': 'builder_business',
    'enterprise': 'builder_enterprise',
  };

  // If already canonical, return as-is
  if (['assistant_pro', 'builder_pro', 'builder_business', 'builder_enterprise'].includes(tier)) {
    return tier as CanonicalTier;
  }

  // Map legacy name to canonical
  return legacyMap[tier as LegacyTier] || 'builder_pro';
}

interface CreateSubscriptionRequest {
  tier: CanonicalTier | LegacyTier;
  interval: 'monthly' | 'annual';
  successUrl?: string;
  cancelUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = user.id;

    const body: CreateSubscriptionRequest = await request.json();
    const { tier: rawTier, interval, successUrl, cancelUrl } = body;

    // Normalize tier to canonical name
    const tier = normalizeToCanonicalTier(rawTier);

    // Check if we have a price ID for this tier (might need legacy lookup)
    const stripeTierKey = STRIPE_PRICE_IDS[tier] ? tier : rawTier;
    if (!STRIPE_PRICE_IDS[stripeTierKey]) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const stripe = getStripeClient();
    const priceId = STRIPE_PRICE_IDS[stripeTierKey][interval || 'monthly'];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://infinityassistant.io';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${baseUrl}/dashboard?subscription=success`,
      cancel_url: cancelUrl || `${baseUrl}/pricing?subscription=canceled`,
      metadata: {
        userId,
        tier, // Store canonical tier name
        interval,
      },
      subscription_data: {
        metadata: {
          userId,
          tier, // Store canonical tier name
        },
      },
    });

    logger.info(`[Create Subscription] Checkout session created for user ${userId}, tier: ${tier}`);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    logger.error('[Create Subscription] Error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
