'use client';

/**
 * Pricing Page Component
 *
 * Displays pricing tiers for Infinity Assistant and Builder
 * Supports both USD and $BRIAN payment modes
 * Features:
 * - Toggle between USD and $BRIAN
 * - Green theme when $BRIAN is selected
 * - Discounted prices for $BRIAN payments
 * - Clear feature comparison
 */

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Check,
  X,
  Sparkles,
  Zap,
  Crown,
  Rocket,
  MessageCircle,
  Code,
  Search,
  Brain,
  Shield,
  Clock,
  Users,
  Infinity,
} from 'lucide-react';
import {
  PaymentModeProvider,
  PaymentModeToggle,
  PriceDisplay,
  usePaymentMode,
  type PricingTier,
} from './PaymentModeToggle';
import { Button } from '@/components/ui/button';
import { BaseNetworkIndicator } from './NetworkIndicator';

// ============================================================================
// PRICING DATA - Option A (Landing Page Prices)
// Cyber Monday: 50% OFF with code CYBER50 (ends Dec 8, 2025)
// ============================================================================

// Cyber Monday countdown - ends Dec 8, 2025 at midnight
export const CYBER_MONDAY_END = new Date('2025-12-08T23:59:59');
export const CYBER_MONDAY_DISCOUNT = 0.50; // 50% off

const ASSISTANT_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    usdPrice: 0,
    brianPrice: 0,
    brianDiscount: 0,
    features: [
      '20 searches per day',
      'Knowledge base access (W/P/G)',
      'Auto-research for missing topics',
      'Community support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    usdPrice: 29, // $29/mo - Cyber Monday: $14.50
    brianPrice: 23200, // ~20% discount in $BRIAN
    brianDiscount: 20,
    popular: true,
    features: [
      '100 queries per day',
      'AI-powered conversations',
      'Deep research with synthesis',
      'Memory & context retention',
      'Multi-language support (15+)',
      'Priority support',
    ],
  },
];

const BUILDER_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    usdPrice: 0,
    brianPrice: 0,
    brianDiscount: 0,
    features: [
      '1 project per month',
      'Basic templates',
      'Vercel deployment',
      'Community support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    usdPrice: 49, // $49/mo - Cyber Monday: $24.50
    brianPrice: 39200, // ~20% discount in $BRIAN
    brianDiscount: 20,
    popular: true,
    features: [
      'All Assistant Pro features',
      'Unlimited queries',
      'Code generation & patterns',
      'Architecture guidance',
      'GitHub integration',
      'Priority builds',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    usdPrice: 149, // $149/mo - Cyber Monday: $74.50
    brianPrice: 104300, // ~30% discount in $BRIAN
    brianDiscount: 30,
    features: [
      'All Builder Pro features',
      'Up to 10 team members',
      'Shared knowledge base',
      'Custom templates',
      'Priority support',
      'SLA guarantee',
    ],
  },
];

// ============================================================================
// PRICING CARD COMPONENT
// ============================================================================

interface PricingCardProps {
  tier: PricingTier;
  type: 'assistant' | 'builder';
  onSelect: (tier: PricingTier) => void;
  brianLogoPath?: string;
}

