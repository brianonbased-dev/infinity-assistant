/**
 * Memory Management API v2
 *
 * Unified memory API using middleware pattern.
 *
 * @route /api/v2/memory
 */

import { NextRequest } from 'next/server';
import { withAuth, success, error, parseBody, getQuery, type AuthenticatedContext } from '@/lib/apiMiddleware';
import { getConversationMemoryService } from '@/lib/knowledge';
import { eventBus, createPayload } from '@/lib/EventBus';

// ============================================================================
// Types
// ============================================================================

type MemoryType = 'wisdom' | 'pattern' | 'gotcha' | 'fact';
type DeleteType = 'critical' | 'compressed' | 'all';

interface StoreMemoryRequest {
  conversationId: string;
  content: string;
  type?: MemoryType;
}

interface DeleteMemoryRequest {
  conversationId: string;
  type: DeleteType;
  entryId?: string;
}

// ============================================================================
// GET - Retrieve Memory
// ============================================================================

export const GET = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const query = getQuery(req);
  const conversationId = query.conversationId;

  if (!conversationId) {
    return error('VALIDATION_FAILED', 'conversationId is required', 400);
  }

  try {
    const memoryService = getConversationMemoryService();
    const memory = memoryService.getMemory(conversationId);

    if (!memory) {
      return success({
        memory: {
          recentMessages: [],
          compressedHistory: [],
          criticalFacts: [],
        },
        stats: {
          totalEntries: 0,
          criticalFacts: 0,
          compressedSegments: 0,
        },
      }, ctx);
    }

    return success({
      memory: {
        recentMessages: memory.activeMemory.map((m: any) => ({
          id: m.id,
          type: m.type,
          content: m.content.substring(0, 200) + (m.content.length > 200 ? '...' : ''),
          importance: m.importance,
          tags: m.tags,
          timestamp: m.createdAt,
        })),
        compressedHistory: memory.compressedMemory,
        criticalFacts: memory.criticalFacts,
      },
      stats: {
        totalEntries: memory.activeMemory.length,
        criticalFacts: memory.criticalFacts.length,
        compressedSegments: memory.compressedMemory.length,
      },
    }, ctx);
  } catch (err) {
    return error('MEMORY_ERROR', 'Failed to fetch memory', 500);
  }
}, {
  rateLimit: 60,
});

// ============================================================================
// POST - Store Memory Entry
// ============================================================================

export const POST = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const body = await parseBody<StoreMemoryRequest>(req);

  if (!body?.conversationId) {
    return error('VALIDATION_FAILED', 'conversationId is required', 400);
  }

  if (!body?.content || typeof body.content !== 'string') {
    return error('VALIDATION_FAILED', 'content is required and must be a string', 400);
  }

  const { conversationId, content, type = 'fact' } = body;

  const validTypes: MemoryType[] = ['wisdom', 'pattern', 'gotcha', 'fact'];
  if (!validTypes.includes(type)) {
    return error('VALIDATION_FAILED', `type must be one of: ${validTypes.join(', ')}`, 400);
  }

  try {
    const memoryService = getConversationMemoryService();
    const entry = await memoryService.storeExplicitKnowledge(conversationId, content, type);

    eventBus.emit('memory.stored' as any, {
      source: 'Memory API',
      timestamp: Date.now(),
      userId: ctx.userId,
      conversationId,
      type,
      entryId: entry.id,
    } as any);

    return success({
      entry: {
        id: entry.id,
        content: entry.content,
        type: entry.type,
        importance: entry.importance,
        createdAt: entry.createdAt,
      },
    }, ctx);
  } catch (err) {
    return error('MEMORY_ERROR', 'Failed to store memory', 500);
  }
}, {
  rateLimit: 30,
  bodySchema: {
    conversationId: { type: 'string', required: true },
    content: { type: 'string', required: true, minLength: 1, maxLength: 10000 },
    type: { type: 'string', enum: ['wisdom', 'pattern', 'gotcha', 'fact'] },
  },
});

// ============================================================================
// DELETE - Delete Memory Entries
// ============================================================================

export const DELETE = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const body = await parseBody<DeleteMemoryRequest>(req);

  if (!body?.conversationId) {
    return error('VALIDATION_FAILED', 'conversationId is required', 400);
  }

  const validDeleteTypes: DeleteType[] = ['critical', 'compressed', 'all'];
  if (!body?.type || !validDeleteTypes.includes(body.type)) {
    return error('VALIDATION_FAILED', `type must be one of: ${validDeleteTypes.join(', ')}`, 400);
  }

  const { conversationId, type, entryId } = body;

  try {
    const memoryService = getConversationMemoryService();
    const memory = memoryService.getMemory(conversationId);

    if (!memory) {
      return error('NOT_FOUND', 'No memory found for this conversation', 404);
    }

    if (type === 'all') {
      memoryService.clearMemory(conversationId);

      eventBus.emit('memory.cleared' as any, {
        source: 'Memory API',
        timestamp: Date.now(),
        userId: ctx.userId,
        conversationId,
      } as any);

      return success({ deleted: true, type: 'all', message: 'All memory cleared' }, ctx);
    }

    if (type === 'critical' && entryId) {
      const updatedFacts = memory.criticalFacts.filter((f: any) => f.id !== entryId);
      memoryService.updateMemory(conversationId, {
        ...memory,
        criticalFacts: updatedFacts,
      });

      return success({ deleted: true, type: 'critical', entryId }, ctx);
    }

    if (type === 'compressed' && entryId) {
      const index = parseInt(entryId, 10);
      if (!isNaN(index) && index >= 0 && index < memory.compressedMemory.length) {
        const updatedMemory = [...memory.compressedMemory];
        updatedMemory.splice(index, 1);
        memoryService.updateMemory(conversationId, {
          ...memory,
          compressedMemory: updatedMemory,
        });

        return success({ deleted: true, type: 'compressed', index }, ctx);
      }
    }

    return error('INVALID_REQUEST', 'Invalid delete request - entryId required for specific deletions', 400);
  } catch (err) {
    return error('MEMORY_ERROR', 'Failed to delete memory', 500);
  }
}, {
  rateLimit: 20,
});
