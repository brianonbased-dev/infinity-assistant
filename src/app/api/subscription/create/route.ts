/**
 * Create Subscription API
 *
 * Creates Stripe checkout session for subscription upgrade
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@clerk/nextjs/server';
import logger from '@/utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

// Price IDs for each tier (configure in Stripe Dashboard)
const PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual',
  },
  business: {
    monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || 'price_business_monthly',
    annual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL || 'price_business_annual',
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise',
    annual: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise',
  },
};

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

    if (!tier || !PRICE_IDS[tier]) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const priceId = PRICE_IDS[tier][interval || 'monthly'];
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
