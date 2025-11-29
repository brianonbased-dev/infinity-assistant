'use client';

/**
 * Infinity Assistant - Main Page
 *
 * Public-facing AI assistant powered by InfinityAssistant.io
 * Features: Search, Assist, Build
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MessageCircle, Code, Search, Sparkles, X, Settings } from 'lucide-react';
import logger from '@/utils/logger';
import UnifiedSearchBar from '@/components/UnifiedSearchBar';
import { AssistantOnboarding, UserPreferences } from '@/components/AssistantOnboarding';
import { SettingsModal } from '@/components/SettingsModal';
import { useLocalPreferences } from '@/hooks/useLocalPreferences';

function InfinityAssistantContent() {
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showChat, setShowChat] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Use local-first preferences
  const {
    preferences: localPreferences,
    isLoading: preferencesLoading,
    hasCompletedOnboarding: hasLocalOnboarding,
    savePreferences,
    updatePreferences,
    syncEnabled,
    setSyncEnabled,
    syncToDatabase,
  } = useLocalPreferences();

  // Combined preferences state (local takes precedence)
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  // Sync local preferences to state
  useEffect(() => {
    if (localPreferences) {
      setUserPreferences(localPreferences);
    }
  }, [localPreferences]);

  // Get or create user ID
  useEffect(() => {
    const getUserId = () => {
      // Try to get from cookie
      const cookieUserId = document.cookie
        .split('; ')
        .find((row) => row.startsWith('infinity_anon_user='))
        ?.split('=')[1];

      if (cookieUserId) {
        return cookieUserId;
      }

      // Generate new anonymous user ID
      const newUserId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      document.cookie = `infinity_anon_user=${newUserId}; max-age=${365 * 24 * 60 * 60}; path=/; SameSite=Strict`;
      return newUserId;
    };

    const userIdValue = getUserId();
    setUserId(userIdValue);

    // Local-first onboarding check
    // Only show onboarding if no local preferences exist
    const checkOnboarding = async () => {
      try {
        // Wait for local preferences to load first
        if (preferencesLoading) return;

        // If user has local preferences, skip onboarding
        if (hasLocalOnboarding) {
          setCheckingOnboarding(false);
          return;
        }

        // Check database for existing preferences (fallback)
        const response = await fetch(
          `/api/onboarding/check?userId=${encodeURIComponent(userIdValue)}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.needsOnboarding) {
            setShowOnboarding(true);
          } else if (data.preferences) {
            // Load database preferences to local storage
            savePreferences(data.preferences);
          }
        }
      } catch (error) {
        logger.error('[InfinityAssistantPage] Failed to check onboarding:', error);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, [preferencesLoading, hasLocalOnboarding, savePreferences]);

  useEffect(() => {
    setMounted(true);
    // Check if chat view is requested
    const view = searchParams.get('view');
    if (view === 'chat') {
      setShowChat(true);
    }
  }, [searchParams]);

  const handleOpenChat = () => {
    setShowChat(true);
    router.push('/?view=chat', { scroll: false });
  };

  const handleCloseChat = () => {
    setShowChat(false);
    router.push('/', { scroll: false });
  };

  if (!mounted || checkingOnboarding || preferencesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center">
        <div className="animate-pulse">
          <Sparkles className="w-12 h-12 text-purple-400" />
        </div>
      </div>
    );
  }

  // Show onboarding if needed
  if (showOnboarding && userId) {
    return (
      <AssistantOnboarding
        userId={userId}
        onComplete={(preferences) => {
          // Save to local storage first (local-first)
          savePreferences(preferences);
          setUserPreferences(preferences);
          setShowOnboarding(false);

          // Optionally sync to database if enabled
          if (syncEnabled) {
            syncToDatabase(userId).catch((err) =>
              logger.error('[InfinityAssistantPage] Failed to sync preferences:', err)
            );
          }

          // If chat view was requested, show it after onboarding
          const view = searchParams.get('view');
          if (view === 'chat') {
            setShowChat(true);
            router.push('/?view=chat', { scroll: false });
          }
        }}
        onSkip={() => {
          setShowOnboarding(false);
          // If chat view was requested, show it after skipping
          const view = searchParams.get('view');
          if (view === 'chat') {
            setShowChat(true);
            router.push('/?view=chat', { scroll: false });
          }
        }}
      />
    );
  }

  // Show chat interface if requested
  if (showChat) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-purple-900 via-blue-900 to-black">
        {/* Header */}
        <header className="border-b border-purple-500/20 bg-black/40 backdrop-blur-sm flex-shrink-0">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleCloseChat}
                  className="flex items-center gap-2 text-gray-400 hover:text-purple-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                  <span className="text-sm">Back</span>
                </button>

                <div className="flex items-center gap-3">
                  <Sparkles className="w-7 h-7 text-purple-400" />
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    Infinity Assistant
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <a
                  href="https://infinityassistant.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-purple-400 transition-colors"
                >
                  InfinityAssistant.io
                </a>
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors text-sm font-semibold text-white">
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Unified Search Bar with Preferences */}
        <div className="flex-1 overflow-hidden">
          <UnifiedSearchBar
            initialMode={userPreferences?.preferredMode || 'assist'}
            userPreferences={userPreferences}
          />
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <SettingsModal
            preferences={userPreferences}
            onSave={(prefs) => {
              savePreferences(prefs);
              setUserPreferences(prefs);
              setShowSettings(false);
            }}
            onClose={() => setShowSettings(false)}
            syncEnabled={syncEnabled}
            onSyncChange={(enabled) => {
              setSyncEnabled(enabled);
              if (enabled && userPreferences && userId) {
                syncToDatabase(userId);
              }
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black text-white">
      {/* Header */}
      <header className="border-b border-purple-500/20 bg-black/40 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Infinity Assistant
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://infinityassistant.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-purple-400 transition-colors"
              >
                InfinityAssistant.io
              </a>
              <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors text-white">
                Sign In
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold mb-6">
            Infinity Assistant:{' '}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              Research, Assist, Build
            </span>
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Your AI-powered research assistant with deep knowledge synthesis. Conduct multi-source
            research, get intelligent help, and build solutions with best practices built-in.
          </p>

          {/* Capabilities Badge */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-full">
              <Search className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 text-sm font-medium">Deep Research</span>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full">
              <MessageCircle className="w-4 h-4 text-purple-400" />
              <span className="text-purple-400 text-sm font-medium">Knowledge Memory</span>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full">
              <Code className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm font-medium">Pattern-Driven</span>
            </div>
          </div>

          {/* Free Tier Badge */}
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-500/20 border border-green-500/30 rounded-full mb-8">
            <Sparkles className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-semibold">Free Tier: 20 queries/day</span>
          </div>

          {/* CTA Button */}
          <div className="flex justify-center gap-4">
            <button
              onClick={handleOpenChat}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg font-semibold text-lg transition-all shadow-lg shadow-purple-500/50"
            >
              Start Researching
            </button>
            <a href="#pricing">
              <button className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-lg font-semibold text-lg transition-all border border-white/20">
                View Pricing
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h3 className="text-3xl font-bold text-center mb-4">What You Can Do</h3>
        <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
          Powered by the uAA2++ 8-Phase Protocol with deep knowledge synthesis
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Research */}
          <div className="bg-black/40 border border-blue-500/20 rounded-lg p-6 hover:border-blue-500/40 transition-all">
            <Search className="w-12 h-12 text-blue-400 mb-4" />
            <h4 className="text-xl font-semibold mb-2">Deep Research</h4>
            <p className="text-gray-400 mb-4">
              Multi-source research with AI synthesis. Combines web search, knowledge base, and
              cross-domain pattern matching.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 bg-blue-500/20 rounded text-blue-300">Web Search</span>
              <span className="text-xs px-2 py-1 bg-blue-500/20 rounded text-blue-300">Knowledge Base</span>
              <span className="text-xs px-2 py-1 bg-blue-500/20 rounded text-blue-300">Synthesis</span>
            </div>
          </div>

          {/* Assist */}
          <div className="bg-black/40 border border-purple-500/20 rounded-lg p-6 hover:border-purple-500/40 transition-all">
            <MessageCircle className="w-12 h-12 text-purple-400 mb-4" />
            <h4 className="text-xl font-semibold mb-2">Intelligent Assist</h4>
            <p className="text-gray-400 mb-4">
              Context-aware assistance with memory. Learns from conversations and provides
              personalized, knowledge-rich responses.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 bg-purple-500/20 rounded text-purple-300">Memory</span>
              <span className="text-xs px-2 py-1 bg-purple-500/20 rounded text-purple-300">Context</span>
              <span className="text-xs px-2 py-1 bg-purple-500/20 rounded text-purple-300">Learning</span>
            </div>
          </div>

          {/* Build */}
          <div className="bg-black/40 border border-green-500/20 rounded-lg p-6 hover:border-green-500/40 transition-all">
            <Code className="w-12 h-12 text-green-400 mb-4" />
            <h4 className="text-xl font-semibold mb-2">Pattern-Driven Build</h4>
            <p className="text-gray-400 mb-4">
              Build with best practices. Architecture guidance, code generation, and implementation
              patterns from real-world wisdom.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 bg-green-500/20 rounded text-green-300">Patterns</span>
              <span className="text-xs px-2 py-1 bg-green-500/20 rounded text-green-300">Best Practices</span>
              <span className="text-xs px-2 py-1 bg-green-500/20 rounded text-green-300">Code Gen</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="container mx-auto px-4 py-20">
        <h3 className="text-3xl font-bold text-center mb-4">Choose Your Plan</h3>
        <p className="text-gray-400 text-center mb-12">Start free, upgrade when you need more</p>

        {/* Assistant Pricing */}
        <div className="mb-16">
          <h4 className="text-xl font-semibold text-center mb-8 flex items-center justify-center gap-2">
            <MessageCircle className="w-5 h-5 text-purple-400" />
            <span>Infinity Assistant</span>
          </h4>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free Search */}
            <div className="bg-black/40 border border-gray-500/20 rounded-lg p-8">
              <h4 className="text-2xl font-bold mb-2">Free Search</h4>
              <p className="text-4xl font-bold mb-2">
                $0<span className="text-lg text-gray-400">/month</span>
              </p>
              <p className="text-sm text-gray-500 mb-6">Search our knowledge base</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">20 searches per day</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Knowledge base access (W/P/G)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Auto-research for missing topics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-600 mt-1">✗</span>
                  <span className="text-gray-500">AI conversations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-600 mt-1">✗</span>
                  <span className="text-gray-500">Deep research synthesis</span>
                </li>
              </ul>
              <button
                onClick={handleOpenChat}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Start Searching
              </button>
            </div>

            {/* Assistant Pro */}
            <div className="bg-gradient-to-br from-purple-900/60 to-blue-900/60 border border-purple-500/40 rounded-lg p-8 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full text-sm font-semibold">
                Most Popular
              </div>
              <h4 className="text-2xl font-bold mb-2">Assistant Pro</h4>
              <p className="text-4xl font-bold mb-2">
                $29<span className="text-lg text-gray-400">/month</span>
              </p>
              <p className="text-sm text-purple-300 mb-6">Full AI assistant experience</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">100 queries per day</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">AI-powered conversations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Deep research with synthesis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Memory & context retention</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Priority support</span>
                </li>
              </ul>
              <button className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg transition-all">
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>

        {/* Builder Pricing */}
        <div>
          <h4 className="text-xl font-semibold text-center mb-8 flex items-center justify-center gap-2">
            <Code className="w-5 h-5 text-green-400" />
            <span>Infinity Builder</span>
            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">For Developers</span>
          </h4>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Builder Pro */}
            <div className="bg-black/40 border border-green-500/20 rounded-lg p-8">
              <h4 className="text-2xl font-bold mb-2">Builder Pro</h4>
              <p className="text-4xl font-bold mb-2">
                $49<span className="text-lg text-gray-400">/month</span>
              </p>
              <p className="text-sm text-green-300 mb-6">Everything + code generation</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">All Assistant Pro features</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Unlimited queries</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Code generation & patterns</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Architecture guidance</span>
                </li>
              </ul>
              <button className="w-full px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg transition-colors">
                Get Builder Pro
              </button>
            </div>

            {/* Builder Business */}
            <div className="bg-gradient-to-br from-green-900/60 to-emerald-900/60 border border-green-500/40 rounded-lg p-8 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full text-sm font-semibold">
                For Teams
              </div>
              <h4 className="text-2xl font-bold mb-2">Builder Business</h4>
              <p className="text-4xl font-bold mb-2">
                $149<span className="text-lg text-gray-400">/month</span>
              </p>
              <p className="text-sm text-green-300 mb-6">Team collaboration</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">All Builder Pro features</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Up to 10 team members</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Shared knowledge base</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Priority support</span>
                </li>
              </ul>
              <button className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg transition-all">
                Get Business
              </button>
            </div>

            {/* Builder Enterprise */}
            <div className="bg-black/40 border border-gray-500/20 rounded-lg p-8">
              <h4 className="text-2xl font-bold mb-2">Enterprise</h4>
              <p className="text-4xl font-bold mb-2">Custom</p>
              <p className="text-sm text-gray-400 mb-6">White glove service</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Everything in Business</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Unlimited team members</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Dedicated account manager</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">Custom integrations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">SLA guarantee</span>
                </li>
              </ul>
              <button className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-purple-500/20 bg-black/40 mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">
              &copy; 2025 Infinity Assistant.{' '}
              <a
                href="https://infinityassistant.io"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-purple-400 transition-colors"
              >
                InfinityAssistant.io
              </a>{' '}
              - Part of the Infinity product family.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-gray-400 hover:text-purple-400 text-sm transition-colors">
                Privacy
              </a>
              <a href="#" className="text-gray-400 hover:text-purple-400 text-sm transition-colors">
                Terms
              </a>
              <a href="#" className="text-gray-400 hover:text-purple-400 text-sm transition-colors">
                Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function InfinityAssistantPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center">
        <div className="animate-pulse">
          <Sparkles className="w-12 h-12 text-purple-400" />
        </div>
      </div>
    }>
      <InfinityAssistantContent />
    </Suspense>
  );
}
