'use client';

/**
 * Assistant Context Provider
 *
 * Provides global access to the Infinity Assistant across all pages.
 * Manages assistant state, orchestration, and the chat bubble.
 *
 * Features:
 * - Global assistant availability
 * - Context-aware help
 * - Builder integration
 * - Proactive notifications
 * - Conversation history
 *
 * @since 2025-12-01
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import {
  assistantOrchestration,
  type AssistantContext as AssistantContextType,
  type OrchestrationResult,
} from '@/services/AssistantOrchestrationService';
import { AssistantChatBubble } from '@/components/AssistantChatBubble';

// Types
interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  orchestrationUsed?: boolean;
  sources?: string[];
  suggestions?: string[];
}

interface Notification {
  id: string;
  type: 'info' | 'help' | 'success' | 'warning';
  message: string;
  action?: string;
  dismissed: boolean;
  createdAt: Date;
}

interface AssistantState {
  isAvailable: boolean;
  isProcessing: boolean;
  currentContext: string;
  isBuilderMode: boolean;
  builderPhase?: string;
  conversations: ConversationMessage[];
  notifications: Notification[];
  hasUnreadNotifications: boolean;
}

interface AssistantContextValue {
  state: AssistantState;
  // Actions
  sendMessage: (message: string) => Promise<OrchestrationResult>;
  setContext: (context: string) => void;
  setBuilderMode: (isBuilder: boolean, phase?: string) => void;
  clearConversation: () => void;
  dismissNotification: (id: string) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'dismissed' | 'createdAt'>) => void;
  // Builder integration
  requestBuilderAssist: (request: string) => Promise<void>;
  pauseBuilder: () => void;
  resumeBuilder: () => void;
  // Quick actions
  showHelp: (topic?: string) => void;
  troubleshoot: (issue: string) => Promise<void>;
  explainPhase: (phase: string) => Promise<void>;
  // UI controls
  openChat: () => void;
  closeChat: () => void;
  minimizeChat: () => void;
  expandToFullChat: () => void;
}

const defaultState: AssistantState = {
  isAvailable: true,
  isProcessing: false,
  currentContext: 'default',
  isBuilderMode: false,
  conversations: [],
  notifications: [],
  hasUnreadNotifications: false,
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

interface AssistantProviderProps {
  children: ReactNode;
  /** Whether to show the floating chat bubble */
  showBubble?: boolean;
  /** Initial context for the assistant */
  initialContext?: string;
  /** Callback when user wants to expand to full chat page */
  onExpandToFullChat?: () => void;
  /** Custom positioning for the bubble */
  bubblePosition?: 'bottom-right' | 'bottom-left';
}

