'use client';

/**
 * Beta Context Provider
 *
 * Provides beta status and features to the entire application.
 * During beta period, all users get full access to all features.
 *
 * @since 2025-11-29
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  getBetaStatus,
  getEffectiveTier,
  isFeatureAvailable,
  registerBetaUser,
  getBetaUser,
  formatBetaExpiryMessage,
  BetaStatus,
  BetaUser,
} from '@/services/BetaWrapperService';

interface BetaContextValue {
  // Beta status
  status: BetaStatus;
  isBeta: boolean;
  daysRemaining: number;
  expiryMessage: string;

  // Effective tier (considering beta)
  effectiveTier: string;

  // Feature checks
  hasFeature: (feature: string) => boolean;
  canAccessMode: (mode: 'search' | 'assist' | 'build') => boolean;

  // User management
  currentUser: BetaUser | null;
  registerForBeta: (email: string) => Promise<BetaUser>;
  isRegistered: boolean;

  // UI helpers
  showBetaBanner: boolean;
  showExpiryWarning: boolean;
  dismissBanner: () => void;
}

const BetaContext = createContext<BetaContextValue | null>(null);

interface BetaProviderProps {
  children: ReactNode;
  userTier?: 'free' | 'assistant_pro' | 'builder_pro' | 'builder_business' | 'builder_enterprise' | 'master';
  userEmail?: string;
}

export function BetaProvider({ children, userTier = 'free', userEmail }: BetaProviderProps) {
  const [status, setStatus] = useState<BetaStatus>(getBetaStatus());
  const [currentUser, setCurrentUser] = useState<BetaUser | null>(null);
  const [showBetaBanner, setShowBetaBanner] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Update status periodically (every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getBetaStatus());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Check for existing user on mount
  useEffect(() => {
    if (userEmail) {
      const existingUser = getBetaUser(userEmail);
      if (existingUser) {
        setCurrentUser(existingUser);
      }
    }
  }, [userEmail]);

  // Calculate effective tier
  const effectiveTier = getEffectiveTier(userTier);

  // Feature check function
  const hasFeature = useCallback(
    (feature: string) => {
      return isFeatureAvailable(feature as keyof BetaStatus['features'], effectiveTier);
    },
    [effectiveTier]
  );

  // Mode access check
  const canAccessMode = useCallback(
    (mode: 'search' | 'assist' | 'build') => {
      if (status.isBeta) {
        return true; // All modes available during beta
      }

      switch (mode) {
        case 'search':
          return true; // Always available
        case 'assist':
          return ['assistant_pro', 'builder_pro', 'builder_business', 'builder_enterprise', 'master'].includes(userTier);
        case 'build':
          return ['builder_pro', 'builder_business', 'builder_enterprise', 'master'].includes(userTier);
        default:
          return false;
      }
    },
    [status.isBeta, userTier]
  );

  // Register for beta
  const registerForBeta = useCallback(async (email: string): Promise<BetaUser> => {
    const user = registerBetaUser(email);
    setCurrentUser(user);

    // Also register via API for persistence
    try {
      await fetch('/api/beta/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userId: user.id }),
      });
    } catch (error) {
      console.warn('Failed to persist beta registration:', error);
    }

    return user;
  }, []);

  // Dismiss banner
  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    setShowBetaBanner(false);

    // Store in localStorage
    try {
      localStorage.setItem('beta_banner_dismissed', 'true');
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Check localStorage on mount
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('beta_banner_dismissed');
      if (dismissed === 'true') {
        setBannerDismissed(true);
        setShowBetaBanner(false);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const value: BetaContextValue = {
    status,
    isBeta: status.isBeta,
    daysRemaining: status.daysRemaining,
    expiryMessage: formatBetaExpiryMessage(status),
    effectiveTier,
    hasFeature,
    canAccessMode,
    currentUser,
    registerForBeta,
    isRegistered: !!currentUser,
    showBetaBanner: status.isBeta && !bannerDismissed,
    showExpiryWarning: status.showExpiryWarning,
    dismissBanner,
  };

  return <BetaContext.Provider value={value}>{children}</BetaContext.Provider>;
}

/**
 * Hook to access beta context
 */
export function useBeta(): BetaContextValue {
  const context = useContext(BetaContext);
  if (!context) {
    throw new Error('useBeta must be used within a BetaProvider');
  }
  return context;
}

/**
 * Hook to check if a specific feature is available
 */
export function useBetaFeature(feature: string): boolean {
  const { hasFeature } = useBeta();
  return hasFeature(feature);
}

/**
 * Hook to get effective tier
 */
export function useEffectiveTier(): string {
  const { effectiveTier } = useBeta();
  return effectiveTier;
}

export default BetaContext;
