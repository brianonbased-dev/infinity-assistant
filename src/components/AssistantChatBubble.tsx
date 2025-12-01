'use client';

/**
 * Assistant Chat Bubble
 *
 * Floating chat bubble that makes the assistant accessible on ALL pages.
 * When clicked, expands into a mini chat interface.
 *
 * Features:
 * - Always visible on non-chat pages
 * - Expandable mini chat interface
 * - Quick actions for common tasks
 * - Context-aware suggestions
 * - Builder integration prompts
 * - Notification badges for proactive help
 *
 * @since 2025-12-01
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Loader2,
  ChevronDown,
  Maximize2,
  Minimize2,
  HelpCircle,
  Wrench,
  Code,
  Settings,
  AlertCircle,
  CheckCircle2,
  Zap,
  ArrowRight,
} from 'lucide-react';

// Types
type AssistantMode = 'chat' | 'help' | 'builder-assist' | 'troubleshoot';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  highlight?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
  suggestions?: string[];
}

interface AssistantChatBubbleProps {
  /** Current page context */
  pageContext?: string;
  /** Whether user is in builder mode */
  isBuilderMode?: boolean;
  /** Current builder phase if applicable */
  builderPhase?: string;
  /** Whether to show notification badge */
  hasNotification?: boolean;
  /** Notification count */
  notificationCount?: number;
  /** Position of the bubble */
  position?: 'bottom-right' | 'bottom-left';
  /** Handler for expanding to full chat */
  onExpandToFullChat?: () => void;
  /** Handler for builder assist requests */
  onBuilderAssist?: (request: string) => void;
  /** Custom quick actions */
  customActions?: QuickAction[];
  /** Z-index for the bubble */
  zIndex?: number;
}

// Quick action configurations by context
const CONTEXT_QUICK_ACTIONS: Record<string, QuickAction[]> = {
  'api-setup': [
    { id: 'help-api', label: 'Help with API keys', icon: <HelpCircle className="w-4 h-4" />, action: () => {} },
    { id: 'troubleshoot', label: 'Connection issues?', icon: <AlertCircle className="w-4 h-4" />, action: () => {}, highlight: true },
  ],
  'builder': [
    { id: 'explain-phase', label: 'Explain current phase', icon: <Sparkles className="w-4 h-4" />, action: () => {} },
    { id: 'add-feature', label: 'Add a feature', icon: <Code className="w-4 h-4" />, action: () => {} },
  ],
  'tools': [
    { id: 'recommend-tools', label: 'Recommend tools', icon: <Wrench className="w-4 h-4" />, action: () => {} },
    { id: 'explain-permissions', label: 'Explain permissions', icon: <HelpCircle className="w-4 h-4" />, action: () => {} },
  ],
  'default': [
    { id: 'whats-new', label: "What's new?", icon: <Sparkles className="w-4 h-4" />, action: () => {} },
    { id: 'help', label: 'Help me get started', icon: <HelpCircle className="w-4 h-4" />, action: () => {} },
  ],
};

