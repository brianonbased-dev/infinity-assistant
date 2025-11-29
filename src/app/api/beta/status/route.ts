/**
 * Beta Status API
 *
 * Returns current beta period status and configuration.
 *
 * GET /api/beta/status
 * - Get beta status, features, and usage limits
 *
 * @since 2025-11-29
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getBetaStatus,
  getAllBetaUsers,
  getBetaConversionStats,
  getBetaUsageStats,
  BETA_USAGE_LIMITS,
} from '@/services/BetaWrapperService';

/**
 * GET /api/beta/status
 *
 * Get current beta status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeStats = searchParams.get('stats') === 'true';
    const adminKey = searchParams.get('adminKey');

    const betaStatus = getBetaStatus();

    const response: Record<string, unknown> = {
      success: true,
      beta: {
        isActive: betaStatus.isBeta,
        version: betaStatus.version,
        startDate: betaStatus.startDate.toISOString(),
        endDate: betaStatus.endDate.toISOString(),
        daysRemaining: betaStatus.daysRemaining,
        hoursRemaining: betaStatus.hoursRemaining,
        showExpiryWarning: betaStatus.showExpiryWarning,
      },
      features: betaStatus.features,
      usageLimits: BETA_USAGE_LIMITS,
      ui: {
        badgeText: betaStatus.badgeText,
        bannerText: betaStatus.bannerText,
      },
    };

    // Include admin stats if requested with valid admin key
    if (includeStats && adminKey === process.env.ADMIN_API_KEY) {
      const conversionStats = getBetaConversionStats();
      const usageStats = getBetaUsageStats();

      response.stats = {
        users: {
          total: conversionStats.totalBetaUsers,
          converted: conversionStats.convertedUsers,
          conversionRate: (conversionStats.conversionRate * 100).toFixed(2) + '%',
          tierBreakdown: conversionStats.tierBreakdown,
        },
        usage: usageStats,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get beta status',
      },
      { status: 500 }
    );
  }
}
