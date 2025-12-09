/**
 * Time Series Service
 * 
 * Manages time-series data for analytics
 * Stores daily snapshots and provides trend data
 */

import { getSupabaseClient } from '@/lib/supabase';
import logger from '@/utils/logger';

export interface AnalyticsSnapshot {
  date: string;
  mode: 'professional' | 'companion' | 'all';
  professional_queries: number;
  professional_gaps: number;
  professional_experimental: number;
  professional_canonical: number;
  companion_queries: number;
  companion_gaps: number;
  companion_experimental: number;
  companion_canonical: number;
  total_queries: number;
  total_gaps: number;
  total_experimental: number;
  total_canonical: number;
}

export interface TrendData {
  date: string;
  queries: number;
  gaps: number;
  experimental: number;
  canonical: number;
}

export interface AccuracySnapshot {
  date: string;
  overall_accuracy: number;
  total_feedback: number;
  corrections: number;
  professional_accuracy?: number;
  companion_accuracy?: number;
  category_accuracy: Record<string, number>;
}

/**
 * Time Series Service
 * Manages analytics time-series data
 */
export class TimeSeriesService {
  /**
   * Create daily snapshot of analytics data
   */
  async createSnapshot(data: {
    mode: 'professional' | 'companion' | 'all';
    professional?: {
      queries: number;
      gaps: number;
      experimental: number;
      canonical: number;
    };
    companion?: {
      queries: number;
      gaps: number;
      experimental: number;
      canonical: number;
    };
  }): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split('T')[0];

      const snapshot = {
        date: today,
        mode: data.mode,
        professional_queries: data.professional?.queries || 0,
        professional_gaps: data.professional?.gaps || 0,
        professional_experimental: data.professional?.experimental || 0,
        professional_canonical: data.professional?.canonical || 0,
        companion_queries: data.companion?.queries || 0,
        companion_gaps: data.companion?.gaps || 0,
        companion_experimental: data.companion?.experimental || 0,
        companion_canonical: data.companion?.canonical || 0,
        total_queries: (data.professional?.queries || 0) + (data.companion?.queries || 0),
        total_gaps: (data.professional?.gaps || 0) + (data.companion?.gaps || 0),
        total_experimental: (data.professional?.experimental || 0) + (data.companion?.experimental || 0),
        total_canonical: (data.professional?.canonical || 0) + (data.companion?.canonical || 0)
      };

      const { error } = await supabase
        .from('knowledge_analytics_snapshots')
        .upsert(snapshot, {
          onConflict: 'date,mode'
        });

      if (error) {
        logger.error('[TimeSeries] Failed to create snapshot:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('[TimeSeries] Error creating snapshot:', error);
      return false;
    }
  }

  /**
   * Get trend data for a date range
   */
  async getTrends(
    startDate: Date,
    endDate: Date,
    mode: 'professional' | 'companion' | 'all' = 'all'
  ): Promise<TrendData[]> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc('get_analytics_trends', {
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: endDate.toISOString().split('T')[0],
        p_mode: mode
      });

      if (error) {
        logger.error('[TimeSeries] Failed to get trends:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        date: row.date,
        queries: row.queries || 0,
        gaps: row.gaps || 0,
        experimental: row.experimental || 0,
        canonical: row.canonical || 0
      }));
    } catch (error) {
      logger.error('[TimeSeries] Error getting trends:', error);
      return [];
    }
  }

  /**
   * Create accuracy snapshot
   */
  async createAccuracySnapshot(data: {
    overall_accuracy: number;
    total_feedback: number;
    corrections: number;
    professional_accuracy?: number;
    companion_accuracy?: number;
    category_accuracy?: Record<string, number>;
  }): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split('T')[0];

      const snapshot = {
        date: today,
        overall_accuracy: data.overall_accuracy,
        total_feedback: data.total_feedback,
        corrections: data.corrections,
        professional_accuracy: data.professional_accuracy,
        companion_accuracy: data.companion_accuracy,
        category_accuracy: data.category_accuracy || {}
      };

      const { error } = await supabase
        .from('detection_accuracy_snapshots')
        .upsert(snapshot, {
          onConflict: 'date'
        });

      if (error) {
        logger.error('[TimeSeries] Failed to create accuracy snapshot:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('[TimeSeries] Error creating accuracy snapshot:', error);
      return false;
    }
  }

  /**
   * Get accuracy trend data
   */
  async getAccuracyTrends(startDate: Date, endDate: Date): Promise<Array<{ date: string; accuracy: number }>> {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc('get_accuracy_trends', {
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: endDate.toISOString().split('T')[0]
      });

      if (error) {
        logger.error('[TimeSeries] Failed to get accuracy trends:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        date: row.date,
        accuracy: parseFloat(row.accuracy) || 0
      }));
    } catch (error) {
      logger.error('[TimeSeries] Error getting accuracy trends:', error);
      return [];
    }
  }
}

// Singleton instance
let timeSeriesServiceInstance: TimeSeriesService | null = null;

export function getTimeSeriesService(): TimeSeriesService {
  if (!timeSeriesServiceInstance) {
    timeSeriesServiceInstance = new TimeSeriesService();
  }
  return timeSeriesServiceInstance;
}
