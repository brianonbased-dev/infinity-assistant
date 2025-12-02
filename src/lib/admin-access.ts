/**
 * Admin Access Control
 *
 * Provides admin tier override functionality to make all InfinityAssistant
 * features free/unlimited for master tier users.
 *
 * @since 2025-12-02
 */

import type { UserTier } from '@/types/agent-capabilities';

/**
 * Admin tiers that get unlimited access to all features
 */
const ADMIN_TIERS: UserTier[] = ['master'];

/**
 * Check if user has admin/master access
 */
export function isAdmin(tier: UserTier | string | null | undefined): boolean {
  if (!tier) return false;
  return ADMIN_TIERS.includes(tier as UserTier);
}

/**
 * Get effective tier for feature access
 * Admin users are treated as having the highest tier for all features
 */
export function getEffectiveTier(tier: UserTier | string | null | undefined): UserTier {
  if (!tier) return 'free';
  if (isAdmin(tier)) return 'builder_enterprise'; // Admin gets enterprise-level access
  return tier as UserTier;
}

/**
 * Check if a feature should be unlocked for this user
 * Admin users always return true
 */
export function hasFeatureAccess(
  tier: UserTier | string | null | undefined,
  requiredTier: UserTier
): boolean {
  if (isAdmin(tier)) return true;

  const tierOrder: UserTier[] = [
    'free',
    'assistant_pro',
    'pro',
    'builder_pro',
    'growth',
    'builder_business',
    'business',
    'team',
    'scale',
    'builder_enterprise',
    'enterprise',
    'master',
  ];

  const userTierIndex = tierOrder.indexOf(tier as UserTier);
  const requiredTierIndex = tierOrder.indexOf(requiredTier);

  return userTierIndex >= requiredTierIndex;
}

/**
 * Get rate limits with admin override
 * Admin users get unlimited everything
 */
export function getAdminRateLimits(tier: UserTier | string | null | undefined) {
  if (isAdmin(tier)) {
    return {
      requests_per_day: -1, // unlimited
      requests_per_hour: -1, // unlimited
      concurrent_conversations: -1, // unlimited
      modes_allowed: ['search', 'assist', 'build'] as const,
      research_depth: 'comprehensive' as const,
      deep_research_per_day: -1, // unlimited
      knowledge_queries_per_day: -1, // unlimited
      agent_spawns_per_day: -1, // unlimited
      mesh_broadcasts_per_day: -1, // unlimited
    };
  }

  // Return null to indicate normal rate limits should apply
  return null;
}

/**
 * Admin capabilities that bypass normal restrictions
 */
export const ADMIN_CAPABILITIES = [
  // Full mesh access
  'mesh.broadcast',
  'mesh.admin',
  'mesh.configure',

  // Full agent control
  'agent.spawn',
  'agent.control',
  'agent.terminate',

  // Full knowledge access
  'knowledge.admin',
  'knowledge.graduate',
  'knowledge.delete',
  'knowledge.import',
  'knowledge.export',

  // System control
  'system.config',
  'system.repair',
  'system.diagnostics',

  // MCP full access
  'mcp.admin',
  'mcp.configure',

  // RPC full access
  'rpc.master',
  'rpc.execute-any',

  // Feature flags
  'features.all',
  'features.beta',
  'features.experimental',
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

/**
 * Check if user has specific admin capability
 */
export function hasAdminCapability(
  tier: UserTier | string | null | undefined,
  capability: AdminCapability
): boolean {
  return isAdmin(tier);
}

/**
 * Middleware helper to check admin access in API routes
 */
export function requireAdmin(tier: UserTier | string | null | undefined): void {
  if (!isAdmin(tier)) {
    throw new Error('Admin access required');
  }
}

/**
 * Get admin status message for UI
 */
export function getAdminStatusMessage(tier: UserTier | string | null | undefined): string | null {
  if (isAdmin(tier)) {
    return 'Admin access: All features unlimited';
  }
  return null;
}
