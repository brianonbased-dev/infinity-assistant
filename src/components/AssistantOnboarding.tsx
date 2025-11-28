'use client';

/**
 * Assistant Onboarding Component
 *
 * Guided onboarding for InfinityAssistant.io users
 * Simplified version for standalone service
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  X,
  Check,
  ArrowRight,
  ArrowLeft,
  Search,
  MessageCircle,
  Code,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
}

interface AssistantOnboardingProps {
  userId: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function AssistantOnboarding({ userId, onComplete, onSkip }: AssistantOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  const steps: WizardStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Infinity Assistant',
      description: 'Your AI-powered assistant for Search, Assist, and Build',
      component: (
        <div className="space-y-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Welcome to Infinity Assistant
          </h2>
          <p className="text-gray-300 max-w-md mx-auto">
            Your intelligent AI assistant. Get help with searching knowledge, getting answers, and building applications.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
              <Search className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-gray-300">Search</div>
              <div className="text-xs text-gray-500 mt-1">Knowledge Base</div>
            </div>
            <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
              <MessageCircle className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-gray-300">Assist</div>
              <div className="text-xs text-gray-500 mt-1">Get Help</div>
            </div>
            <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
              <Code className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-gray-300">Build</div>
              <div className="text-xs text-gray-500 mt-1">Create Apps</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'features',
      title: 'What You Can Do',
      description: 'Explore the three powerful modes',
      component: (
        <div className="space-y-4">
          {/* Search Mode */}
          <Card className="p-4 bg-gray-800 border-blue-500/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Search className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1">Search Mode</h3>
                <p className="text-sm text-gray-400 mb-2">
                  Search our extensive knowledge base for patterns, wisdom, and best practices.
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Find development patterns</li>
                  <li>• Discover wisdom and insights</li>
                  <li>• Learn from gotchas</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Assist Mode */}
          <Card className="p-4 bg-gray-800 border-purple-500/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1">Assist Mode</h3>
                <p className="text-sm text-gray-400 mb-2">
                  Get help with questions, code explanations, and research.
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Ask questions</li>
                  <li>• Get code explanations</li>
                  <li>• Research assistance</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Build Mode */}
          <Card className="p-4 bg-gray-800 border-green-500/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-600 flex items-center justify-center flex-shrink-0">
                <Code className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1">Build Mode</h3>
                <p className="text-sm text-gray-400 mb-2">
                  Get guidance on building applications.
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Plan application architecture</li>
                  <li>• Generate code snippets</li>
                  <li>• Design database schemas</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      ),
    },
    {
      id: 'quickstart',
      title: 'Quick Start Guide',
      description: 'Try these commands to get started',
      component: (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
            <h4 className="font-semibold text-white mb-2">Command Shortcuts</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <code className="px-2 py-1 bg-gray-900 rounded text-blue-400">/search</code>
                <span className="text-gray-400">Switch to Search mode</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="px-2 py-1 bg-gray-900 rounded text-purple-400">/assist</code>
                <span className="text-gray-400">Switch to Assist mode</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="px-2 py-1 bg-gray-900 rounded text-green-400">/build</code>
                <span className="text-gray-400">Switch to Build mode</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
            <h4 className="font-semibold text-white mb-2">Example Queries</h4>
            <div className="space-y-2 text-sm text-gray-400">
              <div>
                <strong className="text-white">Search:</strong> &quot;React best practices&quot;
              </div>
              <div>
                <strong className="text-white">Assist:</strong> &quot;How do I use async/await?&quot;
              </div>
              <div>
                <strong className="text-white">Build:</strong> &quot;Create a todo app with authentication&quot;
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <p className="text-sm text-blue-400">
              <strong>Tip:</strong> Use the mode toggle buttons or command shortcuts to switch
              between Search, Assist, and Build modes. Each mode is optimized for different tasks!
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'complete',
      title: "You're All Set!",
      description: 'Start using Infinity Assistant',
      component: (
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
              <Check className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome to Infinity Assistant!</h2>
          <p className="text-gray-400 max-w-md mx-auto">
            You&apos;re ready to start using all features!
          </p>
          <div className="flex flex-col gap-3 mt-8 max-w-sm mx-auto">
            <p className="text-xs text-gray-500">
              Free tier includes 20 queries per day. Upgrade to Pro for unlimited access.
            </p>
          </div>
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
          stepsCompleted: ['welcome', 'features', 'quickstart', 'complete'],
        }),
      });
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
    setIsCompleting(false);
    onComplete();
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
