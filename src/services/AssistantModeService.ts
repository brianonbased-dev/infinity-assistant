/**
 * Assistant Mode Service
 *
 * Manages the dynamic switching between Assistant modes:
 * - Assist Mode: Helps when asked, more hands-off, responsive
 * - Companion Mode: White-glove orchestrator, proactive, full automation
 *
 * The mode is determined dynamically based on:
 * - User's onboarding preferences
 * - Current situation/context
 * - Explicit user requests
 * - Task complexity
 *
 * Assistant is ALWAYS available regardless of Builder mode.
 * Browser tools from uaa2-service enable full automation in Companion mode.
 *
 * @since 2025-12-01
 */

import logger from '@/utils/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AssistantMode = 'assist' | 'companion';

export interface AssistantModeConfig {
  mode: AssistantMode;
  proactiveLevel: number; // 0-1, how proactive the assistant should be
  automationLevel: number; // 0-1, how much to automate
  browserToolsEnabled: boolean;
  explanationDepth: 'minimal' | 'standard' | 'detailed';
  interruptionThreshold: number; // 0-1, when to interrupt user
  systemPrompt: string;
}

export interface ModeContext {
  userId: string;
  currentTask?: string;
  taskComplexity?: 'simple' | 'moderate' | 'complex';
  userBusy?: boolean;
  explicitModeRequest?: AssistantMode;
  onboardingPreference?: AssistantMode;
  recentInteractions?: number;
  lastModeSwitch?: Date;
}

export interface ModeDecision {
  mode: AssistantMode;
  confidence: number;
  reason: string;
  config: AssistantModeConfig;
}

// ============================================================================
// MODE CONFIGURATIONS
// ============================================================================

const ASSIST_MODE_CONFIG: AssistantModeConfig = {
  mode: 'assist',
  proactiveLevel: 0.3,
  automationLevel: 0.4,
  browserToolsEnabled: false,
  explanationDepth: 'standard',
  interruptionThreshold: 0.8,
  systemPrompt: `You are InfinityAssistant in Assist Mode.
Help when asked, stay out of the way otherwise.
Be responsive, clear, and efficient. Answer questions directly.
Only offer suggestions when specifically relevant.
Respect the user's flow - they're in control.
Provide code, explanations, and guidance on request.
Don't automate unless asked. Don't be overly proactive.`,
};

