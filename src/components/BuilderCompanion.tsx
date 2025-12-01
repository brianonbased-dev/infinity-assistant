'use client';

/**
 * Builder Companion
 *
 * The assistant's integration into the Builder workflow.
 * Provides contextual help, proactive suggestions, and fallback
 * assistance when users encounter issues during the build process.
 *
 * Features:
 * - Phase-aware assistance
 * - Proactive help suggestions
 * - Quick troubleshooting
 * - Setup assistance fallback
 * - Real-time guidance
 *
 * @since 2025-12-01
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  HelpCircle,
  MessageCircle,
  ChevronRight,
  ChevronDown,
  X,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Wrench,
  Code,
  Zap,
  ArrowRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

// Types
type BuilderPhase =
  | 'seed'
  | 'roots'
  | 'sprout'
  | 'stem'
  | 'bud'
  | 'bloom'
  | 'flourish'
  | 'radiance';

type CompanionMode = 'minimized' | 'suggestions' | 'chat' | 'troubleshoot';

interface ProactiveSuggestion {
  id: string;
  type: 'tip' | 'warning' | 'action' | 'info';
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

interface BuilderCompanionProps {
  /** Current builder phase */
  currentPhase: BuilderPhase;
  /** Phase progress (0-100) */
  phaseProgress: number;
  /** Whether build is active */
  isBuilding: boolean;
  /** Whether there's an error */
  hasError?: boolean;
  /** Error message if any */
  errorMessage?: string;
  /** Callback for requesting assistance */
  onRequestAssist?: (request: string) => void;
  /** Callback for troubleshoot action */
  onTroubleshoot?: () => void;
  /** Callback for retrying failed step */
  onRetry?: () => void;
  /** Callback for pausing build */
  onPause?: () => void;
  /** Callback for getting help */
  onGetHelp?: (topic: string) => void;
  /** Position on screen */
  position?: 'top-right' | 'bottom-right' | 'inline';
  /** Additional class name */
  className?: string;
}

// Phase-specific tips and suggestions
const PHASE_SUGGESTIONS: Record<BuilderPhase, ProactiveSuggestion[]> = {
  seed: [
    {
      id: 'seed-1',
      type: 'tip',
      title: 'Getting Started',
      description: 'The seed phase analyzes your project requirements and plans the structure.',
    },
  ],
  roots: [
    {
      id: 'roots-1',
      type: 'info',
      title: 'Foundation Building',
      description: "I'm setting up the core dependencies and project structure.",
    },
    {
      id: 'roots-2',
      type: 'tip',
      title: 'Pro Tip',
      description: 'This is a great time to review the planned architecture.',
    },
  ],
  sprout: [
    {
      id: 'sprout-1',
      type: 'info',
      title: 'First Components',
      description: 'Creating the initial components and pages for your app.',
    },
  ],
  stem: [
    {
      id: 'stem-1',
      type: 'info',
      title: 'Building Structure',
      description: 'Adding more features and connecting components together.',
    },
    {
      id: 'stem-2',
      type: 'action',
      title: 'Want to add something?',
      description: 'You can request additional features at any time.',
    },
  ],
  bud: [
    {
      id: 'bud-1',
      type: 'info',
      title: 'Taking Shape',
      description: 'Your app is coming together! Styling and refinements happening now.',
    },
  ],
  bloom: [
    {
      id: 'bloom-1',
      type: 'info',
      title: 'Coming to Life',
      description: 'Adding finishing touches and ensuring everything works together.',
    },
    {
      id: 'bloom-2',
      type: 'tip',
      title: 'Almost There',
      description: "You'll be able to customize the UI/UX soon!",
    },
  ],
  flourish: [
    {
      id: 'flourish-1',
      type: 'info',
      title: 'Full Beauty',
      description: 'Optimizing performance and finalizing features.',
    },
  ],
  radiance: [
    {
      id: 'radiance-1',
      type: 'tip',
      title: 'Complete!',
      description: 'Your creation is ready. Time to review and customize!',
    },
  ],
};

// Quick help topics for each phase
const PHASE_HELP_TOPICS: Record<BuilderPhase, string[]> = {
  seed: ['What is being planned?', 'How long will this take?', 'Can I change requirements?'],
  roots: ['What dependencies are being installed?', 'Can I use different libraries?'],
  sprout: ['What components are being created?', 'How is the structure organized?'],
  stem: ['How do I add a new feature?', 'Can I see the code being generated?'],
  bud: ['How is styling handled?', 'Can I customize colors?'],
  bloom: ['What integrations are being added?', 'How do I test my app?'],
  flourish: ['What optimizations are happening?', 'Is the code production-ready?'],
  radiance: ['How do I deploy?', 'Can I make changes later?', 'How do I customize the UI?'],
};

