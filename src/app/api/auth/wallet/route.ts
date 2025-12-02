/**
 * Wallet Authentication API
 *
 * Signature-based authentication for master tier users.
 * Verifies wallet ownership through signed messages.
 *
 * Flow:
 * 1. GET /api/auth/wallet?address=0x... - Get challenge nonce
 * 2. POST /api/auth/wallet - Submit signature to authenticate
 *
 * @since 2025-12-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';
import crypto from 'crypto';

// ============================================================================
// MASTER WALLET WHITELIST
// ============================================================================

// Whitelisted wallet addresses that can access master tier
// In production, store these in database or environment variable
const MASTER_WALLETS = new Set([
  // Add master wallet addresses here (lowercase)
  process.env.MASTER_WALLET_1?.toLowerCase(),
  process.env.MASTER_WALLET_2?.toLowerCase(),
].filter(Boolean));

// ============================================================================
// UTILITIES
// ============================================================================

function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Normalize Ethereum address
function normalizeAddress(address: string): string {
  return address.toLowerCase().trim();
}

// Simple signature verification (EIP-191 personal_sign)
// For production, use ethers.js or viem for proper verification
function verifySignature(message: string, signature: string, address: string): boolean {
  // This is a placeholder - in production use proper EIP-191 verification
  // with ethers.verifyMessage or viem's verifyMessage
  // For now we'll do a simplified check
  try {
    // The signature should be a valid hex string of correct length (65 bytes = 130 hex + 0x)
    if (!signature.startsWith('0x') || signature.length !== 132) {
      return false;
    }
    // In a real implementation, you'd use:
    // const recoveredAddress = ethers.verifyMessage(message, signature);
    // return recoveredAddress.toLowerCase() === address.toLowerCase();

    // For now, we'll accept any valid-format signature in development
    // TODO: Implement proper signature verification with ethers.js
    return process.env.NODE_ENV === 'development';
  } catch {
    return false;
  }
}

// ============================================================================
// GET - Get authentication challenge
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const address = url.searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const normalizedAddress = normalizeAddress(address);

    // Check if wallet is whitelisted for master access
    const isMasterWallet = MASTER_WALLETS.has(normalizedAddress);

    // Generate challenge nonce
    const nonce = generateNonce();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create the message to be signed
    const message = `Sign this message to authenticate with Infinity Assistant.\n\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;

    // Store nonce temporarily (in a real app, use Redis or a proper session store)
    const supabase = getSupabaseClient();

    // Try to find existing user by wallet
    const { data: existingUser } = await supabase
      .from(TABLES.USERS)
      .select('id')
      .eq('wallet_address', normalizedAddress)
      .single();

    // Store challenge in preferences if user exists, or in a temporary way
    if (existingUser) {
      await supabase
        .from(TABLES.PREFERENCES)
        .upsert({
          user_id: existingUser.id,
          wallet_nonce: nonce,
          wallet_nonce_expires: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    }

    return NextResponse.json({
      message,
      nonce,
      expiresAt: expiresAt.toISOString(),
      isMasterWallet,
    });
  } catch (error) {
    logger.error('[WalletAuth] Challenge generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication challenge' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Verify signature and authenticate
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, signature, message, nonce } = body;

    if (!address || !signature || !message || !nonce) {
      return NextResponse.json(
        { error: 'Missing required fields: address, signature, message, nonce' },
        { status: 400 }
      );
    }

    const normalizedAddress = normalizeAddress(address);

    // Verify signature
    const isValidSignature = verifySignature(message, signature, normalizedAddress);

    if (!isValidSignature) {
      logger.warn(`[WalletAuth] Invalid signature for address: ${normalizedAddress.substring(0, 10)}...`);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Check if this is a master wallet
    const isMasterWallet = MASTER_WALLETS.has(normalizedAddress);
    const tier = isMasterWallet ? 'master' : 'free';

    const supabase = getSupabaseClient();

    // Find or create user
    let { data: user, error: lookupError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, tier, created_at')
      .eq('wallet_address', normalizedAddress)
      .single();

    if (lookupError && lookupError.code === 'PGRST116') {
      // User doesn't exist - create new one
      const newUserId = `wallet_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const { data: newUser, error: insertError } = await supabase
        .from(TABLES.USERS)
        .insert({
          id: newUserId,
          wallet_address: normalizedAddress,
          tier,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id, email, tier, created_at')
        .single();

      if (insertError) {
        logger.error('[WalletAuth] Failed to create user:', insertError);
        return NextResponse.json(
          { error: 'Failed to create account' },
          { status: 500 }
        );
      }

      user = newUser;
      logger.info(`[WalletAuth] New wallet user created: ${normalizedAddress.substring(0, 10)}... (${tier})`);
    } else if (lookupError) {
      logger.error('[WalletAuth] Database lookup error:', lookupError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    } else {
      // Update tier if master wallet and not already master
      if (isMasterWallet && user?.tier !== 'master') {
        await supabase
          .from(TABLES.USERS)
          .update({ tier: 'master', updated_at: new Date().toISOString() })
          .eq('id', user?.id);
        if (user) user.tier = 'master';
      }
      logger.info(`[WalletAuth] Wallet user signed in: ${normalizedAddress.substring(0, 10)}... (${user?.tier})`);
    }

    // Generate session token
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store session
    await supabase
      .from(TABLES.PREFERENCES)
      .upsert({
        user_id: user?.id,
        session_token: sessionToken,
        session_expires: expiresAt.toISOString(),
        wallet_nonce: null, // Clear nonce
        wallet_nonce_expires: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    // Create response with cookies
    const response = NextResponse.json({
      success: true,
      user: {
        id: user?.id,
        walletAddress: normalizedAddress,
        tier: user?.tier,
        isMaster: user?.tier === 'master',
      },
      message: isMasterWallet ? 'Welcome, Master!' : 'Wallet connected successfully',
    });

    // Set session cookies
    response.cookies.set('infinity_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    response.cookies.set('infinity_user_id', user?.id || '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    logger.error('[WalletAuth] Authentication error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
