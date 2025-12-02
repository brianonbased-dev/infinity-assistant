/**
 * Agent Capability Types
 *
 * Defines execution modes and capabilities for agents
 * Used to limit Infinity Assistant (public) vs Master Portal (full access)
 */

export enum AgentCapabilityMode {
  /**
   * Full mode - Master Portal
   * All capabilities available (god mode, system control, etc.)
   */
  FULL = 'full',

  /**
   * Limited mode - Infinity Assistant (public)
   * Only safe, customer-appropriate capabilities
   */
  LIMITED = 'limited',
}

/**
 * User subscription tiers
 *
 * FREE: Search only (basic knowledge base search, beneficial for knowledge gathering)
 * ASSISTANT_PRO: Full Assistant (Search + Assist + Research)
 * BUILDER_PRO: Full Assistant + Builder capabilities
 * BUILDER_BUSINESS: Full Assistant + Builder + Team features
 * BUILDER_ENTERPRISE: Everything + White Glove support
 * MASTER: Internal system access
 */
export type UserTier =
  | 'free'              // Search only
  | 'assistant_pro'     // Assistant: Search + Assist + Research
  | 'builder_pro'       // Builder: Full Assistant + Build capabilities
  | 'builder_business'  // Builder: + Team features
  | 'builder_enterprise' // Builder: + White Glove
  | 'master';           // Internal/Admin

// Legacy aliases for backwards compatibility
export type LegacyUserTier = 'free' | 'paid' | 'master';

/**
 * Check if user has Assistant tier (Pro or higher)
 */
export function hasAssistantAccess(tier: UserTier): boolean {
  return ['assistant_pro', 'builder_pro', 'builder_business', 'builder_enterprise', 'master'].includes(tier);
}

/**
 * Check if user has Builder tier
 */
export function hasBuilderAccess(tier: UserTier): boolean {
  return ['builder_pro', 'builder_business', 'builder_enterprise', 'master'].includes(tier);
}

/**
 * Check if user has Business tier (team features)
 */
export function hasBusinessAccess(tier: UserTier): boolean {
  return ['builder_business', 'builder_enterprise', 'master'].includes(tier);
}

/**
 * Check if user has Enterprise tier (white glove)
 */
export function hasEnterpriseAccess(tier: UserTier): boolean {
  return ['builder_enterprise', 'master'].includes(tier);
}

export interface AgentExecutionContext {
  /**
   * Capability mode (full or limited)
   */
  mode: AgentCapabilityMode;

  /**
   * User ID (system user for master, Clerk ID for public)
   */
  userId: string;

  /**
   * User tier (free/paid for public, master for system users)
   */
  userTier: UserTier;

  /**
   * Capabilities allowed for this user
   */
  allowedCapabilities: string[];

  /**
   * Request metadata
   */
  metadata?: {
    ip?: string;
    userAgent?: string;
    timestamp?: string;
  };
}

/**
 * Agent capabilities
 */
export const AGENT_CAPABILITIES = {
  // Limited mode (Infinity Assistant - PUBLIC)
  CHAT: 'chat',
  KNOWLEDGE_BASE_QUERY: 'knowledge_base_query',
  RESEARCH_ASSISTANCE: 'research_assistance',
  CODE_EXPLANATION: 'code_explanation',
  PATTERN_DISCOVERY: 'pattern_discovery',
  TEMPLATE_EXECUTION: 'template_execution',

  // Full mode only (Master Portal - LOCAL)
  DATABASE_CONSOLE: 'database_console',
  SYSTEM_CONTROL: 'system_control',
  AGENT_MANAGEMENT: 'agent_management',
  BROWSER_AUTOMATION: 'browser_automation',
  DEPLOYMENT: 'deployment',
  TESTING_TOOLS: 'testing_tools',
  PROCESS_VIEWER: 'process_viewer',
  ANALYTICS_ADMIN: 'analytics_admin',
  KNOWLEDGE_BASE_ADMIN: 'knowledge_base_admin',
} as const;

export type AgentCapability = (typeof AGENT_CAPABILITIES)[keyof typeof AGENT_CAPABILITIES];

/**
 * Capabilities allowed in LIMITED mode (Infinity Assistant)
 */
export const LIMITED_MODE_CAPABILITIES: AgentCapability[] = [
  AGENT_CAPABILITIES.CHAT,
  AGENT_CAPABILITIES.KNOWLEDGE_BASE_QUERY,
  AGENT_CAPABILITIES.RESEARCH_ASSISTANCE,
  AGENT_CAPABILITIES.CODE_EXPLANATION,
  AGENT_CAPABILITIES.PATTERN_DISCOVERY,
  AGENT_CAPABILITIES.TEMPLATE_EXECUTION,
];

