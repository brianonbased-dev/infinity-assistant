/**
 * Customer Portal API
 *
 * Creates Stripe Customer Portal session for billing management
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripeClient } from '@/lib/stripe';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    const stripe = getStripeClient();

    // Get customer ID from subscription record
    const { data: subscription, error } = await supabase
      .from(TABLES.SUBSCRIPTIONS)
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (error || !subscription?.stripe_customer_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://infinityassistant.io';

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${baseUrl}/dashboard`,
    });

    logger.info(`[Customer Portal] Portal session created for user ${userId}`);

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    logger.error('[Customer Portal] Error:', error);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}
