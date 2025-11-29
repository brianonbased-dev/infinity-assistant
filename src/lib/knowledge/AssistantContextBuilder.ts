/**
 * Assistant Context Builder
 *
 * Unified service that combines:
 * - Knowledge loading
 * - Conversation memory
 * - Phase tracking
 * - User preferences
 *
 * Produces a complete context for assistant responses that supports
 * long, knowledge-rich conversations using the uAA2++ 8-phase protocol.
 */

import type {
  AssistantContext,
  UAA2Phase,
  WorkflowPhase,
} from './types';
import { getAssistantKnowledgeService } from './AssistantKnowledgeService';
import { getConversationMemoryService } from './ConversationMemoryService';

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

/**
 * User preferences from onboarding
 */
interface UserPreferences {
  role?: string;
  experienceLevel?: string;
  primaryGoals?: string[];
  preferredMode?: 'search' | 'assist' | 'build';
  interests?: string[];
  customInterests?: string[];
  communicationStyle?: 'concise' | 'detailed' | 'conversational';
  workflowPhases?: WorkflowPhase[];
}

/**
 * Options for building context
 */
interface BuildContextOptions {
  conversationId: string;
  userId: string;
  message: string;
  mode: 'search' | 'assist' | 'build';
  preferences?: UserPreferences;
  includeKnowledge?: boolean;
}

/**
 * Assistant Context Builder
 */
class AssistantContextBuilder {
  private static instance: AssistantContextBuilder;
  private knowledgeService = getAssistantKnowledgeService();
  private memoryService = getConversationMemoryService();

  private constructor() {}

  static getInstance(): AssistantContextBuilder {
    if (!AssistantContextBuilder.instance) {
      AssistantContextBuilder.instance = new AssistantContextBuilder();
    }
    return AssistantContextBuilder.instance;
  }

  /**
   * Build complete context for assistant response
   */
  async buildContext(options: BuildContextOptions): Promise<AssistantContext> {
    const {
      conversationId,
      userId,
      message,
      mode,
      preferences,
      includeKnowledge = true,
    } = options;

    // Build user profile from preferences
    const userProfile: AssistantContext['userProfile'] = {
      role: preferences?.role || '',
      experienceLevel: preferences?.experienceLevel || '',
      interests: preferences?.interests || [],
      customInterests: preferences?.customInterests || [],
      workflowPhases: preferences?.workflowPhases || ['research', 'plan', 'deliver'],
      communicationStyle: preferences?.communicationStyle || 'conversational',
    };

    // Get or initialize memory
    const memoryContext = await this.memoryService.buildContext(
      conversationId,
      userId,
      userProfile,
      mode
    );

    // Add the current message to memory
    await this.memoryService.addMessage(conversationId, {
      content: message,
      type: 'user',
      importance: 'medium',
    });

    // Build context with memory
    let context: AssistantContext = {
      ...memoryContext,
      mode,
      userProfile,
    };

    // Load relevant knowledge if enabled
    if (includeKnowledge) {
      const knowledge = await this.knowledgeService.getRelevantKnowledge(context);
      context = {
        ...context,
        activeKnowledge: {
          relevantWisdom: knowledge.wisdom,
          relevantPatterns: knowledge.patterns,
          relevantGotchas: knowledge.gotchas,
        },
      };
    }

    // Recommend phase based on context
    const recommendedPhase = this.memoryService.recommendPhase(context);
    if (recommendedPhase !== context.phase.currentPhase) {
      // Could auto-transition or just note the recommendation
      // For now, we'll keep current phase
    }

    return context;
  }

