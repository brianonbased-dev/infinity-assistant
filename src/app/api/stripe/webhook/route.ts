/**
 * Stripe Webhook Handler for Infinity Assistant
 *
 * Processes Stripe payment events for subscription management
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient, mapPriceToTier } from '@/lib/stripe';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const stripe = getStripeClient();
  const supabase = getSupabaseClient();
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
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier || 'pro';

        if (userId) {
          await supabase.from(TABLES.SUBSCRIPTIONS).upsert({
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            tier: tier,
            status: 'active',
            current_period_start: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          logger.info(`[Stripe Webhook] Checkout completed for user ${userId}, tier: ${tier}`);
        } else {
          logger.warn('[Stripe Webhook] No userId in checkout session metadata');
        }
        break;
      }

      // Subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: userSub } = await supabase
          .from(TABLES.SUBSCRIPTIONS)
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (userSub) {
          const tier = mapPriceToTier(subscription.items.data[0]?.price?.id);
          await supabase.from(TABLES.SUBSCRIPTIONS).update({
            tier: tier,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          }).eq('stripe_customer_id', customerId);
          logger.info(`[Stripe Webhook] Subscription updated for customer ${customerId}`);
        } else {
          logger.warn(`[Stripe Webhook] No user found for customer ${customerId}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        await supabase.from(TABLES.SUBSCRIPTIONS).update({
          tier: 'free',
          status: 'canceled',
          updated_at: new Date().toISOString(),
        }).eq('stripe_customer_id', customerId);
        logger.info(`[Stripe Webhook] Subscription deleted for customer ${customerId}`);
        break;
      }

      // Invoice events
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await supabase.from(TABLES.PAYMENTS).insert({
          stripe_customer_id: customerId,
          stripe_invoice_id: invoice.id,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: 'paid',
          created_at: new Date().toISOString(),
        });
        logger.info(`[Stripe Webhook] Invoice paid: ${invoice.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await supabase.from(TABLES.PAYMENTS).insert({
          stripe_customer_id: customerId,
          stripe_invoice_id: invoice.id,
          amount: invoice.amount_due,
          currency: invoice.currency,
          status: 'failed',
          created_at: new Date().toISOString(),
        });
        await supabase.from(TABLES.SUBSCRIPTIONS).update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        }).eq('stripe_customer_id', customerId);
        logger.info(`[Stripe Webhook] Invoice failed: ${invoice.id}`);
        break;
      }

      // Payment intent events
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.info(`[Stripe Webhook] Payment succeeded: ${paymentIntent.id}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.error(`[Stripe Webhook] Payment failed: ${paymentIntent.id}`);
        break;
      }

      default:
        logger.info(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(`[Stripe Webhook] Error processing ${event.type}:`, error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
