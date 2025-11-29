/**
 * Pricing API
 *
 * Get pricing tiers for Assistant, Builder, and Bundle products
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

interface PricingTier {
  id: string;
  product: string;
  tier: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  features: string[];
  limits: Record<string, number>;
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
  is_popular: boolean;
  is_active: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get('product');
    const tier = searchParams.get('tier');

    const supabase = getSupabaseClient();
    let query = supabase
      .from(TABLES.PRICING_TIERS)
      .select('*')
      .eq('is_active', true)
      .order('monthly_price', { ascending: true });

    // Filter by product if specified
    if (product && ['assistant', 'builder', 'bundle'].includes(product)) {
      query = query.eq('product', product);
    }

    // Filter by specific tier if specified
    if (tier) {
      query = query.eq('tier', tier);
    }

    const { data: tiers, error } = await query;

    if (error) {
      throw error;
    }

    // Group by product for easier frontend consumption
    const grouped = {
      assistant: [] as PricingTier[],
      builder: [] as PricingTier[],
      bundle: [] as PricingTier[],
    };

    for (const t of tiers || []) {
      if (t.product in grouped) {
        grouped[t.product as keyof typeof grouped].push(t);
      }
    }

    // If specific product requested, return flat array
    if (product && ['assistant', 'builder', 'bundle'].includes(product)) {
      return NextResponse.json({
        product,
        tiers: grouped[product as keyof typeof grouped],
      });
    }

    // Return all grouped pricing
    return NextResponse.json({
      pricing: grouped,
      products: ['assistant', 'builder', 'bundle'],
    });
  } catch (error) {
    logger.error('[Pricing] Error:', error);
    return NextResponse.json({ error: 'Failed to get pricing' }, { status: 500 });
  }
}