/**
 * Agent Search API Endpoint
 *
 * Efficient search endpoint that uses SearchAgentService from uaa2-service.
 * Provides optimized querying for agents and the free search bar.
 *
 * SEARCH PROTOCOLS:
 * - QUICK: <500ms - Cache + local knowledge (free tier)
 * - STANDARD: <2s - Cache + local + world knowledge (pro)
 * - DEEP: <10s - Full research with synthesis (pro)
 * - COMPREHENSIVE: <30s - Full research + web search (builder+)
 *
 * @since 2025-11-29
 */

import { NextRequest, NextResponse } from 'next/server';
import { withOptionalRateLimit } from '@/middleware/apiRateLimit';
import { UserTier } from '@/types/agent-capabilities';
import logger from '@/utils/logger';

type SearchProtocol = 'quick' | 'standard' | 'deep' | 'comprehensive';

interface AgentSearchRequest {
  query: string;
  protocol?: SearchProtocol;
  userId?: string;
  userTier?: UserTier;
  domain?: string;
  tags?: string[];
  limit?: number;
  includeFreemium?: boolean;
}

interface KnowledgeItem {
  id: string;
  type: 'wisdom' | 'pattern' | 'gotcha';
  content: string;
  title?: string;
  domain?: string;
  tags?: string[];
  score: number;
  confidence: number;
  source: string;
  metadata?: Record<string, unknown>;
}

interface FreemiumOffer {
  type: 'assist' | 'build' | 'deep_research';
  title: string;
  description: string;
  ctaText: string;
  remainingToday: number;
  maxPerDay: number;
}

interface AgentSearchResponse {
  success: boolean;
  query: string;
  protocol: SearchProtocol;
  results: {
    wisdom: KnowledgeItem[];
    patterns: KnowledgeItem[];
    gotchas: KnowledgeItem[];
  };
  counts: {
    total: number;
    wisdom: number;
    patterns: number;
    gotchas: number;
  };
  synthesis?: {
    summary?: string;
    keyInsights?: string[];
    recommendations?: string[];
    confidence?: number;
  };
  metadata: {
    searchTimeMs: number;
    sources: string[];
    cacheHit: boolean;
    protocolUsed: SearchProtocol;
  };
  gapCaptured?: boolean;
  generatedAnswer?: string;
  knowledgeCreated?: number;
  freemiumOffer?: FreemiumOffer | null;
}

// Protocol configurations for tier validation
const PROTOCOL_TIERS: Record<SearchProtocol, UserTier[]> = {
  quick: ['free', 'assistant_pro', 'builder_pro', 'builder_business', 'builder_enterprise', 'master'],
  standard: ['assistant_pro', 'builder_pro', 'builder_business', 'builder_enterprise', 'master'],
  deep: ['assistant_pro', 'builder_pro', 'builder_business', 'builder_enterprise', 'master'],
  comprehensive: ['builder_pro', 'builder_business', 'builder_enterprise', 'master'],
};

// Query patterns for freemium detection
const FREEMIUM_PATTERNS = {
  assist: [
    /^how (do|can|should|would) (i|we|you)/i,
    /^help (me|us)/i,
    /^explain/i,
    /^what (is|are|does|should)/i,
    /\?$/,
  ],
  build: [
    /^(build|create|implement|develop|make|generate|write|code)/i,
    /^(add|integrate|setup|configure)/i,
    /\b(api|endpoint|component|service|function)\b/i,
  ],
  deep_research: [
    /\b(compare|comparison|versus|vs)\b/i,
    /\b(best practices?|recommendations?)\b/i,
    /\b(trade-?offs?|pros and cons)\b/i,
  ],
};

// In-memory freemium usage tracking
const freemiumUsage = new Map<string, {
  assistUsed: number;
  buildUsed: number;
  deepResearchUsed: number;
  lastReset: string;
}>();

/**
 * Detect freemium offer based on query pattern
 */
