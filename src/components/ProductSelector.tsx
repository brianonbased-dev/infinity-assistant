'use client';

/**
 * Product Selector Component
 *
 * Initial selection screen for new users to choose between:
 * - Infinity Assistant: AI companion for search, research, conversations
 * - Infinity Builder: Build applications with AI guidance
 *
 * This is shown BEFORE onboarding to route users to the appropriate flow.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  Code,
  Sparkles,
  Search,
  Brain,
  Heart,
  Rocket,
  Check,
  ArrowRight,
} from 'lucide-react';

export type ProductChoice = 'assistant' | 'builder';

interface ProductSelectorProps {
  onSelect: (product: ProductChoice) => void;
  onSkip?: () => void;
}

export function ProductSelector({ onSelect, onSkip }: ProductSelectorProps) {
  const [selected, setSelected] = useState<ProductChoice | null>(null);
  const [hoveredProduct, setHoveredProduct] = useState<ProductChoice | null>(null);

  const handleContinue = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="w-full max-w-4xl mx-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Welcome to Infinity
          </h1>
          <p className="text-gray-400 text-lg">
            Choose how you'd like to get started
          </p>
        </div>

        {/* Product Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Infinity Assistant */}
          <button
            type="button"
            onClick={() => setSelected('assistant')}
            onMouseEnter={() => setHoveredProduct('assistant')}
            onMouseLeave={() => setHoveredProduct(null)}
            className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
              selected === 'assistant'
                ? 'border-purple-500 bg-purple-500/10 scale-[1.02]'
                : hoveredProduct === 'assistant'
                ? 'border-purple-500/50 bg-purple-500/5'
                : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
            }`}
          >
            {/* Selection indicator */}
            {selected === 'assistant' && (
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}

            {/* Icon */}
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors ${
              selected === 'assistant' ? 'bg-purple-500/20' : 'bg-gray-800'
            }`}>
              <MessageCircle className={`w-7 h-7 ${
                selected === 'assistant' ? 'text-purple-400' : 'text-gray-400'
              }`} />
            </div>

            {/* Title & Description */}
            <h2 className={`text-xl font-bold mb-2 ${
              selected === 'assistant' ? 'text-white' : 'text-gray-200'
            }`}>
              Infinity Assistant
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Your personal AI companion that remembers you, helps with research,
              and adapts to your communication style.
            </p>

            {/* Features */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Search className="w-4 h-4 text-blue-400" />
                <span>Deep research & knowledge synthesis</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Brain className="w-4 h-4 text-purple-400" />
                <span>Persistent memory across sessions</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Heart className="w-4 h-4 text-pink-400" />
                <span>Companion or Professional modes</span>
              </div>
            </div>

            {/* Free tier badge */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                <Check className="w-3 h-3" />
                Free tier available
              </span>
            </div>
          </button>

          {/* Infinity Builder */}
          <button
            type="button"
            onClick={() => setSelected('builder')}
            onMouseEnter={() => setHoveredProduct('builder')}
            onMouseLeave={() => setHoveredProduct(null)}
            className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
              selected === 'builder'
                ? 'border-green-500 bg-green-500/10 scale-[1.02]'
                : hoveredProduct === 'builder'
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
            }`}
          >
            {/* Selection indicator */}
            {selected === 'builder' && (
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}

            {/* Icon */}
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors ${
              selected === 'builder' ? 'bg-green-500/20' : 'bg-gray-800'
            }`}>
              <Code className={`w-7 h-7 ${
                selected === 'builder' ? 'text-green-400' : 'text-gray-400'
              }`} />
            </div>

            {/* Title & Description */}
            <h2 className={`text-xl font-bold mb-2 ${
              selected === 'builder' ? 'text-white' : 'text-gray-200'
            }`}>
              Infinity Builder
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Build complete applications with AI guidance. From idea to deployed
              product, no matter your experience level.
            </p>

            {/* Features */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span>Easy/Medium/Expert modes</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Code className="w-4 h-4 text-green-400" />
                <span>Production-ready code generation</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Rocket className="w-4 h-4 text-orange-400" />
                <span>One-click deploy to Vercel/Railway</span>
              </div>
            </div>

            {/* Free demo badge */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                <Sparkles className="w-3 h-3" />
                Free demo available
              </span>
            </div>
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            onClick={handleContinue}
            disabled={!selected}
            className={`px-8 py-3 text-lg font-semibold transition-all ${
              selected
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            Continue
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>

          {onSkip && (
            <Button
              variant="ghost"
              onClick={onSkip}
              className="text-gray-400 hover:text-white"
            >
              Skip for now
            </Button>
          )}
        </div>

        {/* Helper text */}
        <p className="text-center text-gray-500 text-sm mt-6">
          You can switch between products anytime from the main menu
        </p>
      </div>
    </div>
  );
}
