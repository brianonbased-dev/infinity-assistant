'use client';

/**
 * Assistant Onboarding Component
 *
 * Companion-focused onboarding for Infinity Assistant users.
 * Collects preferences for a personalized AI companion experience.
 *
 * This onboarding focuses on:
 * - User's name and how they'd like to be addressed
 * - Communication preferences (casual, formal, playful)
 * - Topics of interest (not just tech)
 * - Voice/personality preferences
 * - Optional family mode setup
 *
 * For developer-focused onboarding (search/assist/build), see BuilderOnboarding.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  X,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  Heart,
  Smile,
  Briefcase,
  MessageCircle,
  Music,
  BookOpen,
  Palette,
  Gamepad2,
  Globe,
  Users,
  Baby,
  Shield,
  Sun,
  Moon,
  Coffee,
} from 'lucide-react';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
}

// Assistant mode - companion vs professional
export type AssistantMode = 'companion' | 'professional';

// Communication adaptation style
export type CommunicationAdaptation = 'match' | 'balanced' | 'counterbalance';

// Preferences collected during onboarding
export interface CompanionPreferences {
  mode: AssistantMode; // Companion or Professional
  name: string; // User's name
  nickname?: string; // How the assistant should address them
  personality: 'friendly' | 'professional' | 'playful' | 'supportive' | 'wise';
  communicationStyle: 'casual' | 'balanced' | 'formal';
  // How the assistant adapts to user's communication
  communicationAdaptation: CommunicationAdaptation;
  interests: string[];
  customInterests: string[];
  responseLength: 'brief' | 'balanced' | 'detailed';
  // Family mode (companion only)
  familyMode: boolean;
  familyMembers: string[];
  childSafetyLevel: 'open' | 'family' | 'strict';
  // Preferences
  preferredLanguage: 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' | 'ar';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'auto';
}

interface AssistantOnboardingProps {
  userId: string;
  onComplete: (preferences: CompanionPreferences) => void;
  onSkip: () => void;
}

export function AssistantOnboarding({ userId, onComplete, onSkip }: AssistantOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [customInterestInput, setCustomInterestInput] = useState('');

  // Preferences state
  const [preferences, setPreferences] = useState<CompanionPreferences>({
    mode: 'companion', // Default to companion, can switch to professional
    name: '',
    nickname: '',
    personality: 'friendly',
    communicationStyle: 'casual',
    communicationAdaptation: 'balanced', // Default to balanced
    interests: [],
    customInterests: [],
    responseLength: 'balanced',
    familyMode: false,
    familyMembers: [],
    childSafetyLevel: 'family',
    preferredLanguage: 'en',
    timeOfDay: 'auto',
  });

  // Apply professional defaults when mode changes
  const setMode = (mode: AssistantMode) => {
    if (mode === 'professional') {
      setPreferences(prev => ({
        ...prev,
        mode,
        personality: 'professional',
        communicationStyle: 'formal',
        responseLength: 'balanced',
        familyMode: false,
      }));
    } else {
      setPreferences(prev => ({
        ...prev,
        mode,
        personality: 'friendly',
        communicationStyle: 'casual',
      }));
    }
  };

  // Selection option component
  const SelectionOption = ({
    icon: Icon,
    label,
    description,
    selected,
    onClick,
    color = 'purple'
  }: {
    icon: React.ElementType;
    label: string;
    description?: string;
    selected: boolean;
    onClick: () => void;
    color?: string;
  }) => {
    const colorClasses: Record<string, { border: string; bg: string; icon: string }> = {
      purple: { border: 'border-purple-500', bg: 'bg-purple-500/10', icon: 'text-purple-400' },
      blue: { border: 'border-blue-500', bg: 'bg-blue-500/10', icon: 'text-blue-400' },
      green: { border: 'border-green-500', bg: 'bg-green-500/10', icon: 'text-green-400' },
      orange: { border: 'border-orange-500', bg: 'bg-orange-500/10', icon: 'text-orange-400' },
      cyan: { border: 'border-cyan-500', bg: 'bg-cyan-500/10', icon: 'text-cyan-400' },
      pink: { border: 'border-pink-500', bg: 'bg-pink-500/10', icon: 'text-pink-400' },
    };
    const colors = colorClasses[color] || colorClasses.purple;

    return (
      <button
        type="button"
        onClick={onClick}
        className={`p-4 rounded-lg border-2 transition-all text-left w-full ${
          selected
            ? `${colors.border} ${colors.bg}`
            : 'border-gray-700 bg-gray-800 hover:border-gray-600'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-6 h-6 ${selected ? colors.icon : 'text-gray-400'}`} />
          <div>
            <div className={`font-medium ${selected ? 'text-white' : 'text-gray-300'}`}>{label}</div>
            {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
          </div>
          {selected && <Check className={`w-5 h-5 ml-auto ${colors.icon}`} />}
        </div>
      </button>
    );
  };

  // Multi-select option component
  const MultiSelectOption = ({
    label,
    emoji,
    selected,
    onClick,
  }: {
    label: string;
    emoji?: string;
    selected: boolean;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full border transition-all text-sm flex items-center gap-2 ${
        selected
          ? 'border-purple-500 bg-purple-500/20 text-purple-300'
          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
      }`}
    >
      {emoji && <span>{emoji}</span>}
      {label}
      {selected && <Check className="w-3 h-3" />}
    </button>
  );

  const toggleInterest = (interest: string) => {
    setPreferences(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const addCustomInterest = () => {
    const trimmed = customInterestInput.trim();
    if (trimmed && !preferences.customInterests.includes(trimmed)) {
      setPreferences(prev => ({
        ...prev,
        customInterests: [...prev.customInterests, trimmed]
      }));
      setCustomInterestInput('');
    }
  };

  const steps: WizardStep[] = [
    // Step 1: Choose Mode
    {
      id: 'mode',
      title: 'How would you like me to help?',
      description: 'Choose the experience that fits you best',
      component: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Companion Mode */}
            <button
              type="button"
              onClick={() => setMode('companion')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                preferences.mode === 'companion'
                  ? 'border-pink-500 bg-pink-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  preferences.mode === 'companion' ? 'bg-pink-500/20' : 'bg-gray-700'
                }`}>
                  <Heart className={`w-6 h-6 ${preferences.mode === 'companion' ? 'text-pink-400' : 'text-gray-400'}`} />
                </div>
                <div>
                  <h3 className={`font-semibold ${preferences.mode === 'companion' ? 'text-white' : 'text-gray-300'}`}>
                    Personal Companion
                  </h3>
                  {preferences.mode === 'companion' && <Check className="w-4 h-4 text-pink-400 inline ml-2" />}
                </div>
              </div>
              <p className="text-sm text-gray-400">
                Friendly, conversational AI that learns about you, your interests, and adapts to your family.
              </p>
              <ul className="mt-3 text-xs text-gray-500 space-y-1">
                <li>• Remembers your preferences</li>
                <li>• Family mode with speaker recognition</li>
                <li>• Casual, warm conversations</li>
              </ul>
            </button>

            {/* Professional Mode */}
            <button
              type="button"
              onClick={() => setMode('professional')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                preferences.mode === 'professional'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  preferences.mode === 'professional' ? 'bg-blue-500/20' : 'bg-gray-700'
                }`}>
                  <Briefcase className={`w-6 h-6 ${preferences.mode === 'professional' ? 'text-blue-400' : 'text-gray-400'}`} />
                </div>
                <div>
                  <h3 className={`font-semibold ${preferences.mode === 'professional' ? 'text-white' : 'text-gray-300'}`}>
                    Professional Assistant
                  </h3>
                  {preferences.mode === 'professional' && <Check className="w-4 h-4 text-blue-400 inline ml-2" />}
                </div>
              </div>
              <p className="text-sm text-gray-400">
                Efficient, focused AI that helps you get things done with clear, professional responses.
              </p>
              <ul className="mt-3 text-xs text-gray-500 space-y-1">
                <li>• Direct, concise responses</li>
                <li>• Task and productivity focused</li>
                <li>• Formal, business-appropriate</li>
              </ul>
            </button>
          </div>

          <p className="text-center text-xs text-gray-500 mt-4">
            You can always change this later in settings
          </p>
        </div>
      ),
    },
    // Step 2: Welcome & Name
    {
      id: 'welcome',
      title: preferences.mode === 'professional' ? 'Welcome to Infinity' : 'Nice to meet you!',
      description: preferences.mode === 'professional' ? "Let's get you set up" : "Tell me a bit about yourself",
      component: (
        <div className="space-y-6 text-center">
          <div className="flex justify-center mb-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
              preferences.mode === 'professional'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 animate-pulse'
            }`}>
              {preferences.mode === 'professional'
                ? <Briefcase className="w-10 h-10 text-white" />
                : <Sparkles className="w-10 h-10 text-white" />
              }
            </div>
          </div>
          <h2 className={`text-3xl font-bold bg-clip-text text-transparent ${
            preferences.mode === 'professional'
              ? 'bg-gradient-to-r from-blue-400 to-cyan-400'
              : 'bg-gradient-to-r from-purple-400 to-pink-400'
          }`}>
            {preferences.mode === 'professional' ? 'Infinity Assistant' : "Hi there! I'm Infinity"}
          </h2>
          <p className="text-gray-300 max-w-md mx-auto">
            {preferences.mode === 'professional'
              ? "I'm here to help you work smarter and get things done efficiently."
              : "I'm your personal AI companion. I'm here to help, chat, and make your day a little easier."
            }
          </p>

          {/* Name input */}
          <div className="max-w-sm mx-auto mt-8">
            <label className="block text-left text-sm text-gray-400 mb-2">
              {preferences.mode === 'professional' ? 'Your name' : "What's your name?"}
            </label>
            <Input
              type="text"
              value={preferences.name}
              onChange={(e) => setPreferences(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Your name"
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 text-center text-lg"
              autoFocus
            />
          </div>

          {preferences.name && preferences.mode === 'companion' && (
            <div className="max-w-sm mx-auto mt-4">
              <label className="block text-left text-sm text-gray-400 mb-2">
                What should I call you? (optional)
              </label>
              <Input
                type="text"
                value={preferences.nickname || ''}
                onChange={(e) => setPreferences(prev => ({ ...prev, nickname: e.target.value }))}
                placeholder={preferences.name || 'A nickname'}
                className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 text-center"
              />
            </div>
          )}
        </div>
      ),
    },
    // Step 2: Personality
    {
      id: 'personality',
      title: 'How should I be?',
      description: 'Choose a personality that feels right',
      component: (
        <div className="space-y-3">
          <SelectionOption
            icon={Smile}
            label="Friendly & Warm"
            description="Approachable, conversational, like chatting with a good friend"
            selected={preferences.personality === 'friendly'}
            onClick={() => setPreferences(prev => ({ ...prev, personality: 'friendly' }))}
            color="pink"
          />
          <SelectionOption
            icon={Heart}
            label="Supportive & Caring"
            description="Encouraging, patient, always here to help"
            selected={preferences.personality === 'supportive'}
            onClick={() => setPreferences(prev => ({ ...prev, personality: 'supportive' }))}
            color="purple"
          />
          <SelectionOption
            icon={Sparkles}
            label="Playful & Fun"
            description="Lighthearted, creative, brings a smile"
            selected={preferences.personality === 'playful'}
            onClick={() => setPreferences(prev => ({ ...prev, personality: 'playful' }))}
            color="orange"
          />
          <SelectionOption
            icon={BookOpen}
            label="Wise & Thoughtful"
            description="Insightful, reflective, offers perspective"
            selected={preferences.personality === 'wise'}
            onClick={() => setPreferences(prev => ({ ...prev, personality: 'wise' }))}
            color="cyan"
          />
          <SelectionOption
            icon={Briefcase}
            label="Professional"
            description="Clear, efficient, gets things done"
            selected={preferences.personality === 'professional'}
            onClick={() => setPreferences(prev => ({ ...prev, personality: 'professional' }))}
            color="blue"
          />
        </div>
      ),
    },
    // Step 3: Communication Style
    {
      id: 'communication',
      title: 'How should I talk?',
      description: 'Pick a communication style',
      component: (
        <div className="space-y-4">
          <div className="space-y-3">
            <SelectionOption
              icon={Coffee}
              label="Casual & Relaxed"
              description="Informal, friendly, like texting a friend"
              selected={preferences.communicationStyle === 'casual'}
              onClick={() => setPreferences(prev => ({ ...prev, communicationStyle: 'casual' }))}
              color="green"
            />
            <SelectionOption
              icon={MessageCircle}
              label="Balanced"
              description="Natural mix of casual and clear"
              selected={preferences.communicationStyle === 'balanced'}
              onClick={() => setPreferences(prev => ({ ...prev, communicationStyle: 'balanced' }))}
              color="blue"
            />
            <SelectionOption
              icon={Briefcase}
              label="Formal"
              description="Professional, polished, precise"
              selected={preferences.communicationStyle === 'formal'}
              onClick={() => setPreferences(prev => ({ ...prev, communicationStyle: 'formal' }))}
              color="purple"
            />
          </div>

          <div className="pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400 mb-3">How detailed should my responses be?</p>
            <div className="flex gap-2">
              {(['brief', 'balanced', 'detailed'] as const).map((length) => (
                <button
                  key={length}
                  onClick={() => setPreferences(prev => ({ ...prev, responseLength: length }))}
                  className={`flex-1 px-4 py-3 rounded-lg capitalize transition-all ${
                    preferences.responseLength === length
                      ? 'bg-purple-600/30 text-purple-400 border border-purple-500'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent'
                  }`}
                >
                  {length}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    // Step 4: Interests
    {
      id: 'interests',
      title: 'What do you enjoy?',
      description: 'Help me understand what matters to you',
      component: (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <MultiSelectOption label="Music" emoji="🎵" selected={preferences.interests.includes('music')} onClick={() => toggleInterest('music')} />
            <MultiSelectOption label="Movies & TV" emoji="🎬" selected={preferences.interests.includes('movies')} onClick={() => toggleInterest('movies')} />
            <MultiSelectOption label="Books" emoji="📚" selected={preferences.interests.includes('books')} onClick={() => toggleInterest('books')} />
            <MultiSelectOption label="Gaming" emoji="🎮" selected={preferences.interests.includes('gaming')} onClick={() => toggleInterest('gaming')} />
            <MultiSelectOption label="Sports" emoji="⚽" selected={preferences.interests.includes('sports')} onClick={() => toggleInterest('sports')} />
            <MultiSelectOption label="Cooking" emoji="🍳" selected={preferences.interests.includes('cooking')} onClick={() => toggleInterest('cooking')} />
            <MultiSelectOption label="Travel" emoji="✈️" selected={preferences.interests.includes('travel')} onClick={() => toggleInterest('travel')} />
            <MultiSelectOption label="Art & Design" emoji="🎨" selected={preferences.interests.includes('art')} onClick={() => toggleInterest('art')} />
            <MultiSelectOption label="Technology" emoji="💻" selected={preferences.interests.includes('technology')} onClick={() => toggleInterest('technology')} />
            <MultiSelectOption label="Science" emoji="🔬" selected={preferences.interests.includes('science')} onClick={() => toggleInterest('science')} />
            <MultiSelectOption label="Nature" emoji="🌿" selected={preferences.interests.includes('nature')} onClick={() => toggleInterest('nature')} />
            <MultiSelectOption label="Fitness" emoji="💪" selected={preferences.interests.includes('fitness')} onClick={() => toggleInterest('fitness')} />
            <MultiSelectOption label="Pets" emoji="🐾" selected={preferences.interests.includes('pets')} onClick={() => toggleInterest('pets')} />
            <MultiSelectOption label="Photography" emoji="📷" selected={preferences.interests.includes('photography')} onClick={() => toggleInterest('photography')} />
            <MultiSelectOption label="Finance" emoji="💰" selected={preferences.interests.includes('finance')} onClick={() => toggleInterest('finance')} />
            <MultiSelectOption label="Mindfulness" emoji="🧘" selected={preferences.interests.includes('mindfulness')} onClick={() => toggleInterest('mindfulness')} />
          </div>

          {/* Custom interests */}
          <div className="pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-2">Add your own:</p>
            <div className="flex gap-2">
              <Input
                value={customInterestInput}
                onChange={(e) => setCustomInterestInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomInterest())}
                placeholder="Something else you love..."
                className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              />
              <Button onClick={addCustomInterest} disabled={!customInterestInput.trim()} className="bg-purple-600 hover:bg-purple-500">
                Add
              </Button>
            </div>
            {preferences.customInterests.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {preferences.customInterests.map(interest => (
                  <span key={interest} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center gap-1">
                    {interest}
                    <X className="w-3 h-3 cursor-pointer hover:text-red-400" onClick={() => setPreferences(prev => ({ ...prev, customInterests: prev.customInterests.filter(i => i !== interest) }))} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ),
    },
    // Step 5: Communication Adaptation (companion mode only)
    ...(preferences.mode === 'companion' ? [{
      id: 'adaptation',
      title: 'How should I adapt to you?',
      description: 'Choose how I communicate with you',
      component: (
        <div className="space-y-4">
          <p className="text-center text-gray-400 text-sm mb-6">
            Everyone communicates differently. How would you like me to respond?
          </p>

          <div className="space-y-3">
            {/* Match Mode */}
            <button
              type="button"
              onClick={() => setPreferences(prev => ({ ...prev, communicationAdaptation: 'match' }))}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                preferences.communicationAdaptation === 'match'
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  preferences.communicationAdaptation === 'match' ? 'bg-green-500/20' : 'bg-gray-700'
                }`}>
                  <Smile className={`w-5 h-5 ${preferences.communicationAdaptation === 'match' ? 'text-green-400' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${preferences.communicationAdaptation === 'match' ? 'text-white' : 'text-gray-300'}`}>
                      Match my energy
                    </span>
                    {preferences.communicationAdaptation === 'match' && <Check className="w-4 h-4 text-green-400" />}
                  </div>
                  <p className="text-xs text-gray-500">Mirror how I communicate - casual when I'm casual, excited when I'm excited</p>
                </div>
              </div>
            </button>

            {/* Balanced Mode */}
            <button
              type="button"
              onClick={() => setPreferences(prev => ({ ...prev, communicationAdaptation: 'balanced' }))}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                preferences.communicationAdaptation === 'balanced'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  preferences.communicationAdaptation === 'balanced' ? 'bg-blue-500/20' : 'bg-gray-700'
                }`}>
                  <MessageCircle className={`w-5 h-5 ${preferences.communicationAdaptation === 'balanced' ? 'text-blue-400' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${preferences.communicationAdaptation === 'balanced' ? 'text-white' : 'text-gray-300'}`}>
                      Keep it balanced
                    </span>
                    {preferences.communicationAdaptation === 'balanced' && <Check className="w-4 h-4 text-blue-400" />}
                  </div>
                  <p className="text-xs text-gray-500">Friendly and neutral - adapt to the situation naturally</p>
                </div>
              </div>
            </button>

            {/* Counterbalance Mode */}
            <button
              type="button"
              onClick={() => setPreferences(prev => ({ ...prev, communicationAdaptation: 'counterbalance' }))}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                preferences.communicationAdaptation === 'counterbalance'
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  preferences.communicationAdaptation === 'counterbalance' ? 'bg-purple-500/20' : 'bg-gray-700'
                }`}>
                  <Sun className={`w-5 h-5 ${preferences.communicationAdaptation === 'counterbalance' ? 'text-purple-400' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${preferences.communicationAdaptation === 'counterbalance' ? 'text-white' : 'text-gray-300'}`}>
                      Be my counterbalance
                    </span>
                    {preferences.communicationAdaptation === 'counterbalance' && <Check className="w-4 h-4 text-purple-400" />}
                  </div>
                  <p className="text-xs text-gray-500">If I'm stressed, be calm. If I'm scattered, be focused. Help balance me out.</p>
                </div>
              </div>
            </button>
          </div>

          <p className="text-center text-xs text-gray-600 mt-4">
            You can change this anytime in settings
          </p>
        </div>
      ),
    }] : []),
    // Step 6: Family Mode (companion mode only)
    ...(preferences.mode === 'companion' ? [{
      id: 'family',
      title: 'Family Mode',
      description: 'Will others use this assistant?',
      component: (
        <div className="space-y-6">
          <div className="text-center mb-4">
            <Users className="w-12 h-12 text-blue-400 mx-auto mb-3" />
            <p className="text-gray-300">
              Family mode helps me recognize and adapt to different family members
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
            <div>
              <div className="font-medium text-white">Enable Family Mode</div>
              <div className="text-xs text-gray-400">Adapt responses for the whole family</div>
            </div>
            <button
              type="button"
              title={preferences.familyMode ? 'Disable family mode' : 'Enable family mode'}
              onClick={() => setPreferences(prev => ({ ...prev, familyMode: !prev.familyMode }))}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                preferences.familyMode ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                preferences.familyMode ? 'translate-x-8' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {preferences.familyMode && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              {/* Child Safety Level */}
              <div className="p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="font-medium text-white">Safety Level</span>
                </div>
                <div className="flex gap-2">
                  {(['open', 'family', 'strict'] as const).map((level) => (
                    <button
                      type="button"
                      key={level}
                      onClick={() => setPreferences(prev => ({ ...prev, childSafetyLevel: level }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm capitalize transition-all ${
                        preferences.childSafetyLevel === level
                          ? level === 'strict' ? 'bg-red-600/30 text-red-400 border border-red-500'
                          : level === 'family' ? 'bg-blue-600/30 text-blue-400 border border-blue-500'
                          : 'bg-green-600/30 text-green-400 border border-green-500'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border border-transparent'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {preferences.childSafetyLevel === 'strict' && 'Most protective - suitable for young children'}
                  {preferences.childSafetyLevel === 'family' && 'Family-friendly content for all ages'}
                  {preferences.childSafetyLevel === 'open' && 'General content with standard guidelines'}
                </p>
              </div>

              {/* Family members hint */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Baby className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-300">Family Members</span>
                </div>
                <p className="text-xs text-gray-400">
                  I'll learn to recognize different speakers over time. You can also add family members in Settings later.
                </p>
              </div>
            </div>
          )}
        </div>
      ),
    }] : []),
    // Step 6: All Set
    {
      id: 'complete',
      title: "You're All Set!",
      description: "Let's start chatting",
      component: (
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
              <Check className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white">
            Nice to meet you{preferences.nickname || preferences.name ? `, ${preferences.nickname || preferences.name}` : ''}!
          </h2>

          {/* Summary */}
          <div className="text-left max-w-md mx-auto bg-gray-800 rounded-lg p-4 space-y-2">
            <p className="text-sm text-gray-300">
              <span className="text-purple-400">Here's how I'll be:</span>
            </p>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• {preferences.personality.charAt(0).toUpperCase() + preferences.personality.slice(1)} personality</li>
              <li>• {preferences.communicationStyle.charAt(0).toUpperCase() + preferences.communicationStyle.slice(1)} communication</li>
              <li>• {preferences.responseLength.charAt(0).toUpperCase() + preferences.responseLength.slice(1)} responses</li>
              {preferences.familyMode && <li>• Family mode enabled ({preferences.childSafetyLevel} safety)</li>}
              {preferences.interests.length > 0 && (
                <li>• Interested in: {preferences.interests.slice(0, 3).join(', ')}{preferences.interests.length > 3 ? '...' : ''}</li>
              )}
            </ul>
          </div>

          <p className="text-xs text-gray-500">
            You can change these anytime in settings.
          </p>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    try {
      await fetch('/api/onboarding/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type: 'companion' }),
      });
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    }
    onSkip();
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          type: 'companion',
          stepsCompleted: steps.map(s => s.id),
          preferences,
        }),
      });
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
    setIsCompleting(false);
    onComplete(preferences);
  };

  const currentStepData = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-800">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">{currentStepData.title}</h1>
              <p className="text-gray-400">{currentStepData.description}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              aria-label="Skip onboarding"
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Step content */}
          <div className="min-h-[400px]">{currentStepData.component}</div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-800">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <ArrowLeft className="mr-2 w-4 h-4" />
              Previous
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-gray-400 hover:text-white"
              >
                Skip
              </Button>
              <Button
                onClick={currentStep === steps.length - 1 ? handleComplete : handleNext}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                disabled={isCompleting || (currentStep === 0 && !preferences.name)}
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    {currentStep === steps.length - 1 ? "Let's Chat!" : 'Next'}
                    {currentStep < steps.length - 1 && <ArrowRight className="ml-2 w-4 h-4" />}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
