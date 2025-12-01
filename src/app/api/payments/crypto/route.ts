/**
 * Crypto Payment API
 *
 * POST /api/payments/crypto - Initiate crypto payment
 * POST /api/payments/crypto/verify - Verify payment transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { cryptoPaymentService, type CryptoToken } from '@/services/CryptoPaymentService';
import { getSupabaseClient, TABLES } from '@/lib/supabase';

// ============================================================================
// Plan Mapping - Map planId to subscription tier
// ============================================================================

const PLAN_TO_TIER: Record<string, string> = {
  'builder_starter': 'builder_starter',
  'builder_pro': 'builder_pro',
  'builder_enterprise': 'builder_enterprise',
  'pro': 'pro',
  'team': 'team',
  'enterprise': 'enterprise',
};

/**
 * Activate subscription after successful crypto payment
 */
async function activateSubscription(
  userId: string,
  planId: string,
  verification: { txHash: string; amount: number; token: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    const tier = PLAN_TO_TIER[planId] || 'pro';
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 month subscription

    // Upsert subscription record
    const { error: dbError } = await supabase
      .from(TABLES.SUBSCRIPTIONS)
      .upsert({
        user_id: userId,
        tier,
        status: 'active',
        payment_method: 'crypto',
        crypto_tx_hash: verification.txHash,
        crypto_token: verification.token,
        crypto_amount: verification.amount,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (dbError) {
      console.error('[Crypto Payment] DB Error:', dbError);
      return { success: false, error: dbError.message };
    }

    console.log('[Crypto Payment] Subscription activated:', { userId, tier, txHash: verification.txHash });
    return { success: true };
  } catch (err) {
    console.error('[Crypto Payment] Activation error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================================================
// POST - Initiate payment / Get payment instructions
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    const body = await request.json();
    const { action, token, amount, planId, txHash, walletAddress } = body;

    // Get payment instructions
    if (action === 'initiate') {
      if (!token || !amount || !planId) {
        return NextResponse.json(
          { error: 'Missing required fields: token, amount, planId' },
          { status: 400 }
        );
      }

      const validTokens: CryptoToken[] = ['USDC', 'BRIAN'];
      if (!validTokens.includes(token)) {
        return NextResponse.json(
          { error: 'Invalid token. Must be USDC or BRIAN' },
          { status: 400 }
        );
      }

      const instructions = cryptoPaymentService.getPaymentInstructions(token, amount);

      return NextResponse.json({
        success: true,
        instructions,
        serviceReady: cryptoPaymentService.isReady(),
        message: cryptoPaymentService.isReady()
          ? `Send ${amount} ${token} to the treasury address`
          : 'Payment service is in test mode - transactions will be simulated',
      });
    }

    // Verify a submitted transaction
    if (action === 'verify') {
      if (!txHash || !token || !amount || !walletAddress) {
        return NextResponse.json(
          { error: 'Missing required fields: txHash, token, amount, walletAddress' },
          { status: 400 }
        );
      }

      try {
        let verification;

        if (cryptoPaymentService.isReady()) {
          // Real verification on Base network
          verification = await cryptoPaymentService.verifyPayment(
            txHash as `0x${string}`,
            token as CryptoToken,
            parseFloat(amount),
            walletAddress
          );
        } else {
          // Simulate for development
          verification = await cryptoPaymentService.simulatePayment(
            token as CryptoToken,
            parseFloat(amount),
            walletAddress
          );
        }

        if (verification.verified) {
          // Activate subscription in database
          const activation = await activateSubscription(userId, planId, {
            txHash: txHash,
            amount: parseFloat(amount),
            token: token,
          });

          if (!activation.success) {
            return NextResponse.json({
              success: false,
              error: `Payment verified but subscription activation failed: ${activation.error}`,
              verification,
            }, { status: 500 });
          }

          return NextResponse.json({
            success: true,
            verification,
            subscription: {
              activated: true,
              tier: PLAN_TO_TIER[planId] || 'pro',
              planId,
            },
            message: 'Payment verified and subscription activated successfully',
          });
        }

        return NextResponse.json(
          { success: false, error: 'Payment verification failed' },
          { status: 400 }
        );
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Verification failed',
          },
          { status: 400 }
        );
      }
    }

    // Simulate payment (for testing) - also activates subscription
    if (action === 'simulate') {
      if (!token || !amount || !walletAddress) {
        return NextResponse.json(
          { error: 'Missing required fields: token, amount, walletAddress' },
          { status: 400 }
        );
      }

      const verification = await cryptoPaymentService.simulatePayment(
        token as CryptoToken,
        parseFloat(amount),
        walletAddress
      );

      // Also activate subscription in test mode if planId provided
      if (planId && verification.verified) {
        const activation = await activateSubscription(userId, planId, {
          txHash: verification.txHash,
          amount: parseFloat(amount),
          token: token,
        });

        return NextResponse.json({
          success: true,
          verification,
          subscription: activation.success ? {
            activated: true,
            tier: PLAN_TO_TIER[planId] || 'pro',
            planId,
          } : undefined,
          message: activation.success
            ? 'Payment simulated and subscription activated (test mode)'
            : 'Payment simulated but subscription activation failed (test mode)',
        });
      }

      return NextResponse.json({
        success: true,
        verification,
        message: 'Payment simulated successfully (test mode)',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Must be: initiate, verify, or simulate' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Crypto Payment API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Check payment service status
// ============================================================================

export async function GET() {
  return NextResponse.json({
    ready: cryptoPaymentService.isReady(),
    network: 'Base',
    chainId: 8453,
    supportedTokens: ['USDC', 'BRIAN'],
    treasuryConfigured: !!cryptoPaymentService.getTreasuryAddress(),
  });
}
