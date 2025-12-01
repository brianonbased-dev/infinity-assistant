/**
 * useConversationFlow Hook
 *
 * React hook for managing the Assistant → CEO → Futurist conversation flow.
 * Provides real-time updates, message handling, and decision escalation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  buildProgressService,
  type BuildProgressEvent,
} from '@/services/BuildProgressService';
import type {
  BuildConversation,
  ConversationMessage,
  ConversationRole,
  ConversationTopic,
  ConversationResolution,
  ActionSuggestion,
} from '@/types/build-progress';

// ============================================================================
// TYPES
// ============================================================================

export interface ConversationFlowState {
  conversations: BuildConversation[];
  activeConversation: BuildConversation | null;
  isLoading: boolean;
  error: string | null;
  pendingResponse: ConversationRole | null;
}

export interface ConversationFlowActions {
  startConversation: (topic: ConversationTopic, message: string, checkpointId?: string) => Promise<BuildConversation>;
  sendMessage: (content: string, attachments?: MessageAttachment[]) => Promise<ConversationMessage>;
  escalate: (reason: string) => Promise<void>;
  resolve: (decision: ConversationResolution['decision'], reason: string) => Promise<void>;
  selectConversation: (conversation: BuildConversation | null) => void;
  executeAction: (suggestion: ActionSuggestion) => Promise<void>;
  refresh: () => void;
}

export interface MessageAttachment {
  type: 'evidence' | 'checkpoint' | 'file' | 'link';
  id: string;
  title: string;
}

export interface UseConversationFlowResult extends ConversationFlowState, ConversationFlowActions {
  personas: typeof PERSONA_INFO;
  getPersonaForRole: (role: ConversationRole) => PersonaInfo;
  canEscalate: boolean;
  suggestedActions: ActionSuggestion[];
}

// ============================================================================
// PERSONA INFORMATION
// ============================================================================

export interface PersonaInfo {
  role: ConversationRole;
  name: string;
  title: string;
  avatar: string;
  color: string;
  focus: string[];
  capabilities: string[];
  escalatesTo?: ConversationRole;
}

const PERSONA_INFO: Record<Exclude<ConversationRole, 'user'>, PersonaInfo> = {
  assistant: {
    role: 'assistant',
    name: 'Builder Assistant',
    title: 'Technical Implementation Lead',
    avatar: '🤖',
    color: '#00ff88',
    focus: [
      'Code quality and best practices',
      'Technical feasibility assessment',
      'Implementation details and architecture',
      'Bug fixes and optimizations',
      'Performance improvements',
    ],
    capabilities: [
      'Write and modify code',
      'Run tests and builds',
      'Create documentation',
      'Suggest optimizations',
      'Review pull requests',
    ],
    escalatesTo: 'ceo',
  },
  ceo: {
    role: 'ceo',
    name: 'Strategic Advisor',
    title: 'Chief Executive Officer',
    avatar: '👔',
    color: '#ffd700',
    focus: [
      'Business value and ROI',
      'User experience impact',
      'Resource allocation',
      'Timeline and priorities',
      'Risk assessment',
    ],
    capabilities: [
      'Approve/reject features',
      'Prioritize backlog',
      'Allocate resources',
      'Define success metrics',
      'Make go/no-go decisions',
    ],
    escalatesTo: 'futurist',
  },
  futurist: {
    role: 'futurist',
    name: 'Vision Architect',
    title: 'Chief Futurist',
    avatar: '🔮',
    color: '#ff6b6b',
    focus: [
      'Long-term vision alignment',
      'Innovation opportunities',
      'Market trends and positioning',
      'Scalability and future-proofing',
      'Strategic partnerships',
    ],
    capabilities: [
      'Set strategic direction',
      'Approve major pivots',
      'Guide innovation investments',
      'Define long-term architecture',
      'Advise on market positioning',
    ],
  },
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useConversationFlow(buildId: string): UseConversationFlowResult {
  const [state, setState] = useState<ConversationFlowState>({
    conversations: [],
    activeConversation: null,
    isLoading: false,
    error: null,
    pendingResponse: null,
  });

  const buildRef = useRef(buildId);
  buildRef.current = buildId;

  // Subscribe to build events
  useEffect(() => {
    const build = buildProgressService.getBuild(buildId);
    if (build) {
      setState((prev) => ({
        ...prev,
        conversations: build.conversations,
      }));
    }

    const unsubscribe = buildProgressService.subscribe(buildId, (event) => {
      handleBuildEvent(event);
    });

    return () => unsubscribe();
  }, [buildId]);

  // Handle build events
  const handleBuildEvent = useCallback((event: BuildProgressEvent) => {
    switch (event.type) {
      case 'conversation_started':
        setState((prev) => ({
          ...prev,
          conversations: [...prev.conversations, event.conversation],
        }));
        break;

      case 'message_added':
        setState((prev) => {
          const conversations = prev.conversations.map((conv) => {
            if (conv.id === event.conversationId) {
              return {
                ...conv,
                messages: [...conv.messages, event.message],
              };
            }
            return conv;
          });

          const activeConversation = prev.activeConversation?.id === event.conversationId
            ? conversations.find((c) => c.id === event.conversationId) || null
            : prev.activeConversation;

          return {
            ...prev,
            conversations,
            activeConversation,
            pendingResponse: null,
          };
        });
        break;

      case 'conversation_escalated':
        setState((prev) => ({
          ...prev,
          pendingResponse: event.to,
        }));
        break;

      case 'conversation_resolved':
        setState((prev) => {
          const conversations = prev.conversations.map((conv) => {
            if (conv.id === event.conversationId) {
              return {
                ...conv,
                status: 'resolved' as const,
                resolution: event.resolution,
              };
            }
            return conv;
          });

          return {
            ...prev,
            conversations,
            activeConversation: prev.activeConversation?.id === event.conversationId
              ? { ...prev.activeConversation, status: 'resolved', resolution: event.resolution }
              : prev.activeConversation,
          };
        });
        break;
    }
  }, []);

  // Start a new conversation
  const startConversation = useCallback(async (
    topic: ConversationTopic,
    message: string,
    checkpointId?: string
  ): Promise<BuildConversation> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const conversation = await buildProgressService.startConversation(
        buildRef.current,
        topic,
        message,
        checkpointId
      );

      setState((prev) => ({
        ...prev,
        isLoading: false,
        activeConversation: conversation,
        pendingResponse: 'assistant',
      }));

      return conversation;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to start conversation',
      }));
      throw error;
    }
  }, []);

  // Send a message in active conversation
  const sendMessage = useCallback(async (
    content: string,
    attachments?: MessageAttachment[]
  ): Promise<ConversationMessage> => {
    if (!state.activeConversation) {
      throw new Error('No active conversation');
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const message = await buildProgressService.addMessage(
        state.activeConversation.id,
        'user',
        content,
        attachments as any
      );

      // Trigger assistant response
      setState((prev) => ({ ...prev, pendingResponse: 'assistant' }));

      setTimeout(async () => {
        if (state.activeConversation) {
          await buildProgressService.generatePersonaResponse(
            state.activeConversation,
            'assistant'
          );
        }
      }, 500);

      setState((prev) => ({ ...prev, isLoading: false }));

      return message;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      }));
      throw error;
    }
  }, [state.activeConversation]);

  // Escalate conversation
  const escalate = useCallback(async (reason: string): Promise<void> => {
    if (!state.activeConversation) {
      throw new Error('No active conversation');
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await buildProgressService.escalateConversation(
        state.activeConversation.id,
        reason
      );

      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to escalate',
      }));
      throw error;
    }
  }, [state.activeConversation]);

  // Resolve conversation
  const resolve = useCallback(async (
    decision: ConversationResolution['decision'],
    reason: string
  ): Promise<void> => {
    if (!state.activeConversation) {
      throw new Error('No active conversation');
    }

    const lastMessage = state.activeConversation.messages[state.activeConversation.messages.length - 1];
    const resolvedBy = lastMessage.role === 'user' ? 'assistant' : lastMessage.role;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await buildProgressService.resolveConversation(
        state.activeConversation.id,
        {
          decision,
          resolvedBy: resolvedBy as Exclude<ConversationRole, 'user'>,
          reason,
          actions: [],
        }
      );

      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to resolve',
      }));
      throw error;
    }
  }, [state.activeConversation]);

  // Select a conversation
  const selectConversation = useCallback((conversation: BuildConversation | null): void => {
    setState((prev) => ({ ...prev, activeConversation: conversation }));
  }, []);

  // Execute a suggested action
  const executeAction = useCallback(async (suggestion: ActionSuggestion): Promise<void> => {
    if (!state.activeConversation) {
      throw new Error('No active conversation');
    }

    switch (suggestion.action) {
      case 'approve':
        await resolve('approved', 'Approved based on review');
        break;

      case 'reject':
        await resolve('rejected', 'Rejected based on review');
        break;

      case 'modify':
        await sendMessage('I would like to request the following modifications...');
        break;

      case 'escalate':
        await escalate('Escalating for higher-level review');
        break;

      case 'revert':
        // Would trigger checkpoint revert
        await sendMessage('Requesting revert to previous checkpoint');
        break;

      case 'defer':
        await resolve('deferred', 'Decision deferred for later');
        break;
    }
  }, [state.activeConversation, resolve, sendMessage, escalate]);

  // Refresh conversations
  const refresh = useCallback((): void => {
    const build = buildProgressService.getBuild(buildRef.current);
    if (build) {
      setState((prev) => ({
        ...prev,
        conversations: build.conversations,
        activeConversation: prev.activeConversation
          ? build.conversations.find((c) => c.id === prev.activeConversation?.id) || null
          : null,
      }));
    }
  }, []);

  // Get persona info for a role
  const getPersonaForRole = useCallback((role: ConversationRole): PersonaInfo => {
    if (role === 'user') {
      return {
        role: 'user',
        name: 'You',
        title: 'Project Owner',
        avatar: '👤',
        color: '#00b4d8',
        focus: [],
        capabilities: [],
      };
    }
    return PERSONA_INFO[role];
  }, []);

  // Check if can escalate
  const canEscalate = state.activeConversation
    ? (() => {
        const lastMessage = state.activeConversation.messages[state.activeConversation.messages.length - 1];
        if (lastMessage.role === 'user') return true;
        const persona = PERSONA_INFO[lastMessage.role as keyof typeof PERSONA_INFO];
        return !!persona?.escalatesTo;
      })()
    : false;

  // Get suggested actions from last message
  const suggestedActions = state.activeConversation?.messages.length
    ? state.activeConversation.messages[state.activeConversation.messages.length - 1].suggestions || []
    : [];

  return {
    // State
    ...state,
    personas: PERSONA_INFO,

    // Actions
    startConversation,
    sendMessage,
    escalate,
    resolve,
    selectConversation,
    executeAction,
    refresh,

    // Helpers
    getPersonaForRole,
    canEscalate,
    suggestedActions,
  };
}

// ============================================================================
// CONVERSATION TOPIC HELPERS
// ============================================================================

export const CONVERSATION_TOPICS: Record<ConversationTopic, {
  name: string;
  description: string;
  suggestedStarter: string;
  defaultResponder: ConversationRole;
}> = {
  implementation_question: {
    name: 'Implementation Question',
    description: 'Ask about technical implementation details',
    suggestedStarter: 'I have a question about how to implement...',
    defaultResponder: 'assistant',
  },
  design_decision: {
    name: 'Design Decision',
    description: 'Discuss UI/UX or architectural design choices',
    suggestedStarter: 'I need help deciding between...',
    defaultResponder: 'assistant',
  },
  approval_request: {
    name: 'Approval Request',
    description: 'Request approval for a change or feature',
    suggestedStarter: 'I would like approval to proceed with...',
    defaultResponder: 'ceo',
  },
  issue_report: {
    name: 'Issue Report',
    description: 'Report a bug or problem encountered',
    suggestedStarter: 'I found an issue with...',
    defaultResponder: 'assistant',
  },
  change_request: {
    name: 'Change Request',
    description: 'Request a change to the current implementation',
    suggestedStarter: 'I would like to change...',
    defaultResponder: 'assistant',
  },
  strategic_review: {
    name: 'Strategic Review',
    description: 'Review business strategy and priorities',
    suggestedStarter: 'I need strategic guidance on...',
    defaultResponder: 'ceo',
  },
  future_consideration: {
    name: 'Future Consideration',
    description: 'Discuss long-term vision and future features',
    suggestedStarter: 'Looking ahead, I think we should consider...',
    defaultResponder: 'futurist',
  },
};

// ============================================================================
// QUICK ACTIONS HELPER
// ============================================================================

export function getQuickActions(
  conversation: BuildConversation | null,
  currentRole: ConversationRole
): ActionSuggestion[] {
  if (!conversation) return [];

  const baseActions: ActionSuggestion[] = [];

  // Common actions
  if (conversation.status === 'active') {
    baseActions.push({
      id: 'approve',
      action: 'approve',
      label: 'Approve',
      description: 'Approve the current approach',
      impact: 'medium',
      automated: true,
    });

    baseActions.push({
      id: 'modify',
      action: 'modify',
      label: 'Request Changes',
      description: 'Request modifications before proceeding',
      impact: 'medium',
      automated: false,
    });
  }

  // Escalation (if not at futurist level)
  if (currentRole !== 'futurist') {
    const nextLevel = currentRole === 'assistant' ? 'CEO' : 'Futurist';
    baseActions.push({
      id: 'escalate',
      action: 'escalate',
      label: `Escalate to ${nextLevel}`,
      description: `Get ${nextLevel} input on this decision`,
      impact: 'low',
      automated: true,
    });
  }

  // Revert option if checkpoint exists
  if (conversation.checkpointId) {
    baseActions.push({
      id: 'revert',
      action: 'revert',
      label: 'Revert to Checkpoint',
      description: 'Roll back to the last checkpoint',
      impact: 'high',
      automated: true,
    });
  }

  return baseActions;
}

export default useConversationFlow;
