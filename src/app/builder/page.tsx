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
 * Free users can access demo mode:
 * - Complete onboarding and design their workspace
 * - Workspace is saved to localStorage for later
 * - When they upgrade, they can continue building
 *
 * Paid users get full build access.
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowLeft, Loader2, Save, FolderOpen, Crown, Lock, Check } from 'lucide-react';
import { EmailAuth } from '@/components/EmailAuth';
import BuilderMode from '@/components/BuilderMode';
import { demoWorkspaceStorage, DemoWorkspace } from '@/services/DemoWorkspaceStorage';

function BuilderContent() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [hasBuilderAccess, setHasBuilderAccess] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [savedWorkspaces, setSavedWorkspaces] = useState<DemoWorkspace[]>([]);
  const [showSavedWorkspaces, setShowSavedWorkspaces] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Load saved demo workspaces
    setSavedWorkspaces(demoWorkspaceStorage.getWorkspaces());

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
          // No valid subscription response - allow demo mode
          setHasBuilderAccess(false);
        }
      } catch {
        // Network error - allow demo mode
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

  // Show demo mode choice for free users (not upgrade wall)
  if (!hasBuilderAccess && !isDemoMode) {
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

        {/* Demo Mode Choice */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-purple-500/20 to-green-500/20 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-purple-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">
                Welcome to Infinity Builder
              </h2>
              <p className="text-gray-300">
                Design your project and see what you can build. Your workspace will be saved for later.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Demo Mode Card */}
              <button
                onClick={() => setIsDemoMode(true)}
                className="p-6 rounded-2xl border-2 border-green-500/30 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Save className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Try Demo Mode</h3>
                    <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Free</span>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  Complete the onboarding experience and design your project.
                  Your workspace will be saved for when you're ready to build.
                </p>
                <ul className="text-sm text-gray-400 space-y-1 mb-4">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span>Full onboarding experience</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span>Design your dream project</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span>Save up to 5 workspaces</span>
                  </li>
                  <li className="flex items-center gap-2 text-gray-500">
                    <Lock className="w-4 h-4" />
                    <span>Building requires upgrade</span>
                  </li>
                </ul>
                <div className="text-green-400 text-sm font-medium group-hover:text-green-300 transition-colors">
                  Start Demo →
                </div>
              </button>

              {/* Upgrade Card */}
              <a href="/pricing?tab=builder" className="block">
                <div className="h-full p-6 rounded-2xl border-2 border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/50 transition-all text-left group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Crown className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Get Builder Pro</h3>
                      <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">$49/mo</span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    Full access to build and deploy complete applications with AI assistance.
                  </p>
                  <ul className="text-sm text-gray-400 space-y-1 mb-4">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-purple-400" />
                      <span>Unlimited workspace builds</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-purple-400" />
                      <span>Code generation & export</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-purple-400" />
                      <span>One-click deployment</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-purple-400" />
                      <span>Priority support</span>
                    </li>
                  </ul>
                  <div className="text-purple-400 text-sm font-medium group-hover:text-purple-300 transition-colors">
                    View Plans →
                  </div>
                </div>
              </a>
            </div>

            {/* Saved Workspaces */}
            {savedWorkspaces.length > 0 && (
              <div className="mt-8">
                <button
                  onClick={() => setShowSavedWorkspaces(!showSavedWorkspaces)}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
                >
                  <FolderOpen className="w-5 h-5" />
                  <span>Your Saved Workspaces ({savedWorkspaces.length})</span>
                </button>

                {showSavedWorkspaces && (
                  <div className="grid gap-3">
                    {savedWorkspaces.map((workspace) => (
                      <div
                        key={workspace.id}
                        className="p-4 bg-black/40 border border-gray-700 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <h4 className="font-medium text-white">{workspace.name}</h4>
                          <p className="text-xs text-gray-500">
                            {workspace.description} • Created {new Date(workspace.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            workspace.status === 'demo_complete'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : workspace.status === 'upgraded'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {workspace.status === 'demo_complete' ? 'Ready to Build' :
                             workspace.status === 'upgraded' ? 'Upgraded' : workspace.status}
                          </span>
                          {workspace.status === 'demo_complete' && (
                            <a
                              href="/pricing?tab=builder"
                              className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded-full text-white transition-colors"
                            >
                              Upgrade to Build
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Handle demo mode completion - save workspace to localStorage
  const handleDemoComplete = (workspaceId: string) => {
    console.log('[Builder] Demo complete, workspace saved:', workspaceId);
    // Refresh saved workspaces list
    setSavedWorkspaces(demoWorkspaceStorage.getWorkspaces());
    // Exit demo mode to show saved workspaces
    setIsDemoMode(false);
  };

  // Render BuilderMode for users with access OR in demo mode
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex flex-col">
      {/* Header */}
      <header className="border-b border-purple-500/20 bg-black/40 backdrop-blur-sm flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (isDemoMode) {
                    setIsDemoMode(false);
                  } else {
                    router.push('/');
                  }
                }}
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
                {isDemoMode && !hasBuilderAccess && (
                  <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">
                    Demo Mode
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isDemoMode && !hasBuilderAccess && (
                <a
                  href="/pricing?tab=builder"
                  className="text-sm px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white transition-colors"
                >
                  Upgrade to Build
                </a>
              )}
              <EmailAuth />
            </div>
          </div>
        </div>
      </header>

      {/* Builder Content */}
      <div className="flex-1 overflow-hidden">
        <BuilderMode
          onBuildComplete={isDemoMode && !hasBuilderAccess ? handleDemoComplete : handleBuildComplete}
          onCancel={handleCancel}
          isDemoMode={isDemoMode && !hasBuilderAccess}
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
