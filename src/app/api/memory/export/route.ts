/**
 * Memory Export/Import API
 *
 * Allows users to export and import their local memory.
 * This gives users full control and portability of their knowledge.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserMemoryStorageService } from '@/lib/knowledge/UserMemoryStorageService';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';

/**
 * GET /api/memory/export
 *
 * Export user's full local memory as JSON
 */
export async function GET(request: NextRequest) {
  try {
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    const memoryService = getUserMemoryStorageService();
    const exportData = await memoryService.exportMemory(userId);

    // Return as downloadable JSON
    return new NextResponse(exportData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="infinity-memory-${userId.slice(0, 8)}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    logger.error('[Memory Export API] Error exporting:', error);
    return NextResponse.json(
      { error: 'Failed to export memory' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memory/export
 *
 * Import memory from JSON
 * Body: { data: string (JSON) } or FormData with file
 */
export async function POST(request: NextRequest) {
  try {
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    let jsonData: string;

    // Check if it's FormData (file upload) or JSON body
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      jsonData = await file.text();
    } else {
      // JSON body
      const body = await request.json();
      jsonData = typeof body.data === 'string' ? body.data : JSON.stringify(body.data);
    }

    // Validate JSON
    try {
      JSON.parse(jsonData);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON format' },
        { status: 400 }
      );
    }

    const memoryService = getUserMemoryStorageService();
    const success = await memoryService.importMemory(userId, jsonData);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to import memory - invalid format' },
        { status: 400 }
      );
    }

    logger.info(`[Memory Export API] Imported memory for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Memory imported successfully',
    });
  } catch (error) {
    logger.error('[Memory Export API] Error importing:', error);
    return NextResponse.json(
      { error: 'Failed to import memory' },
      { status: 500 }
    );
  }
}
