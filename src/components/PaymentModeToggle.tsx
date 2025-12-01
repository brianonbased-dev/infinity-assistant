'use client';

/**
 * Payment Mode Toggle Component
 *
 * Toggles between USD, USDC, and $BRIAN payment modes
 * - USD: Standard credit card payments via Stripe
 * - USDC: Stablecoin payments (same price as USD)
 * - $BRIAN: Token payments with discount (green theme)
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Image from 'next/image';
import { DollarSign, Coins } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type PaymentMode = 'usd' | 'usdc' | 'brian';

export interface PricingTier {
  id: string;
  name: string;
  usdPrice: number;
  brianPrice: number;
  brianDiscount: number; // percentage discount when paying with $BRIAN
  features: string[];
  popular?: boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

interface PaymentModeContextType {
  mode: PaymentMode;
  setMode: (mode: PaymentMode) => void;
  cycleMode: () => void;
  getPrice: (usdPrice: number, brianPrice?: number) => { amount: number; currency: string; display: string };
  getDiscount: () => number;
  isBrianMode: boolean;
  isUsdcMode: boolean;
  isCryptoMode: boolean; // true for both USDC and $BRIAN
}

const PaymentModeContext = createContext<PaymentModeContextType | null>(null);

export function usePaymentMode() {
  const context = useContext(PaymentModeContext);
  if (!context) {
    throw new Error('usePaymentMode must be used within PaymentModeProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

interface PaymentModeProviderProps {
  children: ReactNode;
  defaultMode?: PaymentMode;
  brianDiscountPercent?: number; // Default discount when paying with $BRIAN
  brianToUsdRate?: number; // Exchange rate: 1 $BRIAN = X USD
}

export function PaymentModeProvider({
  children,
  defaultMode = 'usd',
  brianDiscountPercent = 20, // 20% discount by default
  brianToUsdRate = 0.001, // Example rate
}: PaymentModeProviderProps) {
  const [mode, setMode] = useState<PaymentMode>(defaultMode);

  // Cycle through modes: USD -> USDC -> $BRIAN -> USD
  const cycleMode = useCallback(() => {
    setMode((prev) => {
      if (prev === 'usd') return 'usdc';
      if (prev === 'usdc') return 'brian';
      return 'usd';
    });
  }, []);

  const getPrice = useCallback(
    (usdPrice: number, brianPrice?: number) => {
      if (mode === 'brian') {
        // If explicit $BRIAN price provided, use it
        // Otherwise calculate with discount
        const discountedUsd = usdPrice * (1 - brianDiscountPercent / 100);
        const brianAmount = brianPrice ?? Math.round(discountedUsd / brianToUsdRate);

        return {
          amount: brianAmount,
          currency: '$BRIAN',
          display: `${brianAmount.toLocaleString()} $BRIAN`,
        };
      }

      if (mode === 'usdc') {
        // USDC is a stablecoin - same price as USD
        return {
          amount: usdPrice,
          currency: 'USDC',
          display: `${usdPrice.toFixed(2)} USDC`,
        };
      }

      return {
        amount: usdPrice,
        currency: 'USD',
        display: `$${usdPrice.toFixed(2)}`,
      };
    },
    [mode, brianDiscountPercent, brianToUsdRate]
  );

  const getDiscount = useCallback(() => {
    return mode === 'brian' ? brianDiscountPercent : 0;
  }, [mode, brianDiscountPercent]);

  const value: PaymentModeContextType = {
    mode,
    setMode,
    cycleMode,
    getPrice,
    getDiscount,
    isBrianMode: mode === 'brian',
    isUsdcMode: mode === 'usdc',
    isCryptoMode: mode === 'usdc' || mode === 'brian',
  };

  // Apply theme class based on mode
  const themeClass = mode === 'brian' ? 'brian-mode' : mode === 'usdc' ? 'usdc-mode' : '';

  return (
    <PaymentModeContext.Provider value={value}>
      <div className={themeClass}>{children}</div>
    </PaymentModeContext.Provider>
  );
}

// ============================================================================
// TOGGLE COMPONENT - Three-way selector: USD | USDC | $BRIAN
// ============================================================================

interface PaymentModeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  brianLogoPath?: string;
  usdcLogoPath?: string;
}

export function PaymentModeToggle({
  className = '',
  size = 'md',
  showLabels = true,
  brianLogoPath = '/images/brian-logo.svg',
  usdcLogoPath = '/images/usdc-logo.svg',
}: PaymentModeToggleProps) {
  const { mode, setMode, getDiscount } = usePaymentMode();
  const discount = getDiscount();

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  const modes: { key: PaymentMode; label: string; icon: React.ReactNode }[] = [
    {
      key: 'usd',
      label: 'USD',
      icon: <DollarSign size={iconSizes[size]} />,
    },
    {
      key: 'usdc',
      label: 'USDC',
      icon: (
        <Image
          src={usdcLogoPath}
          alt="USDC"
          width={iconSizes[size]}
          height={iconSizes[size]}
          className="rounded-full"
          onError={(e) => {
            // Fallback to Coins icon if image fails to load
            e.currentTarget.style.display = 'none';
          }}
        />
      ),
    },
    {
      key: 'brian',
      label: '$BRIAN',
      icon: (
        <Image
          src={brianLogoPath}
          alt="$BRIAN"
          width={iconSizes[size]}
          height={iconSizes[size]}
          className="rounded-full"
        />
      ),
    },
  ];

  return (
    <div className={`flex items-center gap-1 bg-gray-800/50 rounded-xl p-1 ${className}`}>
      {modes.map((m) => {
        const isActive = mode === m.key;
        const isBrian = m.key === 'brian';
        const isUsdc = m.key === 'usdc';

        return (
          <button
            type="button"
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`
              flex items-center gap-1.5 ${sizeClasses[size]} rounded-lg font-medium transition-all duration-300
              ${isActive
                ? isBrian
                  ? 'bg-brian-green text-black shadow-brian'
                  : isUsdc
                    ? 'bg-usdc-blue text-white shadow-usdc'
                    : 'bg-white text-gray-900'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }
            `}
            aria-label={`Pay with ${m.label}`}
          >
            {m.icon}
            {showLabels && <span>{m.label}</span>}
            {isActive && isBrian && discount > 0 && (
              <span className="text-xs bg-black/20 px-1.5 py-0.5 rounded-full font-bold">
                -{discount}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// PRICE DISPLAY COMPONENT
// ============================================================================

interface PriceDisplayProps {
  usdPrice: number;
  brianPrice?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showOriginal?: boolean;
  period?: string; // e.g., "/month"
  className?: string;
  brianLogoPath?: string;
  usdcLogoPath?: string;
}

export function PriceDisplay({
  usdPrice,
  brianPrice,
  size = 'md',
  showOriginal = true,
  period,
  className = '',
  brianLogoPath = '/images/brian-logo.svg',
  usdcLogoPath = '/images/usdc-logo.svg',
}: PriceDisplayProps) {
  const { mode, getPrice, getDiscount } = usePaymentMode();
  const price = getPrice(usdPrice, brianPrice);
  const discount = getDiscount();
  const isBrian = mode === 'brian';
  const isUsdc = mode === 'usdc';

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
    xl: 'text-5xl',
  };

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 36,
    xl: 48,
  };

  // Get text color based on mode
  const textColor = isBrian ? 'text-brian-green' : isUsdc ? 'text-usdc-blue' : 'text-white';

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="flex items-center gap-2">
        {isBrian && (
          <Image
            src={brianLogoPath}
            alt="$BRIAN"
            width={iconSizes[size]}
            height={iconSizes[size]}
            className="rounded-full"
          />
        )}
        {isUsdc && (
          <Image
            src={usdcLogoPath}
            alt="USDC"
            width={iconSizes[size]}
            height={iconSizes[size]}
            className="rounded-full"
          />
        )}
        <span className={`font-bold ${textSizes[size]} ${textColor}`}>
          {price.display}
        </span>
        {period && (
          <span className="text-gray-400 text-sm">{period}</span>
        )}
      </div>

      {/* Show original USD price when in $BRIAN mode (discount) */}
      {isBrian && showOriginal && discount > 0 && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-gray-500 line-through text-sm">
            ${usdPrice.toFixed(2)}
          </span>
          <span className="text-brian-green text-xs font-bold">
            Save {discount}%
          </span>
        </div>
      )}

      {/* Show note for USDC - same price as USD */}
      {isUsdc && showOriginal && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-usdc-blue text-xs font-medium">
            Same as USD - Stablecoin
          </span>
        </div>
      )}
    </div>
  );
}

export default PaymentModeToggle;
