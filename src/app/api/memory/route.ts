/**
 * Memory Management API
 *
 * Allows users to view and manage their conversation memory
 * - GET: Retrieve memory for a conversation
 * - DELETE: Remove specific facts or clear all memory
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConversationMemoryService } from '@/lib/knowledge';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';

/**
 * GET /api/memory
 *
 * Get memory for a conversation
 * Query params: conversationId
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    // Get user ID from cookie
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Get memory service
    const memoryService = getConversationMemoryService();
    const memory = memoryService.getMemory(conversationId);

    if (!memory) {
      return NextResponse.json({
        memory: {
          recentMessages: [],
          compressedHistory: [],
          criticalFacts: [],
        },
      });
    }

    // Return memory mapped to UI-expected format
    // ConversationMemory uses activeMemory/compressedMemory,
    // but UI expects recentMessages/compressedHistory
    return NextResponse.json({
      memory: {
        recentMessages: memory.activeMemory.map((m: { id: string; type: string; content: string; importance: string; tags?: string[]; createdAt: string }) => ({
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
    });
  } catch (error) {
    logger.error('[Memory API] Error fetching memory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch memory' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memory
 *
 * Explicitly store a memory entry
 * Body: { conversationId, content, type: 'wisdom' | 'pattern' | 'gotcha' | 'fact' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, content, type = 'fact' } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content is required and must be a string' },
        { status: 400 }
      );
    }

    if (!['wisdom', 'pattern', 'gotcha', 'fact'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be one of: wisdom, pattern, gotcha, fact' },
        { status: 400 }
      );
    }

    const memoryService = getConversationMemoryService();
    const entry = await memoryService.storeExplicitKnowledge(conversationId, content, type);

    logger.info(`[Memory API] Stored ${type} for conversation ${conversationId}`);

    return NextResponse.json({
      success: true,
      entry: {
        id: entry.id,
        content: entry.content,
        type: entry.type,
        importance: entry.importance,
        createdAt: entry.createdAt,
      },
    });
  } catch (error) {
    logger.error('[Memory API] Error storing memory:', error);
    return NextResponse.json(
      { error: 'Failed to store memory' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/memory
 *
 * Delete memory entries
 * Body: { conversationId, type: 'critical' | 'compressed' | 'all', entryId?: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, type, entryId } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    if (!type || !['critical', 'compressed', 'all'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be one of: critical, compressed, all' },
        { status: 400 }
      );
    }

    // Get memory service
    const memoryService = getConversationMemoryService();
    const memory = memoryService.getMemory(conversationId);

    if (!memory) {
      return NextResponse.json(
        { error: 'No memory found for this conversation' },
        { status: 404 }
      );
    }

    if (type === 'all') {
      // Clear all memory for this conversation
      memoryService.clearMemory(conversationId);
      logger.info(`[Memory API] Cleared all memory for conversation ${conversationId}`);
      return NextResponse.json({ success: true, message: 'All memory cleared' });
    }

    if (type === 'critical' && entryId) {
      // Remove specific critical fact
      const updatedFacts = memory.criticalFacts.filter((f: { id: string }) => f.id !== entryId);
      memoryService.updateMemory(conversationId, {
        ...memory,
        criticalFacts: updatedFacts,
      });
      logger.info(`[Memory API] Removed critical fact ${entryId} from conversation ${conversationId}`);
      return NextResponse.json({ success: true, message: 'Fact removed' });
    }

    if (type === 'compressed' && entryId) {
      // Remove specific compressed segment (by index)
      const index = parseInt(entryId, 10);
      if (!isNaN(index) && index >= 0 && index < memory.compressedMemory.length) {
        const updatedMemory = [...memory.compressedMemory];
        updatedMemory.splice(index, 1);
        memoryService.updateMemory(conversationId, {
          ...memory,
          compressedMemory: updatedMemory,
        });
        logger.info(`[Memory API] Removed compressed segment ${index} from conversation ${conversationId}`);
        return NextResponse.json({ success: true, message: 'Segment removed' });
      }
    }

    return NextResponse.json(
      { error: 'Invalid delete request' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('[Memory API] Error deleting memory:', error);
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 }
    );
  }
}