function detectFreemiumOffer(query: string, userId: string): FreemiumOffer | null {
  const today = new Date().toISOString().split('T')[0];
  let usage = freemiumUsage.get(userId);

  if (!usage || usage.lastReset !== today) {
    usage = {
      assistUsed: 0,
      buildUsed: usage?.buildUsed || 0, // Build is weekly
      deepResearchUsed: 0,
      lastReset: today,
    };
    freemiumUsage.set(userId, usage);
  }

  // Check assist patterns
  if (usage.assistUsed < 3) {
    for (const pattern of FREEMIUM_PATTERNS.assist) {
      if (pattern.test(query)) {
        return {
          type: 'assist',
          title: 'Try AI Assistant',
          description: 'Get a personalized AI answer with context and explanations',
          ctaText: `Get AI Answer (${3 - usage.assistUsed} free today)`,
          remainingToday: 3 - usage.assistUsed,
          maxPerDay: 3,
        };
      }
    }
  }

  // Check build patterns
  if (usage.buildUsed < 1) {
    for (const pattern of FREEMIUM_PATTERNS.build) {
      if (pattern.test(query)) {
        return {
          type: 'build',
          title: 'Try Free Mini-Build',
          description: 'Generate starter code with best practices',
          ctaText: `Generate Code (${1 - usage.buildUsed} free this week)`,
          remainingToday: 1 - usage.buildUsed,
          maxPerDay: 1,
        };
      }
    }
  }

  // Check deep research patterns
  if (usage.deepResearchUsed < 1) {
    for (const pattern of FREEMIUM_PATTERNS.deep_research) {
      if (pattern.test(query)) {
        return {
          type: 'deep_research',
          title: 'Try Deep Research',
          description: 'Get comprehensive analysis with synthesis',
          ctaText: `Deep Research (${1 - usage.deepResearchUsed} free today)`,
          remainingToday: 1 - usage.deepResearchUsed,
          maxPerDay: 1,
        };
      }
    }
  }

  return null;
}

/**
 * Determine appropriate protocol based on tier
 */
function determineProtocol(requested: SearchProtocol | undefined, userTier: UserTier): SearchProtocol {
  const protocol = requested || 'quick';

  if (PROTOCOL_TIERS[protocol].includes(userTier)) {
    return protocol;
  }

  // Downgrade to highest allowed protocol
  const protocols: SearchProtocol[] = ['comprehensive', 'deep', 'standard', 'quick'];
  for (const p of protocols) {
    if (PROTOCOL_TIERS[p].includes(userTier)) {
      return p;
    }
  }

  return 'quick';
}

/**
 * POST /api/search/agent
 *
 * Efficient agent search through uaa2-service SearchAgentService
 */
