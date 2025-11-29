/**
 * Centralized Stripe Client
 *
 * Singleton pattern to avoid re-initializing Stripe on every request
 */

import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

/**
 * Get the singleton Stripe instance
 */
export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }

    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  }

  return stripeInstance;
}

/**
 * Price IDs for subscription tiers
 */
export const STRIPE_PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
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

/**
 * Map Stripe price ID to tier
 */
export function mapPriceToTier(priceId: string | undefined): string {
  if (!priceId) return 'pro';

  // Check environment variables first
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) {
    return 'pro';
  }
  if (priceId === process.env.STRIPE_PRICE_BUSINESS_MONTHLY || priceId === process.env.STRIPE_PRICE_BUSINESS_ANNUAL) {
    return 'business';
  }
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) {
    return 'enterprise';
  }

  // Fallback to pattern matching
  if (priceId.includes('business')) return 'business';
  if (priceId.includes('enterprise')) return 'enterprise';
  return 'pro';
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Stripe.Event {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