/**
 * Capabilities ONLY allowed in FULL mode (Master Portal)
 */
export const FULL_MODE_ONLY_CAPABILITIES: AgentCapability[] = [
  AGENT_CAPABILITIES.DATABASE_CONSOLE,
  AGENT_CAPABILITIES.SYSTEM_CONTROL,
  AGENT_CAPABILITIES.AGENT_MANAGEMENT,
  AGENT_CAPABILITIES.BROWSER_AUTOMATION,
  AGENT_CAPABILITIES.DEPLOYMENT,
  AGENT_CAPABILITIES.TESTING_TOOLS,
  AGENT_CAPABILITIES.PROCESS_VIEWER,
  AGENT_CAPABILITIES.ANALYTICS_ADMIN,
  AGENT_CAPABILITIES.KNOWLEDGE_BASE_ADMIN,
];

/**
 * Rate limits per tier
 */
export const RATE_LIMITS = {
  // Free tier: Search only
  FREE: {
    requests_per_day: 20,
    requests_per_hour: 10,
    concurrent_conversations: 1,
    modes_allowed: ['search'] as const, // Only search mode
    research_depth: 'basic' as const,   // Basic search, no deep research
  },
  // Assistant Pro: Full search + assist
  ASSISTANT_PRO: {
    requests_per_day: 100,
    requests_per_hour: 50,
    concurrent_conversations: 3,
    modes_allowed: ['search', 'assist'] as const, // Search + Assist (no build)
    research_depth: 'deep' as const,              // Full research capabilities
  },
  // Builder Pro: Everything
  BUILDER_PRO: {
    requests_per_day: -1, // unlimited
    requests_per_hour: 100,
    concurrent_conversations: 5,
    modes_allowed: ['search', 'assist', 'build'] as const, // All modes
    research_depth: 'comprehensive' as const,
  },
  // Builder Business: Team features
  BUILDER_BUSINESS: {
    requests_per_day: -1, // unlimited
    requests_per_hour: 200,
    concurrent_conversations: 10,
    modes_allowed: ['search', 'assist', 'build'] as const,
    research_depth: 'comprehensive' as const,
  },
  // Builder Enterprise: White Glove
  BUILDER_ENTERPRISE: {
    requests_per_day: -1, // unlimited
    requests_per_hour: -1, // unlimited
    concurrent_conversations: -1, // unlimited
    modes_allowed: ['search', 'assist', 'build'] as const,
    research_depth: 'comprehensive' as const,
  },
  // Master: Internal
  MASTER: {
    requests_per_day: -1, // unlimited
    requests_per_hour: -1, // unlimited
    concurrent_conversations: -1, // unlimited
    modes_allowed: ['search', 'assist', 'build'] as const,
    research_depth: 'comprehensive' as const,
  },
  // Legacy paid tier (maps to assistant_pro)
  PAID: {
    requests_per_day: -1,
    requests_per_hour: 100,
    concurrent_conversations: 5,
    modes_allowed: ['search', 'assist', 'build'] as const,
    research_depth: 'deep' as const,
  },
  // Aliases for subscription tiers (pro, business, enterprise)
  PRO: {
    requests_per_day: 100,
    requests_per_hour: 50,
    concurrent_conversations: 3,
    modes_allowed: ['search', 'assist', 'build'] as const,
    research_depth: 'deep' as const,
  },
  BUSINESS: {
    requests_per_day: -1, // unlimited
    requests_per_hour: 200,
    concurrent_conversations: 10,
    modes_allowed: ['search', 'assist', 'build'] as const,
    research_depth: 'comprehensive' as const,
  },
  ENTERPRISE: {
    requests_per_day: -1, // unlimited
    requests_per_hour: -1, // unlimited
    concurrent_conversations: -1, // unlimited
    modes_allowed: ['search', 'assist', 'build'] as const,
    research_depth: 'comprehensive' as const,
  },
  // Team tier alias
  TEAM: {
    requests_per_day: -1, // unlimited
    requests_per_hour: 200,
    concurrent_conversations: 10,
    modes_allowed: ['search', 'assist', 'build'] as const,
    research_depth: 'comprehensive' as const,
  },
} as const;

/**
 * Get rate limits for a tier
 */
export function getRateLimitsForTier(tier: UserTier) {
  const tierKey = tier.toUpperCase().replace('-', '_') as keyof typeof RATE_LIMITS;
  return RATE_LIMITS[tierKey] || RATE_LIMITS.FREE;
}

/**
 * Check if a mode is allowed for a tier
 */
export function isModeAllowedForTier(tier: UserTier, mode: 'search' | 'assist' | 'build'): boolean {
  const limits = getRateLimitsForTier(tier);
  return (limits.modes_allowed as readonly string[]).includes(mode);
}

