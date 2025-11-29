/**
 * Content Usage API
 *
 * Returns storage usage statistics for the current user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserContentStorageService } from '@/services/UserContentStorageService';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';

/**
 * GET /api/content/usage
 *
 * Get user's storage usage statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    const storageService = getUserContentStorageService();
    const usage = await storageService.getStorageUsage(userId);

    return NextResponse.json(usage);
  } catch (error) {
    logger.error('[Content Usage API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get storage usage' },
      { status: 500 }
    );
  }
}
