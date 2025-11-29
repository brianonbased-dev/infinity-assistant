'use client';

/**
 * Freemium Offer Component
 *
 * Displays contextual offers for free users when they search for something
 * that could benefit from our paid services.
 *
 * Offers:
 * - Free AI Assist response (3/day)
 * - Free mini-build (1/week)
 * - Free deep research (1/day)
 */

import { useState } from 'react';
import {
  MessageCircle,
  Code,
  Search,
  Sparkles,
  ArrowRight,
  X,
  Loader2,
  Check,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FreemiumOffer as FreemiumOfferType } from '@/services/FreemiumOfferService';

interface FreemiumOfferProps {
  offer: FreemiumOfferType;
  query: string;
  onAccept: () => void;
  onDismiss: () => void;
  onUpgrade: () => void;
  isLoading?: boolean;
}

export function FreemiumOfferCard({
  offer,
  query,
  onAccept,
  onDismiss,
  onUpgrade,
  isLoading = false,
}: FreemiumOfferProps) {
  const getIcon = () => {
    switch (offer.type) {
      case 'assist':
        return MessageCircle;
      case 'build':
        return Code;
      case 'deep_research':
        return Search;
      default:
        return Sparkles;
    }
  };

  const getGradient = () => {
    switch (offer.type) {
      case 'assist':
        return 'from-purple-600/20 to-blue-600/20 border-purple-500/40';
      case 'build':
        return 'from-green-600/20 to-emerald-600/20 border-green-500/40';
      case 'deep_research':
        return 'from-blue-600/20 to-cyan-600/20 border-blue-500/40';
      default:
        return 'from-gray-600/20 to-gray-700/20 border-gray-500/40';
    }
  };

  const getAccentColor = () => {
    switch (offer.type) {
      case 'assist':
        return 'text-purple-400';
      case 'build':
        return 'text-green-400';
      case 'deep_research':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const getButtonGradient = () => {
    switch (offer.type) {
      case 'assist':
        return 'from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500';
      case 'build':
        return 'from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500';
      case 'deep_research':
        return 'from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500';
      default:
        return 'from-gray-600 to-gray-700';
    }
  };

  const Icon = getIcon();

  return (
    <div
      className={`relative rounded-lg border bg-gradient-to-r ${getGradient()} p-4 mb-4 animate-in slide-in-from-top-2 duration-300`}
    >
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-300 transition-colors"
        aria-label="Dismiss offer"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={`w-12 h-12 rounded-lg bg-black/30 flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={`w-6 h-6 ${getAccentColor()}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badge */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-black/30 ${getAccentColor()}`}
            >
              <Zap className="w-3 h-3 inline mr-1" />
              Free Trial
            </span>
            <span className="text-xs text-gray-500">
              {offer.remainingToday}/{offer.maxPerDay}{' '}
              {offer.type === 'build' ? 'this week' : 'today'}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-white mb-1">{offer.title}</h3>

          {/* Description */}
          <p className="text-sm text-gray-400 mb-3">{offer.description}</p>

          {/* Query preview */}
          <div className="text-xs text-gray-500 mb-3 bg-black/20 rounded px-2 py-1 truncate">
            &quot;{query}&quot;
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={onAccept}
              disabled={isLoading}
              className={`bg-gradient-to-r ${getButtonGradient()} text-white font-medium`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {offer.ctaText}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>

            <button
              onClick={onUpgrade}
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              {offer.upgradeText}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Freemium Response Display
 * Shows the result of accepting a freemium offer
 */
interface FreemiumResponseProps {
  type: 'assist' | 'build' | 'deep_research';
  response: string;
  onUpgrade: () => void;
  onClose: () => void;
}

export function FreemiumResponse({
  type,
  response,
  onUpgrade,
  onClose,
}: FreemiumResponseProps) {
  const getConfig = () => {
    switch (type) {
      case 'assist':
        return {
          title: 'AI Assistant Response',
          icon: MessageCircle,
          color: 'purple',
          upgradeText: 'Get unlimited AI conversations with Assistant Pro',
        };
      case 'build':
        return {
          title: 'Generated Code',
          icon: Code,
          color: 'green',
          upgradeText: 'Get unlimited code generation with Builder Pro',
        };
      case 'deep_research':
        return {
          title: 'Deep Research Results',
          icon: Search,
          color: 'blue',
          upgradeText: 'Get unlimited deep research with Assistant Pro',
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 text-${config.color}-400`} />
          <span className="font-medium text-white">{config.title}</span>
          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
            <Check className="w-3 h-3 inline mr-1" />
            Free Trial
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-500 hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Response content */}
      <div className="p-4">
        <div className="prose prose-invert prose-sm max-w-none">
          {type === 'build' ? (
            <pre className="bg-gray-800 rounded-lg p-4 overflow-x-auto text-sm">
              <code>{response}</code>
            </pre>
          ) : (
            <div className="whitespace-pre-wrap text-gray-300">{response}</div>
          )}
        </div>
      </div>

      {/* Upgrade CTA */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            <Sparkles className="w-4 h-4 inline mr-1 text-purple-400" />
            {config.upgradeText}
          </p>
          <Button
            onClick={onUpgrade}
            size="sm"
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
          >
            Upgrade Now
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Mini version of the offer for inline display
 */
interface FreemiumOfferMiniProps {
  offer: FreemiumOfferType;
  onAccept: () => void;
}

export function FreemiumOfferMini({ offer, onAccept }: FreemiumOfferMiniProps) {
  const getIcon = () => {
    switch (offer.type) {
      case 'assist':
        return MessageCircle;
      case 'build':
        return Code;
      case 'deep_research':
        return Search;
      default:
        return Sparkles;
    }
  };

  const getColor = () => {
    switch (offer.type) {
      case 'assist':
        return 'purple';
      case 'build':
        return 'green';
      case 'deep_research':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const Icon = getIcon();
  const color = getColor();

  return (
    <button
      onClick={onAccept}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-${color}-500/40 bg-${color}-500/10 text-${color}-400 text-sm hover:bg-${color}-500/20 transition-colors`}
    >
      <Icon className="w-4 h-4" />
      <span>{offer.ctaText}</span>
      <Zap className="w-3 h-3" />
    </button>
  );
}
