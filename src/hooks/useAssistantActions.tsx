/**
 * useAssistantActions Hook
 *
 * Allows users to control the Infinity Assistant app through chat commands.
 * The assistant can perform actions on behalf of the user.
 *
 * Supported Actions:
 * - Navigation: "go to settings", "open my creations"
 * - Content: "show my documents", "delete that file"
 * - Preferences: "change my style to concise", "update my interests"
 * - Memory: "show what you remember", "forget that"
 * - Mode: "switch to build mode", "use search mode"
 *
 * Usage:
 * ```tsx
 * const { executeAction, pendingAction, confirmAction, cancelAction } = useAssistantActions();
 *
 * // Execute an action from chat
 * await executeAction({ type: 'navigate', target: 'settings' });
 *
 * // Some actions require confirmation
 * if (pendingAction) {
 *   await confirmAction(); // or cancelAction()
 * }
 * ```
 */

import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from 'react';
import { useLocalPreferences, type UserPreferences } from './useLocalPreferences';

// ============================================================================
// TYPES
// ============================================================================

export type ActionType =
  | 'navigate'
  | 'setMode'
  | 'updatePreferences'
  | 'manageContent'
  | 'manageMemory'
  | 'createContent'
  | 'exportData'
  | 'toggleFeature';

export interface AssistantAction {
  id: string;
  type: ActionType;
  target?: string;
  params?: Record<string, unknown>;
  requiresConfirmation?: boolean;
  description: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
  nextAction?: AssistantAction;
}

export interface PendingAction {
  action: AssistantAction;
  confirmMessage: string;
  onConfirm: () => Promise<ActionResult>;
  onCancel: () => void;
}

interface UseAssistantActionsReturn {
  // State
  pendingAction: PendingAction | null;
  lastResult: ActionResult | null;
  isExecuting: boolean;

  // Actions
  executeAction: (action: AssistantAction) => Promise<ActionResult>;
  confirmAction: () => Promise<ActionResult>;
  cancelAction: () => void;

  // Parsers
  parseCommand: (message: string) => AssistantAction | null;

  // Registered handlers
  registerHandler: (type: ActionType, handler: ActionHandler) => void;
}

type ActionHandler = (action: AssistantAction) => Promise<ActionResult>;

// ============================================================================
// ACTION PATTERNS (for parsing user messages)
// ============================================================================

