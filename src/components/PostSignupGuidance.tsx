'use client';

/**
 * Post-Signup Guidance Component
 * 
 * Shows helpful next steps after user signs up.
 * Appears once after signup completion.
 */

import { useEffect, useState } from 'react';
import { X, Check, ArrowRight, Sparkles, BookOpen, Code, Settings, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getPostSignupSteps, markPostSignupGuidanceShown, type SignupFlowContext } from '@/utils/signup-flow';

interface PostSignupGuidanceProps {
  userId: string;
  context: SignupFlowContext;
  onDismiss: () => void;
}

export function PostSignupGuidance({ userId, context, onDismiss }: PostSignupGuidanceProps) {
  const [dismissed, setDismissed] = useState(false);
  const steps = getPostSignupSteps(context);

  const handleDismiss = () => {
    setDismissed(true);
    markPostSignupGuidanceShown(userId);
    onDismiss();
  };

  if (dismissed) return null;

  return (
    <Card className="fixed bottom-4 right-4 w-96 p-6 bg-gradient-to-br from-purple-900/90 to-blue-900/90 border-purple-500/50 shadow-2xl z-50 animate-in slide-in-from-bottom-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-300" />
          <h3 className="text-lg font-semibold text-white">Welcome! 🎉</h3>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-300 mb-3">
            You're all set! Here's what you can do next:
          </p>
          
          <div className="space-y-2">
            {steps.next.slice(0, 4).map((step, index) => (
              <div key={index} className="flex items-start gap-2 text-sm text-gray-200">
                <ArrowRight className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-purple-500/30">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 bg-purple-800/50 border-purple-500/50 text-white hover:bg-purple-700/50"
              onClick={() => window.open(steps.resources.gettingStarted, '_blank')}
            >
              <BookOpen className="w-4 h-4 mr-1" />
              Guide
            </Button>
            {context.email && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 bg-purple-800/50 border-purple-500/50 text-white hover:bg-purple-700/50"
                onClick={() => window.open(steps.resources.apiDocs, '_blank')}
              >
                <Code className="w-4 h-4 mr-1" />
                API Docs
              </Button>
            )}
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="w-full text-gray-400 hover:text-white"
          onClick={handleDismiss}
        >
          Got it, thanks!
        </Button>
      </div>
    </Card>
  );
}

