/**
 * Job Knowledge Tracking API
 * 
 * Endpoints for tracking and retrieving knowledge accumulation by profession
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJobKnowledgeTracker } from '@/lib/job-detection';
import logger from '@/utils/logger';

/**
 * GET /api/jobs/tracking
 * 
 * Get knowledge accumulation statistics by job category
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const format = searchParams.get('format') || 'json';

    const tracker = getJobKnowledgeTracker();

    if (category) {
      // Get metrics for specific category
      const metrics = tracker.getMetrics(category as any);
      if (!metrics) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }

      if (format === 'export') {
        return new NextResponse(JSON.stringify(metrics, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="job-tracking-${category}.json"`,
          },
        });
      }

      return NextResponse.json({ success: true, data: metrics });
    }

    // Get all stats
    const stats = tracker.getStats();
    const topCategories = tracker.getTopCategories(10);

    if (format === 'export') {
      return new NextResponse(tracker.exportMetrics(), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="job-tracking-all.json"',
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
        topCategories,
        byCategory: stats.byCategory,
      },
    });
  } catch (error: unknown) {
    logger.error('[Job Tracking API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve tracking data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/jobs/tracking
 * 
 * Track a query or knowledge event
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, category, query, hadKnowledgeGap, knowledgeType } = body;

    if (!action || !category) {
      return NextResponse.json(
        { error: 'action and category are required' },
        { status: 400 }
      );
    }

    const tracker = getJobKnowledgeTracker();

    switch (action) {
      case 'track_query':
        if (!query) {
          return NextResponse.json(
            { error: 'query is required for track_query action' },
            { status: 400 }
          );
        }
        // This is typically done in the chat API, but we support it here for external tracking
        tracker.trackQuery(
          { category, confidence: 1, keywords: [] },
          query,
          hadKnowledgeGap || false
        );
        break;

      case 'track_experimental':
        tracker.trackExperimentalKnowledge(category);
        break;

      case 'track_canonical':
        tracker.trackCanonicalKnowledge(category);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('[Job Tracking API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}

