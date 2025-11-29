/**
 * Infinity Assistant - Advanced Search API
 *
 * Provides search capabilities for InfinityAssistant.io
 *
 * FREE TIER: Basic knowledge base search
 * - Searches existing W/P/G knowledge
 * - If no results, triggers knowledge gap capture
 * - User still gets an answer via quick research
 * - Knowledge is created for future searches
 *
 * PRO TIER: Deep research with synthesis
 * - Full web search + knowledge base
 * - AI-powered synthesis
 * - No restrictions
 */

import { NextRequest, NextResponse } from 'next/server';
import { CapabilityLimiter } from '@/lib/capability-limiter';
import { UserTier, getRateLimitsForTier } from '@/types/agent-capabilities';
import {
  KnowledgeItem,
  FormattedWisdomItem,
  FormattedPatternItem,
  FormattedGotchaItem,
  SearchSuggestion,
} from '@/types/knowledge';
import { withOptionalRateLimit } from '@/middleware/apiRateLimit';
import { getMasterPortalClient } from '@/services/MasterPortalClient';
import logger from '@/utils/logger';

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
    wisdom: FormattedWisdomItem[];
    patterns: FormattedPatternItem[];
    gotchas: FormattedGotchaItem[];
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
 * Format a knowledge item as a wisdom result
 */
function formatWisdomItem(item: KnowledgeItem): FormattedWisdomItem {
  return {
    id: item.id,
    title: item.metadata?.title || 'Wisdom',
    content: item.content,
    score: item.score,
    source: item.source,
  };
}

/**
 * Format a knowledge item as a pattern result
 */
function formatPatternItem(item: KnowledgeItem): FormattedPatternItem {
  return {
    id: item.id,
    name: item.metadata?.title || item.metadata?.pattern_id || 'Pattern',
    description: item.content,
    score: item.score,
    domain: item.metadata?.domain || 'general',
  };
}

/**
 * Format a knowledge item as a gotcha result
 */
function formatGotchaItem(item: KnowledgeItem): FormattedGotchaItem {
  return {
    id: item.id,
    title: item.metadata?.title || 'Gotcha',
    content: item.content,
    score: item.score,
    source: item.source,
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
    const finalUserTier = userTier || 'free';

    // Create execution context (validates capabilities)
    await CapabilityLimiter.getPublicContext(
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

    // Format results for public API with proper typing
    const wisdomItems = (knowledgeResult.grouped?.wisdom || []) as KnowledgeItem[];
    const patternItems = (knowledgeResult.grouped?.patterns || []) as KnowledgeItem[];
    const gotchaItems = (knowledgeResult.grouped?.gotchas || []) as KnowledgeItem[];

    const formattedResults: SearchResponse['results'] = {
      wisdom: wisdomItems.slice(0, limit).map(formatWisdomItem),
      patterns: patternItems.slice(0, limit).map(formatPatternItem),
      gotchas: gotchaItems.slice(0, limit).map(formatGotchaItem),
    };

    const totalResults = wisdomItems.length + patternItems.length + gotchaItems.length;
    const searchTime = Date.now() - startTime;

    // FREE TIER: If no results found, trigger knowledge gap capture
    // This researches the topic and creates knowledge for future searches
    let gapResponse: { response?: string; gapId?: string; knowledgeCreated?: number } | null = null;

    if (finalUserTier === 'free' && totalResults === 0) {
      try {
        // Call knowledge gap API to research and create knowledge
        const gapResult = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/knowledge/gap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.trim(),
            userId: userId || 'anonymous',
            source: 'free_search',
          }),
        });

        if (gapResult.ok) {
          gapResponse = await gapResult.json();
          logger.info('[Search API] Knowledge gap captured', {
            query: query.trim(),
            gapId: gapResponse?.gapId,
            knowledgeCreated: gapResponse?.knowledgeCreated,
          });
        }
      } catch (gapError) {
        // Non-blocking - search still returns
        logger.warn('[Search API] Failed to capture knowledge gap:', gapError);
      }
    }

    const response: SearchResponse & {
      gapCaptured?: boolean;
      generatedAnswer?: string;
      knowledgeCreated?: number;
    } = {
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
        sources: gapResponse ? ['knowledge-base', 'quick-research'] : ['knowledge-base'],
      },
      // Include gap response data if available
      ...(gapResponse && {
        gapCaptured: true,
        generatedAnswer: gapResponse.response,
        knowledgeCreated: gapResponse.knowledgeCreated,
      }),
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

    // Extract suggestions from results with proper typing
    const suggestions: SearchSuggestion[] = [];

    // Add pattern names
    const patterns = (knowledgeResult.grouped?.patterns || []) as KnowledgeItem[];
    patterns.slice(0, limit).forEach((pattern: KnowledgeItem) => {
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
    const wisdomItems = (knowledgeResult.grouped?.wisdom || []) as KnowledgeItem[];
    wisdomItems.slice(0, limit).forEach((wisdom: KnowledgeItem) => {
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
    const gotchaItems = (knowledgeResult.grouped?.gotchas || []) as KnowledgeItem[];
    gotchaItems.slice(0, limit).forEach((gotcha: KnowledgeItem) => {
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
      .sort((a, b) => (b.score || 0) - (a.score || 0))
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

    // Return proper error status instead of 200
    return NextResponse.json(
      {
        success: false,
        suggestions: [],
        query: '',
        error: 'Failed to load suggestions',
      },
      { status: 500 }
    );
  }
});

