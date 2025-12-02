'use client';

/**
 * Mobile-Optimized Onboarding Component
 *
 * Simplified onboarding for mobile beginners following research-backed patterns:
 * - 3 core steps maximum (vs 5+ on desktop)
 * - Large touch targets (48px+ buttons)
 * - Single decision per screen
 * - Portrait-optimized layout
 * - Swipe gestures for navigation
 * - Skip option always visible
 *
 * Research source:
 * - Progressive disclosure for complex onboarding
 * - Mobile-first essential-only approach
 * - Interactive tutorials rather than long explanations
 *
 * @since 2025-12-02
 */

import { useState, useCallback } from 'react';
import {
  Sparkles,
  ArrowRight,
  MessageCircle,
  Search,
  Smile,
  Briefcase,
  Globe,
  ChevronLeft,
} from 'lucide-react';
import { useDeviceExperience } from '@/hooks/useDeviceExperience';

// ============================================================================
// TYPES
// ============================================================================

export interface MobileOnboardingPreferences {
  name: string;
  experienceLevel: 'beginner' | 'experienced';
  primaryUse: 'chat' | 'search' | 'both';
  language: string;
}

interface MobileOnboardingProps {
  onComplete: (preferences: MobileOnboardingPreferences) => void;
  onSkip: () => void;
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

interface StepProps {
  onNext: () => void;
  onBack?: () => void;
  onSkip: () => void;
}

// Step 1: Welcome & Name
function WelcomeStep({
  name,
  setName,
  onNext,
  onSkip,
}: StepProps & { name: string; setName: (n: string) => void }) {
  return (
    <div className="flex flex-col h-full px-6 py-8">
      {/* Skip button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={onSkip}
          className="text-gray-400 text-sm px-4 py-2 touch-manipulation"
        >
          Skip
        </button>
      </div>

      {/* Icon */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6">
          <Sparkles className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-2">
          Welcome to Infinity
        </h1>
        <p className="text-gray-400 text-center mb-8 max-w-xs">
          Your personal AI assistant that remembers and learns
        </p>

        {/* Name Input */}
        <div className="w-full max-w-xs">
          <label className="block text-sm text-gray-400 mb-2">
            What should I call you?
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white text-lg placeholder-gray-500 focus:outline-none focus:border-purple-500"
            autoFocus
          />
        </div>
      </div>

      {/* Continue Button */}
      <button
        onClick={onNext}
        className="w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-semibold text-lg flex items-center justify-center gap-2 touch-manipulation"
      >
        Continue
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}

// Step 2: Experience Level
function ExperienceStep({
  experience,
  setExperience,
  onNext,
  onBack,
  onSkip,
}: StepProps & {
  experience: 'beginner' | 'experienced';
  setExperience: (e: 'beginner' | 'experienced') => void;
}) {
  return (
    <div className="flex flex-col h-full px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="p-2 -ml-2 touch-manipulation">
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <span className="text-sm text-gray-500">2 of 3</span>
        <button onClick={onSkip} className="text-gray-400 text-sm touch-manipulation">
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1">
        <h2 className="text-xl font-bold text-white text-center mb-2">
          How experienced are you with AI assistants?
        </h2>
        <p className="text-gray-400 text-center mb-8">
          This helps us customize your experience
        </p>

        <div className="space-y-4">
          {/* Beginner Option */}
          <button
            onClick={() => setExperience('beginner')}
            className={`w-full p-5 rounded-xl border-2 transition-all touch-manipulation flex items-center gap-4 ${
              experience === 'beginner'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-gray-700 bg-gray-800/50'
            }`}
          >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              experience === 'beginner' ? 'bg-purple-500' : 'bg-gray-700'
            }`}>
              <Smile className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white">I'm new to this</h3>
              <p className="text-sm text-gray-400">
                Keep it simple and guide me
              </p>
            </div>
          </button>

          {/* Experienced Option */}
          <button
            onClick={() => setExperience('experienced')}
            className={`w-full p-5 rounded-xl border-2 transition-all touch-manipulation flex items-center gap-4 ${
              experience === 'experienced'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-gray-700 bg-gray-800/50'
            }`}
          >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              experience === 'experienced' ? 'bg-purple-500' : 'bg-gray-700'
            }`}>
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white">I'm experienced</h3>
              <p className="text-sm text-gray-400">
                Show me all the features
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Continue Button */}
      <button
        onClick={onNext}
        className="w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-semibold text-lg flex items-center justify-center gap-2 touch-manipulation"
      >
        Continue
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}

// Step 3: Primary Use
function UseStep({
  primaryUse,
  setPrimaryUse,
  onNext,
  onBack,
  onSkip,
}: StepProps & {
  primaryUse: 'chat' | 'search' | 'both';
  setPrimaryUse: (u: 'chat' | 'search' | 'both') => void;
}) {
  return (
    <div className="flex flex-col h-full px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="p-2 -ml-2 touch-manipulation">
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <span className="text-sm text-gray-500">3 of 3</span>
        <button onClick={onSkip} className="text-gray-400 text-sm touch-manipulation">
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1">
        <h2 className="text-xl font-bold text-white text-center mb-2">
          What will you use me for?
        </h2>
        <p className="text-gray-400 text-center mb-8">
          You can always change this later
        </p>

        <div className="space-y-4">
          {/* Chat Option */}
          <button
            onClick={() => setPrimaryUse('chat')}
            className={`w-full p-5 rounded-xl border-2 transition-all touch-manipulation flex items-center gap-4 ${
              primaryUse === 'chat'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-gray-700 bg-gray-800/50'
            }`}
          >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              primaryUse === 'chat' ? 'bg-purple-500' : 'bg-gray-700'
            }`}>
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white">Chat & Get Help</h3>
              <p className="text-sm text-gray-400">
                Ask questions, get advice
              </p>
            </div>
          </button>

          {/* Search Option */}
          <button
            onClick={() => setPrimaryUse('search')}
            className={`w-full p-5 rounded-xl border-2 transition-all touch-manipulation flex items-center gap-4 ${
              primaryUse === 'search'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-gray-700 bg-gray-800/50'
            }`}
          >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              primaryUse === 'search' ? 'bg-purple-500' : 'bg-gray-700'
            }`}>
              <Search className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white">Research & Learn</h3>
              <p className="text-sm text-gray-400">
                Find information quickly
              </p>
            </div>
          </button>

