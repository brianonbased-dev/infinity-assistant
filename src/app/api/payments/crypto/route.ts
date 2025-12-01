/**
 * Crypto Payment API
 *
 * POST /api/payments/crypto - Initiate crypto payment
 * POST /api/payments/crypto/verify - Verify payment transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cryptoPaymentService, type CryptoToken } from '@/services/CryptoPaymentService';

// ============================================================================
// POST - Initiate payment / Get payment instructions
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
          // TODO: Activate subscription in database
          // await activateSubscription(userId, planId, verification);

          return NextResponse.json({
            success: true,
            verification,
            message: 'Payment verified successfully',
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

    // Simulate payment (for testing)
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
