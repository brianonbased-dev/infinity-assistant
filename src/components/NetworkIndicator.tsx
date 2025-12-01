'use client';

/**
 * Network Indicator Component
 *
 * Shows the blockchain network for crypto payments
 * Supports Base, Ethereum, Polygon, etc.
 */

import React from 'react';
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type SupportedNetwork = 'base' | 'ethereum' | 'polygon' | 'arbitrum' | 'optimism';

export interface NetworkConfig {
  id: SupportedNetwork;
  name: string;
  chainId: number;
  color: string;
  bgColor: string;
  borderColor: string;
  logoPath: string;
  explorerUrl: string;
  rpcUrl: string;
}

// ============================================================================
// NETWORK CONFIGURATIONS
// ============================================================================

export const NETWORKS: Record<SupportedNetwork, NetworkConfig> = {
  base: {
    id: 'base',
    name: 'Base',
    chainId: 8453,
    color: '#0052FF',
    bgColor: 'bg-base-blue',
    borderColor: 'border-base-blue',
    logoPath: '/images/base-logo.svg',
    explorerUrl: 'https://basescan.org',
    rpcUrl: 'https://mainnet.base.org',
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    color: '#627EEA',
    bgColor: 'bg-[#627EEA]',
    borderColor: 'border-[#627EEA]',
    logoPath: '/images/ethereum-logo.svg',
    explorerUrl: 'https://etherscan.io',
    rpcUrl: 'https://eth.llamarpc.com',
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    chainId: 137,
    color: '#8247E5',
    bgColor: 'bg-[#8247E5]',
    borderColor: 'border-[#8247E5]',
    logoPath: '/images/polygon-logo.svg',
    explorerUrl: 'https://polygonscan.com',
    rpcUrl: 'https://polygon-rpc.com',
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    chainId: 42161,
    color: '#28A0F0',
    bgColor: 'bg-[#28A0F0]',
    borderColor: 'border-[#28A0F0]',
    logoPath: '/images/arbitrum-logo.svg',
    explorerUrl: 'https://arbiscan.io',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism',
    chainId: 10,
    color: '#FF0420',
    bgColor: 'bg-[#FF0420]',
    borderColor: 'border-[#FF0420]',
    logoPath: '/images/optimism-logo.svg',
    explorerUrl: 'https://optimistic.etherscan.io',
    rpcUrl: 'https://mainnet.optimism.io',
  },
};

// Default network for payments
export const DEFAULT_NETWORK: SupportedNetwork = 'base';

// ============================================================================
// NETWORK BADGE COMPONENT
// ============================================================================

interface NetworkBadgeProps {
  network: SupportedNetwork;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

export function NetworkBadge({
  network,
  size = 'md',
  showName = true,
  className = '',
}: NetworkBadgeProps) {
  const config = NETWORKS[network];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        ${sizeClasses[size]}
        ${className}
      `}
      style={{
        backgroundColor: `${config.color}20`,
        border: `1px solid ${config.color}50`,
        color: config.color,
      }}
    >
      <Image
        src={config.logoPath}
        alt={config.name}
        width={iconSizes[size]}
        height={iconSizes[size]}
        className="rounded-full"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      {showName && <span>{config.name}</span>}
    </div>
  );
}

// ============================================================================
// NETWORK SELECTOR COMPONENT
// ============================================================================

interface NetworkSelectorProps {
  selectedNetwork: SupportedNetwork;
  onNetworkChange: (network: SupportedNetwork) => void;
  availableNetworks?: SupportedNetwork[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function NetworkSelector({
  selectedNetwork,
  onNetworkChange,
  availableNetworks = ['base', 'ethereum', 'polygon'],
  size = 'md',
  className = '',
}: NetworkSelectorProps) {
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

  return (
    <div className={`flex items-center gap-1 bg-gray-800/50 rounded-xl p-1 ${className}`}>
      {availableNetworks.map((networkId) => {
        const config = NETWORKS[networkId];
        const isActive = selectedNetwork === networkId;

        return (
          <button
            type="button"
            key={networkId}
            onClick={() => onNetworkChange(networkId)}
            className={`
              flex items-center gap-1.5 ${sizeClasses[size]} rounded-lg font-medium transition-all duration-300
              ${isActive
                ? 'text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }
            `}
            style={isActive ? { backgroundColor: config.color } : {}}
            aria-label={`Select ${config.name} network`}
          >
            <Image
              src={config.logoPath}
              alt={config.name}
              width={iconSizes[size]}
              height={iconSizes[size]}
              className="rounded-full"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span>{config.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// NETWORK INFO BANNER
// ============================================================================

interface NetworkInfoBannerProps {
  network: SupportedNetwork;
  tokenSymbol: string; // e.g., 'USDC' or '$BRIAN'
  showExplorer?: boolean;
  className?: string;
}

export function NetworkInfoBanner({
  network,
  tokenSymbol,
  showExplorer = true,
  className = '',
}: NetworkInfoBannerProps) {
  const config = NETWORKS[network];

  return (
    <div
      className={`
        flex items-center justify-between p-3 rounded-xl
        ${className}
      `}
      style={{
        backgroundColor: `${config.color}10`,
        border: `1px solid ${config.color}30`,
      }}
    >
      <div className="flex items-center gap-3">
        <Image
          src={config.logoPath}
          alt={config.name}
          width={24}
          height={24}
          className="rounded-full"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div>
          <p className="text-sm font-medium text-white">
            Pay with {tokenSymbol} on {config.name}
          </p>
          <p className="text-xs text-gray-400">
            Low fees, fast transactions
          </p>
        </div>
      </div>

      {showExplorer && (
        <a
          href={config.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs hover:underline"
          style={{ color: config.color }}
        >
          Explorer
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

// ============================================================================
// BASE NETWORK SPECIFIC COMPONENT
// ============================================================================

interface BaseNetworkIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  showPoweredBy?: boolean;
  className?: string;
}

export function BaseNetworkIndicator({
  size = 'md',
  showPoweredBy = true,
  className = '',
}: BaseNetworkIndicatorProps) {
  const config = NETWORKS.base;

  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
    lg: 'text-base gap-2',
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 24,
  };

  return (
    <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
      <Image
        src={config.logoPath}
        alt="Base"
        width={iconSizes[size]}
        height={iconSizes[size]}
        className="rounded-full"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <span className="font-medium text-base-blue">Base</span>
      {showPoweredBy && (
        <span className="text-gray-500 text-xs">by Coinbase</span>
      )}
    </div>
  );
}

export default NetworkIndicator;

// Simple export for backwards compatibility
export function NetworkIndicator(props: NetworkBadgeProps) {
  return <NetworkBadge {...props} />;
}
