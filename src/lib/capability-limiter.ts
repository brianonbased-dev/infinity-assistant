/**
 * Capability Limiter
 *
 * Enforces capability restrictions for Infinity Assistant (LIMITED mode)
 * vs Master Portal (FULL mode)
 */

import {
  AgentCapabilityMode,
  AgentExecutionContext,
  AgentCapability,
  LIMITED_MODE_CAPABILITIES,
  FULL_MODE_ONLY_CAPABILITIES,
  UserTier,
  RATE_LIMITS,
} from '@/types/agent-capabilities';
import logger from '@/utils/logger';

export interface RateLimitCheck {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_at?: string;
  reason?: string;
}

export class CapabilityLimiter {
  /**
   * Check if capability is allowed in current mode
   */
  static isCapabilityAllowed(capability: string, context: AgentExecutionContext): boolean {
    if (context.mode === AgentCapabilityMode.FULL) {
      return true; // Master Portal: all capabilities allowed
    }

    // Infinity Assistant (LIMITED mode): only safe capabilities
    return LIMITED_MODE_CAPABILITIES.includes(capability as AgentCapability);
  }

  /**
   * Get list of blocked capabilities for current mode
   */
  static getBlockedCapabilities(context: AgentExecutionContext): AgentCapability[] {
    if (context.mode === AgentCapabilityMode.FULL) {
      return []; // No blocked capabilities in FULL mode
    }

    // LIMITED mode blocks all FULL mode only capabilities
    return FULL_MODE_ONLY_CAPABILITIES;
  }

  /**
   * Filter request to remove restricted capabilities
   */
  static filterRequest(request: any, context: AgentExecutionContext): any {
    if (context.mode === AgentCapabilityMode.FULL) {
      logger.info('[CapabilityLimiter] FULL mode - no filtering', {
        userId: context.userId,
      });
      return request; // No filtering for Master Portal
    }

    logger.info('[CapabilityLimiter] LIMITED mode - filtering request', {
      userId: context.userId,
      userTier: context.userTier,
    });

    // Create filtered copy
    const filtered = { ...request };

    // Block system control commands
    if (filtered.command?.startsWith('system.')) {
      logger.warn('[CapabilityLimiter] Blocked system control command', {
        userId: context.userId,
        command: filtered.command,
      });
      throw new Error(
        'System control not available in Infinity Assistant. Upgrade to paid tier or use Master Portal for advanced features.'
      );
    }

    // Block database queries
    if (filtered.sql || filtered.database_query) {
      logger.warn('[CapabilityLimiter] Blocked database query', {
        userId: context.userId,
      });
      throw new Error(
        'Database access not available in Infinity Assistant. This feature is only available in Master Portal.'
      );
    }

    // Block agent management
    if (filtered.agent_action || filtered.manage_agent) {
      logger.warn('[CapabilityLimiter] Blocked agent management', {
        userId: context.userId,
      });
      throw new Error(
        'Agent management not available in Infinity Assistant. This feature is only available in Master Portal.'
      );
    }

    // Block deployment commands
    if (filtered.deploy || filtered.deployment) {
      logger.warn('[CapabilityLimiter] Blocked deployment', {
        userId: context.userId,
      });
      throw new Error(
        'Deployment not available in Infinity Assistant. This feature is only available in Master Portal.'
      );
    }

    return filtered;
  }

  /**
   * Get public context (LIMITED mode)
   */
  static async getPublicContext(userId: string, userTier: UserTier): Promise<AgentExecutionContext> {
    return {
      mode: AgentCapabilityMode.LIMITED,
      userId,
      userTier,
      allowedCapabilities: LIMITED_MODE_CAPABILITIES,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Check rate limit
   */
  static checkRateLimit(
    context: AgentExecutionContext,
    currentUsage: number
  ): RateLimitCheck {
    const limits = RATE_LIMITS[context.userTier.toUpperCase() as keyof typeof RATE_LIMITS] || RATE_LIMITS.FREE;

    // Unlimited tier
    if (limits.requests_per_day === -1) {
      return {
        allowed: true,
        limit: -1,
        remaining: -1,
      };
    }

    // Check daily limit
    if (currentUsage >= limits.requests_per_day) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      return {
        allowed: false,
        limit: limits.requests_per_day,
        remaining: 0,
        reset_at: tomorrow.toISOString(),
        reason: `Daily limit of ${limits.requests_per_day} requests reached. Reset at ${tomorrow.toISOString()}`,
      };
    }

    return {
      allowed: true,
      limit: limits.requests_per_day,
      remaining: limits.requests_per_day - currentUsage,
    };
  }
}

