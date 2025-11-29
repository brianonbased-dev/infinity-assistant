/**
 * Stripe Webhook Handler for Infinity Assistant
 *
 * Processes Stripe payment events for subscription management
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import logger from '@/utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.UAA2_SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    logger.error('[Stripe Webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  logger.info(`[Stripe Webhook] Processing event: ${event.type}`);

  try {
    switch (event.type) {
      // Checkout events
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      // Subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      // Invoice events
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;

      // Payment intent events
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        logger.info(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing ${event.type}:`, error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier || 'pro';

  if (!userId) {
    logger.warn('[Stripe Webhook] No userId in checkout session metadata');
    return;
  }

  await supabase.from('infinity_assistant_subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: session.subscription as string,
    tier: tier,
    status: 'active',
    current_period_start: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  logger.info(`[Stripe Webhook] Checkout completed for user ${userId}, tier: ${tier}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find user by customer ID
  const { data: userSub } = await supabase
    .from('infinity_assistant_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!userSub) {
    logger.warn(`[Stripe Webhook] No user found for customer ${customerId}`);
    return;
  }

  const tier = mapPriceToTier(subscription.items.data[0]?.price?.id);

  await supabase.from('infinity_assistant_subscriptions').update({
    tier: tier,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }).eq('stripe_customer_id', customerId);

  logger.info(`[Stripe Webhook] Subscription updated for customer ${customerId}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  await supabase.from('infinity_assistant_subscriptions').update({
    tier: 'free',
    status: 'canceled',
    updated_at: new Date().toISOString(),
  }).eq('stripe_customer_id', customerId);

  logger.info(`[Stripe Webhook] Subscription deleted for customer ${customerId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  await supabase.from('infinity_assistant_payments').insert({
    stripe_customer_id: customerId,
    stripe_invoice_id: invoice.id,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: 'paid',
    created_at: new Date().toISOString(),
  });

  logger.info(`[Stripe Webhook] Invoice paid: ${invoice.id}`);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  await supabase.from('infinity_assistant_payments').insert({
    stripe_customer_id: customerId,
    stripe_invoice_id: invoice.id,
    amount: invoice.amount_due,
    currency: invoice.currency,
    status: 'failed',
    created_at: new Date().toISOString(),
  });

  // Update subscription status
  await supabase.from('infinity_assistant_subscriptions').update({
    status: 'past_due',
    updated_at: new Date().toISOString(),
  }).eq('stripe_customer_id', customerId);

  logger.info(`[Stripe Webhook] Invoice failed: ${invoice.id}`);
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  logger.info(`[Stripe Webhook] Payment succeeded: ${paymentIntent.id}`);
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  logger.error(`[Stripe Webhook] Payment failed: ${paymentIntent.id}`);
}

function mapPriceToTier(priceId: string | undefined): string {
  const priceTierMap: Record<string, string> = {
    // Add your Stripe price IDs here
    'price_pro_monthly': 'pro',
    'price_pro_annual': 'pro',
    'price_business_monthly': 'business',
    'price_business_annual': 'business',
    'price_enterprise': 'enterprise',
  };
  return priceTierMap[priceId || ''] || 'pro';
}
