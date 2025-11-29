/**
 * Create Subscription API
 *
 * Creates Stripe checkout session for subscription upgrade
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripeClient, STRIPE_PRICE_IDS } from '@/lib/stripe';
import logger from '@/utils/logger';

interface CreateSubscriptionRequest {
  tier: 'pro' | 'business' | 'enterprise';
  interval: 'monthly' | 'annual';
  successUrl?: string;
  cancelUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body: CreateSubscriptionRequest = await request.json();
    const { tier, interval, successUrl, cancelUrl } = body;

    if (!tier || !STRIPE_PRICE_IDS[tier]) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const stripe = getStripeClient();
    const priceId = STRIPE_PRICE_IDS[tier][interval || 'monthly'];
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
        tier,
        interval,
      },
      subscription_data: {
        metadata: {
          userId,
          tier,
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
