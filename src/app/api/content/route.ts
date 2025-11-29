/**
 * Content Management API
 *
 * Manages user-generated and assistant-created content.
 * - GET: List user's content with filtering
 * - POST: Create content record (for assistant-generated content)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserContentStorageService } from '@/services/UserContentStorageService';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';

/**
 * GET /api/content
 *
 * List user's content with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get user ID
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Parse query params
    const contentType = searchParams.get('contentType') as 'document' | 'image' | 'video' | 'audio' | 'code' | 'data' | undefined;
    const createdBy = searchParams.get('createdBy') as 'user' | 'assistant' | undefined;
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const sortBy = searchParams.get('sortBy') as 'createdAt' | 'name' | 'size' | undefined;
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const storageService = getUserContentStorageService();
    const result = await storageService.listContent(userId, {
      contentType,
      createdBy,
      tags,
      sortBy,
      sortOrder,
      limit,
      offset,
    });

    return NextResponse.json({
      content: result.content,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('[Content API] List error:', error);
    return NextResponse.json(
      { error: 'Failed to list content' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/content
 *
 * Store assistant-generated content
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, mimeType, data, conversationId, prompt, tags } = body;

    if (!name || !mimeType || !data) {
      return NextResponse.json(
        { error: 'name, mimeType, and data are required' },
        { status: 400 }
      );
    }

    // Get user ID
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    const storageService = getUserContentStorageService();

    // Decode base64 data if provided
    const buffer = Buffer.from(data, 'base64');

    const result = await storageService.storeGeneratedContent(userId, buffer, {
      name,
      mimeType,
      conversationId,
      prompt,
      tags,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to store content' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      content: result.content,
      url: result.signedUrl,
    });
  } catch (error) {
    logger.error('[Content API] Create error:', error);
    return NextResponse.json(
      { error: 'Failed to create content' },
      { status: 500 }
    );
  }
}
