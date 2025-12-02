'use client';

/**
 * Unified Search Bar Component
 *
 * Intelligent interface for Infinity Assistant with AUTO-MODE DETECTION
 *
 * The assistant automatically detects user intent and routes appropriately:
 * - Search queries → Knowledge base search
 * - Conversations/help → AI conversation
 * - Build requests → Code generation (if tier allows)
 *
 * Mode toggles are now OPTIONAL visual indicators, not required switches.
 * The assistant "just works" regardless of which toggle is selected.
 *
 * Features:
 * - Auto-intent detection (search/assist/build)
 * - Seamless mode switching based on query
 * - Command shortcuts (/search, /assist, /build) still work
 * - Visual mode indicator shows detected intent
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import logger from '@/utils/logger';
import {
  Send,
  Loader2,
  AlertCircle,
  Sparkles,
  Search,
  MessageCircle,
  Code,
  Mic,
  XCircle,
  Lock,
  Crown,
  Wand2,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { generatePreferencesPrompt, UserPreferences } from '@/hooks/useLocalPreferences';
import { type UserTier, isModeAllowedForTier, hasBuilderAccess } from '@/types/agent-capabilities';
import { useFreemiumDebounced } from '@/hooks/useFreemium';
import { FreemiumOfferCard, FreemiumResponse } from '@/components/FreemiumOffer';
import { getQueryIntentClassifier, type QueryIntent } from '@/services/QueryIntentClassifier';

type SearchMode = 'search' | 'assist' | 'build';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  mode?: SearchMode;
}

interface RateLimit {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_at?: string;
}

interface UnifiedSearchBarProps {
  initialMode?: SearchMode;
  initialConversationId?: string;
  onModeChange?: (mode: SearchMode) => void;
  userPreferences?: UserPreferences | null;
  userTier?: UserTier; // Subscription tier determines available modes
  onUpgradeClick?: () => void; // Callback when user clicks upgrade
  autoMode?: boolean; // Enable auto-mode detection (default: true)
}

export default function UnifiedSearchBar({
  initialMode = 'assist', // Default to assist - conversation is always available
  initialConversationId,
  onModeChange,
  userPreferences,
  userTier = 'free', // Default to free tier
  onUpgradeClick,
  autoMode = true, // Auto-mode detection enabled by default
}: UnifiedSearchBarProps) {
  // Assist mode (conversation) is ALWAYS available to all users
  // Only Build mode is restricted to builder_pro+
  const effectiveInitialMode = initialMode === 'build' && !hasBuilderAccess(userTier)
    ? 'assist'
    : initialMode;
  const [mode, setMode] = useState<SearchMode>(effectiveInitialMode);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null);
  interface Suggestion {
    text: string;
    type: 'pattern' | 'wisdom' | 'gotcha' | 'query';
    metadata?: Record<string, unknown>;
  }
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Auto-mode detection state
  const [detectedIntent, setDetectedIntent] = useState<QueryIntent | null>(null);
  const [intentConfidence, setIntentConfidence] = useState<number>(0);
  const [isAutoModeEnabled, setIsAutoModeEnabled] = useState(autoMode);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsCacheRef = useRef<Map<string, Suggestion[]>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestAbortControllerRef = useRef<AbortController | null>(null);

  // Intent classifier instance
  const intentClassifier = useMemo(() => getQueryIntentClassifier(), []);

  // Debounce input for autocomplete (300ms delay)
  const debouncedInput = useDebounce(input, 300);

  // ============================================================================
  // CONVERSATION PERSISTENCE (localStorage)
  // ============================================================================
  const STORAGE_KEY = 'infinity_conversation';

  // Load persisted conversation on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only restore if conversation is less than 24 hours old
        const storedTime = new Date(parsed.updatedAt || 0).getTime();
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (now - storedTime < maxAge) {
          if (parsed.conversationId && !conversationId) {
            setConversationId(parsed.conversationId);
          }
          if (parsed.messages && parsed.messages.length > 0 && messages.length === 0) {
            setMessages(parsed.messages);
            logger.debug('[UnifiedSearchBar] Restored conversation from localStorage', {
              conversationId: parsed.conversationId,
              messageCount: parsed.messages.length,
            });
          }
        } else {
          // Clear stale conversation
          localStorage.removeItem(STORAGE_KEY);
          logger.debug('[UnifiedSearchBar] Cleared stale conversation (>24h old)');
        }
      }
    } catch (e) {
      logger.warn('[UnifiedSearchBar] Failed to load persisted conversation:', e);
    }
  }, []); // Only run once on mount

  // Save conversation to localStorage when it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!conversationId && messages.length <= 1) return; // Don't save empty or welcome-only

    try {
      const toStore = {
        conversationId,
        messages: messages.slice(-50), // Keep last 50 messages
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      logger.debug('[UnifiedSearchBar] Saved conversation to localStorage', {
        conversationId,
        messageCount: messages.length,
      });
    } catch (e) {
      logger.warn('[UnifiedSearchBar] Failed to save conversation:', e);
    }
  }, [conversationId, messages]);

  // Auto-detect intent when input changes (with debounce)
  useEffect(() => {
    if (isAutoModeEnabled && debouncedInput.length > 3) {
      const classification = intentClassifier.classify(debouncedInput, {
        currentMode: mode,
        previousMessages: messages.slice(-3).map(m => m.content),
      });

      setDetectedIntent(classification.intent);
      setIntentConfidence(classification.confidence);

      // Log intent detection for debugging
      logger.debug('[UnifiedSearchBar] Intent detected:', {
        query: debouncedInput.substring(0, 50),
        intent: classification.intent,
        confidence: classification.confidence,
      });
    } else if (debouncedInput.length <= 3) {
      setDetectedIntent(null);
      setIntentConfidence(0);
    }
  }, [debouncedInput, isAutoModeEnabled, intentClassifier, mode, messages]);

  // Freemium offers for free tier users
  const freemium = useFreemiumDebounced('anonymous', 600); // 600ms debounce for offer check

  // Check for freemium offers when user types (only for free tier)
  useEffect(() => {
    if (userTier === 'free' && debouncedInput.length > 10) {
      freemium.debouncedCheckForOffer(debouncedInput);
    }
  }, [debouncedInput, userTier, freemium]);

  // Handle accepting a freemium offer
  const handleAcceptFreemium = useCallback(async () => {
    if (!freemium.currentOffer || !input.trim()) return;

    const result = await freemium.executeFreemium(input.trim(), freemium.currentOffer.type);

    if (result) {
      // Add the freemium response as a message
      const freemiumMessage: Message = {
        id: `freemium-${Date.now()}`,
        role: 'assistant',
        content: result,
        timestamp: new Date().toISOString(),
        mode,
      };
      setMessages((prev) => [...prev, freemiumMessage]);
      setInput('');
    }
  }, [freemium, input, mode]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add welcome message on mount - personalized based on preferences
  useEffect(() => {
    if (messages.length === 0) {
      // Generate personalized greeting
      const userName = userPreferences?.role
        ? {
            developer: 'fellow developer',
            designer: 'creative designer',
            product_manager: 'product leader',
            data_analyst: 'data expert',
            student: 'eager learner',
            entrepreneur: 'innovator',
            researcher: 'curious researcher',
            other: 'friend',
          }[userPreferences.role] || 'friend'
        : 'friend';

      const styleHint = userPreferences?.communicationStyle
        ? {
            concise: "I'll keep my responses brief and actionable.",
            detailed: "I'll provide comprehensive explanations with examples.",
            conversational: "Let's have a friendly chat about whatever you need.",
          }[userPreferences.communicationStyle]
        : '';

      const interestHint =
        userPreferences?.interests && userPreferences.interests.length > 0
          ? `\n\nI see you're interested in **${userPreferences.interests.slice(0, 3).join(', ')}** - feel free to ask about those topics!`
          : '';

      // Tier-aware welcome messages
      const freeSearchWelcome = `Hello, ${userName}! Welcome to **Infinity Search**.\n\nSearch our knowledge base for:\n- **Patterns** - Proven solutions and approaches\n- **Wisdom** - Key insights and principles\n- **Gotchas** - Common pitfalls to avoid\n\nYour searches help us grow our knowledge! If we don't have what you're looking for, we'll note it and research it.${interestHint}\n\n*Tip: Upgrade to Assistant Pro for AI-powered conversations and deep research.*\n\nWhat would you like to search for?`;

      const proSearchWelcome = `Hello, ${userName}! I am Infinity Agent with **Deep Research** capabilities.\n\n**Research Mode** combines:\n- Web search (Brave API)\n- Knowledge base (patterns, wisdom, gotchas)\n- AI-powered synthesis\n- Cross-domain connections\n\nI can conduct:\n- **Quick research** (<500ms) - fast lookups\n- **Standard research** (<2s) - balanced depth\n- **Deep research** (<10s) - thorough analysis\n- **Comprehensive research** (<30s) - full protocol${interestHint}\n\nWhat would you like to research?`;

      const welcomeMessages: Record<SearchMode, string> = {
        search: userTier === 'free' ? freeSearchWelcome : proSearchWelcome,
        assist: `Hello, ${userName}! I am Infinity Agent. ${styleHint}\n\n**Assist Mode** provides:\n- Intelligent conversation with memory\n- Knowledge-rich responses (W/P/G)\n- Context-aware assistance\n- Phase-tracked learning\n\nI can help with:\n- Answering questions\n- Explaining code\n- Research assistance\n- Problem solving${interestHint}\n\nHow can I assist you today?`,
        build: `Hello, ${userName}! I am Infinity Agent. Use **Build** mode for development guidance.\n\n**Build Mode** leverages:\n- Best practices & patterns\n- Architecture templates\n- Code generation\n- Implementation guidance\n\nI can help you:\n- Plan your application architecture\n- Generate code snippets\n- Design database schemas\n- Apply industry best practices${interestHint}\n\nWhat would you like to build?`,
      };

      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: welcomeMessages[mode],
          timestamp: new Date().toISOString(),
          mode,
        },
      ]);
    }
  }, [messages.length, mode, userPreferences]);

  // Handle mode change
  const handleModeChange = useCallback(
    (newMode: SearchMode) => {
      setMode(newMode);
      onModeChange?.(newMode);
      // Clear messages when switching modes
      setMessages([]);
    },
    [onModeChange]
  );

  // Generate suggestions with caching and debouncing
  // Uses the efficient agent search endpoint for faster suggestions
  const generateSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoadingSuggestions(false);
      return;
    }

    // Don't show suggestions for command shortcuts
    if (
      query.startsWith('/search ') ||
      query.startsWith('/assist ') ||
      query.startsWith('/build ')
    ) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoadingSuggestions(false);
      return;
    }

    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    const cached = suggestionsCacheRef.current.get(cacheKey);
    if (cached) {
      setSuggestions(cached);
      setShowSuggestions(true);
      setIsLoadingSuggestions(false);
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    setIsLoadingSuggestions(true);

    try {
      // Use agent search endpoint for more efficient querying
      const response = await fetch(
        `/api/search/agent?q=${encodeURIComponent(query)}&limit=5&userTier=${userTier}`,
        { signal: abortControllerRef.current.signal }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.results) {
          // Convert agent search results to suggestions format
          const formattedSuggestions: Suggestion[] = [];

          // Add wisdom results
          (data.results.wisdom || []).slice(0, 2).forEach((item: { title?: string; content: string; metadata?: Record<string, unknown> }) => {
            formattedSuggestions.push({
              text: item.title || item.content.substring(0, 60),
              type: 'wisdom',
              metadata: item.metadata,
            });
          });

          // Add pattern results
          (data.results.patterns || []).slice(0, 2).forEach((item: { title?: string; content: string; metadata?: Record<string, unknown> }) => {
            formattedSuggestions.push({
              text: item.title || item.content.substring(0, 60),
              type: 'pattern',
              metadata: item.metadata,
            });
          });

          // Add gotcha results
          (data.results.gotchas || []).slice(0, 1).forEach((item: { title?: string; content: string; metadata?: Record<string, unknown> }) => {
            formattedSuggestions.push({
              text: item.title || item.content.substring(0, 60),
              type: 'gotcha',
              metadata: item.metadata,
            });
          });

          if (formattedSuggestions.length > 0) {
            // Cache suggestions (limit cache size to 50 entries)
            if (suggestionsCacheRef.current.size >= 50) {
              const firstKey = suggestionsCacheRef.current.keys().next().value;
              if (firstKey) suggestionsCacheRef.current.delete(firstKey);
            }
            suggestionsCacheRef.current.set(cacheKey, formattedSuggestions);

            setSuggestions(formattedSuggestions);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error: unknown) {
      // Ignore abort errors (expected when user types quickly)
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      // Silently fail for other errors - suggestions are optional
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [userTier]);

  // Effect to trigger suggestions when debounced input changes
  useEffect(() => {
    if (mode === 'search' && debouncedInput.length > 0) {
      generateSuggestions(debouncedInput);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoadingSuggestions(false);
    }
  }, [debouncedInput, mode, generateSuggestions]);

  // Handle command shortcuts
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);

      // Detect command shortcuts
      if (value.startsWith('/search ')) {
        handleModeChange('search');
        setInput(value.replace('/search ', ''));
      } else if (value.startsWith('/assist ')) {
        handleModeChange('assist');
        setInput(value.replace('/assist ', ''));
      } else if (value.startsWith('/build ')) {
        handleModeChange('build');
        setInput(value.replace('/build ', ''));
      }

      // Reset selection when input changes
      setSelectedSuggestionIndex(-1);
    },
    [handleModeChange]
  );

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (requestAbortControllerRef.current) {
      requestAbortControllerRef.current.abort();
      requestAbortControllerRef.current = null;
    }
    setIsLoading(false);
    setError(null);
  }, []);

  // Handle send
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Cancel any existing request
    if (requestAbortControllerRef.current) {
      requestAbortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    requestAbortControllerRef.current = new AbortController();

    // Determine effective mode: use auto-detected intent if enabled, otherwise use selected mode
    let effectiveMode: SearchMode = mode;
    if (isAutoModeEnabled && detectedIntent && intentConfidence > 0.5) {
      // Apply tier restrictions to detected intent
      if (detectedIntent === 'build' && !hasBuilderAccess(userTier)) {
        // Fall back to assist if user can't access build
        effectiveMode = 'assist';
      } else {
        effectiveMode = detectedIntent;
      }

      // Update visual mode indicator if different
      if (effectiveMode !== mode) {
        setMode(effectiveMode);
        onModeChange?.(effectiveMode);
        logger.info('[UnifiedSearchBar] Auto-switched mode:', {
          from: mode,
          to: effectiveMode,
          confidence: intentConfidence,
        });
      }
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      mode: effectiveMode,
    };

    // Add user message to UI immediately
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    setShowSuggestions(false);
    setDetectedIntent(null); // Reset detected intent after send
    setIntentConfidence(0);

    try {
      // Determine API endpoint based on effective mode
      // Search mode uses agent search for efficient querying
      // Assist and Build modes use chat API for full conversation
      const isSearchMode = effectiveMode === 'search';
      const apiEndpoint = isSearchMode ? '/api/search/agent' : '/api/chat';

      // Generate preferences context for personalization
      const preferencesContext = generatePreferencesPrompt(userPreferences || null);

      // Build request body based on effective mode
      const requestBody = isSearchMode
        ? {
            query: userMessage.content,
            protocol: userTier === 'free' ? 'quick' : 'standard',
            userId: 'anonymous',
            userTier,
            includeFreemium: userTier === 'free',
          }
        : {
            message: userMessage.content,
            conversationId,
            mode: effectiveMode,
            // Include preferences for AI personalization
            userContext: preferencesContext || undefined,
            preferences: userPreferences || undefined,
          };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: requestAbortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          const errorData = await response.json();
          setError(errorData.message || 'Rate limit exceeded. Please try again later.');
          setRateLimit(errorData.rateLimit);
          return;
        }

        throw new Error('Failed to send message');
      }

      const data = await response.json();

      // All modes now use unified /api/chat response format
      // Search mode includes: web search (Brave) + knowledge base + LLM synthesis

      // Update conversation ID if new
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Update rate limit
      if (data.rateLimit) {
        setRateLimit(data.rateLimit);
      }

      // Handle response - format based on mode
      if (data.success === false) {
        // Error response
        const errorMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `**Error**: ${data.error || 'Request failed'}\n\nPlease try again or rephrase your query.`,
          timestamp: new Date().toISOString(),
          mode,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } else if (mode === 'search' && data.results) {
        // Agent search response - format W/P/G results
        let searchContent = '';

        // Check for generated answer from knowledge gap capture
        if (data.generatedAnswer) {
          searchContent += `**Generated Answer:**\n${data.generatedAnswer}\n\n---\n\n`;
        }

        // Show synthesis if available
        if (data.synthesis?.summary) {
          searchContent += `**Summary:**\n${data.synthesis.summary}\n\n`;
        }

        // Format wisdom results
        if (data.results.wisdom && data.results.wisdom.length > 0) {
          searchContent += `**💡 Wisdom** (${data.results.wisdom.length} found)\n`;
          data.results.wisdom.slice(0, 5).forEach((item: { title?: string; content: string; score?: number }) => {
            searchContent += `- ${item.title || item.content.substring(0, 100)}${item.score ? ` (${Math.round(item.score * 100)}% match)` : ''}\n`;
          });
          searchContent += '\n';
        }

        // Format pattern results
        if (data.results.patterns && data.results.patterns.length > 0) {
          searchContent += `**📋 Patterns** (${data.results.patterns.length} found)\n`;
          data.results.patterns.slice(0, 5).forEach((item: { title?: string; content: string; score?: number }) => {
            searchContent += `- ${item.title || item.content.substring(0, 100)}${item.score ? ` (${Math.round(item.score * 100)}% match)` : ''}\n`;
          });
          searchContent += '\n';
        }

        // Format gotcha results
        if (data.results.gotchas && data.results.gotchas.length > 0) {
          searchContent += `**⚠️ Gotchas** (${data.results.gotchas.length} found)\n`;
          data.results.gotchas.slice(0, 3).forEach((item: { title?: string; content: string; score?: number }) => {
            searchContent += `- ${item.title || item.content.substring(0, 100)}${item.score ? ` (${Math.round(item.score * 100)}% match)` : ''}\n`;
          });
          searchContent += '\n';
        }

        // No results message
        if (data.counts.total === 0 && !data.generatedAnswer) {
          searchContent = "No results found in our knowledge base. We've noted this topic for future research.\n\n*Tip: Upgrade to Assistant Pro for AI-powered answers to any question.*";
        }

        // Add metadata
        searchContent += `\n---\n*Search completed in ${data.metadata?.searchTimeMs || 0}ms | Protocol: ${data.protocol || 'quick'}*`;

        const searchMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: searchContent,
          timestamp: new Date().toISOString(),
          mode,
        };
        setMessages((prev) => [...prev, searchMessage]);
      } else {
        // Chat response - works for assist and build modes
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response || data.message || 'No response received',
          timestamp: new Date().toISOString(),
          mode,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err: unknown) {
      // Handle cancellation
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled - don't show error
        const cancelledMsg: Message = {
          id: `cancelled-${Date.now()}`,
          role: 'assistant',
          content:
            '**Request cancelled**\n\nThe request was cancelled. You can try again with a new query.',
          timestamp: new Date().toISOString(),
          mode,
        };
        setMessages((prev) => [...prev, cancelledMsg]);
        return;
      }

      logger.error('[UnifiedSearchBar] Error sending message:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send message. Please try again.';
      setError(errorMessage);

      // Add error message to chat
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `**Error**: ${errorMessage}\n\nPlease try again or rephrase your query.`,
        timestamp: new Date().toISOString(),
        mode,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      requestAbortControllerRef.current = null;
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'ArrowDown' && showSuggestions && suggestions.length > 0) {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp' && showSuggestions && suggestions.length > 0) {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && showSuggestions && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      const selectedSuggestion = suggestions[selectedSuggestionIndex];
      if (selectedSuggestion) {
        setInput(selectedSuggestion.text);
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    }
  };

  // Mode configuration with tier requirements
  // IMPORTANT: Conversation (Assist) is ALWAYS available - it's our way in the door
  // per RATE_LIMITS philosophy in agent-capabilities.ts
  const modeConfig = {
    search: {
      icon: Search,
      label: 'Search',
      color: 'blue',
      description: userTier === 'free' ? 'Search knowledge base' : 'Deep research with knowledge synthesis',
      hint: userTier === 'free' ? 'Knowledge Base Search' : 'Web + Knowledge Base + AI Synthesis',
      requiredTier: 'free' as UserTier, // Available to all
      upgradeMessage: null,
    },
    assist: {
      icon: MessageCircle,
      label: 'Assist',
      color: 'purple',
      description: 'Get intelligent help and answers',
      hint: 'Conversation + Knowledge + Memory',
      requiredTier: 'free' as UserTier, // ALWAYS available - conversation is our way in
      upgradeMessage: null, // No upgrade needed - always available
    },
    build: {
      icon: Code,
      label: 'Build',
      color: 'green',
      description: 'Generate code and architecture',
      hint: 'Patterns + Best Practices + Code Gen',
      requiredTier: 'builder_pro' as UserTier,
      upgradeMessage: 'Upgrade to Builder Pro for code generation',
    },
  };

  const currentModeConfig = modeConfig[mode];

  // Check if a mode is available for the current tier
  const isModeAvailable = (m: SearchMode): boolean => {
    return isModeAllowedForTier(userTier, m);
  };

  // Handle mode change with tier check
  const handleTierAwareModeChange = (m: SearchMode) => {
    if (isModeAvailable(m)) {
      handleModeChange(m);
    } else if (onUpgradeClick) {
      onUpgradeClick();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 to-black text-white">
      {/* Mode Toggle Bar - Now optional with auto-detection */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Auto-mode indicator */}
                {isAutoModeEnabled && (
                  <button
                    type="button"
                    onClick={() => setIsAutoModeEnabled(!isAutoModeEnabled)}
                    className="px-2 py-1 rounded-md bg-linear-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-purple-300 text-xs flex items-center gap-1 hover:from-purple-500/30 hover:to-blue-500/30 transition-all"
                    title="Auto-mode: I detect your intent automatically. Click to disable."
                  >
                    <Wand2 className="w-3 h-3" />
                    Auto
                  </button>
                )}
                {!isAutoModeEnabled && (
                  <button
                    type="button"
                    onClick={() => setIsAutoModeEnabled(true)}
                    className="px-2 py-1 rounded-md bg-gray-800 border border-gray-700 text-gray-500 text-xs flex items-center gap-1 hover:bg-gray-700 hover:text-gray-400 transition-all"
                    title="Enable auto-mode detection"
                  >
                    <Wand2 className="w-3 h-3" />
                    Auto
                  </button>
                )}

                <span className="text-gray-600 text-xs">|</span>

                {(['search', 'assist', 'build'] as SearchMode[]).map((m) => {
                  const config = modeConfig[m];
                  const Icon = config.icon;
                  const isActive = mode === m;
                  const isAvailable = isModeAvailable(m);
                  const isDetected = isAutoModeEnabled && detectedIntent === m && intentConfidence > 0.5;

                  return (
                    <button
                      key={m}
                      onClick={() => handleTierAwareModeChange(m)}
                      className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all flex items-center gap-1.5 ${
                        isActive
                          ? m === 'search'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : m === 'assist'
                              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                              : 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                          : isDetected
                            ? 'bg-gray-700 text-gray-200 ring-2 ring-purple-500/50'
                            : isAvailable
                              ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                              : 'bg-gray-900 text-gray-600 cursor-not-allowed border border-gray-800'
                      }`}
                      title={
                        isDetected
                          ? `Detected: ${config.label} (${Math.round(intentConfidence * 100)}% confident)`
                          : isAvailable
                            ? config.hint
                            : config.upgradeMessage || 'Upgrade required'
                      }
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {config.label}
                      {!isAvailable && <Lock className="w-3 h-3" />}
                      {isDetected && !isActive && <span className="text-[10px] text-purple-300">•</span>}
                    </button>
                  );
                })}
              </div>

              {/* Rate Limit & Tier Display */}
              <div className="flex items-center gap-3 text-sm">
                {userTier !== 'free' && (
                  <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    {userTier.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                )}
                {rateLimit && (
                  <span className="text-gray-400 text-xs">
                    {rateLimit.limit === -1
                      ? 'Unlimited'
                      : `${rateLimit.remaining}/${rateLimit.limit}`}
                  </span>
                )}
              </div>
            </div>

            {/* Mode Hint Bar - Shows detected intent when auto-mode is on */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-gray-500">
                {isAutoModeEnabled && detectedIntent && intentConfidence > 0.5 ? (
                  <>
                    <Wand2 className="w-3 h-3 text-purple-400" />
                    <span className="text-purple-300">
                      Detected: {modeConfig[detectedIntent].label} ({Math.round(intentConfidence * 100)}%)
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    <span>{currentModeConfig.hint}</span>
                  </>
                )}
              </div>
              {userTier === 'free' && (
                <button
                  onClick={onUpgradeClick}
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <Crown className="w-3 h-3" />
                  Upgrade
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-6 py-4 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'bg-gray-800 border border-gray-700 text-gray-100'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-gray-400 font-semibold">
                      Infinity Assistant ({currentModeConfig.label})
                    </span>
                  </div>
                )}
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                <div className="text-xs text-gray-400 mt-2">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl px-6 py-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  <span className="text-sm text-gray-400">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex justify-center">
              <div className="bg-red-500/20 border border-red-500/30 rounded-2xl px-6 py-4 max-w-md">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-300 font-semibold mb-1">Error</p>
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Unified Search Bar */}
      <div className="border-t border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Freemium Offer (for free tier users) */}
          {userTier === 'free' && freemium.currentOffer && !freemium.isExecuting && (
            <FreemiumOfferCard
              offer={freemium.currentOffer}
              query={input}
              onAccept={handleAcceptFreemium}
              onDismiss={freemium.dismissOffer}
              onUpgrade={() => onUpgradeClick?.()}
              isLoading={freemium.isExecuting}
            />
          )}

          {/* Freemium Response Display */}
          {freemium.freemiumResponse && (
            <div className="mb-4">
              <FreemiumResponse
                type={freemium.freemiumResponse.type}
                response={freemium.freemiumResponse.response}
                onUpgrade={() => onUpgradeClick?.()}
                onClose={freemium.clearResponse}
              />
            </div>
          )}

          {/* Suggestions Dropdown */}
          {showSuggestions && (suggestions.length > 0 || isLoadingSuggestions) && (
            <div className="mb-2 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl">
              {isLoadingSuggestions && suggestions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading suggestions...
                </div>
              ) : (
                suggestions.map((suggestion, index) => {
                  const isSelected = index === selectedSuggestionIndex;
                  const typeIcons = {
                    pattern: '📋',
                    wisdom: '💡',
                    gotcha: '⚠️',
                    query: '🔍',
                  };
                  const typeLabels = {
                    pattern: 'Pattern',
                    wisdom: 'Wisdom',
                    gotcha: 'Gotcha',
                    query: 'Query',
                  };

                  return (
                    <button
                      key={index}
                      onClick={() => {
                        setInput(suggestion.text);
                        setShowSuggestions(false);
                        setSelectedSuggestionIndex(-1);
                        inputRef.current?.focus();
                      }}
                      onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-3 ${
                        isSelected ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <span className="text-base">{typeIcons[suggestion.type]}</span>
                      <div className="flex-1">
                        <div className="font-medium">{suggestion.text}</div>
                        <div className="text-xs opacity-75 mt-0.5">
                          {typeLabels[suggestion.type]}
                          {suggestion.metadata?.domain ? ` • ${String(suggestion.metadata.domain)}` : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          <div className="flex gap-3 items-end">
            {/* Mode Icon */}
            <div className="flex-shrink-0">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  mode === 'search'
                    ? 'bg-blue-600'
                    : mode === 'assist'
                      ? 'bg-purple-600'
                      : 'bg-green-600'
                }`}
              >
                <currentModeConfig.icon className="w-5 h-5 text-white" />
              </div>
            </div>

            {/* Input Area */}
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`${currentModeConfig.description}... (Use /search, /assist, or /build to switch modes)`}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={3}
                maxLength={5000}
                disabled={isLoading || rateLimit?.allowed === false}
              />
              <div className="flex justify-between items-center mt-2 px-2">
                <span className="text-xs text-gray-500">{input.length} / 5000 characters</span>
                <span className="text-xs text-gray-500">
                  Press Enter to send, Shift+Enter for new line
                </span>
                {rateLimit?.allowed === false && (
                  <span className="text-xs text-red-400">Rate limit exceeded</span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {/* Cancel Button (shown when loading) */}
              {isLoading && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-semibold transition-all shadow-lg shadow-red-500/30 flex items-center gap-2 text-white"
                  title="Cancel request"
                >
                  <XCircle className="w-5 h-5" />
                  <span>Cancel</span>
                </button>
              )}

              {/* Voice Input (Future) */}
              {!isLoading && (
                <button
                  className="px-4 py-3 bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={true}
                  title="Voice input (coming soon)"
                >
                  <Mic className="w-5 h-5 text-gray-400" />
                </button>
              )}

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || rateLimit?.allowed === false}
                className={`px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-600 disabled:cursor-not-allowed rounded-xl font-semibold transition-all shadow-lg shadow-purple-500/30 flex items-center gap-2`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