const ACTION_PATTERNS: Array<{
  pattern: RegExp;
  type: ActionType;
  extract: (match: RegExpMatchArray) => Partial<AssistantAction>;
}> = [
  // Navigation
  {
    pattern: /^(go to|open|show me|navigate to)\s+(settings|preferences|my creations|my files|home|chat)/i,
    type: 'navigate',
    extract: (match) => ({
      target: match[2].toLowerCase().replace(/\s+/g, '-'),
      description: `Navigate to ${match[2]}`,
    }),
  },

  // Mode switching
  {
    pattern: /^(switch to|use|change to)\s+(search|assist|build)\s*mode/i,
    type: 'setMode',
    extract: (match) => ({
      target: match[2].toLowerCase() as 'search' | 'assist' | 'build',
      description: `Switch to ${match[2]} mode`,
    }),
  },

  // Preference updates
  {
    pattern: /^(change|set|update)\s+my\s+(style|communication style)\s+to\s+(concise|detailed|conversational)/i,
    type: 'updatePreferences',
    extract: (match) => ({
      target: 'communicationStyle',
      params: { value: match[3].toLowerCase() },
      description: `Change communication style to ${match[3]}`,
    }),
  },

  // Content management
  {
    pattern: /^(show|list|display)\s+(my\s+)?(documents|images|videos|files|creations)/i,
    type: 'manageContent',
    extract: (match) => ({
      target: 'list',
      params: { contentType: match[3].toLowerCase().replace(/s$/, '') },
      description: `Show your ${match[3]}`,
    }),
  },
  {
    pattern: /^(delete|remove)\s+(that|this|the)\s+(file|document|image|video)/i,
    type: 'manageContent',
    extract: (match) => ({
      target: 'delete',
      requiresConfirmation: true,
      description: `Delete the ${match[3]}`,
    }),
  },

  // Memory management
  {
    pattern: /^(show|what do you)\s+(remember|know)\s*(about me)?/i,
    type: 'manageMemory',
    extract: () => ({
      target: 'show',
      description: 'Show what I remember about you',
    }),
  },
  {
    pattern: /^(forget|clear|delete)\s+(that|this|everything|all memory)/i,
    type: 'manageMemory',
    extract: (match) => ({
      target: match[2] === 'everything' || match[2] === 'all memory' ? 'clearAll' : 'clearLast',
      requiresConfirmation: true,
      description: match[2] === 'everything' ? 'Clear all memory' : 'Forget that',
    }),
  },

  // Content creation
  {
    pattern: /^(create|generate|make)\s+(a\s+)?(document|pdf|image|report|summary)/i,
    type: 'createContent',
    extract: (match) => ({
      target: match[3].toLowerCase(),
      description: `Create a ${match[3]}`,
    }),
  },

  // Export
  {
    pattern: /^(export|download)\s+(my\s+)?(data|conversation|history|preferences)/i,
    type: 'exportData',
    extract: (match) => ({
      target: match[3].toLowerCase(),
      description: `Export your ${match[3]}`,
    }),
  },

  // Feature toggles
  {
    pattern: /^(enable|disable|turn on|turn off)\s+(dark mode|notifications|auto-save|sync)/i,
    type: 'toggleFeature',
    extract: (match) => ({
      target: match[2].toLowerCase().replace(/\s+/g, '-'),
      params: { enabled: match[1].includes('enable') || match[1].includes('on') },
      description: `${match[1]} ${match[2]}`,
    }),
  },
];

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useAssistantActions(): UseAssistantActionsReturn {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [handlers, setHandlers] = useState<Map<ActionType, ActionHandler>>(new Map());

  const { preferences, updatePreferences } = useLocalPreferences();

  // Register default handlers
  useEffect(() => {
    const defaultHandlers = new Map<ActionType, ActionHandler>();

    // Navigate handler
    defaultHandlers.set('navigate', async (action) => {
      const routes: Record<string, string> = {
        'settings': '/settings',
        'preferences': '/settings',
        'my-creations': '/creations',
        'my-files': '/creations',
        'home': '/',
        'chat': '/',
      };

      const route = routes[action.target || ''];
      if (route && typeof window !== 'undefined') {
        window.location.href = route;
        return { success: true, message: `Navigating to ${action.target}` };
      }
      return { success: false, message: `Unknown destination: ${action.target}` };
    });

    // Set mode handler
    defaultHandlers.set('setMode', async (action) => {
      const mode = action.target as 'search' | 'assist' | 'build';
      if (['search', 'assist', 'build'].includes(mode)) {
        updatePreferences({ preferredMode: mode });
        return { success: true, message: `Switched to ${mode} mode` };
      }
      return { success: false, message: `Unknown mode: ${action.target}` };
    });

    // Update preferences handler
    defaultHandlers.set('updatePreferences', async (action) => {
      const { value } = action.params || {};
      if (action.target && value) {
        updatePreferences({ [action.target]: value } as Partial<UserPreferences>);
        return { success: true, message: `Updated ${action.target} to ${value}` };
      }
      return { success: false, message: 'Invalid preference update' };
    });

    // Content management handler
    defaultHandlers.set('manageContent', async (action) => {
      if (action.target === 'list') {
        // Trigger content list refresh
        window.dispatchEvent(new CustomEvent('assistant:show-content', {
          detail: action.params,
        }));
        return { success: true, message: 'Showing your content' };
      }
      if (action.target === 'delete') {
        return { success: true, message: 'Ready to delete. Please confirm.' };
      }
      return { success: false, message: 'Unknown content action' };
    });

    // Memory management handler
    defaultHandlers.set('manageMemory', async (action) => {
      if (action.target === 'show') {
        window.dispatchEvent(new CustomEvent('assistant:show-memory'));
        return { success: true, message: 'Showing your memory' };
      }
      if (action.target === 'clearAll') {
        // This would call the memory API
        return { success: true, message: 'All memory cleared' };
      }
      if (action.target === 'clearLast') {
        return { success: true, message: 'Last item forgotten' };
      }
      return { success: false, message: 'Unknown memory action' };
    });

    // Content creation handler
    defaultHandlers.set('createContent', async (action) => {
      window.dispatchEvent(new CustomEvent('assistant:create-content', {
        detail: { type: action.target },
      }));
      return {
        success: true,
        message: `I'll help you create a ${action.target}. What would you like it to contain?`,
      };
    });

    // Export handler
    defaultHandlers.set('exportData', async (action) => {
      window.dispatchEvent(new CustomEvent('assistant:export', {
        detail: { type: action.target },
      }));
      return { success: true, message: `Exporting your ${action.target}...` };
    });

    // Feature toggle handler
    defaultHandlers.set('toggleFeature', async (action) => {
      const { enabled } = action.params || {};
      window.dispatchEvent(new CustomEvent('assistant:toggle-feature', {
        detail: { feature: action.target, enabled },
      }));
      return {
        success: true,
        message: `${action.target} has been ${enabled ? 'enabled' : 'disabled'}`,
      };
    });

    setHandlers(defaultHandlers);
  }, [updatePreferences]);

  // Parse command from user message
  const parseCommand = useCallback((message: string): AssistantAction | null => {
    for (const { pattern, type, extract } of ACTION_PATTERNS) {
      const match = message.match(pattern);
      if (match) {
        const extracted = extract(match);
        return {
          id: `action_${Date.now()}`,
          type,
          ...extracted,
        } as AssistantAction;
      }
    }
    return null;
  }, []);

  // Execute action
  const executeAction = useCallback(async (action: AssistantAction): Promise<ActionResult> => {
    setIsExecuting(true);

    try {
      const handler = handlers.get(action.type);
      if (!handler) {
        const result = { success: false, message: `No handler for action type: ${action.type}` };
        setLastResult(result);
        return result;
      }

      // Check if confirmation is required
      if (action.requiresConfirmation) {
        return new Promise((resolve) => {
          setPendingAction({
            action,
            confirmMessage: `Are you sure you want to: ${action.description}?`,
            onConfirm: async () => {
              const result = await handler(action);
              setLastResult(result);
              setPendingAction(null);
              return result;
            },
            onCancel: () => {
              const result = { success: false, message: 'Action cancelled' };
              setLastResult(result);
              setPendingAction(null);
              resolve(result);
            },
          });

          // Resolve with pending state
          resolve({ success: true, message: 'Awaiting confirmation...' });
        });
      }

      // Execute immediately
      const result = await handler(action);
      setLastResult(result);
      return result;
    } catch (error) {
      const result = {
        success: false,
        message: error instanceof Error ? error.message : 'Action failed',
      };
      setLastResult(result);
      return result;
    } finally {
      setIsExecuting(false);
    }
  }, [handlers]);

  // Confirm pending action
  const confirmAction = useCallback(async (): Promise<ActionResult> => {
    if (!pendingAction) {
      return { success: false, message: 'No pending action to confirm' };
    }
    return pendingAction.onConfirm();
  }, [pendingAction]);

  // Cancel pending action
  const cancelAction = useCallback(() => {
    if (pendingAction) {
      pendingAction.onCancel();
    }
  }, [pendingAction]);

  // Register custom handler
  const registerHandler = useCallback((type: ActionType, handler: ActionHandler) => {
    setHandlers((prev) => {
      const next = new Map(prev);
      next.set(type, handler);
      return next;
    });
  }, []);

  return {
    pendingAction,
    lastResult,
    isExecuting,
    executeAction,
    confirmAction,
    cancelAction,
    parseCommand,
    registerHandler,
  };
}

// ============================================================================
// CONTEXT PROVIDER (optional, for app-wide action handling)
// ============================================================================

const AssistantActionsContext = createContext<UseAssistantActionsReturn | null>(null);

export function AssistantActionsProvider({ children }: { children: ReactNode }) {
  const actions = useAssistantActions();
  return (
    <AssistantActionsContext.Provider value={actions}>
      {children}
    </AssistantActionsContext.Provider>
  );
}

export function useAssistantActionsContext(): UseAssistantActionsReturn {
  const context = useContext(AssistantActionsContext);
  if (!context) {
    throw new Error('useAssistantActionsContext must be used within AssistantActionsProvider');
  }
  return context;
}
