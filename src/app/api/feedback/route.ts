/**
 * Feedback API
 *
 * Collect user feedback for improvement
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

interface FeedbackRequest {
  type: 'bug' | 'feature' | 'improvement' | 'general';
  message: string;
  rating?: number;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const anonUserId = request.cookies.get('infinity_anon_user')?.value;
    const effectiveUserId = user?.id || anonUserId || 'anonymous';

    const body: FeedbackRequest = await request.json();
    const { type, message, rating, conversationId, metadata } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 chars)' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from(TABLES.FEEDBACK).insert({
      user_id: effectiveUserId,
      type: type || 'general',
      message: message.trim(),
      rating,
      conversation_id: conversationId,
      metadata,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }

    logger.info(`[Feedback] Received ${type} feedback from user ${effectiveUserId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Feedback] Error:', error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
