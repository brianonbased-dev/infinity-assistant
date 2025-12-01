/**
 * Centralized Supabase Client
 *
 * Singleton pattern to avoid re-initializing Supabase on every request
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Get the singleton Supabase instance with service role key
 * This is used for backend operations with elevated permissions
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Support both naming conventions for flexibility
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.UAA2_SUPABASE_SERVICE_KEY;

    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is not set');
    }

    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
    }

    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseInstance;
}

/**
 * Database table names used by Infinity Assistant
 */
export const TABLES = {
  USAGE: 'infinity_assistant_usage',
  USERS: 'infinity_assistant_users',
  SUBSCRIPTIONS: 'infinity_assistant_subscriptions',
  PREFERENCES: 'infinity_assistant_preferences',
  FEEDBACK: 'infinity_assistant_feedback',
  PAYMENTS: 'infinity_assistant_payments',
  CONVERSATIONS: 'infinity_assistant_conversations',
  ONBOARDING: 'assistant_onboarding',
  PRICING_TIERS: 'pricing_tiers',
  USER_PREFERENCES: 'user_preferences',
  // Mesh network tables
  USER_MESH_NODES: 'user_mesh_nodes',
  MESH_CONNECTIONS: 'mesh_connections',
  MESH_EVENTS: 'mesh_events',
  // User vault tables
  USER_VAULT_CONFIG: 'user_vault_config',
  USER_VAULT_SECRETS: 'user_vault_secrets',
  USER_VAULT_AUDIT: 'user_vault_audit',
} as const;

/**
 * Usage limits per subscription tier
 */
export const USAGE_LIMITS: Record<string, { daily: number; monthly: number }> = {
  free: { daily: 10, monthly: 100 },
  pro: { daily: 100, monthly: 3000 },
  business: { daily: 500, monthly: 15000 },
  enterprise: { daily: -1, monthly: -1 }, // Unlimited
};

/**
 * Get usage limits for a tier
 */
export function getUsageLimits(tier: string): { daily: number; monthly: number } {
  return USAGE_LIMITS[tier] || USAGE_LIMITS.free;
}
