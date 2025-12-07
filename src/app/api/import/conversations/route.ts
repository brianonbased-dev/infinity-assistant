/**
 * Import Conversations
 * 
 * Import conversations from JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserService } from '@/services/UserService';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';
import crypto from 'crypto';

/**
 * POST /api/import/conversations
 * 
 * Import conversations from JSON
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

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

    // Read and parse JSON file
    const fileContent = await file.text();
    let jsonData: any;

    try {
      jsonData = JSON.parse(fileContent);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON file format' },
        { status: 400 }
      );
    }

    // Extract conversations array
    const conversations = jsonData.conversations || jsonData.data || (Array.isArray(jsonData) ? jsonData : []);

    if (!Array.isArray(conversations) || conversations.length === 0) {
      return NextResponse.json(
        { error: 'Invalid file format or empty conversations array' },
        { status: 400 }
      );
    }

    // Validate and transform data
    const supabase = getSupabaseClient();
    const records = conversations.map((conv: any) => ({
      id: conv.id || crypto.randomUUID(),
      user_id: actualUserId,
      title: conv.title || conv.name || 'Imported Conversation',
      message_count: parseInt(conv.messageCount || conv.message_count || '0', 10) || 0,
      metadata: conv.metadata || {},
      created_at: conv.createdAt || conv.created_at || new Date().toISOString(),
      updated_at: conv.updatedAt || conv.updated_at || new Date().toISOString(),
    }));

    // Insert records (in batches for large files)
    const batchSize = 50;
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from(TABLES.CONVERSATIONS)
        .upsert(batch, { onConflict: 'id' }); // Use upsert to handle duplicates

      if (error) {
        logger.error('[Import] Failed to import batch:', error);
        errors += batch.length;
      } else {
        imported += batch.length;
      }
    }

    logger.info('[Import] Conversations import completed:', {
      userId: actualUserId,
      imported,
      errors,
      total: records.length,
    });

    return NextResponse.json({
      success: true,
      imported,
      errors,
      total: records.length,
      message: `Successfully imported ${imported} conversations${errors > 0 ? ` (${errors} failed)` : ''}`,
    });
  } catch (error: unknown) {
    logger.error('[Import] Error importing conversations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import conversations' },
      { status: 500 }
    );
  }
}

