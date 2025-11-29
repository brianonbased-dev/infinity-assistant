/**
 * Content Upload API
 *
 * Handles user file uploads with virus scanning and storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserContentStorageService } from '@/services/UserContentStorageService';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  // Images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  // Video
  'video/mp4',
  'video/webm',
  // Data
  'application/json',
  // Code
  'text/javascript',
  'text/typescript',
  'text/html',
  'text/css',
];

/**
 * POST /api/content/upload
 *
 * Upload a file
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;
    const description = formData.get('description') as string | null;
    const folder = formData.get('folder') as string | null;
    const tagsJson = formData.get('tags') as string | null;
    const isPublic = formData.get('isPublic') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}` },
        { status: 400 }
      );
    }

    // Get user ID
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Parse tags
    let tags: string[] = [];
    if (tagsJson) {
      try {
        tags = JSON.parse(tagsJson);
      } catch {
        tags = tagsJson.split(',').map((t) => t.trim());
      }
    }

    const storageService = getUserContentStorageService();
    const result = await storageService.uploadContent(userId, file, {
      name: name || file.name,
      description: description || undefined,
      folder: folder || undefined,
      tags,
      isPublic,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Upload failed' },
        { status: 500 }
      );
    }

    logger.info('[Content Upload] File uploaded', {
      userId,
      name: name || file.name,
      size: file.size,
    });

    return NextResponse.json({
      success: true,
      content: result.content,
      url: result.signedUrl,
    });
  } catch (error) {
    logger.error('[Content Upload] Error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
