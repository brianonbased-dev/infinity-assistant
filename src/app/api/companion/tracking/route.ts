/**
 * Companion Interest Tracking API
 * 
 * Endpoints for tracking and retrieving knowledge accumulation by life context and interests
 */

import { NextRequest, NextResponse } from 'next/server';
import { getInterestKnowledgeTracker } from '@/lib/life-context';
import type { LifeStage, InterestCategory } from '@/lib/life-context';
import logger from '@/utils/logger';

/**
 * GET /api/companion/tracking
 * 
 * Get knowledge accumulation statistics by life context and interests
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lifeStage = searchParams.get('lifeStage') as LifeStage | null;
    const interest = searchParams.get('interest') as InterestCategory | null;
    const format = searchParams.get('format') || 'json';

    const tracker = getInterestKnowledgeTracker();

    if (lifeStage && interest) {
      // Get metrics for specific life stage + interest combination
      const metrics = tracker.getMetrics(lifeStage, interest);
      if (!metrics) {
        return NextResponse.json(
          { error: 'Life stage and interest combination not found' },
          { status: 404 }
        );
      }

      if (format === 'export') {
        return new NextResponse(JSON.stringify(metrics, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="companion-tracking-${lifeStage}-${interest}.json"`,
          },
        });
      }

      return NextResponse.json({ success: true, data: metrics });
    }

    if (lifeStage) {
      // Get metrics for specific life stage
      const metrics = tracker.getMetricsByLifeStage(lifeStage);
      return NextResponse.json({ success: true, data: metrics });
    }

    if (interest) {
      // Get metrics for specific interest
      const metrics = tracker.getMetricsByInterest(interest);
      return NextResponse.json({ success: true, data: metrics });
    }

    // Get all stats
    const stats = tracker.getStats();
    const topInterests = tracker.getTopInterests(10);

    if (format === 'export') {
      return new NextResponse(tracker.exportMetrics(), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="companion-tracking-all.json"',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalQueries: stats.totalQueries,
          totalKnowledgeGaps: stats.totalKnowledgeGaps,
          totalExperimentalKnowledge: stats.totalExperimentalKnowledge,
          totalCanonicalKnowledge: stats.totalCanonicalKnowledge,
        },
        topInterests,
        byLifeStage: stats.byLifeStage,
        byInterest: stats.byInterest,
      },
    });
  } catch (error: unknown) {
    logger.error('[Companion Tracking API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve tracking data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/companion/tracking
 * 
 * Track a query or knowledge event for companion mode
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, lifeStage, interest, query, hadKnowledgeGap, knowledgeType } = body;

    if (!action || !interest) {
      return NextResponse.json(
        { error: 'action and interest are required' },
        { status: 400 }
      );
    }

    const tracker = getInterestKnowledgeTracker();

    switch (action) {
      case 'track_query':
        if (!query) {
          return NextResponse.json(
            { error: 'query is required for track_query action' },
            { status: 400 }
          );
        }
        // This is typically done in the chat API, but we support it here for external tracking
        const { getLifeContextDetectionService } = await import('@/lib/life-context');
        const contextService = getLifeContextDetectionService();
        const contextResult = contextService.detectLifeContext({ query });
        tracker.trackQuery(contextResult, query, hadKnowledgeGap || false);
        break;

      case 'track_experimental':
        tracker.trackExperimentalKnowledge(lifeStage || undefined, interest);
        break;

      case 'track_canonical':
        tracker.trackCanonicalKnowledge(lifeStage || undefined, interest);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('[Companion Tracking API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}