export const POST = withOptionalRateLimit(async (request: NextRequest) => {
  const startTime = Date.now();

  try {
    const body: AgentSearchRequest = await request.json();
    const {
      query,
      protocol: requestedProtocol,
      userId = 'anonymous',
      userTier = 'free',
      domain,
      limit = 20,
      includeFreemium = true,
    } = body;

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    if (query.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Query too long. Maximum 500 characters.' },
        { status: 400 }
      );
    }

    // Determine protocol based on tier
    const protocol = determineProtocol(requestedProtocol, userTier);

    logger.debug('[Agent Search API] Request', {
      query: query.substring(0, 50),
      protocol,
      userTier,
      userId,
    });

    // Call uaa2-service SearchAgentService via internal API
    const uaa2BaseUrl = process.env.UAA2_SERVICE_URL || 'http://localhost:3001';

    try {
      const searchResponse = await fetch(`${uaa2BaseUrl}/api/search/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Service': 'infinity-assistant',
        },
        body: JSON.stringify({
          query: query.trim(),
          protocol,
          userId,
          userTier,
          domain,
          limit,
          includeFreemium: userTier === 'free' && includeFreemium,
        }),
      });

      if (searchResponse.ok) {
        const searchResult = await searchResponse.json() as AgentSearchResponse;
        return NextResponse.json(searchResult, { status: 200 });
      }

      // If uaa2 service unavailable, fall back to local implementation
      logger.warn('[Agent Search API] uaa2 service unavailable, using fallback');
    } catch (fetchError) {
      logger.warn('[Agent Search API] uaa2 service error, using fallback:', fetchError);
    }

    // Fallback: Use local Master Portal search
    const { getMasterPortalClient } = await import('@/services/MasterPortalClient');
    const masterPortal = getMasterPortalClient();

    const knowledgeResult = await masterPortal.searchKnowledge(query.trim(), {
      type: 'all',
      limit: Math.min(limit, 50),
      domain,
    });

    // Convert to agent search format
    const wisdomItems = (knowledgeResult.grouped?.wisdom || []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      type: 'wisdom' as const,
      content: item.content as string,
      title: (item.metadata as Record<string, unknown>)?.title as string,
      domain: (item.metadata as Record<string, unknown>)?.domain as string,
      score: item.score as number,
      confidence: 0.8,
      source: item.source as string,
      metadata: item.metadata as Record<string, unknown>,
    }));

    const patternItems = (knowledgeResult.grouped?.patterns || []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      type: 'pattern' as const,
      content: item.content as string,
      title: (item.metadata as Record<string, unknown>)?.title as string,
      domain: (item.metadata as Record<string, unknown>)?.domain as string,
      score: item.score as number,
      confidence: 0.8,
      source: item.source as string,
      metadata: item.metadata as Record<string, unknown>,
    }));

    const gotchaItems = (knowledgeResult.grouped?.gotchas || []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      type: 'gotcha' as const,
      content: item.content as string,
      title: (item.metadata as Record<string, unknown>)?.title as string,
      domain: (item.metadata as Record<string, unknown>)?.domain as string,
      score: item.score as number,
      confidence: 0.8,
      source: item.source as string,
      metadata: item.metadata as Record<string, unknown>,
    }));

    const totalResults = wisdomItems.length + patternItems.length + gotchaItems.length;
    const searchTime = Date.now() - startTime;

    // Handle knowledge gap for free tier
    let gapData: { gapCaptured?: boolean; generatedAnswer?: string; knowledgeCreated?: number } = {};
    if (userTier === 'free' && totalResults === 0) {
      try {
        const gapResult = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/knowledge/gap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.trim(),
            userId,
            source: 'agent_search',
          }),
        });

        if (gapResult.ok) {
          const gapResponse = await gapResult.json();
          gapData = {
            gapCaptured: true,
            generatedAnswer: gapResponse.response,
            knowledgeCreated: gapResponse.knowledgeCreated,
          };
        }
      } catch (gapError) {
        logger.warn('[Agent Search API] Gap capture failed:', gapError);
      }
    }

    // Detect freemium offer for free tier
    let freemiumOffer: FreemiumOffer | null = null;
    if (userTier === 'free' && includeFreemium) {
      freemiumOffer = detectFreemiumOffer(query.trim(), userId);
    }

    const response: AgentSearchResponse = {
      success: true,
      query: query.trim(),
      protocol,
      results: {
        wisdom: wisdomItems,
        patterns: patternItems,
        gotchas: gotchaItems,
      },
      counts: {
        total: totalResults,
        wisdom: wisdomItems.length,
        patterns: patternItems.length,
        gotchas: gotchaItems.length,
      },
      metadata: {
        searchTimeMs: searchTime,
        sources: gapData.gapCaptured ? ['knowledge-base', 'quick-research'] : ['knowledge-base'],
        cacheHit: false,
        protocolUsed: protocol,
      },
      ...gapData,
      freemiumOffer,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Agent Search API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred during search.',
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/search/agent
 *
 * Quick search for autocomplete and instant results
 */
export const GET = withOptionalRateLimit(async (request: NextRequest) => {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const userId = searchParams.get('userId') || 'anonymous';
    const userTier = (searchParams.get('userTier') || 'free') as UserTier;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: true,
        query: '',
        protocol: 'quick',
        results: { wisdom: [], patterns: [], gotchas: [] },
        counts: { total: 0, wisdom: 0, patterns: 0, gotchas: 0 },
        metadata: {
          searchTimeMs: 0,
          sources: [],
          cacheHit: false,
          protocolUsed: 'quick',
        },
      }, { status: 200 });
    }

    // Always use quick protocol for GET (autocomplete)
    const protocol: SearchProtocol = 'quick';
    const trimmedQuery = query.trim();

    // Try uaa2 service first
    const uaa2BaseUrl = process.env.UAA2_SERVICE_URL || 'http://localhost:3001';

    try {
      const searchResponse = await fetch(
        `${uaa2BaseUrl}/api/search/agent?q=${encodeURIComponent(trimmedQuery)}&userId=${userId}&limit=${limit}`,
        {
          headers: {
            'X-Internal-Service': 'infinity-assistant',
          },
        }
      );

      if (searchResponse.ok) {
        return NextResponse.json(await searchResponse.json(), { status: 200 });
      }
    } catch (fetchError) {
      logger.warn('[Agent Search API] uaa2 GET unavailable:', fetchError);
    }

    // Fallback to local search
    const { getMasterPortalClient } = await import('@/services/MasterPortalClient');
    const masterPortal = getMasterPortalClient();

    const knowledgeResult = await masterPortal.searchKnowledge(trimmedQuery, {
      type: 'all',
      limit: Math.min(limit, 30),
    });

    const searchTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      query: trimmedQuery,
      protocol,
      results: {
        wisdom: knowledgeResult.grouped?.wisdom || [],
        patterns: knowledgeResult.grouped?.patterns || [],
        gotchas: knowledgeResult.grouped?.gotchas || [],
      },
      counts: {
        total: knowledgeResult.counts?.total || 0,
        wisdom: knowledgeResult.counts?.wisdom || 0,
        patterns: knowledgeResult.counts?.patterns || 0,
        gotchas: knowledgeResult.counts?.gotchas || 0,
      },
      metadata: {
        searchTimeMs: searchTime,
        sources: ['knowledge-base'],
        cacheHit: false,
        protocolUsed: protocol,
      },
    }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Agent Search API GET] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
      },
      { status: 500 }
    );
  }
});