  /**
   * Generate system prompt from context
   */
  generateSystemPrompt(context: AssistantContext): string {
    const parts: string[] = [];

    // Core identity
    parts.push('# Infinity Assistant');
    parts.push('You are Infinity Assistant, an AI research assistant focused on helping users search, learn, and understand.');
    parts.push('');

    // Mode-specific instructions
    if (context.mode === 'search') {
      parts.push('## Mode: SEARCH');
      parts.push('Focus on finding information, discovering patterns, and presenting research insights.');
    } else if (context.mode === 'build') {
      parts.push('## Mode: BUILD');
      parts.push('Focus on helping with architecture, code guidance, and implementation planning.');
      parts.push('Note: For full project generation and deployment, recommend Infinity Builder.');
    } else {
      parts.push('## Mode: ASSIST');
      parts.push('Focus on understanding questions deeply and providing helpful, personalized responses.');
    }
    parts.push('');

    // User context
    if (context.userProfile.role || context.userProfile.experienceLevel) {
      parts.push('## User Profile');
      if (context.userProfile.role) {
        parts.push(`- Role: ${context.userProfile.role}`);
      }
      if (context.userProfile.experienceLevel) {
        parts.push(`- Experience: ${context.userProfile.experienceLevel}`);
      }
      if (context.userProfile.interests.length > 0 || context.userProfile.customInterests.length > 0) {
        const allInterests = [...context.userProfile.interests, ...context.userProfile.customInterests];
        parts.push(`- Interests: ${allInterests.join(', ')}`);
      }
      parts.push('');
    }

    // Communication style
    parts.push('## Communication Style');
    switch (context.userProfile.communicationStyle) {
      case 'concise':
        parts.push('Keep responses brief and to the point. Use bullet points. No unnecessary elaboration.');
        break;
      case 'detailed':
        parts.push('Provide thorough explanations with examples and context. Be comprehensive.');
        break;
      default:
        parts.push('Be friendly and conversational while remaining helpful. Balance depth with accessibility.');
    }
    parts.push('');

    // Workflow phase preferences
    if (context.userProfile.workflowPhases.length > 0) {
      parts.push('## User Workflow Preference');
      const phases = context.userProfile.workflowPhases
        .map(p => {
          switch (p) {
            case 'research': return 'Research (explore and understand)';
            case 'plan': return 'Plan (design and strategize)';
            case 'deliver': return 'Deliver (implement and ship)';
            default: return p;
          }
        })
        .join(' → ');
      parts.push(`Preferred workflow: ${phases}`);
      parts.push('Adapt your assistance to match their workflow stage.');
      parts.push('');
    }

    // Phase context (uAA2++)
    parts.push('## Current Phase');
    parts.push(`Phase: ${context.phase.currentPhase.toUpperCase()}`);
    parts.push(`Cycle: ${context.phase.cycleCount}`);
    switch (context.phase.currentPhase) {
      case 'intake':
        parts.push('Focus on gathering information and understanding the request.');
        break;
      case 'reflect':
        parts.push('Analyze and synthesize the information gathered.');
        break;
      case 'execute':
        parts.push('Take action and provide concrete help.');
        break;
      case 'compress':
        parts.push('Summarize key insights and learnings.');
        break;
      case 'grow':
        parts.push('Build on learnings and expand understanding.');
        break;
      case 'evolve':
        parts.push('Adapt and improve based on feedback.');
        break;
      default:
        parts.push('Proceed with the conversation naturally.');
    }
    parts.push('');

    // Knowledge context
    if (context.activeKnowledge.relevantWisdom.length > 0 ||
        context.activeKnowledge.relevantPatterns.length > 0 ||
        context.activeKnowledge.relevantGotchas.length > 0) {
      const knowledgePrompt = this.knowledgeService.formatKnowledgeForPrompt({
        wisdom: context.activeKnowledge.relevantWisdom,
        patterns: context.activeKnowledge.relevantPatterns,
        gotchas: context.activeKnowledge.relevantGotchas,
      });
      if (knowledgePrompt) {
        parts.push('## Relevant Knowledge');
        parts.push(knowledgePrompt);
        parts.push('');
      }
    }

    // Memory context
    if (context.memory.criticalFacts.length > 0) {
      parts.push('## Critical Facts (Remember)');
      for (const fact of context.memory.criticalFacts.slice(-5)) {
        parts.push(`- ${fact.content.substring(0, 200)}`);
      }
      parts.push('');
    }

    // Compressed history
    if (context.memory.compressedHistory.length > 0) {
      parts.push('## Conversation History');
      for (const summary of context.memory.compressedHistory.slice(-2)) {
        parts.push(`- ${summary.summary}`);
      }
      parts.push('');
    }

    // Rate limit awareness
    if (context.rateLimit.remaining <= 5) {
      parts.push('## Notice');
      parts.push(`User has ${context.rateLimit.remaining} queries remaining today.`);
      parts.push('Be mindful of providing value in each response.');
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Record assistant response to memory
   */
  async recordResponse(
    conversationId: string,
    response: string,
    insights?: string[]
  ): Promise<void> {
    await this.memoryService.addMessage(conversationId, {
      content: response,
      type: 'assistant',
      importance: 'medium',
      tags: insights ? ['has-insights'] : undefined,
    });

    // If there are key insights, add them as separate entries
    if (insights) {
      for (const insight of insights) {
        await this.memoryService.addMessage(conversationId, {
          content: insight,
          type: 'insight',
          importance: 'high',
          tags: ['insight'],
        });
      }
    }
  }

  /**
   * Transition to a new phase
   */
  async transitionPhase(
    conversationId: string,
    newPhase: UAA2Phase,
    insights?: string[]
  ): Promise<void> {
    await this.memoryService.updatePhase(conversationId, newPhase, insights);
  }

  /**
   * Get phase recommendation for next response
   */
  getPhaseRecommendation(context: AssistantContext): {
    recommended: UAA2Phase;
    reason: string;
  } {
    const currentPhase = context.phase.currentPhase;
    const recentMessages = context.memory.recentMessages;

    // Analyze conversation to determine next phase
    if (recentMessages.length < 3) {
      return {
        recommended: 'intake',
        reason: 'Early in conversation, still gathering context',
      };
    }

    const userMessages = recentMessages.filter(m => m.type === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1]?.content.toLowerCase() || '';

    // Completion indicators
    if (lastUserMessage.includes('thank') || lastUserMessage.includes('got it') || lastUserMessage.includes('that helps')) {
      return {
        recommended: 'compress',
        reason: 'User indicates satisfaction, time to compress learnings',
      };
    }

    // More questions = still in intake
    if (lastUserMessage.includes('?') && currentPhase === 'intake') {
      return {
        recommended: 'intake',
        reason: 'User still asking questions, continue gathering',
      };
    }

    // Action indicators
    if (lastUserMessage.includes('let\'s') || lastUserMessage.includes('can you') || lastUserMessage.includes('help me')) {
      return {
        recommended: 'execute',
        reason: 'User ready for action',
      };
    }

    // Default progression
    const phaseOrder: UAA2Phase[] = ['intake', 'reflect', 'execute', 'compress', 'reintake', 'grow', 'evolve', 'autonomize'];
    const currentIndex = phaseOrder.indexOf(currentPhase);
    const nextPhase = phaseOrder[Math.min(currentIndex + 1, phaseOrder.length - 1)];

    return {
      recommended: nextPhase,
      reason: 'Natural progression through conversation cycle',
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getAssistantContextBuilder = (): AssistantContextBuilder => {
  return AssistantContextBuilder.getInstance();
};

export { AssistantContextBuilder };
export type { UserPreferences, BuildContextOptions };
