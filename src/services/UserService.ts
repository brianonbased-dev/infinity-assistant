/**
 * User Service
 *
 * Manages user data, tiers, and usage tracking
 */

import { UserTier } from '@/types/agent-capabilities';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

export class UserService {
  /**
   * Get or create anonymous user ID from cookies
   */
  getAnonymousUserId(cookieUserId?: string): string {
    if (cookieUserId) {
      return cookieUserId;
    }
    return `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get user's current usage count for rate limiting
   */
  async getUserUsageCount(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from(TABLES.USAGE)
        .select('daily_count')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (error) {
        // No record for today = 0 usage
        if (error.code === 'PGRST116') {
          return 0;
        }
        logger.error('[UserService] Error fetching usage count:', error);
        return 0;
      }

      return data?.daily_count || 0;
    } catch (error) {
      logger.error('[UserService] Error in getUserUsageCount:', error);
      return 0;
    }
  }

  /**
   * Get detailed usage stats for a user
   */
  async getUserUsageStats(userId: string): Promise<{
    today: number;
    thisMonth: number;
    tokensUsed: number;
  }> {
    const today = new Date().toISOString().split('T')[0];

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from(TABLES.USAGE)
        .select('daily_count, monthly_count, tokens_used')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (error || !data) {
        return { today: 0, thisMonth: 0, tokensUsed: 0 };
      }

      return {
        today: data.daily_count || 0,
        thisMonth: data.monthly_count || 0,
        tokensUsed: data.tokens_used || 0,
      };
    } catch (error) {
      logger.error('[UserService] Error in getUserUsageStats:', error);
      return { today: 0, thisMonth: 0, tokensUsed: 0 };
    }
  }

  /**
   * Record usage for rate limiting
   * Uses database function for atomic increment
   */
  async recordUsage(
    userId: string,
    _conversationId: string,
    tokensUsed: number = 0
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient();

      // Use the database function for atomic increment
      const { error } = await supabase.rpc('increment_usage', {
        p_user_id: userId,
        p_tokens: tokensUsed,
      });

      if (error) {
        // Fallback to upsert if function doesn't exist
        logger.warn('[UserService] increment_usage RPC failed, using upsert:', error.message);
        const today = new Date().toISOString().split('T')[0];

        await supabase.from(TABLES.USAGE).upsert({
          user_id: userId,
          date: today,
          daily_count: 1,
          monthly_count: 1,
          tokens_used: tokensUsed,
          api_calls: 1,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,date',
        });
      }
    } catch (error) {
      logger.error('[UserService] Error recording usage:', error);
    }
  }

  /**
   * Get or determine user tier
   */
  async getUserTier(userId: string): Promise<UserTier> {
    if (userId.startsWith('anon_')) {
      return 'free';
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('tier')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return 'free';
      }

      return (data.tier as UserTier) || 'free';
    } catch (error) {
      logger.error('[UserService] Error fetching user tier:', error);
      return 'free';
    }
  }
}

let userService: UserService | null = null;

export function getUserService(): UserService {
  if (!userService) {
    userService = new UserService();
  }
  return userService;
}
