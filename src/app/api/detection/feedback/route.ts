/**
 * Detection Feedback API
 * 
 * Allows users to provide feedback on job/life context detection accuracy
 * Used to improve detection algorithms
 */

import { NextRequest, NextResponse } from 'next/server';
import logger from '@/utils/logger';

interface DetectionFeedback {
  type: 'professional' | 'companion';
  detectedCategory: string;
  correctCategory?: string;
  query: string;
  userId?: string;
  timestamp: Date;
}

// In-memory storage (in production, use database)
const feedbackStore: DetectionFeedback[] = [];

/**
 * POST /api/detection/feedback
 * 
 * Submit feedback on detection accuracy
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, detectedCategory, correctCategory, query, userId } = body;

    if (!type || !detectedCategory || !query) {
      return NextResponse.json(
        { error: 'type, detectedCategory, and query are required' },
        { status: 400 }
      );
    }

    const feedback: DetectionFeedback = {
      type,
      detectedCategory,
      correctCategory,
      query,
      userId,
      timestamp: new Date()
    };

    feedbackStore.push(feedback);

    logger.info('[Detection Feedback] Received feedback:', {
      type,
      detectedCategory,
      correctCategory,
      hasCorrection: !!correctCategory
    });

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded',
      feedbackId: feedbackStore.length - 1
    });
  } catch (error: unknown) {
    logger.error('[Detection Feedback API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to record feedback' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/detection/feedback
 * 
 * Get feedback statistics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Check auth (simplified - in production, verify admin access)
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'professional' | 'companion' | null;

    const filteredFeedback = type 
      ? feedbackStore.filter(f => f.type === type)
      : feedbackStore;

    // Calculate accuracy metrics
    const totalFeedback = filteredFeedback.length;
    const corrections = filteredFeedback.filter(f => f.correctCategory).length;
    const accuracy = totalFeedback > 0 
      ? ((totalFeedback - corrections) / totalFeedback) * 100 
      : 100;

    // Group by category
    const categoryStats: Record<string, { total: number; corrections: number }> = {};
    filteredFeedback.forEach(f => {
      if (!categoryStats[f.detectedCategory]) {
        categoryStats[f.detectedCategory] = { total: 0, corrections: 0 };
      }
      categoryStats[f.detectedCategory].total += 1;
      if (f.correctCategory) {
        categoryStats[f.detectedCategory].corrections += 1;
      }
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalFeedback,
        corrections,
        accuracy: accuracy.toFixed(2),
        categoryStats: Object.entries(categoryStats).map(([category, stats]) => ({
          category,
          total: stats.total,
          corrections: stats.corrections,
          accuracy: ((stats.total - stats.corrections) / stats.total * 100).toFixed(2)
        }))
      },
      recentFeedback: filteredFeedback.slice(-20).reverse()
    });
  } catch (error: unknown) {
    logger.error('[Detection Feedback API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve feedback' },
      { status: 500 }
    );
  }
}

