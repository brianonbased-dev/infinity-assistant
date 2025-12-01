'use client';

/**
 * Pricing Page Route
 *
 * /pricing - Displays pricing tiers for Infinity Assistant and Builder
 * Supports USD and $BRIAN payment modes
 */

import React from 'react';
import { PricingPage as PricingPageComponent, type PricingTier } from '@/components/PricingPage';
import { UpgradeModal, type UpgradePlan } from '@/components/UpgradeModal';
import { useState } from 'react';

export default function PricingRoute() {
  const [selectedTier, setSelectedTier] = useState<{
    tier: PricingTier;
    type: 'assistant' | 'builder';
    paymentMode: 'usd' | 'brian';
  } | null>(null);

  const handleSelectTier = (
    tier: PricingTier,
    type: 'assistant' | 'builder',
    paymentMode: 'usd' | 'brian'
  ) => {
    // Don't open modal for free tiers
    if (tier.usdPrice === 0) {
      // Redirect to signup or app
      window.location.href = '/';
      return;
    }

    setSelectedTier({ tier, type, paymentMode });
  };

  const handleCloseModal = () => {
    setSelectedTier(null);
  };

  const handleUpgradeComplete = (result: {
    success: boolean;
    paymentMethod: 'usd' | 'brian';
    txHash?: string;
  }) => {
    if (result.success) {
      // Handle successful upgrade
      console.log('Upgrade successful:', result);
      // Could redirect to dashboard or show success message
    }
  };

  // Convert PricingTier to UpgradePlan for the modal
  const getUpgradePlan = (): UpgradePlan | null => {
    if (!selectedTier) return null;

    return {
      id: selectedTier.tier.id,
      name: selectedTier.tier.name,
      usdPrice: selectedTier.tier.usdPrice,
      brianPrice: selectedTier.tier.brianPrice,
      features: selectedTier.tier.features,
      period: 'monthly', // Default to monthly, could be toggle
    };
  };

  const upgradePlan = getUpgradePlan();

  return (
    <>
      <PricingPageComponent
        defaultTab="assistant"
        onSelectTier={handleSelectTier}
        brianLogoPath="/images/brian-logo.svg"
        brianDiscountPercent={20}
      />

      {upgradePlan && (
        <UpgradeModal
          isOpen={!!selectedTier}
          onClose={handleCloseModal}
          plan={upgradePlan}
          onUpgradeComplete={handleUpgradeComplete}
          brianLogoPath="/images/brian-logo.svg"
        />
      )}
    </>
  );
}
