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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const supabase = getSupabaseClient();
      const { count, error } = await supabase
        .from(TABLES.USAGE)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', today.toISOString());

      if (error) {
        logger.error('[UserService] Error fetching usage count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      logger.error('[UserService] Error in getUserUsageCount:', error);
      return 0;
    }
  }

  /**
   * Record usage for rate limiting
   */
  async recordUsage(
    userId: string,
    conversationId: string,
    tokensUsed: number = 0
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      await supabase.from(TABLES.USAGE).insert({
        user_id: userId,
        conversation_id: conversationId,
        tokens_used: tokensUsed,
        created_at: new Date().toISOString(),
      });
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