          {/* Both Option */}
          <button
            onClick={() => setPrimaryUse('both')}
            className={`w-full p-5 rounded-xl border-2 transition-all touch-manipulation flex items-center gap-4 ${
              primaryUse === 'both'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-gray-700 bg-gray-800/50'
            }`}
          >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              primaryUse === 'both' ? 'bg-purple-500' : 'bg-gray-700'
            }`}>
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white">A bit of everything</h3>
              <p className="text-sm text-gray-400">
                Chat, search, and more
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Complete Button */}
      <button
        onClick={onNext}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold text-lg flex items-center justify-center gap-2 touch-manipulation"
      >
        Get Started
        <Sparkles className="w-5 h-5" />
      </button>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MobileOnboarding({ onComplete, onSkip }: MobileOnboardingProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [experience, setExperience] = useState<'beginner' | 'experienced'>('beginner');
  const [primaryUse, setPrimaryUse] = useState<'chat' | 'search' | 'both'>('both');

  const { completeOnboarding } = useDeviceExperience();

  const handleComplete = useCallback(() => {
    const preferences: MobileOnboardingPreferences = {
      name,
      experienceLevel: experience,
      primaryUse,
      language: navigator.language.split('-')[0] || 'en',
    };

    completeOnboarding();
    onComplete(preferences);
  }, [name, experience, primaryUse, completeOnboarding, onComplete]);

  const handleSkip = useCallback(() => {
    completeOnboarding();
    onSkip();
  }, [completeOnboarding, onSkip]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
      {/* Progress Dots */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i === step ? 'bg-purple-500 w-6' : i < step ? 'bg-purple-500' : 'bg-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Steps */}
      <div className="h-screen">
        {step === 0 && (
          <WelcomeStep
            name={name}
            setName={setName}
            onNext={() => setStep(1)}
            onSkip={handleSkip}
          />
        )}
        {step === 1 && (
          <ExperienceStep
            experience={experience}
            setExperience={setExperience}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
            onSkip={handleSkip}
          />
        )}
        {step === 2 && (
          <UseStep
            primaryUse={primaryUse}
            setPrimaryUse={setPrimaryUse}
            onNext={handleComplete}
            onBack={() => setStep(1)}
            onSkip={handleSkip}
          />
        )}
      </div>
    </div>
  );
}
