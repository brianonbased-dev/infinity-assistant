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

export type UserTier = 'free' | 'paid' | 'master';

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
  FREE: {
    requests_per_day: 20,
    requests_per_hour: 10,
    concurrent_conversations: 1,
  },
  PAID: {
    requests_per_day: -1, // unlimited
    requests_per_hour: 100,
    concurrent_conversations: 5,
  },
  MASTER: {
    requests_per_day: -1, // unlimited
    requests_per_hour: -1, // unlimited
    concurrent_conversations: -1, // unlimited
  },
} as const;

