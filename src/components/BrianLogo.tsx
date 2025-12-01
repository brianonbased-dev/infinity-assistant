'use client';

/**
 * $BRIAN Token Logo Component
 *
 * Official logo for $BRIAN cryptocurrency token
 * Used throughout the monetization UI
 */

import React from 'react';

interface BrianLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animated?: boolean;
}

const sizeMap = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
};

export function BrianLogo({ size = 'md', className = '', animated = false }: BrianLogoProps) {
  const pixelSize = sizeMap[size];

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 100 100"
      className={`${className} ${animated ? 'animate-pulse' : ''}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Gradient definitions */}
      <defs>
        <linearGradient id="brianGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00FF88" />
          <stop offset="50%" stopColor="#00D971" />
          <stop offset="100%" stopColor="#00B35A" />
        </linearGradient>
        <linearGradient id="brianGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00FF88" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#00B35A" stopOpacity="0.2" />
        </linearGradient>
        <filter id="brianShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00FF88" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Outer glow circle */}
      <circle cx="50" cy="50" r="48" fill="url(#brianGlow)" opacity="0.3" />

      {/* Main circle with gradient */}
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="url(#brianGradient)"
        filter="url(#brianShadow)"
      />

      {/* Inner darker circle for depth */}
      <circle cx="50" cy="50" r="36" fill="#001a0d" opacity="0.3" />

      {/* $B symbol */}
      <text
        x="50"
        y="58"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="36"
        fontWeight="bold"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="#ffffff"
        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
      >
        $B
      </text>

      {/* Decorative lines */}
      <path
        d="M 20 50 Q 30 35, 50 35 Q 70 35, 80 50"
        stroke="#ffffff"
        strokeWidth="1.5"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M 20 50 Q 30 65, 50 65 Q 70 65, 80 50"
        stroke="#ffffff"
        strokeWidth="1.5"
        fill="none"
        opacity="0.3"
      />
    </svg>
  );
}

/**
 * $BRIAN Token Icon (smaller, simpler version)
 */
export function BrianIcon({ size = 'sm', className = '' }: Omit<BrianLogoProps, 'animated'>) {
  const pixelSize = sizeMap[size];

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="11" fill="#00D971" />
      <text
        x="12"
        y="13"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="10"
        fontWeight="bold"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="#ffffff"
      >
        $B
      </text>
    </svg>
  );
}

/**
 * $BRIAN Badge (for showing prices)
 */
interface BrianBadgeProps {
  amount: number | string;
  size?: 'sm' | 'md' | 'lg';
  showDiscount?: boolean;
  originalAmount?: number;
  className?: string;
}

export function BrianBadge({
  amount,
  size = 'md',
  showDiscount = false,
  originalAmount,
  className = ''
}: BrianBadgeProps) {
  const textSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base';
  const iconSize = size === 'sm' ? 'xs' : size === 'lg' ? 'md' : 'sm';

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <BrianIcon size={iconSize} />
      <span className={`font-bold text-brian-green ${textSize}`}>
        {typeof amount === 'number' ? amount.toLocaleString() : amount}
      </span>
      {showDiscount && originalAmount && (
        <span className="text-gray-500 line-through text-sm ml-1">
          ${originalAmount}
        </span>
      )}
    </div>
  );
}

export default BrianLogo;
