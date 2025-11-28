/**
 * Infinity Assistant - Advanced Search API
 *
 * Provides advanced search capabilities for InfinityAssistant.io
 * All searches go through Master Portal for orchestration
 */

import { NextRequest, NextResponse } from 'next/server';
import { CapabilityLimiter } from '@/lib/capability-limiter';
import { AgentCapabilityMode, UserTier } from '@/types/agent-capabilities';
import { withOptionalRateLimit } from '@/middleware/apiRateLimit';
import { getMasterPortalClient } from '@/services/MasterPortalClient';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error-handling';

interface SearchRequest {
  query: string;
  type?: 'all' | 'wisdom' | 'patterns' | 'gotchas';
  limit?: number;
  domain?: string;
  tags?: string[];
  userId?: string;
  userTier?: UserTier;
}

interface SearchResponse {
  success: boolean;
  query: string;
  results: {
    wisdom: Array<{
      id: string;
      title: string;
      content: string;
      score: number;
      source: string;
    }>;
    patterns: Array<{
      id: string;
      name: string;
      description: string;
      score: number;
      domain: string;
    }>;
    gotchas: Array<{
      id: string;
      title: string;
      content: string;
      score: number;
      source: string;
    }>;
  };
  counts: {
    total: number;
    wisdom: number;
    patterns: number;
    gotchas: number;
  };
  metadata: {
    searchTimeMs: number;
    sources: string[];
  };
}

/**
 * POST /api/search
 *
 * Advanced knowledge base search through Master Portal
 */
export const POST = withOptionalRateLimit(async (request: NextRequest) => {
  const startTime = Date.now();

  try {
    const body: SearchRequest = await request.json();
    const { query, type = 'all', limit = 20, domain, tags, userId, userTier } = body;

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (query.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Query too long. Maximum 500 characters.' },
        { status: 400 }
      );
    }

    // Get user tier
    const userService = getUserService();
    const finalUserTier = userTier || 'free';

    // Create execution context
    const context = await CapabilityLimiter.getPublicContext(
      userId || 'anonymous',
      finalUserTier
    );

    // Query knowledge base through Master Portal
    const masterPortal = getMasterPortalClient();
    const knowledgeResult = await masterPortal.searchKnowledge(query.trim(), {
      type,
      limit: Math.min(limit, 50),
      domain,
      tags,
    });

    // Format results for public API
    const formattedResults: SearchResponse['results'] = {
      wisdom: (knowledgeResult.grouped?.wisdom || []).slice(0, limit).map((item: any) => ({
        id: item.id,
        title: item.metadata?.title || 'Wisdom',
        content: item.content,
        score: item.score,
        source: item.source,
      })),
      patterns: (knowledgeResult.grouped?.patterns || []).slice(0, limit).map((item: any) => ({
        id: item.id,
        name: item.metadata?.title || item.metadata?.pattern_id || 'Pattern',
        description: item.content,
        score: item.score,
        domain: item.metadata?.domain || 'general',
      })),
      gotchas: (knowledgeResult.grouped?.gotchas || []).slice(0, limit).map((item: any) => ({
        id: item.id,
        title: item.metadata?.title || 'Gotcha',
        content: item.content,
        score: item.score,
        source: item.source,
      })),
    };

    const searchTime = Date.now() - startTime;

    const response: SearchResponse = {
      success: true,
      query: query.trim(),
      results: formattedResults,
      counts: {
        total: knowledgeResult.counts?.total || 0,
        wisdom: knowledgeResult.counts?.wisdom || 0,
        patterns: knowledgeResult.counts?.patterns || 0,
        gotchas: knowledgeResult.counts?.gotchas || 0,
      },
      metadata: {
        searchTimeMs: searchTime,
        sources: ['knowledge-base'],
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Assistant Search API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred during search. Please try again later.',
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/search
 *
 * Get search suggestions (autocomplete)
 */
export const GET = withOptionalRateLimit(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ success: true, suggestions: [] }, { status: 200 });
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return NextResponse.json({ success: true, suggestions: [] }, { status: 200 });
    }

    // Query knowledge base through Master Portal
    const masterPortal = getMasterPortalClient();
    const knowledgeResult = await masterPortal.searchKnowledge(trimmedQuery, {
      limit: Math.min(limit * 2, 30),
      type: 'all',
    });

    // Extract suggestions from results
    const suggestions: Array<{
      text: string;
      type: 'pattern' | 'wisdom' | 'gotcha' | 'query';
      score: number;
      metadata?: Record<string, any>;
    }> = [];

    // Add pattern names
    (knowledgeResult.grouped?.patterns || []).slice(0, limit).forEach((pattern: any) => {
      const title = pattern.metadata?.title || pattern.metadata?.pattern_id || pattern.content?.substring(0, 50);
      if (title && !suggestions.find((s) => s.text === title)) {
        suggestions.push({
          text: title,
          type: 'pattern',
          score: pattern.score,
          metadata: {
            domain: pattern.metadata?.domain,
            pattern_id: pattern.metadata?.pattern_id,
          },
        });
      }
    });

    // Add wisdom titles
    (knowledgeResult.grouped?.wisdom || []).slice(0, limit).forEach((wisdom: any) => {
      const title = wisdom.metadata?.title || wisdom.content?.substring(0, 50);
      if (title && !suggestions.find((s) => s.text === title)) {
        suggestions.push({
          text: title,
          type: 'wisdom',
          score: wisdom.score,
          metadata: {
            wisdom_id: wisdom.metadata?.wisdom_id,
          },
        });
      }
    });

    // Add gotcha titles
    (knowledgeResult.grouped?.gotchas || []).slice(0, limit).forEach((gotcha: any) => {
      const title = gotcha.metadata?.title || gotcha.content?.substring(0, 50);
      if (title && !suggestions.find((s) => s.text === title)) {
        suggestions.push({
          text: title,
          type: 'gotcha',
          score: gotcha.score,
          metadata: {
            gotcha_id: gotcha.metadata?.gotcha_id,
          },
        });
      }
    });

    // Sort by score and limit
    const sortedSuggestions = suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => ({
        text: s.text,
        type: s.type,
        metadata: s.metadata,
      }));

    return NextResponse.json(
      {
        success: true,
        suggestions: sortedSuggestions,
        query: trimmedQuery,
        count: sortedSuggestions.length,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error('[Assistant Search Suggestions] Error:', error);

    return NextResponse.json(
      {
        success: true,
        suggestions: [],
        query: '',
        error: 'Failed to load suggestions',
      },
      { status: 200 }
    );
  }
});