export function AssistantChatBubble({
  pageContext = 'default',
  isBuilderMode = false,
  builderPhase,
  hasNotification = false,
  notificationCount = 0,
  position = 'bottom-right',
  onExpandToFullChat,
  onBuilderAssist,
  customActions,
  zIndex = 50,
}: AssistantChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mode, setMode] = useState<AssistantMode>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get context-aware quick actions
  const quickActions = customActions || CONTEXT_QUICK_ACTIONS[pageContext] || CONTEXT_QUICK_ACTIONS.default;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Add proactive help message based on context
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage = getWelcomeMessage(pageContext, isBuilderMode, builderPhase);
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: welcomeMessage,
        timestamp: new Date(),
        suggestions: getSuggestions(pageContext),
      }]);
    }
  }, [isOpen, pageContext, isBuilderMode, builderPhase]);

  const getWelcomeMessage = (context: string, builder: boolean, phase?: string): string => {
    if (builder && phase) {
      return `I see you're in the **${phase}** phase. Need any help? I can explain what's happening or help you make adjustments.`;
    }

    switch (context) {
      case 'api-setup':
        return "Setting up your APIs? I'm here to help! If you run into any issues with API keys or connections, just ask.";
      case 'tools':
        return "Configuring your tools? I can explain what each tool does and help you set up the right permissions.";
      case 'builder':
        return "Ready to build something amazing? Tell me what you're working on and I'll help guide you through the process.";
      default:
        return "Hi! I'm your Infinity Assistant. How can I help you today?";
    }
  };

  const getSuggestions = (context: string): string[] => {
    switch (context) {
      case 'api-setup':
        return ['Where do I get my API key?', 'Why is my connection failing?', 'Which APIs do I need?'];
      case 'tools':
        return ['What tools should I enable?', 'Explain file permissions', 'Is this tool safe?'];
      case 'builder':
        return ['How does building work?', 'Add authentication', 'Explain the phases'];
      default:
        return ['Start a new project', 'Help with setup', 'Show me examples'];
    }
  };

  const handleSend = useCallback(async () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setShowQuickActions(false);
    setIsTyping(true);

    // Simulate assistant response
    // In production, this would call the actual assistant API
    setTimeout(() => {
      const response = generateResponse(inputValue, pageContext, isBuilderMode);
      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        suggestions: response.suggestions,
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  }, [inputValue, pageContext, isBuilderMode]);

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    handleSend();
  };

  const handleQuickAction = (action: QuickAction) => {
    // Set input and send, or execute custom action
    if (action.action) {
      action.action();
    }
    setMessages(prev => [...prev, {
      id: `user_${Date.now()}`,
      role: 'user',
      content: action.label,
      timestamp: new Date(),
    }]);
    setShowQuickActions(false);
    setIsTyping(true);

    setTimeout(() => {
      const response = generateResponse(action.label, pageContext, isBuilderMode);
      setMessages(prev => [...prev, {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        suggestions: response.suggestions,
      }]);
      setIsTyping(false);
    }, 800);
  };

  const positionClasses = position === 'bottom-right'
    ? 'right-6 bottom-6'
    : 'left-6 bottom-6';

  return (
    <div
      className={`fixed ${positionClasses}`}
      style={{ zIndex }}
    >
      {/* Chat Panel */}
      {isOpen && (
        <div
          className={`mb-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
            isMinimized ? 'w-72 h-14' : 'w-96 h-[500px]'
          }`}
        >
          {/* Header */}
          <div className="h-14 px-4 flex items-center justify-between bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Infinity Assistant</h3>
                {!isMinimized && (
                  <p className="text-[10px] text-gray-400">Always here to help</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onExpandToFullChat && (
                <button
                  onClick={onExpandToFullChat}
                  className="p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-gray-300"
                  title="Open full chat"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-gray-300"
              >
                {isMinimized ? (
                  <ChevronDown className="w-4 h-4 rotate-180" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="h-[360px] overflow-y-auto p-4 space-y-4">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white rounded-br-md'
                          : 'bg-gray-800 text-gray-200 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                      {/* Suggestions */}
                      {message.suggestions && message.suggestions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.suggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleSuggestionClick(suggestion)}
                              className="text-xs px-2 py-1 bg-gray-700/50 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                {showQuickActions && messages.length <= 1 && (
                  <div className="pt-2">
                    <p className="text-xs text-gray-500 mb-2">Quick actions:</p>
                    <div className="space-y-2">
                      {quickActions.map(action => (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            action.highlight
                              ? 'border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20'
                              : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'
                          }`}
                        >
                          <span className={action.highlight ? 'text-yellow-400' : 'text-gray-400'}>
                            {action.icon}
                          </span>
                          <span className={`text-sm ${action.highlight ? 'text-yellow-300' : 'text-gray-300'}`}>
                            {action.label}
                          </span>
                          <ArrowRight className="w-4 h-4 text-gray-600 ml-auto" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="h-16 px-4 py-3 border-t border-gray-700 bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Ask me anything..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-full px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isTyping}
                    className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isTyping ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Bubble Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-gray-700 scale-90'
            : 'bg-gradient-to-br from-purple-500 to-blue-500 hover:scale-110 hover:shadow-purple-500/25'
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6 text-white" />
            {/* Notification Badge */}
            {hasNotification && !isOpen && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                {notificationCount > 9 ? '9+' : notificationCount || '!'}
              </span>
            )}
            {/* Pulse effect for proactive help */}
            {hasNotification && (
              <span className="absolute inset-0 rounded-full bg-purple-500 animate-ping opacity-25" />
            )}
          </>
        )}
      </button>
    </div>
  );
}

// Helper function to generate contextual responses
function generateResponse(input: string, context: string, isBuilder: boolean): { content: string; suggestions?: string[] } {
  const lowerInput = input.toLowerCase();

  // API setup context responses
  if (context === 'api-setup') {
    if (lowerInput.includes('api key') || lowerInput.includes('where')) {
      return {
        content: "To get your API key:\n\n1. **Anthropic**: Visit console.anthropic.com/settings/keys\n2. **OpenAI**: Go to platform.openai.com/api-keys\n3. **GitHub**: Settings → Developer settings → Personal access tokens\n\nNeed help with a specific provider?",
        suggestions: ['Help with Anthropic', 'Help with GitHub', 'What permissions do I need?'],
      };
    }
    if (lowerInput.includes('fail') || lowerInput.includes('error') || lowerInput.includes('issue')) {
      return {
        content: "Connection issues are usually caused by:\n\n1. **Invalid API key** - Double-check for typos\n2. **Expired key** - Generate a new one\n3. **Rate limits** - Wait a moment and retry\n4. **Network issues** - Check your internet connection\n\nWant me to help you troubleshoot?",
        suggestions: ['Test my connection', 'Generate new key', 'Check rate limits'],
      };
    }
  }

  // Builder context responses
  if (isBuilder || context === 'builder') {
    if (lowerInput.includes('phase') || lowerInput.includes('explain')) {
      return {
        content: "The build process follows 7 phases:\n\n1. **INTAKE** - Understanding your request\n2. **REFLECT** - Planning the approach\n3. **EXECUTE** - Building the solution\n4. **COMPRESS** - Optimizing code\n5. **GROW** - Learning patterns\n6. **RE-INTAKE** - Refining if needed\n7. **EVOLVE** - Enhancing capabilities\n\nEach phase ensures quality results!",
        suggestions: ['Skip to next phase', 'Pause the build', 'Add a feature'],
      };
    }
    if (lowerInput.includes('add') || lowerInput.includes('feature')) {
      return {
        content: "I can help you add features! Just describe what you want:\n\n- \"Add user authentication\"\n- \"Add a dark mode toggle\"\n- \"Add payment integration\"\n\nI'll add it to the task list and the agent will handle it in the next cycle.",
        suggestions: ['Add authentication', 'Add database', 'Add API endpoint'],
      };
    }
  }

  // Tools context
  if (context === 'tools') {
    if (lowerInput.includes('permission') || lowerInput.includes('safe')) {
      return {
        content: "Tool permissions are categorized by risk:\n\n🟢 **Low risk**: Read files, search code\n🟡 **Medium risk**: Write files, execute commands\n🔴 **High risk**: Delete files, push to remote\n\nI recommend starting with low-risk permissions and enabling others as needed.",
        suggestions: ['Enable all low-risk', 'Explain write permissions', 'What about terminal?'],
      };
    }
  }

  // Default helpful response
  return {
    content: "I'm here to help! I can assist with:\n\n• **API Setup** - Configure your integrations\n• **Building** - Guide you through the process\n• **Troubleshooting** - Fix issues that come up\n• **Learning** - Explain how things work\n\nWhat would you like to explore?",
    suggestions: ['Help with setup', 'Start building', 'Learn more'],
  };
}

export default AssistantChatBubble;
