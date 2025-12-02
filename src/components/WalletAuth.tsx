'use client';

/**
 * Wallet Authentication Component
 *
 * Signature-based authentication for master tier access.
 * Uses wallet signing for secure login.
 *
 * @since 2025-12-02
 */

import { useState, useEffect, useCallback } from 'react';
import { Wallet, Loader2, LogOut, Shield, AlertCircle } from 'lucide-react';

interface WalletUser {
  id: string;
  walletAddress: string;
  tier: string;
  isMaster: boolean;
}

interface WalletAuthProps {
  onAuthChange?: (user: WalletUser | null) => void;
  className?: string;
}

// Check if window.ethereum (MetaMask) is available
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

export function WalletAuth({ onAuthChange, className = '' }: WalletAuthProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<WalletUser | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check for wallet extension
  useEffect(() => {
    setHasWallet(typeof window !== 'undefined' && !!window.ethereum);
  }, []);

  // Check existing session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/email'); // Uses same session cookie
        const data = await response.json();

        if (data.authenticated && data.user?.tier === 'master') {
          setUser({
            id: data.user.id,
            walletAddress: '', // Not stored in email auth
            tier: data.user.tier,
            isMaster: true,
          });
          onAuthChange?.(user);
        }
      } catch (err) {
        console.error('[WalletAuth] Session check failed:', err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [onAuthChange, user]);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError('Please install MetaMask or another Web3 wallet');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (!accounts || accounts.length === 0) {
        setError('No accounts found. Please unlock your wallet.');
        return;
      }

      const address = accounts[0];

      // Get challenge from server
      const challengeResponse = await fetch(`/api/auth/wallet?address=${address}`);
      const challenge = await challengeResponse.json();

      if (!challengeResponse.ok) {
        setError(challenge.error || 'Failed to get authentication challenge');
        return;
      }

      // Sign the message
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [challenge.message, address],
      }) as string;

      // Verify signature with server
      const authResponse = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          signature,
          message: challenge.message,
          nonce: challenge.nonce,
        }),
      });

      const authData = await authResponse.json();

      if (!authResponse.ok) {
        setError(authData.error || 'Authentication failed');
        return;
      }

      const walletUser: WalletUser = {
        id: authData.user.id,
        walletAddress: authData.user.walletAddress,
        tier: authData.user.tier,
        isMaster: authData.user.isMaster,
      };

      setUser(walletUser);
      onAuthChange?.(walletUser);
    } catch (err) {
      console.error('[WalletAuth] Connection error:', err);
      if ((err as { code?: number })?.code === 4001) {
        setError('Signature request was rejected');
      } else {
        setError('Failed to connect wallet. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [onAuthChange]);

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/email', { method: 'DELETE' }); // Uses same session
      setUser(null);
      onAuthChange?.(null);
    } catch (err) {
      console.error('[WalletAuth] Disconnect error:', err);
    } finally {
      setLoading(false);
    }
  }, [onAuthChange]);

  if (checkingSession) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
      </div>
    );
  }

  // User is connected
  if (user) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-full border border-purple-500/30">
          <Shield className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-300">
            {user.isMaster ? 'Master' : 'Connected'}
          </span>
          {user.walletAddress && (
            <span className="text-xs text-gray-400">
              {user.walletAddress.substring(0, 6)}...{user.walletAddress.slice(-4)}
            </span>
          )}
        </div>
        <button
          onClick={disconnect}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
          title="Disconnect"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  }

  // No wallet extension
  if (!hasWallet) {
    return (
      <div className={`flex items-center gap-2 text-gray-400 text-sm ${className}`}>
        <AlertCircle className="w-4 h-4" />
        <span>Install MetaMask for Master access</span>
      </div>
    );
  }

  // Connect button
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <button
        onClick={connectWallet}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-purple-800 disabled:to-pink-800 rounded-lg transition-all text-sm font-semibold"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            <span>Master Login</span>
          </>
        )}
      </button>
      {error && (
        <span className="text-red-400 text-xs">{error}</span>
      )}
    </div>
  );
}

export default WalletAuth;