export function AssistantProvider({
  children,
  showBubble = true,
  initialContext = 'default',
  onExpandToFullChat,
  bubblePosition = 'bottom-right',
}: AssistantProviderProps) {
  const [state, setState] = useState<AssistantState>({
    ...defaultState,
    currentContext: initialContext,
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const sessionId = useRef(`session_${Date.now()}`);
  const userId = useRef('current-user'); // In production, get from auth

  // Build assistant context for orchestration
  const buildOrchestrationContext = useCallback((): AssistantContextType => {
    return {
      userId: userId.current,
      sessionId: sessionId.current,
      pageContext: state.currentContext,
      isBuilderMode: state.isBuilderMode,
      builderPhase: state.builderPhase,
      previousInteractions: state.conversations
        .filter(c => c.role === 'user')
        .slice(-5)
        .map(c => c.content),
      userPreferences: {},
    };
  }, [state.currentContext, state.isBuilderMode, state.builderPhase, state.conversations]);

  // Send message to assistant
  const sendMessage = useCallback(async (message: string): Promise<OrchestrationResult> => {
    // Add user message
    const userMessage: ConversationMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      isProcessing: true,
      conversations: [...prev.conversations, userMessage],
    }));

    try {
      // Process through orchestration
      const context = buildOrchestrationContext();
      const result = await assistantOrchestration.processQuery(message, context);

      // Add assistant response
      const assistantMessage: ConversationMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        orchestrationUsed: result.confidence > 0.8,
        sources: result.sources,
        suggestions: result.followUpQuestions,
      };

      setState(prev => ({
        ...prev,
        isProcessing: false,
        conversations: [...prev.conversations, assistantMessage],
      }));

      return result;
    } catch (error) {
      setState(prev => ({ ...prev, isProcessing: false }));
      throw error;
    }
  }, [buildOrchestrationContext]);

  // Set page context
  const setContext = useCallback((context: string) => {
    setState(prev => ({ ...prev, currentContext: context }));
  }, []);

  // Set builder mode
  const setBuilderMode = useCallback((isBuilder: boolean, phase?: string) => {
    setState(prev => ({
      ...prev,
      isBuilderMode: isBuilder,
      builderPhase: phase,
    }));

    // Add proactive notification when entering builder mode
    if (isBuilder && !state.isBuilderMode) {
      addNotification({
        type: 'info',
        message: "I'm here to help with your build! Just ask if you need anything.",
        action: 'Got it',
      });
    }
  }, [state.isBuilderMode]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setState(prev => ({ ...prev, conversations: [] }));
  }, []);

  // Notification management
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'dismissed' | 'createdAt'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}`,
      dismissed: false,
      createdAt: new Date(),
    };

    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, newNotification],
      hasUnreadNotifications: true,
    }));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n =>
        n.id === id ? { ...n, dismissed: true } : n
      ),
      hasUnreadNotifications: prev.notifications.some(n => n.id !== id && !n.dismissed),
    }));
  }, []);

  // Builder integration
  const requestBuilderAssist = useCallback(async (request: string) => {
    // Special handling for builder assistance requests
    const context = buildOrchestrationContext();
    context.isBuilderMode = true;

    await assistantOrchestration.processQuery(
      `[Builder Assist] ${request}`,
      context
    );

    addNotification({
      type: 'success',
      message: `Added to build tasks: ${request}`,
    });
  }, [buildOrchestrationContext, addNotification]);

  const pauseBuilder = useCallback(() => {
    addNotification({
      type: 'info',
      message: 'Build paused. Let me know when you want to resume.',
    });
  }, [addNotification]);

  const resumeBuilder = useCallback(() => {
    addNotification({
      type: 'info',
      message: 'Resuming build...',
    });
  }, [addNotification]);

  // Quick actions
  const showHelp = useCallback((topic?: string) => {
    const helpMessage = topic
      ? `Help me understand ${topic}`
      : 'I need help getting started';
    sendMessage(helpMessage);
    setIsChatOpen(true);
  }, [sendMessage]);

  const troubleshoot = useCallback(async (issue: string) => {
    await sendMessage(`I'm having an issue: ${issue}`);
    setIsChatOpen(true);
  }, [sendMessage]);

  const explainPhase = useCallback(async (phase: string) => {
    await sendMessage(`Explain what happens in the ${phase} phase`);
    setIsChatOpen(true);
  }, [sendMessage]);

  // UI controls
  const openChat = useCallback(() => setIsChatOpen(true), []);
  const closeChat = useCallback(() => setIsChatOpen(false), []);
  const minimizeChat = useCallback(() => {
    // Chat bubble handles its own minimize state
  }, []);
  const expandToFullChat = useCallback(() => {
    onExpandToFullChat?.();
  }, [onExpandToFullChat]);

  // Proactive help based on context changes
  useEffect(() => {
    // Check if user might need help based on time spent on a page
    const helpTimer = setTimeout(() => {
      if (state.currentContext === 'api-setup' && state.conversations.length === 0) {
        addNotification({
          type: 'help',
          message: 'Need help setting up your APIs? I can guide you through it.',
          action: 'Show me',
        });
      }
    }, 30000); // 30 seconds

    return () => clearTimeout(helpTimer);
  }, [state.currentContext, state.conversations.length, addNotification]);

  const value: AssistantContextValue = {
    state,
    sendMessage,
    setContext,
    setBuilderMode,
    clearConversation,
    dismissNotification,
    addNotification,
    requestBuilderAssist,
    pauseBuilder,
    resumeBuilder,
    showHelp,
    troubleshoot,
    explainPhase,
    openChat,
    closeChat,
    minimizeChat,
    expandToFullChat,
  };

  return (
    <AssistantContext.Provider value={value}>
      {children}

      {/* Global Chat Bubble */}
      {showBubble && (
        <AssistantChatBubble
          pageContext={state.currentContext}
          isBuilderMode={state.isBuilderMode}
          builderPhase={state.builderPhase}
          hasNotification={state.hasUnreadNotifications}
          notificationCount={state.notifications.filter(n => !n.dismissed).length}
          position={bubblePosition}
          onExpandToFullChat={expandToFullChat}
          onBuilderAssist={requestBuilderAssist}
        />
      )}
    </AssistantContext.Provider>
  );
}

/**
 * Hook to access assistant context
 */
export function useAssistant(): AssistantContextValue {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}

/**
 * Hook for quick assistant actions
 */
export function useAssistantActions() {
  const {
    sendMessage,
    showHelp,
    troubleshoot,
    explainPhase,
    requestBuilderAssist,
    openChat,
  } = useAssistant();

  return {
    ask: sendMessage,
    help: showHelp,
    troubleshoot,
    explainPhase,
    requestBuilderAssist,
    openChat,
  };
}

/**
 * Hook for builder-specific assistant features
 */
export function useBuilderAssistant() {
  const {
    state,
    setBuilderMode,
    requestBuilderAssist,
    pauseBuilder,
    resumeBuilder,
    explainPhase,
  } = useAssistant();

  return {
    isBuilderMode: state.isBuilderMode,
    currentPhase: state.builderPhase,
    setBuilderMode,
    requestAssist: requestBuilderAssist,
    pause: pauseBuilder,
    resume: resumeBuilder,
    explainPhase,
  };
}

export default AssistantProvider;
