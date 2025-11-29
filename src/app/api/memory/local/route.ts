/**
 * Local Memory Management API
 *
 * Manages user's local editable memory (stored on device/localStorage).
 * This is the user-controlled memory that persists across sessions.
 *
 * Structure:
 * - wisdom: Key insights and learnings
 * - patterns: Reusable approaches
 * - gotchas: Problems and solutions
 * - facts: Personal facts and preferences
 * - profile: User profile info
 * - preferences: Memory settings
 *
 * All of this is stored locally so users can:
 * 1. Edit their memories directly
 * 2. Export/import their knowledge
 * 3. Have full transparency over what's stored
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserMemoryStorageService } from '@/lib/knowledge/UserMemoryStorageService';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';

/**
 * GET /api/memory/local
 *
 * Get user's full local memory
 */
export async function GET(request: NextRequest) {
  try {
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    const memoryService = getUserMemoryStorageService();
    const localMemory = await memoryService.getLocalMemory(userId);

    return NextResponse.json({
      success: true,
      memory: {
        wisdom: localMemory.wisdom,
        patterns: localMemory.patterns,
        gotchas: localMemory.gotchas,
        facts: localMemory.facts,
        profile: localMemory.profile,
        preferences: localMemory.preferences,
        stats: {
          wisdomCount: localMemory.wisdom.length,
          patternCount: localMemory.patterns.length,
          gotchaCount: localMemory.gotchas.length,
          factCount: localMemory.facts.length,
          lastUpdated: localMemory.lastUpdated,
        },
      },
    });
  } catch (error) {
    logger.error('[Local Memory API] Error fetching:', error);
    return NextResponse.json(
      { error: 'Failed to fetch local memory' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memory/local
 *
 * Add new entry to local memory
 * Body: { type: 'wisdom'|'patterns'|'gotchas'|'facts', data: {...} }
 */
export async function POST(request: NextRequest) {
  try {
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    const body = await request.json();
    const { type, data } = body;

    if (!type || !['wisdom', 'patterns', 'gotchas', 'facts'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be one of: wisdom, patterns, gotchas, facts' },
        { status: 400 }
      );
    }

    const memoryService = getUserMemoryStorageService();
    let entry;

    switch (type) {
      case 'wisdom':
        if (!data.content) {
          return NextResponse.json({ error: 'content is required for wisdom' }, { status: 400 });
        }
        entry = await memoryService.addWisdom(userId, data.content, {
          source: data.source,
          tags: data.tags,
          confidence: data.confidence,
        });
        break;

      case 'patterns':
        if (!data.name || !data.description) {
          return NextResponse.json({ error: 'name and description are required for patterns' }, { status: 400 });
        }
        entry = await memoryService.addPattern(userId, data.name, data.description, {
          useCase: data.useCase,
          example: data.example,
          tags: data.tags,
        });
        break;

      case 'gotchas':
        if (!data.problem || !data.solution) {
          return NextResponse.json({ error: 'problem and solution are required for gotchas' }, { status: 400 });
        }
        entry = await memoryService.addGotcha(userId, data.problem, data.solution, {
          context: data.context,
          tags: data.tags,
          severity: data.severity,
        });
        break;

      case 'facts':
        if (!data.content) {
          return NextResponse.json({ error: 'content is required for facts' }, { status: 400 });
        }
        entry = await memoryService.addFact(userId, data.content, {
          category: data.category,
          neverForget: data.neverForget,
        });
        break;
    }

    logger.info(`[Local Memory API] Added ${type} entry for user ${userId}`);

    return NextResponse.json({
      success: true,
      entry,
    });
  } catch (error) {
    logger.error('[Local Memory API] Error adding entry:', error);
    return NextResponse.json(
      { error: 'Failed to add memory entry' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/memory/local
 *
 * Update existing entry or profile/preferences
 * Body: { type, entryId, updates } or { updateType: 'profile'|'preferences', updates }
 */
export async function PUT(request: NextRequest) {
  try {
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    const body = await request.json();
    const { type, entryId, updates, updateType } = body;

    const memoryService = getUserMemoryStorageService();

    // Handle profile/preferences updates
    if (updateType === 'profile') {
      const success = await memoryService.updateProfile(userId, updates);
      return NextResponse.json({ success, message: success ? 'Profile updated' : 'Update failed' });
    }

    if (updateType === 'preferences') {
      const success = await memoryService.updatePreferences(userId, updates);
      return NextResponse.json({ success, message: success ? 'Preferences updated' : 'Update failed' });
    }

    // Handle entry updates
    if (!type || !['wisdom', 'patterns', 'gotchas', 'facts'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be one of: wisdom, patterns, gotchas, facts' },
        { status: 400 }
      );
    }

    if (!entryId) {
      return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
    }

    const success = await memoryService.updateEntry(userId, type, entryId, updates);

    if (!success) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    logger.info(`[Local Memory API] Updated ${type} entry ${entryId} for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Entry updated',
    });
  } catch (error) {
    logger.error('[Local Memory API] Error updating entry:', error);
    return NextResponse.json(
      { error: 'Failed to update memory entry' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/memory/local
 *
 * Delete a memory entry
 * Body: { type, entryId }
 */
export async function DELETE(request: NextRequest) {
  try {
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    const body = await request.json();
    const { type, entryId } = body;

    if (!type || !['wisdom', 'patterns', 'gotchas', 'facts'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be one of: wisdom, patterns, gotchas, facts' },
        { status: 400 }
      );
    }

    if (!entryId) {
      return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
    }

    const memoryService = getUserMemoryStorageService();
    const success = await memoryService.deleteEntry(userId, type, entryId);

    if (!success) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    logger.info(`[Local Memory API] Deleted ${type} entry ${entryId} for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Entry deleted',
    });
  } catch (error) {
    logger.error('[Local Memory API] Error deleting entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete memory entry' },
      { status: 500 }
    );
  }
}
