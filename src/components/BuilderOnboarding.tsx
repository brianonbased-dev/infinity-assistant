'use client';

/**
 * Builder Onboarding Component
 *
 * Email sign-up onboarding for Builder tier users (search/assist/build modes)
 * Collects preferences for development-focused experience
 *
 * FREE TIER users get:
 * - Search mode only (20 queries/day)
 * - Knowledge base access (W/P/G)
 * - Auto-research for missing topics
 *
 * This onboarding is focused on:
 * - Email collection for account
 * - Developer preferences (role, experience, tech stack)
 * - Build-focused experience
 *
 * PAID users (Builder Pro) get full access to search/assist/build modes.
 * For companion/family assistant, see AssistantOnboarding component.
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
  Search,
  MessageCircle,
  Sparkles,
  Loader2,
  Briefcase,
  GraduationCap,
  Rocket,
  Lightbulb,
  Wrench,
  BookOpen,
  Zap,
  Brain,
  Users,
  Plus,
  Mail,
  Lock,
  Code,
} from 'lucide-react';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
}

// Re-export UserPreferences from hook for type compatibility
export type { UserPreferences } from '@/hooks/useLocalPreferences';
import type { UserPreferences } from '@/hooks/useLocalPreferences';

// Extended preferences with onboarding-specific fields
interface OnboardingState extends Omit<UserPreferences, 'preferredLanguage'> {
  email?: string; // Email for account (free tier sign-up)
  tier?: 'free' | 'assistant_pro' | 'builder_pro'; // User tier
  preferredLanguage: UserPreferences['preferredLanguage'];
}

interface BuilderOnboardingProps {
  userId: string;
  onComplete: (preferences: UserPreferences) => void;
  onSkip: () => void;
}

export function BuilderOnboarding({ userId, onComplete, onSkip }: BuilderOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [customInterestInput, setCustomInterestInput] = useState('');
  const [emailError, setEmailError] = useState('');

  // User preferences state - FREE tier defaults to search mode
  const [preferences, setPreferences] = useState<OnboardingState>({
    email: '',
    role: '',
    experienceLevel: '',
    primaryGoals: [],
    preferredMode: 'search', // FREE tier = search mode only
    interests: [],
    customInterests: [],
    communicationStyle: 'conversational',
    workflowPhases: ['research'], // FREE tier focuses on research
    preferredLanguage: 'en', // Default to English
    tier: 'free',
  });

  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
    };
    const colors = colorClasses[color] || colorClasses.purple;

    return (
      <button
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
    selected,
    onClick,
    removable = false,
    onRemove
  }: {
    label: string;
    selected: boolean;
    onClick: () => void;
    removable?: boolean;
    onRemove?: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full border transition-all text-sm flex items-center gap-1 ${
        selected
          ? 'border-purple-500 bg-purple-500/20 text-purple-300'
          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
      }`}
    >
      {label}
      {selected && <Check className="w-3 h-3 inline ml-1" />}
      {removable && selected && (
        <X
          className="w-3 h-3 ml-1 hover:text-red-400"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
        />
      )}
    </button>
  );

  const toggleGoal = (goal: string) => {
    setPreferences(prev => ({
      ...prev,
      primaryGoals: prev.primaryGoals.includes(goal)
        ? prev.primaryGoals.filter(g => g !== goal)
        : [...prev.primaryGoals, goal]
    }));
  };

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
    if (trimmed && !preferences.customInterests.includes(trimmed) && !preferences.interests.includes(trimmed.toLowerCase())) {
      setPreferences(prev => ({
        ...prev,
        customInterests: [...prev.customInterests, trimmed]
      }));
      setCustomInterestInput('');
    }
  };

  const removeCustomInterest = (interest: string) => {
    setPreferences(prev => ({
      ...prev,
      customInterests: prev.customInterests.filter(i => i !== interest)
    }));
  };

  const steps: WizardStep[] = [
    // Step 1: Welcome + Email
    {
      id: 'welcome',
      title: 'Welcome to Infinity Search',
      description: 'Get started with free knowledge search',
      component: (
        <div className="space-y-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
              <Search className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Infinity Search
          </h2>
          <p className="text-gray-300 max-w-md mx-auto">
            Search our growing knowledge base of patterns, wisdom, and gotchas. Your searches help us build better knowledge for everyone.
          </p>

          {/* Email signup */}
          <div className="max-w-sm mx-auto mt-8">
            <label className="block text-left text-sm text-gray-400 mb-2">
              Enter your email to get started (optional)
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Input
                type="email"
                value={preferences.email || ''}
                onChange={(e) => {
                  setPreferences(prev => ({ ...prev, email: e.target.value }));
                  setEmailError('');
                }}
                placeholder="your@email.com"
                className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              />
            </div>
            {emailError && (
              <p className="text-red-400 text-xs mt-1 text-left">{emailError}</p>
            )}
            <p className="text-xs text-gray-500 mt-2 text-left">
              We&apos;ll save your preferences and notify you of new features.
            </p>
          </div>

          {/* Free tier info */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg max-w-sm mx-auto">
            <div className="flex items-center gap-2 justify-center mb-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">Free Tier Includes</span>
            </div>
            <ul className="text-xs text-gray-400 space-y-1 text-left">
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3 text-green-400" />
                <span>20 searches per day</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3 text-green-400" />
                <span>Knowledge base access (W/P/G)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3 text-green-400" />
                <span>Auto-research for new topics</span>
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    // Step 2: Role selection
    {
      id: 'role',
      title: 'What describes you best?',
      description: 'This helps us tailor responses to your context',
      component: (
        <div className="space-y-3">
          <SelectionOption
            icon={Code}
            label="Software Developer"
            description="Building applications, writing code, debugging"
            selected={preferences.role === 'developer'}
            onClick={() => setPreferences(prev => ({ ...prev, role: 'developer' }))}
            color="blue"
          />
          <SelectionOption
            icon={Briefcase}
            label="Product Manager / Business"
            description="Planning features, strategy, requirements"
            selected={preferences.role === 'product'}
            onClick={() => setPreferences(prev => ({ ...prev, role: 'product' }))}
            color="purple"
          />
          <SelectionOption
            icon={GraduationCap}
            label="Student / Learner"
            description="Learning to code, studying concepts"
            selected={preferences.role === 'student'}
            onClick={() => setPreferences(prev => ({ ...prev, role: 'student' }))}
            color="green"
          />
          <SelectionOption
            icon={Rocket}
            label="Entrepreneur / Founder"
            description="Building a startup, wearing many hats"
            selected={preferences.role === 'entrepreneur'}
            onClick={() => setPreferences(prev => ({ ...prev, role: 'entrepreneur' }))}
            color="orange"
          />
          <SelectionOption
            icon={Users}
            label="Other / Just Exploring"
            description="Curious about what Infinity Assistant can do"
            selected={preferences.role === 'other'}
            onClick={() => setPreferences(prev => ({ ...prev, role: 'other' }))}
          />
        </div>
      ),
    },
    // Step 3: Experience level
    {
      id: 'experience',
      title: 'What\'s your experience level?',
      description: 'We\'ll adjust explanations accordingly',
      component: (
        <div className="space-y-3">
          <SelectionOption
            icon={Lightbulb}
            label="Beginner"
            description="New to development, learning the basics"
            selected={preferences.experienceLevel === 'beginner'}
            onClick={() => setPreferences(prev => ({ ...prev, experienceLevel: 'beginner' }))}
            color="green"
          />
          <SelectionOption
            icon={Wrench}
            label="Intermediate"
            description="Comfortable with fundamentals, building projects"
            selected={preferences.experienceLevel === 'intermediate'}
            onClick={() => setPreferences(prev => ({ ...prev, experienceLevel: 'intermediate' }))}
            color="blue"
          />
          <SelectionOption
            icon={Rocket}
            label="Advanced"
            description="Deep expertise, architecting complex systems"
            selected={preferences.experienceLevel === 'advanced'}
            onClick={() => setPreferences(prev => ({ ...prev, experienceLevel: 'advanced' }))}
            color="purple"
          />

          {/* Developer Portal Bypass for Advanced Users */}
          {preferences.experienceLevel === 'advanced' && (
            <div className="mt-4 pt-4 border-t border-gray-700 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="bg-black/40 border border-green-500/30 rounded-lg p-4 relative overflow-hidden group">
                {/* Matrix rain effect hint */}
                <div className="absolute inset-0 bg-[url('https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif')] opacity-5 pointer-events-none mix-blend-screen"></div>
                
                <div className="relative z-10">
                  <h4 className="text-green-400 font-mono text-sm mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    CONTEXT PROTOCOL DETECTED
                  </h4>
                  <p className="text-xs text-green-300/80 mb-3 font-mono">
                    Advanced users may bypass standard orchestration and access the Context Management layer directly.
                  </p>
                  <a 
                    href="/developers" 
                    className="flex items-center justify-center gap-2 w-full py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/50 rounded text-green-400 font-mono text-xs transition-all hover:shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                  >
                    <Code className="w-3 h-3" />
                    INITIALIZE_DEV_CONSOLE()
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      ),
    },
    // Step 4: Primary goals
    {
      id: 'goals',
      title: 'What do you want to accomplish?',
      description: 'Select all that apply',
      component: (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <MultiSelectOption
              label="Learn new skills"
              selected={preferences.primaryGoals.includes('learn')}
              onClick={() => toggleGoal('learn')}
            />
            <MultiSelectOption
              label="Build projects"
              selected={preferences.primaryGoals.includes('build')}
              onClick={() => toggleGoal('build')}
            />
            <MultiSelectOption
              label="Debug issues"
              selected={preferences.primaryGoals.includes('debug')}
              onClick={() => toggleGoal('debug')}
            />
            <MultiSelectOption
              label="Find best practices"
              selected={preferences.primaryGoals.includes('best-practices')}
              onClick={() => toggleGoal('best-practices')}
            />
            <MultiSelectOption
              label="Code reviews"
              selected={preferences.primaryGoals.includes('code-review')}
              onClick={() => toggleGoal('code-review')}
            />
            <MultiSelectOption
              label="Research topics"
              selected={preferences.primaryGoals.includes('research')}
              onClick={() => toggleGoal('research')}
            />
            <MultiSelectOption
              label="Write documentation"
              selected={preferences.primaryGoals.includes('documentation')}
              onClick={() => toggleGoal('documentation')}
            />
            <MultiSelectOption
              label="Plan architecture"
              selected={preferences.primaryGoals.includes('architecture')}
              onClick={() => toggleGoal('architecture')}
            />
          </div>
          {preferences.primaryGoals.length > 0 && (
            <p className="text-sm text-gray-400">
              Selected: {preferences.primaryGoals.length} goal{preferences.primaryGoals.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      ),
    },
    // Step 6: Interests/Tech stack (ENHANCED with custom input)
    {
      id: 'interests',
      title: 'What technologies interest you?',
      description: 'Select or add your own technologies',
      component: (
        <div className="space-y-4">
          {/* Preset Technologies */}
          <div className="flex flex-wrap gap-2">
            <MultiSelectOption
              label="React / Next.js"
              selected={preferences.interests.includes('react')}
              onClick={() => toggleInterest('react')}
            />
            <MultiSelectOption
              label="TypeScript"
              selected={preferences.interests.includes('typescript')}
              onClick={() => toggleInterest('typescript')}
            />
            <MultiSelectOption
              label="Node.js"
              selected={preferences.interests.includes('nodejs')}
              onClick={() => toggleInterest('nodejs')}
            />
            <MultiSelectOption
              label="Python"
              selected={preferences.interests.includes('python')}
              onClick={() => toggleInterest('python')}
            />
            <MultiSelectOption
              label="AI / Machine Learning"
              selected={preferences.interests.includes('ai-ml')}
              onClick={() => toggleInterest('ai-ml')}
            />
            <MultiSelectOption
              label="Databases / SQL"
              selected={preferences.interests.includes('databases')}
              onClick={() => toggleInterest('databases')}
            />
            <MultiSelectOption
              label="Cloud / DevOps"
              selected={preferences.interests.includes('cloud')}
              onClick={() => toggleInterest('cloud')}
            />
            <MultiSelectOption
              label="Mobile Development"
              selected={preferences.interests.includes('mobile')}
              onClick={() => toggleInterest('mobile')}
            />
            <MultiSelectOption
              label="Web3 / Blockchain"
              selected={preferences.interests.includes('web3')}
              onClick={() => toggleInterest('web3')}
            />
            <MultiSelectOption
              label="System Design"
              selected={preferences.interests.includes('system-design')}
              onClick={() => toggleInterest('system-design')}
            />
            <MultiSelectOption
              label="Rust"
              selected={preferences.interests.includes('rust')}
              onClick={() => toggleInterest('rust')}
            />
            <MultiSelectOption
              label="Go"
              selected={preferences.interests.includes('go')}
              onClick={() => toggleInterest('go')}
            />
            <MultiSelectOption
              label="Java / Spring"
              selected={preferences.interests.includes('java')}
              onClick={() => toggleInterest('java')}
            />
            <MultiSelectOption
              label="C# / .NET"
              selected={preferences.interests.includes('dotnet')}
              onClick={() => toggleInterest('dotnet')}
            />
            <MultiSelectOption
              label="GraphQL"
              selected={preferences.interests.includes('graphql')}
              onClick={() => toggleInterest('graphql')}
            />
            <MultiSelectOption
              label="Kubernetes"
              selected={preferences.interests.includes('kubernetes')}
              onClick={() => toggleInterest('kubernetes')}
            />
          </div>

          {/* Custom Technologies */}
          {preferences.customInterests.length > 0 && (
            <div className="pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-500 mb-2">Your custom technologies:</p>
              <div className="flex flex-wrap gap-2">
                {preferences.customInterests.map(interest => (
                  <MultiSelectOption
                    key={interest}
                    label={interest}
                    selected={true}
                    onClick={() => {}}
                    removable={true}
                    onRemove={() => removeCustomInterest(interest)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Add Custom Technology */}
          <div className="pt-2 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-2">Add your own technology:</p>
            <div className="flex gap-2">
              <Input
                value={customInterestInput}
                onChange={(e) => setCustomInterestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomInterest();
                  }
                }}
                placeholder="e.g., Flutter, Svelte, Elixir..."
                className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              />
              <Button
                onClick={addCustomInterest}
                disabled={!customInterestInput.trim()}
                className="bg-purple-600 hover:bg-purple-500"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Selection count */}
          {(preferences.interests.length + preferences.customInterests.length) > 0 && (
            <p className="text-sm text-gray-400">
              Selected: {preferences.interests.length + preferences.customInterests.length} technolog{(preferences.interests.length + preferences.customInterests.length) !== 1 ? 'ies' : 'y'}
            </p>
          )}
        </div>
      ),
    },
    // Step 7: Communication style
    {
      id: 'style',
      title: 'How should I communicate?',
      description: 'Choose your preferred response style',
      component: (
        <div className="space-y-3">
          <SelectionOption
            icon={Zap}
            label="Concise"
            description="Short, direct answers. Get to the point quickly."
            selected={preferences.communicationStyle === 'concise'}
            onClick={() => setPreferences(prev => ({ ...prev, communicationStyle: 'concise' }))}
            color="blue"
          />
          <SelectionOption
            icon={BookOpen}
            label="Detailed"
            description="Thorough explanations with examples and context."
            selected={preferences.communicationStyle === 'detailed'}
            onClick={() => setPreferences(prev => ({ ...prev, communicationStyle: 'detailed' }))}
            color="purple"
          />
          <SelectionOption
            icon={MessageCircle}
            label="Conversational"
            description="Friendly, natural dialogue. Like chatting with a colleague."
            selected={preferences.communicationStyle === 'conversational'}
            onClick={() => setPreferences(prev => ({ ...prev, communicationStyle: 'conversational' }))}
            color="green"
          />
        </div>
      ),
    },
    // Step 6: Free Tier Features
    {
      id: 'features',
      title: 'Your Free Search Experience',
      description: 'Here\'s what you can do with Infinity Search',
      component: (
        <div className="space-y-4">
          {/* Search - Available */}
          <div className="p-4 rounded-lg border-2 border-blue-500 bg-blue-500/10">
            <div className="flex items-center gap-3">
              <Search className="w-6 h-6 text-blue-400" />
              <div className="flex-1">
                <div className="font-medium text-white flex items-center gap-2">
                  Search
                  <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Free</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Search our knowledge base of patterns, wisdom, and gotchas
                </div>
              </div>
              <Check className="w-5 h-5 text-blue-400" />
            </div>
          </div>

          {/* Assist - Locked */}
          <div className="p-4 rounded-lg border-2 border-gray-700 bg-gray-800 opacity-75">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-6 h-6 text-gray-500" />
              <div className="flex-1">
                <div className="font-medium text-gray-400 flex items-center gap-2">
                  Assist
                  <Lock className="w-3 h-3" />
                  <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">Pro $29/mo</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  AI conversations, deep research, memory & context
                </div>
              </div>
            </div>
          </div>

          {/* Build - Locked */}
          <div className="p-4 rounded-lg border-2 border-gray-700 bg-gray-800 opacity-75">
            <div className="flex items-center gap-3">
              <Brain className="w-6 h-6 text-gray-500" />
              <div className="flex-1">
                <div className="font-medium text-gray-400 flex items-center gap-2">
                  Build
                  <Lock className="w-3 h-3" />
                  <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Builder $49/mo</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Code generation, architecture guidance, full-stack development
                </div>
              </div>
            </div>
          </div>

          {/* Upgrade CTA */}
          <div className="mt-4 p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg">
            <p className="text-sm text-gray-300 text-center">
              <Sparkles className="w-4 h-4 inline mr-1 text-purple-400" />
              Unlock more with <a href="#pricing" className="text-purple-400 hover:text-purple-300 font-medium">Assistant Pro</a>
            </p>
          </div>
        </div>
      ),
    },
    // Step 7: Complete
    {
      id: 'complete',
      title: "You're All Set!",
      description: 'Start searching our knowledge base',
      component: (
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
              <Check className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome to Infinity Search!</h2>

          {/* What we learned */}
          <div className="text-left max-w-md mx-auto bg-gray-800 rounded-lg p-4 space-y-2">
            <p className="text-sm text-gray-300">
              <span className="text-blue-400">Your search experience is personalized:</span>
            </p>
            <ul className="text-sm text-gray-400 space-y-1">
              {preferences.email && (
                <li>• Signed up as <span className="text-white">{preferences.email}</span></li>
              )}
              {preferences.role && (
                <li>• Tailored for <span className="text-white">{preferences.role}</span></li>
              )}
              {preferences.experienceLevel && (
                <li>• <span className="text-white">{preferences.experienceLevel}</span> level results</li>
              )}
              {(preferences.interests.length + preferences.customInterests.length) > 0 && (
                <li>• Focusing on: <span className="text-white">
                  {[...preferences.interests, ...preferences.customInterests].slice(0, 3).join(', ')}
                  {(preferences.interests.length + preferences.customInterests.length) > 3 ? '...' : ''}
                </span></li>
              )}
            </ul>
          </div>

          {/* Free tier reminder */}
          <div className="max-w-md mx-auto bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 justify-center mb-2">
              <Search className="w-5 h-5 text-blue-400" />
              <span className="font-medium text-blue-300">Free Search</span>
            </div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• 20 searches per day</li>
              <li>• Knowledge base access (Wisdom, Patterns, Gotchas)</li>
              <li>• Auto-research creates knowledge for missing topics</li>
            </ul>
          </div>

          {/* Upgrade hint */}
          <div className="max-w-md mx-auto bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-3">
            <p className="text-xs text-gray-400">
              Want AI conversations and deep research?{' '}
              <a href="#pricing" className="text-purple-400 hover:text-purple-300 font-medium">
                Upgrade to Assistant Pro
              </a>
            </p>
          </div>

          <p className="text-xs text-gray-500">
            You can change preferences anytime in settings.
          </p>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    // Validate email on welcome step if provided
    if (steps[currentStep].id === 'welcome' && preferences.email) {
      if (!validateEmail(preferences.email)) {
        setEmailError('Please enter a valid email address');
        return;
      }
    }

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
        body: JSON.stringify({ userId }),
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
          stepsCompleted: steps.map(s => s.id),
          preferences,
        }),
      });
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
    setIsCompleting(false);
    // Strip onboarding-specific fields before passing to onComplete
    const { email: _email, tier: _tier, ...userPrefs } = preferences;
    onComplete(userPrefs);
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
              <span>
                Step {currentStep + 1} of {steps.length}
              </span>
              <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300"
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
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
                disabled={isCompleting}
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
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
