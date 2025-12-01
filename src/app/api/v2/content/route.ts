/**
 * Content Management API v2
 *
 * Unified content API using middleware pattern.
 *
 * @route /api/v2/content
 */

import { NextRequest } from 'next/server';
import { withAuth, success, error, parseBody, getQuery, type AuthenticatedContext } from '@/lib/apiMiddleware';
import { getUserContentStorageService } from '@/services/UserContentStorageService';
import { eventBus, createPayload } from '@/lib/EventBus';

// ============================================================================
// Types
// ============================================================================

type ContentType = 'document' | 'image' | 'video' | 'audio' | 'code' | 'data';
type CreatedBy = 'user' | 'assistant';

interface ContentListQuery {
  contentType?: ContentType;
  createdBy?: CreatedBy;
  tags?: string;
  sortBy?: 'createdAt' | 'name' | 'size';
  sortOrder?: 'asc' | 'desc';
  limit?: string;
  offset?: string;
}

interface CreateContentRequest {
  name: string;
  mimeType: string;
  data: string; // base64
  conversationId?: string;
  prompt?: string;
  tags?: string[];
}

// ============================================================================
// GET - List Content
// ============================================================================

export const GET = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const query = getQuery(req) as ContentListQuery;

  const options = {
    contentType: query.contentType,
    createdBy: query.createdBy,
    tags: query.tags?.split(',').filter(Boolean),
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    limit: parseInt(query.limit || '20', 10),
    offset: parseInt(query.offset || '0', 10),
  };

  try {
    const storageService = getUserContentStorageService();
    const result = await storageService.listContent(ctx.userId, options);

    return success({
      content: result.content,
      total: result.total,
      limit: options.limit,
      offset: options.offset,
      filters: {
        contentType: options.contentType,
        createdBy: options.createdBy,
        tags: options.tags,
      },
    }, ctx);
  } catch (err) {
    return error('STORAGE_ERROR', 'Failed to list content', 500);
  }
}, {
  rateLimit: 60,
});

// ============================================================================
// POST - Create Content
// ============================================================================

export const POST = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const body = await parseBody<CreateContentRequest>(req);

  if (!body?.name || !body?.mimeType || !body?.data) {
    return error('VALIDATION_FAILED', 'name, mimeType, and data are required', 400);
  }

  const { name, mimeType, data, conversationId, prompt, tags } = body;

  try {
    const storageService = getUserContentStorageService();

    // Decode base64 data
    const buffer = Buffer.from(data, 'base64');

    // Check file size (max 50MB)
    if (buffer.length > 50 * 1024 * 1024) {
      return error('FILE_TOO_LARGE', 'Maximum file size is 50MB', 400);
    }

    const result = await storageService.storeGeneratedContent(ctx.userId, buffer, {
      name,
      mimeType,
      conversationId,
      prompt,
      tags,
    });

    if (!result.success) {
      return error('STORAGE_ERROR', result.error || 'Failed to store content', 500);
    }

    eventBus.emit('content.created' as any, {
      source: 'Content API',
      timestamp: Date.now(),
      userId: ctx.userId,
      contentId: result.content?.id,
      mimeType,
      size: buffer.length,
    } as any);

    return success({
      content: result.content,
      url: result.signedUrl,
    }, ctx);
  } catch (err) {
    return error('INTERNAL_ERROR', 'Failed to create content', 500);
  }
}, {
  rateLimit: 30,
  bodySchema: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 255 },
    mimeType: { type: 'string', required: true },
    data: { type: 'string', required: true },
  },
});

// ============================================================================
// DELETE - Delete Content
// ============================================================================

export const DELETE = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const query = getQuery(req);
  const contentId = query.id;

  if (!contentId) {
    return error('VALIDATION_FAILED', 'Content ID is required', 400);
  }

  try {
    const storageService = getUserContentStorageService();
    const deleted = await storageService.deleteContent(ctx.userId, contentId);

    if (!deleted) {
      return error('DELETE_FAILED', 'Failed to delete content', 500);
    }

    eventBus.emit('content.deleted' as any, {
      source: 'Content API',
      timestamp: Date.now(),
      userId: ctx.userId,
      contentId,
    } as any);

    return success({ deleted: true, contentId }, ctx);
  } catch (err) {
    return error('INTERNAL_ERROR', 'Failed to delete content', 500);
  }
}, {
  rateLimit: 30,
});
