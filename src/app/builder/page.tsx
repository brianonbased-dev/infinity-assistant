'use client';

/**
 * Infinity Builder Page
 *
 * Dedicated page for the Infinity Builder experience.
 * Routes through experience level selection (Easy/Medium/Experienced)
 * then to the appropriate onboarding flow:
 * - Easy: ConversationalOnboarding (companion relationship)
 * - Medium/Experienced: BuilderDreamBoard (visual ideation)
 *
 * Requires Builder subscription tier.
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import { EmailAuth } from '@/components/EmailAuth';
import BuilderMode from '@/components/BuilderMode';

function BuilderContent() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [hasBuilderAccess, setHasBuilderAccess] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check if user has Builder subscription
    const checkBuilderAccess = async () => {
      try {
        const response = await fetch('/api/v2/subscription');
        if (response.ok) {
          const data = await response.json();
          // Check if user has builder tier - strict validation
          // Valid tiers: builder_starter, builder_pro, builder_enterprise, or any tier containing 'builder'
          // Also allow pro, team, enterprise tiers full access
          const validBuilderTiers = [
            'builder_starter',
            'builder_pro',
            'builder_enterprise',
            'pro',
            'team',
            'enterprise',
            'scale', // From PaymentBillingService
            'growth', // From PaymentBillingService
          ];

          const hasAccess =
            validBuilderTiers.includes(data.tier) ||
            data.tier?.includes('builder');

          setHasBuilderAccess(hasAccess);
        } else {
          // No valid subscription response - deny access
          setHasBuilderAccess(false);
        }
      } catch {
        // Network error - deny access (fail secure)
        setHasBuilderAccess(false);
      } finally {
        setCheckingSubscription(false);
      }
    };

    checkBuilderAccess();
  }, []);

  const handleBuildComplete = (workspaceId: string) => {
    console.log('[Builder] Build complete:', workspaceId);
    // Could navigate to workspace or show completion screen
  };

  const handleCancel = () => {
    router.push('/');
  };

  if (!mounted || checkingSubscription) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
          <p className="text-gray-400">Loading Builder...</p>
        </div>
      </div>
    );
  }

  // Show upgrade prompt if no access
  if (!hasBuilderAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex flex-col">
        {/* Header */}
        <header className="border-b border-purple-500/20 bg-black/40 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/')}
                  className="flex items-center gap-2 text-gray-400 hover:text-purple-400 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="text-sm">Back</span>
                </button>
                <div className="flex items-center gap-3">
                  <Sparkles className="w-7 h-7 text-purple-400" />
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    Infinity Builder
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <EmailAuth />
              </div>
            </div>
          </div>
        </header>

        {/* Upgrade Prompt */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-lg text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-purple-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Unlock Infinity Builder
            </h2>
            <p className="text-gray-300 mb-8">
              Build complete applications with AI assistance. Choose your experience level
              and let Infinity guide you through creating your vision.
            </p>

            <div className="space-y-4">
              <a href="/pricing">
                <button className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-purple-500/30">
                  View Builder Plans
                </button>
              </a>
              <button
                onClick={() => router.push('/')}
                className="w-full px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-gray-300"
              >
                Back to Assistant
              </button>
            </div>

            {/* Feature highlights */}
            <div className="mt-12 grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-black/30 rounded-lg border border-purple-500/20">
                <div className="text-2xl mb-2">3</div>
                <div className="text-xs text-gray-400">Experience Levels</div>
              </div>
              <div className="p-4 bg-black/30 rounded-lg border border-purple-500/20">
                <div className="text-2xl mb-2">10+</div>
                <div className="text-xs text-gray-400">Templates</div>
              </div>
              <div className="p-4 bg-black/30 rounded-lg border border-purple-500/20">
                <div className="text-2xl mb-2">AI</div>
                <div className="text-xs text-gray-400">Powered</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render BuilderMode for users with access
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex flex-col">
      {/* Header */}
      <header className="border-b border-purple-500/20 bg-black/40 backdrop-blur-sm flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-gray-400 hover:text-purple-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm">Back</span>
              </button>
              <div className="flex items-center gap-3">
                <Sparkles className="w-7 h-7 text-purple-400" />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  Infinity Builder
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <EmailAuth />
            </div>
          </div>
        </div>
      </header>

      {/* Builder Content */}
      <div className="flex-1 overflow-hidden">
        <BuilderMode
          onBuildComplete={handleBuildComplete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
        </div>
      }
    >
      <BuilderContent />
    </Suspense>
  );
}