const COMPANION_MODE_CONFIG: AssistantModeConfig = {
  mode: 'companion',
  proactiveLevel: 0.9,
  automationLevel: 0.95,
  browserToolsEnabled: true,
  explanationDepth: 'minimal',
  interruptionThreshold: 0.3,
  systemPrompt: `You are InfinityAssistant in Companion Mode - a white-glove orchestrator.
Be proactive, anticipate needs, and handle everything automatically.
Use browser tools to show users what you're doing in real-time.
Make decisions autonomously. Don't ask - just do (with visibility).
Handle OAuth flows, deployments, and complex tasks seamlessly.
Focus on outcomes, not process. Celebrate progress.
You are their trusted partner who takes care of everything.
Be warm, supportive, and make them feel taken care of.`,
};

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class AssistantModeService {
  private currentModes = new Map<string, AssistantMode>();
  private modeHistory = new Map<string, Array<{ mode: AssistantMode; timestamp: Date; reason: string }>>();

  /**
   * Determine the best mode based on context
   */
  determineMode(context: ModeContext): ModeDecision {
    // Explicit request takes precedence
    if (context.explicitModeRequest) {
      return {
        mode: context.explicitModeRequest,
        confidence: 1.0,
        reason: 'User explicitly requested this mode',
        config: this.getConfig(context.explicitModeRequest),
      };
    }

    // Check onboarding preference
    if (context.onboardingPreference) {
      // But allow situational override
      const situationalMode = this.analyzeSituation(context);
      if (situationalMode.shouldOverride) {
        return {
          mode: situationalMode.suggestedMode,
          confidence: situationalMode.confidence,
          reason: situationalMode.reason,
          config: this.getConfig(situationalMode.suggestedMode),
        };
      }

      return {
        mode: context.onboardingPreference,
        confidence: 0.85,
        reason: 'Based on onboarding preference',
        config: this.getConfig(context.onboardingPreference),
      };
    }

    // Default to assist mode for new users
    return {
      mode: 'assist',
      confidence: 0.6,
      reason: 'Default mode for new interactions',
      config: ASSIST_MODE_CONFIG,
    };
  }

  /**
   * Analyze the current situation for mode switching
   */
  private analyzeSituation(context: ModeContext): {
    shouldOverride: boolean;
    suggestedMode: AssistantMode;
    confidence: number;
    reason: string;
  } {
    // Complex task + user not busy = suggest companion mode
    if (context.taskComplexity === 'complex' && !context.userBusy) {
      return {
        shouldOverride: true,
        suggestedMode: 'companion',
        confidence: 0.75,
        reason: 'Complex task detected, switching to companion for automation',
      };
    }

    // User is busy = switch to assist mode (less interruptions)
    if (context.userBusy && context.onboardingPreference === 'companion') {
      return {
        shouldOverride: true,
        suggestedMode: 'assist',
        confidence: 0.7,
        reason: 'User appears busy, reducing proactivity',
      };
    }

    // Low recent interactions in companion mode = maybe switch to assist
    if (context.recentInteractions !== undefined && context.recentInteractions < 2) {
      if (context.onboardingPreference === 'companion') {
        return {
          shouldOverride: false,
          suggestedMode: 'companion',
          confidence: 0.5,
          reason: 'Low activity but keeping companion mode',
        };
      }
    }

    return {
      shouldOverride: false,
      suggestedMode: context.onboardingPreference || 'assist',
      confidence: 0.5,
      reason: 'No situational override needed',
    };
  }

  /**
   * Get configuration for a mode
   */
  getConfig(mode: AssistantMode): AssistantModeConfig {
    return mode === 'companion' ? { ...COMPANION_MODE_CONFIG } : { ...ASSIST_MODE_CONFIG };
  }

  /**
   * Set user's mode explicitly
   */
  setMode(userId: string, mode: AssistantMode, reason: string): void {
    const previousMode = this.currentModes.get(userId);
    this.currentModes.set(userId, mode);

    // Track history
    const history = this.modeHistory.get(userId) || [];
    history.push({ mode, timestamp: new Date(), reason });
    if (history.length > 50) history.shift(); // Keep last 50
    this.modeHistory.set(userId, history);

    if (previousMode !== mode) {
      logger.info(`[AssistantMode] User ${userId} switched from ${previousMode || 'none'} to ${mode}: ${reason}`);
    }
  }

  /**
   * Get current mode for user
   */
  getCurrentMode(userId: string): AssistantMode | null {
    return this.currentModes.get(userId) || null;
  }

  /**
   * Get mode history for user
   */
  getModeHistory(userId: string): Array<{ mode: AssistantMode; timestamp: Date; reason: string }> {
    return this.modeHistory.get(userId) || [];
  }

  /**
   * Check if browser tools should be enabled
   */
  shouldEnableBrowserTools(userId: string): boolean {
    const mode = this.currentModes.get(userId);
    if (!mode) return false;
    return this.getConfig(mode).browserToolsEnabled;
  }

  /**
   * Get the system prompt addition for current mode
   */
  getSystemPrompt(userId: string): string {
    const mode = this.currentModes.get(userId) || 'assist';
    return this.getConfig(mode).systemPrompt;
  }

  /**
   * Suggest mode switch based on user behavior
   */
  suggestModeSwitch(context: ModeContext): {
    shouldSuggest: boolean;
    suggestedMode: AssistantMode;
    message: string;
  } | null {
    const currentMode = this.currentModes.get(context.userId);
    if (!currentMode) return null;

    // In assist mode but user seems to want more help
    if (currentMode === 'assist' && context.recentInteractions && context.recentInteractions > 10) {
      return {
        shouldSuggest: true,
        suggestedMode: 'companion',
        message: "I notice you're asking a lot of questions. Would you like me to switch to Companion mode and handle more things automatically?",
      };
    }

    // In companion mode but user keeps overriding
    if (currentMode === 'companion' && context.taskComplexity === 'simple') {
      return {
        shouldSuggest: true,
        suggestedMode: 'assist',
        message: "This seems like a straightforward task. Would you prefer Assist mode where you have more direct control?",
      };
    }

    return null;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let assistantModeService: AssistantModeService | null = null;

export function getAssistantModeService(): AssistantModeService {
  if (!assistantModeService) {
    assistantModeService = new AssistantModeService();
  }
  return assistantModeService;
}

export default AssistantModeService;
