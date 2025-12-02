'use client';

/**
 * Mobile-Optimized Chat Interface
 *
 * Designed for beginner users on mobile devices with:
 * - Large touch targets (48px minimum)
 * - Single-task focus
 * - Simplified UI with 3-5 core actions
 * - Quick action buttons instead of typing
 * - Portrait-optimized layout
 * - Swipe gestures for navigation
 *
 * Research-backed patterns:
 * - Essential-first approach: Only show critical actions
 * - Progressive disclosure: Advanced features revealed as user grows
 * - Contextual actions: Show relevant options based on conversation
 *
 * @since 2025-12-02
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Loader2,
  Sparkles,
  ChevronDown,
  Mic,
  Camera,
  Search,
  MessageCircle,
  ArrowUp,
  X,
  MoreHorizontal,
  Home,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { useDeviceExperience } from '@/hooks/useDeviceExperience';

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
  category: 'search' | 'help' | 'learn' | 'create';
}

interface MobileChatInterfaceProps {
  onSendMessage: (message: string) => Promise<void>;
  messages: Message[];
  isLoading?: boolean;
  userName?: string;
  assistantName?: string;
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'help',
    label: 'Help me',
    icon: <HelpCircle className="w-5 h-5" />,
    prompt: 'I need help with something',
    category: 'help',
  },
  {
    id: 'search',
    label: 'Search',
    icon: <Search className="w-5 h-5" />,
    prompt: 'Search for ',
    category: 'search',
  },
  {
    id: 'explain',
    label: 'Explain',
    icon: <MessageCircle className="w-5 h-5" />,
    prompt: 'Explain to me ',
    category: 'learn',
  },
  {
    id: 'create',
    label: 'Create',
    icon: <Sparkles className="w-5 h-5" />,
    prompt: 'Help me create ',
    category: 'create',
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MobileChatInterface({
  onSendMessage,
  messages,
  isLoading = false,
  userName,
  assistantName = 'Infinity',
}: MobileChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    isMobile,
    isBeginner,
    adaptiveUI,
    trackFeatureUsage,
    incrementQueries,
  } = useDeviceExperience();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Hide quick actions after first message
  useEffect(() => {
    if (messages.length > 0) {
      setShowQuickActions(false);
    }
  }, [messages.length]);

  // Handle sending a message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    incrementQueries();
    trackFeatureUsage('chat');

    try {
      await onSendMessage(message);
    } catch (error) {
      console.error('[MobileChatInterface] Send failed:', error);
    }
  }, [input, isLoading, onSendMessage, incrementQueries, trackFeatureUsage]);

  // Handle quick action tap
  const handleQuickAction = useCallback((action: QuickAction) => {
    trackFeatureUsage('quick_actions');

    if (action.prompt.endsWith(' ')) {
      // Action needs user input
      setInput(action.prompt);
      inputRef.current?.focus();
    } else {
      // Action is complete
      onSendMessage(action.prompt);
    }
    setShowQuickActions(false);
  }, [onSendMessage, trackFeatureUsage]);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-purple-900/30">
      {/* Mobile Header - Simplified */}
      <header className="flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-sm border-b border-purple-500/20">
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className="p-2 -ml-2 touch-manipulation"
          aria-label="Menu"
        >
          <MoreHorizontal className="w-6 h-6 text-gray-400" />
        </button>

        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <span className="font-semibold text-white">{assistantName}</span>
        </div>

        <button
          onClick={() => window.location.href = '/'}
          className="p-2 -mr-2 touch-manipulation"
          aria-label="Home"
        >
          <Home className="w-6 h-6 text-gray-400" />
        </button>
      </header>

      {/* More Menu Overlay */}
      {showMoreMenu && (
        <div
          className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Menu</h2>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-2 touch-manipulation"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <nav className="space-y-2">
              <a
                href="/"
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-800/50 text-white touch-manipulation"
              >
                <Home className="w-5 h-5 text-purple-400" />
                Home
              </a>
              <a
                href="/pricing"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800/50 touch-manipulation"
              >
                <Sparkles className="w-5 h-5 text-purple-400" />
                Upgrade
              </a>
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  // Navigate to settings
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800/50 touch-manipulation"
              >
                <Settings className="w-5 h-5 text-gray-400" />
                Settings
              </button>
              <a
                href="/help"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800/50 touch-manipulation"
              >
                <HelpCircle className="w-5 h-5 text-gray-400" />
                Help
              </a>
            </nav>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Welcome Message for Empty State */}
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              {getGreeting()}{userName ? `, ${userName}` : ''}!
            </h2>
            <p className="text-gray-400 text-sm max-w-xs mx-auto">
              I'm your AI assistant. Ask me anything or tap a quick action below to get started.
            </p>
          </div>
        )}

        {/* Quick Actions - Show for beginners or empty state */}
        {showQuickActions && (isBeginner || messages.length === 0) && (
          <div className="grid grid-cols-2 gap-3 py-4">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800/60 border border-gray-700 rounded-xl hover:border-purple-500/50 transition-colors touch-manipulation"
                style={{ minHeight: '80px' }} // Large touch target
              >
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                  {action.icon}
                </div>
                <span className="text-sm font-medium text-white">{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-md'
                  : 'bg-gray-800 text-gray-100 rounded-bl-md'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
              </p>
              <span className="block text-xs opacity-60 mt-1">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                <span className="text-sm text-gray-400">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Large Touch Targets */}
      <div className="border-t border-gray-800 bg-black/40 backdrop-blur-sm p-4 pb-safe">
        {/* Toggle Quick Actions Button */}
        {messages.length > 0 && (
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="flex items-center justify-center gap-1 w-full py-2 text-sm text-purple-400 mb-3"
          >
            <span>{showQuickActions ? 'Hide' : 'Show'} quick actions</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showQuickActions ? 'rotate-180' : ''}`} />
          </button>
        )}

        <div className="flex items-end gap-3">
          {/* Voice Input Button - Mobile-friendly */}
          <button
            className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-purple-400 transition-colors touch-manipulation"
            aria-label="Voice input"
            onClick={() => trackFeatureUsage('voice_input')}
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask me anything..."
              rows={1}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none text-base"
              style={{
                minHeight: '48px',
                maxHeight: '120px',
              }}
            />
          </div>

          {/* Send Button - Large Touch Target */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all touch-manipulation ${
              input.trim() && !isLoading
                ? 'bg-purple-600 text-white hover:bg-purple-500'
                : 'bg-gray-800 text-gray-600'
            }`}
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowUp className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Character Hint */}
        {input.length > 200 && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            {500 - input.length} characters remaining
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MOBILE-SPECIFIC STYLES
// ============================================================================

/**
 * Add to your global CSS or tailwind config:
 *
 * .touch-manipulation {
 *   touch-action: manipulation;
 * }
 *
 * .pb-safe {
 *   padding-bottom: env(safe-area-inset-bottom, 16px);
 * }
 *
 * // Large touch targets
 * button, a {
 *   min-height: 44px;
 *   min-width: 44px;
 * }
 */