export function BuilderCompanion({
  currentPhase,
  phaseProgress,
  isBuilding,
  hasError = false,
  errorMessage,
  onRequestAssist,
  onTroubleshoot,
  onRetry,
  onPause,
  onGetHelp,
  position = 'bottom-right',
  className = '',
}: BuilderCompanionProps) {
  const [mode, setMode] = useState<CompanionMode>('suggestions');
  const [isExpanded, setIsExpanded] = useState(true);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);

  // Get current suggestions
  const currentSuggestions = PHASE_SUGGESTIONS[currentPhase].filter(
    s => !dismissedSuggestions.has(s.id)
  );

  // Get help topics
  const helpTopics = PHASE_HELP_TOPICS[currentPhase];

  // Auto-switch to troubleshoot mode on error
  useEffect(() => {
    if (hasError) {
      setMode('troubleshoot');
      setIsExpanded(true);
    }
  }, [hasError]);

  // Dismiss suggestion
  const dismissSuggestion = useCallback((id: string) => {
    setDismissedSuggestions(prev => new Set([...prev, id]));
  }, []);

  // Handle quick question
  const handleQuickQuestion = useCallback((topic: string) => {
    onGetHelp?.(topic);
    setMessages(prev => [
      ...prev,
      { role: 'user', content: topic },
      { role: 'assistant', content: getQuickAnswer(topic, currentPhase) },
    ]);
    setMode('chat');
  }, [onGetHelp, currentPhase]);

  // Handle custom message
  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue;
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // Simulate response (in production, this would use the orchestration)
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: getQuickAnswer(userMessage, currentPhase) },
      ]);
    }, 500);

    onRequestAssist?.(userMessage);
  }, [inputValue, currentPhase, onRequestAssist]);

  const positionClasses = {
    'top-right': 'fixed top-20 right-4',
    'bottom-right': 'fixed bottom-24 right-4',
    'inline': '',
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`${positionClasses[position]} z-40 p-3 rounded-full bg-purple-500 text-white shadow-lg hover:bg-purple-600 transition-all ${className}`}
      >
        <Sparkles className="w-5 h-5" />
        {hasError && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div
      className={`${positionClasses[position]} z-40 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-white">Build Companion</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded hover:bg-gray-700/50 text-gray-400"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Phase indicator */}
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <span className="capitalize">{currentPhase} Phase</span>
          <span>•</span>
          <span>{phaseProgress}%</span>
          {isBuilding && (
            <Loader2 className="w-3 h-3 animate-spin ml-auto text-purple-400" />
          )}
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex border-b border-gray-700">
        {(['suggestions', 'chat', 'troubleshoot'] as CompanionMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              mode === m
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/5'
                : 'text-gray-500 hover:text-gray-400'
            }`}
          >
            {m === 'suggestions' && 'Tips'}
            {m === 'chat' && 'Chat'}
            {m === 'troubleshoot' && (
              <span className="flex items-center gap-1">
                Help
                {hasError && <span className="w-2 h-2 bg-red-500 rounded-full" />}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        {/* Suggestions Mode */}
        {mode === 'suggestions' && (
          <div className="p-3 space-y-2">
            {currentSuggestions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No suggestions right now. Ask me anything!
              </p>
            ) : (
              currentSuggestions.map(suggestion => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onDismiss={() => dismissSuggestion(suggestion.id)}
                  onAction={() => {
                    suggestion.action?.onClick();
                    dismissSuggestion(suggestion.id);
                  }}
                />
              ))
            )}

            {/* Quick questions */}
            <div className="pt-3 border-t border-gray-700">
              <p className="text-xs text-gray-500 mb-2">Quick questions:</p>
              <div className="space-y-1">
                {helpTopics.slice(0, 3).map((topic, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickQuestion(topic)}
                    className="w-full text-left text-xs px-3 py-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-gray-300 flex items-center justify-between group"
                  >
                    <span>{topic}</span>
                    <ArrowRight className="w-3 h-3 text-gray-600 group-hover:text-purple-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat Mode */}
        {mode === 'chat' && (
          <div className="flex flex-col h-64">
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Ask me anything about your build!
                </p>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-800 text-gray-300'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask about your build..."
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleSendMessage}
                  className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Troubleshoot Mode */}
        {mode === 'troubleshoot' && (
          <div className="p-3 space-y-3">
            {hasError ? (
              <>
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-400">Build Error</p>
                      <p className="text-xs text-red-300/70 mt-1">
                        {errorMessage || 'An error occurred during the build process.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-sm text-gray-300"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry failed step
                    </button>
                  )}
                  {onTroubleshoot && (
                    <button
                      onClick={onTroubleshoot}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-sm text-gray-300"
                    >
                      <Wrench className="w-4 h-4" />
                      Auto-troubleshoot
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMode('chat');
                      setMessages(prev => [
                        ...prev,
                        { role: 'user', content: 'Help me fix this error' },
                        { role: 'assistant', content: `I see there's an error: "${errorMessage}". Let me help you troubleshoot this. First, let's check if your API keys are configured correctly. Would you like me to verify your setup?` },
                      ]);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-sm text-purple-300"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Talk to me about this
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <p className="text-sm text-green-400">No issues detected</p>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  If you're experiencing problems, you can:
                </p>
                <div className="space-y-2">
                  {onPause && (
                    <button
                      onClick={onPause}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-sm text-gray-300"
                    >
                      <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                      Pause the build
                    </button>
                  )}
                  <button
                    onClick={() => handleQuickQuestion("Something doesn't look right")}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-sm text-gray-300"
                  >
                    <HelpCircle className="w-4 h-4" />
                    Report an issue
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Suggestion Card Component
function SuggestionCard({
  suggestion,
  onDismiss,
  onAction,
}: {
  suggestion: ProactiveSuggestion;
  onDismiss: () => void;
  onAction?: () => void;
}) {
  const iconMap = {
    tip: <Lightbulb className="w-4 h-4 text-yellow-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    action: <Zap className="w-4 h-4 text-purple-400" />,
    info: <HelpCircle className="w-4 h-4 text-blue-400" />,
  };

  const bgMap = {
    tip: 'bg-yellow-500/10 border-yellow-500/20',
    warning: 'bg-orange-500/10 border-orange-500/20',
    action: 'bg-purple-500/10 border-purple-500/20',
    info: 'bg-blue-500/10 border-blue-500/20',
  };

  return (
    <div className={`p-3 rounded-lg border ${bgMap[suggestion.type]}`}>
      <div className="flex items-start gap-2">
        {iconMap[suggestion.type]}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200">{suggestion.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{suggestion.description}</p>
          {suggestion.action && (
            <button
              onClick={onAction}
              className="mt-2 text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              {suggestion.action.label}
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
        {suggestion.dismissible !== false && (
          <button
            onClick={onDismiss}
            className="p-1 text-gray-600 hover:text-gray-400"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// Helper function for quick answers
function getQuickAnswer(question: string, phase: BuilderPhase): string {
  const lowerQ = question.toLowerCase();

  if (lowerQ.includes('how long') || lowerQ.includes('time')) {
    return 'Build time varies based on complexity, but typically takes 5-15 minutes. You can see the progress in the phase indicator above.';
  }

  if (lowerQ.includes('change') || lowerQ.includes('modify') || lowerQ.includes('add')) {
    return "You can request changes at any time! Just tell me what you'd like to add or modify, and I'll queue it up for the next cycle.";
  }

  if (lowerQ.includes('error') || lowerQ.includes('issue') || lowerQ.includes('problem')) {
    return "I'm here to help! Can you describe what's happening? Check the Troubleshoot tab for common solutions, or describe the issue and I'll help you fix it.";
  }

  if (lowerQ.includes('deploy') || lowerQ.includes('publish')) {
    return 'Once the build is complete, you can deploy to Vercel with one click. Make sure your Vercel API token is configured in the API Setup section.';
  }

  // Phase-specific answers
  const phaseAnswers: Record<BuilderPhase, string> = {
    seed: "I'm currently analyzing your requirements and planning the optimal structure for your project.",
    roots: "I'm setting up the foundation - installing dependencies and creating the basic project structure.",
    sprout: "The first components are being created. This is where your app starts to take shape.",
    stem: "Building out the core features and connecting everything together.",
    bud: "Adding styling and polish. Your app is really coming together!",
    bloom: "Final integrations and making sure everything works smoothly.",
    flourish: "Optimizing performance and adding finishing touches.",
    radiance: "Your build is complete! You can now review and customize the UI/UX.",
  };

  return phaseAnswers[phase] || "I'm here to help with your build. What would you like to know?";
}

export default BuilderCompanion;
