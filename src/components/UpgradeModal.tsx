'use client';

/**
 * Upgrade Modal Component
 *
 * Modal for upgrading subscription with USD or $BRIAN
 * Features:
 * - Payment method selection (USD via Stripe, $BRIAN via wallet)
 * - Real-time price calculation with discounts
 * - Green theme when $BRIAN is selected
 * - Wallet connection for crypto payments
 */

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import {
  X,
  Check,
  CreditCard,
  Wallet,
  ArrowRight,
  Loader2,
  Shield,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PaymentModeProvider,
  PaymentModeToggle,
  PriceDisplay,
  usePaymentMode,
} from './PaymentModeToggle';
import { NetworkInfoBanner, BaseNetworkIndicator, NETWORKS, type SupportedNetwork } from './NetworkIndicator';

// ============================================================================
// TYPES
// ============================================================================

export interface UpgradePlan {
  id: string;
  name: string;
  usdPrice: number;
  brianPrice: number;
  features: string[];
  period: 'monthly' | 'yearly';
}

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: UpgradePlan;
  currentPlan?: string;
  onUpgradeComplete?: (result: { success: boolean; paymentMethod: 'usd' | 'brian'; txHash?: string }) => void;
  brianLogoPath?: string;
  stripePublishableKey?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UpgradeModal({
  isOpen,
  onClose,
  plan,
  currentPlan,
  onUpgradeComplete,
  brianLogoPath = '/images/brian-logo.svg',
}: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <PaymentModeProvider brianDiscountPercent={20}>
      <UpgradeModalContent
        plan={plan}
        currentPlan={currentPlan}
        onClose={onClose}
        onUpgradeComplete={onUpgradeComplete}
        brianLogoPath={brianLogoPath}
      />
    </PaymentModeProvider>
  );
}

