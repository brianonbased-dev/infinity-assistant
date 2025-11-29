/**
 * Content Item API
 *
 * Operations on individual content items.
 * - GET: Get content details
 * - DELETE: Delete content
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserContentStorageService } from '@/services/UserContentStorageService';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/content/[id]
 *
 * Get content details
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Get user ID
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    const storageService = getUserContentStorageService();
    const url = await storageService.getDownloadUrl(userId, id);

    if (!url) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ url });
  } catch (error) {
    logger.error('[Content API] Get error:', error);
    return NextResponse.json(
      { error: 'Failed to get content' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/content/[id]
 *
 * Delete content
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Get user ID
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    const storageService = getUserContentStorageService();
    const success = await storageService.deleteContent(userId, id);

    if (!success) {
      return NextResponse.json(
        { error: 'Content not found or delete failed' },
        { status: 404 }
      );
    }

    logger.info('[Content API] Content deleted', { userId, contentId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Content API] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete content' },
      { status: 500 }
    );
  }
}