function PricingCard({ tier, type, onSelect, brianLogoPath = '/images/brian-logo.svg' }: PricingCardProps) {
  const { isBrianMode, isUsdcMode, getDiscount } = usePaymentMode();
  const discount = tier.brianDiscount;

  const icons = {
    free: Zap,
    starter: Zap,
    pro: Sparkles,
    creator: Rocket,
    enterprise: Crown,
    agency: Crown,
  };

  const Icon = icons[tier.id as keyof typeof icons] || Sparkles;

  // Get styling based on payment mode
  const getPopularCardStyle = () => {
    if (isBrianMode) return 'bg-gradient-to-b from-brian-green/20 to-brian-green/5 border-2 border-brian-green shadow-brian-lg';
    if (isUsdcMode) return 'bg-gradient-to-b from-usdc-blue/20 to-usdc-blue/5 border-2 border-usdc-blue shadow-usdc-lg';
    return 'bg-gradient-to-b from-purple-600/20 to-purple-600/5 border-2 border-purple-500 shadow-purple-lg';
  };

  const getAccentColor = () => {
    if (isBrianMode) return 'text-brian-green';
    if (isUsdcMode) return 'text-usdc-blue';
    return 'text-purple-400';
  };

  const getButtonStyle = () => {
    if (isBrianMode) return 'bg-brian-green hover:bg-brian-green-dark text-black';
    if (isUsdcMode) return 'bg-usdc-blue hover:bg-usdc-blue-dark text-white';
    return 'bg-purple-500 hover:bg-purple-600 text-white';
  };

  const getBadgeStyle = () => {
    if (isBrianMode) return 'bg-brian-green text-black';
    if (isUsdcMode) return 'bg-usdc-blue text-white';
    return 'bg-purple-500 text-white';
  };

  return (
    <div
      className={`
        relative rounded-2xl p-6 transition-all duration-300
        ${tier.popular ? getPopularCardStyle() : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'}
      `}
    >
      {/* Popular badge */}
      {tier.popular && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold ${getBadgeStyle()}`}>
          MOST POPULAR
        </div>
      )}

      {/* $BRIAN discount badge */}
      {isBrianMode && discount > 0 && (
        <div className="absolute -top-3 -right-3 flex items-center gap-1 bg-brian-green text-black px-2 py-1 rounded-full text-xs font-bold shadow-lg">
          <Image src={brianLogoPath} alt="$BRIAN" width={14} height={14} className="rounded-full" />
          -{discount}%
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <div
          className={`
            inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4
            ${tier.popular
              ? isBrianMode
                ? 'bg-brian-green/20'
                : isUsdcMode
                  ? 'bg-usdc-blue/20'
                  : 'bg-purple-500/20'
              : 'bg-gray-700'
            }
          `}
        >
          <Icon className={`w-6 h-6 ${tier.popular ? getAccentColor() : 'text-gray-400'}`} />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>

        {/* Price */}
        <PriceDisplay
          usdPrice={tier.usdPrice}
          brianPrice={tier.brianPrice}
          size={tier.popular ? 'lg' : 'md'}
          period="/month"
          brianLogoPath={brianLogoPath}
        />
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-6">
        {tier.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${getAccentColor()}`} />
            <span className="text-gray-300 text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <Button
        onClick={() => onSelect(tier)}
        className={`w-full py-3 rounded-xl font-semibold transition-all ${tier.popular ? getButtonStyle() : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
      >
        {tier.usdPrice === 0 ? 'Get Started Free' : `Choose ${tier.name}`}
      </Button>
    </div>
  );
}

// ============================================================================
// MAIN PRICING PAGE
// ============================================================================

interface PricingPageProps {
  defaultTab?: 'assistant' | 'builder';
  onSelectTier?: (tier: PricingTier, type: 'assistant' | 'builder', paymentMode: 'usd' | 'brian') => void;
  brianLogoPath?: string;
  brianDiscountPercent?: number;
}

export function PricingPage({
  defaultTab = 'assistant',
  onSelectTier,
  brianLogoPath = '/images/brian-logo.svg',
  brianDiscountPercent = 20,
}: PricingPageProps) {
  const [activeTab, setActiveTab] = useState<'assistant' | 'builder'>(defaultTab);

  return (
    <PaymentModeProvider brianDiscountPercent={brianDiscountPercent}>
      <PricingPageContent
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSelectTier={onSelectTier}
        brianLogoPath={brianLogoPath}
      />
    </PaymentModeProvider>
  );
}

function PricingPageContent({
  activeTab,
  setActiveTab,
  onSelectTier,
  brianLogoPath,
}: {
  activeTab: 'assistant' | 'builder';
  setActiveTab: (tab: 'assistant' | 'builder') => void;
  onSelectTier?: (tier: PricingTier, type: 'assistant' | 'builder', paymentMode: 'usd' | 'usdc' | 'brian') => void;
  brianLogoPath: string;
}) {
  const { mode, isBrianMode, isUsdcMode, isCryptoMode } = usePaymentMode();
  const tiers = activeTab === 'assistant' ? ASSISTANT_TIERS : BUILDER_TIERS;

  const handleSelectTier = (tier: PricingTier) => {
    onSelectTier?.(tier, activeTab, mode);
  };

  // Get background gradient based on payment mode
  const bgGradient = isBrianMode
    ? 'bg-gradient-to-b from-gray-900 via-brian-green/5 to-gray-900'
    : isUsdcMode
      ? 'bg-gradient-to-b from-gray-900 via-usdc-blue/5 to-gray-900'
      : 'bg-gradient-to-b from-gray-900 via-purple-900/10 to-gray-900';

  return (
    <div className={`min-h-screen py-16 px-4 transition-colors duration-500 ${bgGradient}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
            Choose the plan that fits your needs. Pay with USD, USDC, or save with{' '}
            <span className="text-brian-green font-semibold">$BRIAN</span>.
          </p>

          {/* Payment Mode Toggle */}
          <div className="flex justify-center mb-8">
            <PaymentModeToggle size="lg" brianLogoPath={brianLogoPath} />
          </div>

          {/* $BRIAN benefits callout */}
          {isBrianMode && (
            <div className="inline-flex items-center gap-3 bg-brian-green/10 border border-brian-green/30 rounded-xl px-6 py-3 mb-8">
              <Image src={brianLogoPath} alt="$BRIAN" width={24} height={24} className="rounded-full" />
              <span className="text-brian-green font-medium">
                You're saving up to 40% by paying with $BRIAN!
              </span>
            </div>
          )}

          {/* USDC info callout with Base network */}
          {isUsdcMode && (
            <div className="flex flex-col items-center gap-2 mb-8">
              <div className="inline-flex items-center gap-3 bg-usdc-blue/10 border border-usdc-blue/30 rounded-xl px-6 py-3">
                <Image src="/images/usdc-logo.svg" alt="USDC" width={24} height={24} className="rounded-full" />
                <span className="text-usdc-blue font-medium">
                  Pay with USDC stablecoin - same price as USD
                </span>
              </div>
              <div className="inline-flex items-center gap-2 bg-base-blue/10 border border-base-blue/30 rounded-lg px-4 py-2">
                <BaseNetworkIndicator size="sm" showPoweredBy={true} />
                <span className="text-gray-400 text-sm">Low fees, fast transactions</span>
              </div>
            </div>
          )}

          {/* $BRIAN on Base callout */}
          {isBrianMode && (
            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center gap-2 bg-base-blue/10 border border-base-blue/30 rounded-lg px-4 py-2">
                <BaseNetworkIndicator size="sm" showPoweredBy={true} />
                <span className="text-gray-400 text-sm">$BRIAN payments on Base network</span>
              </div>
            </div>
          )}

          {/* Product Tabs */}
          <div className="flex justify-center gap-2 mb-8">
            <button
              type="button"
              onClick={() => setActiveTab('assistant')}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                ${activeTab === 'assistant'
                  ? isBrianMode
                    ? 'bg-brian-green text-black'
                    : isUsdcMode
                      ? 'bg-usdc-blue text-white'
                      : 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
                }
              `}
            >
              <MessageCircle className="w-5 h-5" />
              Infinity Assistant
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('builder')}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                ${activeTab === 'builder'
                  ? isBrianMode
                    ? 'bg-brian-green text-black'
                    : isUsdcMode
                      ? 'bg-usdc-blue text-white'
                      : 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
                }
              `}
            >
              <Code className="w-5 h-5" />
              Infinity Builder
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {tiers.map((tier) => (
            <PricingCard
              key={tier.id}
              tier={tier}
              type={activeTab}
              onSelect={handleSelectTier}
              brianLogoPath={brianLogoPath}
            />
          ))}
        </div>

        {/* Feature Comparison */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Compare All Features
          </h2>
          <FeatureComparison type={activeTab} isBrianMode={isBrianMode} />
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-gray-400">
            Questions? Contact us at{' '}
            <a href="mailto:support@infinityassistant.io" className="text-brian-green hover:underline">
              support@infinityassistant.io
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FEATURE COMPARISON TABLE
// ============================================================================

function FeatureComparison({ type, isBrianMode }: { type: 'assistant' | 'builder'; isBrianMode: boolean }) {
  const features =
    type === 'assistant'
      ? [
          { name: 'Daily Searches', free: '20', pro: 'Unlimited', enterprise: 'Unlimited' },
          { name: 'Search Mode', free: true, pro: true, enterprise: true },
          { name: 'Assist Mode', free: false, pro: true, enterprise: true },
          { name: 'Build Mode', free: false, pro: false, enterprise: true },
          { name: 'Knowledge Base', free: false, pro: true, enterprise: true },
          { name: 'Conversation Memory', free: false, pro: true, enterprise: true },
          { name: 'API Access', free: false, pro: false, enterprise: true },
          { name: 'Team Collaboration', free: false, pro: false, enterprise: true },
          { name: 'Priority Support', free: false, pro: true, enterprise: true },
        ]
      : [
          { name: 'Projects/Month', free: '1', pro: '10', enterprise: 'Unlimited' },
          { name: 'Templates', free: 'Basic', pro: 'All', enterprise: 'All + Custom' },
          { name: 'Deployment', free: 'Vercel', pro: 'Vercel + Custom', enterprise: 'Any' },
          { name: 'GitHub Integration', free: false, pro: true, enterprise: true },
          { name: 'Custom Domains', free: false, pro: true, enterprise: true },
          { name: 'API Access', free: false, pro: false, enterprise: true },
          { name: 'Team Seats', free: '1', pro: '3', enterprise: '10+' },
          { name: 'White-Label', free: false, pro: false, enterprise: true },
          { name: 'SLA Guarantee', free: false, pro: false, enterprise: true },
        ];

  const tierNames = type === 'assistant' ? ['Free', 'Pro', 'Enterprise'] : ['Starter', 'Creator', 'Agency'];
  const tierKeys = type === 'assistant' ? ['free', 'pro', 'enterprise'] : ['free', 'pro', 'enterprise'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-4 px-4 text-gray-400 font-medium">Feature</th>
            {tierNames.map((name, idx) => (
              <th key={name} className="text-center py-4 px-4 text-white font-semibold">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((feature, idx) => (
            <tr key={idx} className="border-b border-gray-800">
              <td className="py-4 px-4 text-gray-300">{feature.name}</td>
              {tierKeys.map((key) => {
                const value = feature[key as keyof typeof feature];
                return (
                  <td key={key} className="text-center py-4 px-4">
                    {typeof value === 'boolean' ? (
                      value ? (
                        <Check className={`w-5 h-5 mx-auto ${isBrianMode ? 'text-brian-green' : 'text-purple-400'}`} />
                      ) : (
                        <X className="w-5 h-5 mx-auto text-gray-600" />
                      )
                    ) : (
                      <span className="text-gray-300">{value}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PricingPage;
