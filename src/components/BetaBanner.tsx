'use client';

/**
 * Beta Banner Components
 *
 * UI components for displaying beta status, banners, and badges.
 *
 * @since 2025-11-29
 */

import { useState } from 'react';
import {
  X,
  Sparkles,
  Clock,
  Crown,
  Rocket,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { useBeta } from '@/contexts/BetaContext';

/**
 * Beta Badge - Small indicator showing beta status
 */
export function BetaBadge({ className = '' }: { className?: string }) {
  const { isBeta } = useBeta();

  if (!isBeta) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30 ${className}`}
    >
      <Sparkles className="w-3 h-3" />
      BETA
    </span>
  );
}

/**
 * Beta Banner - Full-width banner at top of page
 */
export function BetaBanner({
  onSubscribe,
  compact = false,
}: {
  onSubscribe?: () => void;
  compact?: boolean;
}) {
  const { isBeta, showBetaBanner, showExpiryWarning, daysRemaining, expiryMessage, dismissBanner } =
    useBeta();
  const [isVisible, setIsVisible] = useState(true);

  if (!isBeta || !showBetaBanner || !isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    dismissBanner();
  };

  if (compact) {
    return (
      <div
        className={`w-full py-2 px-4 text-center text-sm ${
          showExpiryWarning
            ? 'bg-gradient-to-r from-orange-500 to-red-500'
            : 'bg-gradient-to-r from-purple-600 to-pink-600'
        } text-white`}
      >
        <div className="flex items-center justify-center gap-2">
          {showExpiryWarning ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>{expiryMessage}</span>
          {showExpiryWarning && onSubscribe && (
            <button
              onClick={onSubscribe}
              className="ml-2 px-3 py-0.5 bg-white/20 hover:bg-white/30 rounded-full text-xs font-semibold transition-colors"
            >
              Subscribe Now
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="ml-2 p-0.5 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full py-3 px-4 ${
        showExpiryWarning
          ? 'bg-gradient-to-r from-orange-600 to-red-600'
          : 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600'
      } text-white relative overflow-hidden`}
    >
      {/* Animated background */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

      <div className="max-w-6xl mx-auto flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {showExpiryWarning ? (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                <Rocket className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">Infinity Assistant BETA</span>
                <BetaBadge />
              </div>
              <p className="text-sm text-white/80">{expiryMessage}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Feature highlights */}
          <div className="hidden md:flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-green-300" />
            <span>All features free</span>
          </div>

          {/* Days remaining */}
          <div className="px-3 py-1.5 bg-white/20 rounded-full text-sm font-semibold">
            {daysRemaining} days left
          </div>

          {/* Subscribe CTA (shown when warning) */}
          {showExpiryWarning && onSubscribe && (
            <button
              onClick={onSubscribe}
              className="px-4 py-1.5 bg-white text-purple-600 rounded-full text-sm font-bold hover:bg-white/90 transition-colors flex items-center gap-1"
            >
              Subscribe
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Beta Feature Card - Shows a beta-exclusive feature
 */
export function BetaFeatureCard({
  title,
  description,
  icon: Icon,
  available = true,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  available?: boolean;
}) {
  const { isBeta } = useBeta();

  return (
    <div
      className={`p-4 rounded-xl border ${
        isBeta && available
          ? 'border-purple-500/30 bg-purple-500/10'
          : 'border-gray-700 bg-gray-800/50'
      } transition-all hover:border-purple-500/50`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isBeta && available ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700 text-gray-400'
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">{title}</h3>
            {isBeta && available && <BetaBadge />}
          </div>
          <p className="text-sm text-gray-400 mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Beta Countdown - Shows time remaining
 */
export function BetaCountdown({ className = '' }: { className?: string }) {
  const { isBeta, daysRemaining, status } = useBeta();

  if (!isBeta) return null;

  // Calculate hours remaining in the current day
  const hoursInDay = status.hoursRemaining % 24;

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="text-center">
        <div className="text-3xl font-bold text-white">{daysRemaining}</div>
        <div className="text-xs text-gray-400 uppercase">Days</div>
      </div>
      <div className="text-2xl text-gray-600">:</div>
      <div className="text-center">
        <div className="text-3xl font-bold text-white">{hoursInDay}</div>
        <div className="text-xs text-gray-400 uppercase">Hours</div>
      </div>
    </div>
  );
}

/**
 * Beta Upgrade Prompt - Shown when beta is ending
 */
export function BetaUpgradePrompt({
  onUpgrade,
  onDismiss,
}: {
  onUpgrade: () => void;
  onDismiss: () => void;
}) {
  const { isBeta, showExpiryWarning, daysRemaining } = useBeta();

  if (!isBeta || !showExpiryWarning) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Beta Ending Soon!</h2>
          <p className="text-gray-400 mb-4">
            Your free access to all features ends in{' '}
            <span className="text-purple-400 font-semibold">{daysRemaining} days</span>.
          </p>

          <BetaCountdown className="justify-center mb-6" />

          <div className="space-y-3">
            <button
              onClick={onUpgrade}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Crown className="w-5 h-5" />
              Subscribe Now - Keep Your Access
            </button>
            <button
              onClick={onDismiss}
              className="w-full py-2 px-4 text-gray-400 hover:text-white transition-colors text-sm"
            >
              Remind me later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Beta Status Indicator - Small status for headers
 */
export function BetaStatusIndicator() {
  const { isBeta, daysRemaining, showExpiryWarning } = useBeta();

  if (!isBeta) return null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
        showExpiryWarning
          ? 'bg-orange-500/20 text-orange-400'
          : 'bg-purple-500/20 text-purple-400'
      }`}
    >
      <Sparkles className="w-4 h-4" />
      <span className="font-medium">BETA</span>
      <span className="text-xs opacity-75">• {daysRemaining}d left</span>
    </div>
  );
}

// Add shimmer animation to global styles
const shimmerStyle = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.animate-shimmer {
  animation: shimmer 3s infinite;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = shimmerStyle;
  document.head.appendChild(style);
}
