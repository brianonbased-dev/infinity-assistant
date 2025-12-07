/**
 * Usage Analytics API
 * 
 * Provides detailed usage analytics for users
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserService } from '@/services/UserService';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

interface UsageDataPoint {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
}

interface UsageAnalytics {
  summary: {
    today: {
      requests: number;
      tokens: number;
      cost: number;
    };
    thisWeek: {
      requests: number;
      tokens: number;
      cost: number;
    };
    thisMonth: {
      requests: number;
      tokens: number;
      cost: number;
    };
    allTime: {
      requests: number;
      tokens: number;
      cost: number;
    };
  };
  trends: {
    daily: UsageDataPoint[];
    weekly: UsageDataPoint[];
    monthly: UsageDataPoint[];
  };
  breakdown: {
    byEndpoint: Array<{
      endpoint: string;
      requests: number;
      tokens: number;
      cost: number;
    }>;
    byModel: Array<{
      model: string;
      requests: number;
      tokens: number;
      cost: number;
    }>;
  };
  predictions: {
    estimatedMonthlyCost: number;
    projectedUsage: {
      requests: number;
      tokens: number;
    };
  };
}

// Token cost per 1M tokens (approximate)
const TOKEN_COSTS: Record<string, number> = {
  'claude-3-5-sonnet': 3.00, // $3 per 1M input, $15 per 1M output (average)
  'claude-3-opus': 15.00,
  'claude-3-sonnet': 3.00,
  'gpt-4': 30.00,
  'gpt-4-turbo': 10.00,
  'gpt-3.5-turbo': 0.50,
  'default': 3.00,
};

function calculateCost(tokens: number, model: string = 'default'): number {
  const costPerMillion = TOKEN_COSTS[model] || TOKEN_COSTS.default;
  return (tokens / 1_000_000) * costPerMillion;
}

export async function GET(request: NextRequest) {
  try {
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Check auth (should verify user is authenticated)
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/email`);
    const authData = await authResponse.json();
    
    if (!authData.authenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const actualUserId = authData.user?.id || userId;
    const supabase = getSupabaseClient();

    // Get date ranges
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 7);
    const startOfMonth = new Date(today);
    startOfMonth.setDate(1);
    const startOfYear = new Date(today);
    startOfYear.setMonth(0, 1);

    // Get usage data
    const { data: usageData, error: usageError } = await supabase
      .from(TABLES.USAGE)
      .select('*')
      .eq('user_id', actualUserId)
      .order('date', { ascending: false })
      .limit(365); // Last year

    if (usageError) {
      logger.error('[Usage Analytics] Error fetching usage:', usageError);
    }

    const usage = usageData || [];

    // Calculate summary
    const todayStr = today.toISOString().split('T')[0];
    const todayUsage = usage.find(u => u.date === todayStr) || { daily_count: 0, tokens_used: 0 };
    
    const weekUsage = usage
      .filter(u => new Date(u.date) >= startOfWeek)
      .reduce((acc, u) => ({
        requests: acc.requests + (u.daily_count || 0),
        tokens: acc.tokens + (u.tokens_used || 0),
      }), { requests: 0, tokens: 0 });

    const monthUsage = usage
      .filter(u => new Date(u.date) >= startOfMonth)
      .reduce((acc, u) => ({
        requests: acc.requests + (u.daily_count || 0),
        tokens: acc.tokens + (u.tokens_used || 0),
      }), { requests: 0, tokens: 0 });

    const allTimeUsage = usage.reduce((acc, u) => ({
      requests: acc.requests + (u.daily_count || 0),
      tokens: acc.tokens + (u.tokens_used || 0),
    }), { requests: 0, tokens: 0 });

    // Build daily trends (last 30 days)
    const dailyTrends: UsageDataPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayUsage = usage.find(u => u.date === dateStr) || { daily_count: 0, tokens_used: 0 };
      
      dailyTrends.push({
        date: dateStr,
        requests: dayUsage.daily_count || 0,
        tokens: dayUsage.tokens_used || 0,
        cost: calculateCost(dayUsage.tokens_used || 0),
      });
    }

    // Build weekly trends (last 12 weeks)
    const weeklyTrends: UsageDataPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7) - 6);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekUsage = usage.filter(u => {
        const date = new Date(u.date);
        return date >= weekStart && date <= weekEnd;
      }).reduce((acc, u) => ({
        requests: acc.requests + (u.daily_count || 0),
        tokens: acc.tokens + (u.tokens_used || 0),
      }), { requests: 0, tokens: 0 });

      weeklyTrends.push({
        date: weekStart.toISOString().split('T')[0],
        requests: weekUsage.requests,
        tokens: weekUsage.tokens,
        cost: calculateCost(weekUsage.tokens),
      });
    }

    // Build monthly trends (last 12 months)
    const monthlyTrends: UsageDataPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(today);
      monthStart.setMonth(today.getMonth() - i);
      monthStart.setDate(1);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthStart.getMonth() + 1);
      monthEnd.setDate(0);

      const monthUsage = usage.filter(u => {
        const date = new Date(u.date);
        return date >= monthStart && date <= monthEnd;
      }).reduce((acc, u) => ({
        requests: acc.requests + (u.daily_count || 0),
        tokens: acc.tokens + (u.tokens_used || 0),
      }), { requests: 0, tokens: 0 });

      monthlyTrends.push({
        date: monthStart.toISOString().split('T')[0],
        requests: monthUsage.requests,
        tokens: monthUsage.tokens,
        cost: calculateCost(monthUsage.tokens),
      });
    }

    // Calculate predictions (simple linear projection)
    const avgDailyTokens = monthUsage.tokens / Math.max(1, today.getDate());
    const avgDailyRequests = monthUsage.requests / Math.max(1, today.getDate());
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    const projectedMonthlyTokens = avgDailyTokens * daysInMonth;
    const projectedMonthlyRequests = avgDailyRequests * daysInMonth;
    const estimatedMonthlyCost = calculateCost(projectedMonthlyTokens);

    const analytics: UsageAnalytics = {
      summary: {
        today: {
          requests: todayUsage.daily_count || 0,
          tokens: todayUsage.tokens_used || 0,
          cost: calculateCost(todayUsage.tokens_used || 0),
        },
        thisWeek: {
          requests: weekUsage.requests,
          tokens: weekUsage.tokens,
          cost: calculateCost(weekUsage.tokens),
        },
        thisMonth: {
          requests: monthUsage.requests,
          tokens: monthUsage.tokens,
          cost: calculateCost(monthUsage.tokens),
        },
        allTime: {
          requests: allTimeUsage.requests,
          tokens: allTimeUsage.tokens,
          cost: calculateCost(allTimeUsage.tokens),
        },
      },
      trends: {
        daily: dailyTrends,
        weekly: weeklyTrends,
        monthly: monthlyTrends,
      },
      breakdown: {
        byEndpoint: [], // Would need additional tracking
        byModel: [], // Would need additional tracking
      },
      predictions: {
        estimatedMonthlyCost: estimatedMonthlyCost,
        projectedUsage: {
          requests: projectedMonthlyRequests,
          tokens: projectedMonthlyTokens,
        },
      },
    };

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (error: unknown) {
    logger.error('[Usage Analytics] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage analytics' },
      { status: 500 }
    );
  }
}

