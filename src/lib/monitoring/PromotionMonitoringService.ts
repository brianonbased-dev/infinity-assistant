/**
 * Promotion Monitoring Service
 * 
 * Tracks and monitors knowledge promotion rates and metrics
 */

import { getSupabaseClient } from '@/lib/supabase';
import logger from '@/utils/logger';

export interface PromotionStats {
  total_promotions: number;
  avg_trust_score: number;
  avg_validation_count: number;
  avg_age_days: number;
  promotions_by_type: Record<string, number>;
  promotions_by_domain: Record<string, number>;
  promotion_rate: number; // Promotions per day/week/month
  recent_promotions: Array<{
    id: string;
    experimental_id: string;
    canonical_id: string;
    trust_score: number;
    type: string;
    domain: string;
    promoted_at: string;
  }>;
}

export interface PromotionAlert {
  type: 'low_rate' | 'high_failure' | 'quality_drop';
  severity: 'warning' | 'error';
  message: string;
  threshold: number;
  current: number;
}

/**
 * Promotion Monitoring Service
 * Monitors promotion rates and quality
 */
export class PromotionMonitoringService {
  /**
   * Log a promotion event
   */
  async logPromotion(data: {
    experimental_id: string;
    canonical_id: string;
    trust_score: number;
    validation_count: number;
    age_days: number;
    usage_count: number;
    type: 'wisdom' | 'pattern' | 'gotcha';
    domain: string;
    source?: string;
    metadata?: Record<string, any>;
  }): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from('knowledge_promotion_log')
        .insert({
          experimental_id: data.experimental_id,
          canonical_id: data.canonical_id,
          trust_score: data.trust_score,
          validation_count: data.validation_count,
          age_days: data.age_days,
          usage_count: data.usage_count,
          type: data.type,
          domain: data.domain,
          source: data.source,
          metadata: data.metadata || {}
        });

      if (error) {
        logger.error('[Promotion Monitoring] Failed to log promotion:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('[Promotion Monitoring] Error logging promotion:', error);
      return false;
    }
  }

  /**
   * Get promotion statistics
   */
  async getStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<PromotionStats | null> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc('get_promotion_stats', {
        p_start_date: startDate?.toISOString().split('T')[0] || null,
        p_end_date: endDate?.toISOString().split('T')[0] || null
      });

      if (error) {
        logger.error('[Promotion Monitoring] Failed to get stats:', error);
        return null;
      }

      const stats = data?.[0];
      if (!stats) {
        return {
          total_promotions: 0,
          avg_trust_score: 0,
          avg_validation_count: 0,
          avg_age_days: 0,
          promotions_by_type: {},
          promotions_by_domain: {},
          promotion_rate: 0,
          recent_promotions: []
        };
      }

      // Get recent promotions
      const { data: recent, error: recentError } = await supabase
        .from('knowledge_promotion_log')
        .select('*')
        .order('promoted_at', { ascending: false })
        .limit(10);

      if (recentError) {
        logger.warn('[Promotion Monitoring] Failed to get recent promotions:', recentError);
      }

      // Calculate promotion rate (promotions per day)
      const days = startDate && endDate
        ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        : 30; // Default to 30 days
      const promotionRate = days > 0 ? (stats.total_promotions || 0) / days : 0;

      return {
        total_promotions: parseInt(stats.total_promotions) || 0,
        avg_trust_score: parseFloat(stats.avg_trust_score) || 0,
        avg_validation_count: parseFloat(stats.avg_validation_count) || 0,
        avg_age_days: parseFloat(stats.avg_age_days) || 0,
        promotions_by_type: stats.promotions_by_type || {},
        promotions_by_domain: stats.promotions_by_domain || {},
        promotion_rate,
        recent_promotions: (recent || []).map((p: any) => ({
          id: p.id,
          experimental_id: p.experimental_id,
          canonical_id: p.canonical_id,
          trust_score: parseFloat(p.trust_score),
          type: p.type,
          domain: p.domain,
          promoted_at: p.promoted_at
        }))
      };
    } catch (error) {
      logger.error('[Promotion Monitoring] Error getting stats:', error);
      return null;
    }
  }

  /**
   * Check for promotion alerts
   */
  async checkAlerts(): Promise<PromotionAlert[]> {
    const alerts: PromotionAlert[] = [];
    const stats = await this.getStats();

    if (!stats) {
      return alerts;
    }

    // Check promotion rate (should be at least 1 per day)
    if (stats.promotion_rate < 1) {
      alerts.push({
        type: 'low_rate',
        severity: 'warning',
        message: `Promotion rate is low: ${stats.promotion_rate.toFixed(2)} per day`,
        threshold: 1,
        current: stats.promotion_rate
      });
    }

    // Check average trust score (should be >= 0.90)
    if (stats.avg_trust_score < 0.90) {
      alerts.push({
        type: 'quality_drop',
        severity: 'warning',
        message: `Average trust score is below threshold: ${stats.avg_trust_score.toFixed(2)}`,
        threshold: 0.90,
        current: stats.avg_trust_score
      });
    }

    return alerts;
  }
}

// Singleton instance
let monitoringServiceInstance: PromotionMonitoringService | null = null;

export function getPromotionMonitoringService(): PromotionMonitoringService {
  if (!monitoringServiceInstance) {
    monitoringServiceInstance = new PromotionMonitoringService();
  }
  return monitoringServiceInstance;
}