function UpgradeModalContent({
  plan,
  currentPlan,
  onClose,
  onUpgradeComplete,
  brianLogoPath,
}: Omit<UpgradeModalProps, 'isOpen'>) {
  const { mode, isBrianMode, isUsdcMode, isCryptoMode, getPrice } = usePaymentMode();
  const [step, setStep] = useState<'select' | 'payment' | 'processing' | 'success' | 'error'>('select');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetwork>('base');

  const price = getPrice(plan.usdPrice, plan.brianPrice);
  const tokenSymbol = isBrianMode ? '$BRIAN' : 'USDC';

  // Switch network to Base
  const switchToNetwork = useCallback(async (network: SupportedNetwork) => {
    const config = NETWORKS[network];
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${config.chainId.toString(16)}` }],
        });
        setSelectedNetwork(network);
      }
    } catch (switchError: any) {
      // Chain not added, try to add it
      if (switchError.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${config.chainId.toString(16)}`,
              chainName: config.name,
              rpcUrls: [config.rpcUrl],
              blockExplorerUrls: [config.explorerUrl],
            }],
          });
          setSelectedNetwork(network);
        } catch (addError) {
          setError(`Failed to add ${config.name} network. Please add it manually.`);
        }
      }
    }
  }, []);

  // Connect wallet for crypto payment ($BRIAN or USDC)
  const connectWallet = useCallback(async () => {
    try {
      // Check for ethereum provider (MetaMask, etc.)
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });
        if (accounts[0]) {
          setWalletAddress(accounts[0]);
          setWalletConnected(true);
          // Auto-switch to Base network
          await switchToNetwork('base');
        }
      } else {
        setError(`Please install MetaMask or another Web3 wallet to pay with ${tokenSymbol}`);
      }
    } catch (err) {
      setError('Failed to connect wallet. Please try again.');
    }
  }, [tokenSymbol, switchToNetwork]);

  // Process payment
  const processPayment = useCallback(async () => {
    setStep('processing');
    setError(null);

    try {
      if (isCryptoMode) {
        // Crypto payment via Base network ($BRIAN or USDC)
        const token = isBrianMode ? 'BRIAN' : 'USDC';

        // Step 1: Get payment instructions from API
        const initResponse = await fetch('/api/payments/crypto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'initiate',
            token,
            amount: price.amount,
            planId: plan.id,
          }),
        });

        const initData = await initResponse.json();
        if (!initData.success) {
          throw new Error(initData.error || 'Failed to initiate payment');
        }

        // Step 2: Request token transfer via wallet
        const ethereum = (window as any).ethereum;
        if (!ethereum) {
          throw new Error('No wallet detected');
        }

        const { instructions } = initData;

        // ERC20 transfer function signature
        const transferFunctionSig = '0xa9059cbb';
        // Pad address to 32 bytes
        const paddedTo = instructions.to.slice(2).padStart(64, '0');
        // Convert amount to wei (6 decimals for USDC, 18 for BRIAN)
        const decimals = token === 'USDC' ? 6 : 18;
        const amountWei = BigInt(Math.floor(price.amount * 10 ** decimals));
        const paddedAmount = amountWei.toString(16).padStart(64, '0');

        const txData = transferFunctionSig + paddedTo + paddedAmount;

        // Send transaction
        const txHash = await ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: walletAddress,
            to: instructions.tokenAddress,
            data: txData,
            chainId: `0x${(8453).toString(16)}`, // Base chainId
          }],
        });

        // Step 3: Verify payment
        const verifyResponse = await fetch('/api/payments/crypto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify',
            txHash,
            token,
            amount: price.amount,
            walletAddress,
            planId: plan.id,
          }),
        });

        const verifyData = await verifyResponse.json();

        if (verifyData.success) {
          setStep('success');
          onUpgradeComplete?.({
            success: true,
            paymentMethod: isBrianMode ? 'brian' : 'usd',
            txHash,
          });
        } else {
          throw new Error(verifyData.error || 'Payment verification failed');
        }
      } else {
        // USD payment via Stripe
        const response = await fetch('/api/subscription/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tier: plan.id,
            interval: plan.period === 'yearly' ? 'annual' : 'monthly',
          }),
        });

        const data = await response.json();

        if (data.url) {
          // Redirect to Stripe Checkout
          window.location.href = data.url;
        } else {
          throw new Error(data.error || 'Failed to create checkout session');
        }
      }
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    }
  }, [isBrianMode, isCryptoMode, plan, price, walletAddress, onUpgradeComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`
          relative w-full max-w-lg rounded-2xl p-6
          ${isBrianMode
            ? 'bg-gradient-to-b from-gray-900 via-brian-green/5 to-gray-900 border border-brian-green/30'
            : isUsdcMode
              ? 'bg-gradient-to-b from-gray-900 via-usdc-blue/5 to-gray-900 border border-usdc-blue/30'
              : 'bg-gradient-to-b from-gray-900 via-purple-900/10 to-gray-900 border border-purple-500/30'
          }
        `}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">
            Upgrade to {plan.name}
          </h2>
          {currentPlan && (
            <p className="text-gray-400 text-sm">
              Current plan: <span className="text-white">{currentPlan}</span>
            </p>
          )}
        </div>

        {/* Payment Mode Toggle */}
        <div className="flex justify-center mb-6">
          <PaymentModeToggle size="md" brianLogoPath={brianLogoPath} />
        </div>

        {/* Step Content */}
        {step === 'select' && (
          <>
            {/* Price Display */}
            <div className="text-center mb-6">
              <PriceDisplay
                usdPrice={plan.usdPrice}
                brianPrice={plan.brianPrice}
                size="xl"
                period={`/${plan.period === 'yearly' ? 'year' : 'month'}`}
                brianLogoPath={brianLogoPath}
              />
            </div>

            {/* Features */}
            <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">What's included:</h3>
              <ul className="space-y-2">
                {plan.features.slice(0, 5).map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className={`w-4 h-4 ${isBrianMode ? 'text-brian-green' : isUsdcMode ? 'text-usdc-blue' : 'text-purple-400'}`} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Payment Method */}
            {isCryptoMode ? (
              <div className="space-y-4">
                {/* Base Network Banner */}
                <NetworkInfoBanner
                  network={selectedNetwork}
                  tokenSymbol={tokenSymbol}
                  showExplorer={false}
                />

                {!walletConnected ? (
                  <Button
                    onClick={connectWallet}
                    className={`w-full py-4 font-semibold rounded-xl flex items-center justify-center gap-2 ${
                      isBrianMode
                        ? 'bg-brian-green hover:bg-brian-green-dark text-black'
                        : 'bg-usdc-blue hover:bg-usdc-blue-dark text-white'
                    }`}
                  >
                    <Wallet className="w-5 h-5" />
                    Connect Wallet to Pay with {tokenSymbol}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    {/* Wallet Connected Status */}
                    <div className={`flex items-center justify-between p-3 rounded-xl border ${
                      isBrianMode
                        ? 'bg-brian-green/10 border-brian-green/30'
                        : 'bg-usdc-blue/10 border-usdc-blue/30'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Wallet className={`w-5 h-5 ${isBrianMode ? 'text-brian-green' : 'text-usdc-blue'}`} />
                        <span className="text-sm text-gray-300">Connected:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BaseNetworkIndicator size="sm" showPoweredBy={false} />
                        <span className={`text-sm font-mono ${isBrianMode ? 'text-brian-green' : 'text-usdc-blue'}`}>
                          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={processPayment}
                      className={`w-full py-4 font-semibold rounded-xl flex items-center justify-center gap-2 ${
                        isBrianMode
                          ? 'bg-brian-green hover:bg-brian-green-dark text-black'
                          : 'bg-usdc-blue hover:bg-usdc-blue-dark text-white'
                      }`}
                    >
                      <Image
                        src={isBrianMode ? brianLogoPath! : '/images/usdc-logo.svg'}
                        alt={tokenSymbol}
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                      Pay {price.display} on Base
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <Button
                onClick={processPayment}
                className="w-full py-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                Pay {price.display} with Card
                <ArrowRight className="w-5 h-5" />
              </Button>
            )}

            {/* Security note */}
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
              <Shield className="w-4 h-4" />
              <span>Secure payment processed by {isCryptoMode ? 'blockchain' : 'Stripe'}</span>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div className="text-center py-12">
            <Loader2 className={`w-12 h-12 mx-auto mb-4 animate-spin ${
              isBrianMode ? 'text-brian-green' : isUsdcMode ? 'text-usdc-blue' : 'text-purple-400'
            }`} />
            <h3 className="text-lg font-semibold text-white mb-2">
              Processing Payment...
            </h3>
            <p className="text-gray-400 text-sm">
              {isCryptoMode
                ? 'Confirming blockchain transaction...'
                : 'Connecting to payment processor...'
              }
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-12">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
              isBrianMode ? 'bg-brian-green/20' : isUsdcMode ? 'bg-usdc-blue/20' : 'bg-purple-500/20'
            }`}>
              <Check className={`w-8 h-8 ${
                isBrianMode ? 'text-brian-green' : isUsdcMode ? 'text-usdc-blue' : 'text-purple-400'
              }`} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Welcome to {plan.name}!
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Your upgrade is complete. Enjoy your new features!
            </p>
            <Button
              onClick={onClose}
              className={`px-8 py-3 rounded-xl font-semibold ${
                isBrianMode
                  ? 'bg-brian-green hover:bg-brian-green-dark text-black'
                  : isUsdcMode
                    ? 'bg-usdc-blue hover:bg-usdc-blue-dark text-white'
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
              }`}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start Exploring
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Payment Failed
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              {error || 'Something went wrong. Please try again.'}
            </p>
            <Button
              onClick={() => setStep('select')}
              className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold"
            >
              Try Again
            </Button>
          </div>
        )}

        {error && step === 'select' && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UpgradeModal;
