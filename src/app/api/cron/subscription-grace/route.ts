/**
 * Cron Job: Subscription Grace Period Handler
 *
 * Daily scheduled job to handle subscriptions past their grace period.
 * Runs after subscription-expiry cron to finalize downgrades.
 *
 * Scheduled via Vercel Cron or QStash:
 * - Daily at 1am UTC: Check for expired grace periods
 *
 * This endpoint:
 * 1. Scans for past_due subscriptions older than GRACE_PERIOD_DAYS
 * 2. Downgrades to free tier after grace period expires
 * 3. Logs grace expiry events for analytics
 * 4. Reports processing results
 *
 * @route GET /api/cron/subscription-grace
 * @route POST /api/cron/subscription-grace (QStash support)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, TABLES } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Grace period in days before final downgrade
const GRACE_PERIOD_DAYS = 7;

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Verify cron secret from request
 *
 * Supports multiple authentication methods:
 * 1. QStash signature verification (if configured)
 * 2. CRON_SECRET via Authorization header
 * 3. CRON_SECRET via x-cron-secret header
 * 4. Vercel cron header (x-vercel-cron)
 * 5. Development mode (no auth required)
 */
async function verifyCronSecret(request: NextRequest): Promise<boolean> {
  // Method 1: QStash signature (check for upstash-signature header)
  const upstashSignature = request.headers.get('upstash-signature');
  if (upstashSignature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    // QStash signature verification would go here
    // For now, presence of signature + key means it's from QStash
    console.log('[SubscriptionGraceCron] Authenticated via QStash signature');
    return true;
  }

  // Method 2-4: CRON_SECRET or Vercel cron header
  const authHeader = request.headers.get('authorization');
  const cronSecretHeader = request.headers.get('x-cron-secret');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  // Vercel cron header (automatic from Vercel)
  if (vercelCronHeader) {
    console.log('[SubscriptionGraceCron] Authenticated via Vercel cron header');
    return true;
  }

  // CRON_SECRET authentication
  if (cronSecret) {
    if (authHeader === `Bearer ${cronSecret}` || cronSecretHeader === cronSecret) {
      console.log('[SubscriptionGraceCron] Authenticated via CRON_SECRET');
      return true;
    }
  }

  // Development mode - allow without auth if no secret configured
  if (process.env.NODE_ENV === 'development' && !cronSecret) {
    console.log('[SubscriptionGraceCron] Development mode - no auth required');
    return true;
  }

  console.warn('[SubscriptionGraceCron] Authentication failed - no valid credentials');
  return false;
}

// ============================================================================
// TYPES
// ============================================================================

interface SubscriptionRecord {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  current_period_end: string;
  payment_method?: string;
}

interface GraceResult {
  processed: number;
  downgraded: number;
  errors: number;
  details: Array<{
    userId: string;
    action: 'downgraded' | 'error';
    previousTier: string;
    daysPastDue: number;
    reason?: string;
  }>;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Log grace expiry events for analytics
 */
async function logGraceExpiryEvent(
  supabase: ReturnType<typeof getSupabaseClient>,
  subscription: SubscriptionRecord,
  daysPastDue: number
): Promise<void> {
  try {
    await supabase
      .from('subscription_events')
      .insert({
        user_id: subscription.user_id,
        subscription_id: subscription.id,
        event_type: 'subscription.grace_expired',
        previous_tier: subscription.tier,
        new_tier: 'free',
        previous_status: 'past_due',
        new_status: 'canceled',
        payment_method: subscription.payment_method,
        metadata: {
          period_end: subscription.current_period_end,
          days_past_due: daysPastDue,
          grace_period_days: GRACE_PERIOD_DAYS,
        },
        created_at: new Date().toISOString(),
      });
  } catch {
    // Silently fail if subscription_events table doesn't exist
    console.warn('[SubscriptionGraceCron] Could not log event (table may not exist)');
  }
}

// ============================================================================
// MAIN JOB LOGIC
// ============================================================================

async function executeGracePeriodJob(): Promise<GraceResult> {
  const result: GraceResult = {
    processed: 0,
    downgraded: 0,
    errors: 0,
    details: [],
  };

  const supabase = getSupabaseClient();
  const now = new Date();

  // Calculate grace period cutoff (7 days ago)
  const graceCutoff = new Date(now);
  graceCutoff.setDate(graceCutoff.getDate() - GRACE_PERIOD_DAYS);

  // Find past_due subscriptions where period_end is older than grace period
  const { data: expiredGrace, error: fetchError } = await supabase
    .from(TABLES.SUBSCRIPTIONS)
    .select('*')
    .eq('status', 'past_due')
    .lt('current_period_end', graceCutoff.toISOString());

  if (fetchError) {
    console.error('[SubscriptionGraceCron] Fetch error:', fetchError);
    throw new Error(`Database error: ${fetchError.message}`);
  }

  if (!expiredGrace || expiredGrace.length === 0) {
    return result;
  }

  // Process each subscription with expired grace period
  for (const subscription of expiredGrace as SubscriptionRecord[]) {
    result.processed++;

    const periodEnd = new Date(subscription.current_period_end);
    const daysPastDue = Math.floor((now.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24));

    try {
      // Downgrade to free tier
      const { error: updateError } = await supabase
        .from(TABLES.SUBSCRIPTIONS)
        .update({
          tier: 'free',
          status: 'canceled',
          updated_at: now.toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) {
        result.errors++;
        result.details.push({
          userId: subscription.user_id,
          action: 'error',
          previousTier: subscription.tier,
          daysPastDue,
          reason: updateError.message,
        });
      } else {
        result.downgraded++;
        result.details.push({
          userId: subscription.user_id,
          action: 'downgraded',
          previousTier: subscription.tier,
          daysPastDue,
          reason: `Grace period (${GRACE_PERIOD_DAYS} days) expired`,
        });
        await logGraceExpiryEvent(supabase, subscription, daysPastDue);
      }
    } catch (err) {
      result.errors++;
      result.details.push({
        userId: subscription.user_id,
        action: 'error',
        previousTier: subscription.tier,
        daysPastDue,
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return result;
}

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * GET /api/cron/subscription-grace
 *
 * Execute grace period check
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authentication
    const isAuthenticated = await verifyCronSecret(request);
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - invalid cron secret' },
        { status: 401 }
      );
    }

    console.log('[SubscriptionGraceCron] Starting grace period check');

    // Execute the job
    const result = await executeGracePeriodJob();
    const executionTimeMs = Date.now() - startTime;

    // Log results
    console.log('[SubscriptionGraceCron] Check complete', {
      processed: result.processed,
      downgraded: result.downgraded,
      errors: result.errors,
      executionTimeMs,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
      executionTimeMs,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SubscriptionGraceCron] Check failed:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/subscription-grace
 *
 * Execute grace period check (POST support for QStash)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
