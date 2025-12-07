/**
 * Export Conversations
 * 
 * Export user conversations to JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserService } from '@/services/UserService';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

/**
 * GET /api/export/conversations
 * 
 * Export conversations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const conversationId = searchParams.get('conversationId');

    // Get user ID from auth
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Check auth
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

    // Build query
    let query = supabase
      .from(TABLES.CONVERSATIONS)
      .select('*')
      .eq('user_id', actualUserId)
      .order('created_at', { ascending: false });

    if (conversationId) {
      query = query.eq('id', conversationId);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('[Export] Failed to fetch conversations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    const conversations = (data || []).map(row => ({
      id: row.id,
      title: row.title || 'Untitled Conversation',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: row.message_count || 0,
      metadata: row.metadata || {},
    }));

    return NextResponse.json({
      success: true,
      exportDate: new Date().toISOString(),
      format: 'json',
      recordCount: conversations.length,
      conversations,
    });
  } catch (error: unknown) {
    logger.error('[Export] Error exporting conversations:', error);
    return NextResponse.json(
      { error: 'Failed to export conversations' },
      { status: 500 }
    );
  }
}

