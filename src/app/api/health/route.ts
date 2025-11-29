/**
 * Health Check API
 *
 * Returns service health status for monitoring
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const checks: Record<string, { status: string; latency?: number }> = {};
  let overallStatus = 'healthy';

  // Check Supabase connection
  try {
    const start = Date.now();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.UAA2_SUPABASE_SERVICE_KEY!
    );
    await supabase.from('user_preferences').select('user_id').limit(1);
    checks.supabase = { status: 'healthy', latency: Date.now() - start };
  } catch {
    checks.supabase = { status: 'unhealthy' };
    overallStatus = 'degraded';
  }

  // Check Stripe configuration
  checks.stripe = {
    status: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured',
  };

  // Check AI providers
  checks.anthropic = {
    status: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured',
  };
  checks.openai = {
    status: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
  };

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks,
  });
}
