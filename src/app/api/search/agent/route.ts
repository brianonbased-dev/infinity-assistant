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

// Query intent detection - determines if query needs research vs simple search
// "gorillas" -> lookup (simple facts)
// "ways to make money today" -> research (needs synthesis)
const RESEARCH_INTENT_PATTERNS = [
  // Actionable/practical queries that need synthesis
  /\b(how (to|can|do)|ways? to|methods? (to|for)|steps? to)\b/i,
  /\b(make money|earn|income|start (a )?business|side hustle)\b/i,
  /\b(best|top|recommended|most effective|proven)\b/i,
  /\b(strategy|strategies|approach|plan|roadmap)\b/i,
  /\b(improve|increase|boost|optimize|maximize)\b/i,
  /\b(solve|fix|resolve|overcome|deal with)\b/i,
  /\b(should i|would it|is it (worth|good|better))\b/i,
  /\b(compare|difference between|pros and cons)\b/i,
  /\b(learn|master|become|get (started|better))\b/i,
  // Questions that need synthesized answers
  /^(what|why|how|when|where|which|who) .{30,}/i, // Long questions (30+ chars after question word)
  // Life/career/business advice
  /\b(career|job|interview|resume|salary|negotiate)\b/i,
  /\b(invest|investing|stock|crypto|real estate)\b/i,
  /\b(health|fitness|diet|workout|weight loss)\b/i,
  /\b(relationship|dating|marriage|parenting)\b/i,
  /\b(productivity|motivation|habits|goals)\b/i,
];

// Simple lookup queries - just need facts from knowledge base
const LOOKUP_INTENT_PATTERNS = [
  /^(what is|define|meaning of|definition of)\s+\w+$/i, // Single word definition
  /^(who is|who was)\s+/i, // Person lookup
  /^(when (was|did|is))\s+/i, // Date lookup
  /^(where is|location of)\s+/i, // Location lookup
  /\b(facts? about|information (about|on))\b/i,
  /^tell me about [a-z]+$/i, // Short "tell me about X"
];

/**
 * Detect if query needs research (LLM synthesis) vs simple search (knowledge lookup)
 * Returns: 'research' | 'lookup'
 */
function detectQueryIntent(query: string): 'research' | 'lookup' {
  const trimmed = query.trim();

  // Check research patterns first (higher priority)
  for (const pattern of RESEARCH_INTENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'research';
    }
  }

  // Check lookup patterns
  for (const pattern of LOOKUP_INTENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'lookup';
    }
  }

  // Default: queries with question marks and longer than 40 chars are likely research
  if (trimmed.includes('?') && trimmed.length > 40) {
    return 'research';
  }

  // Default to lookup for short queries, research for longer ones
  return trimmed.length > 35 ? 'research' : 'lookup';
}

// In-memory freemium usage tracking
const freemiumUsage = new Map<string, {
  assistUsed: number;
  buildUsed: number;
  deepResearchUsed: number;
  lastReset: string;
}>();

/**
 * Detect freemium offer based on query pattern and intent
 */
function detectFreemiumOffer(query: string, userId: string, queryIntent: 'research' | 'lookup'): FreemiumOffer | null {
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

  // For research intent queries, offer deep research if available
  if (queryIntent === 'research' && usage.deepResearchUsed < 1) {
    return {
      type: 'deep_research',
      title: 'Get AI Research',
      description: 'The assistant will research this and provide a comprehensive answer',
      ctaText: `Get AI Answer (${1 - usage.deepResearchUsed} free research today)`,
      remainingToday: 1 - usage.deepResearchUsed,
      maxPerDay: 1,
    };
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

  // Check assist patterns for general questions
  if (usage.assistUsed < 3) {
    for (const pattern of FREEMIUM_PATTERNS.assist) {
      if (pattern.test(query)) {
        return {
          type: 'assist',
          title: 'Get AI Answer',
          description: 'Get a personalized answer with context and explanations',
          ctaText: `Get AI Answer (${3 - usage.assistUsed} free today)`,
          remainingToday: 3 - usage.assistUsed,
          maxPerDay: 3,
        };
      }
    }
  }

  return null;
}

/**
 * Auto-determine search depth based on query intent and user tier
 * - Lookup queries: basic search (knowledge base only)
 * - Research queries: LLM synthesis required
 * - Complex queries: deep research with multiple sources
 */
function autoDetectSearchDepth(
  query: string,
  userTier: UserTier,
  userId: string
): { protocol: SearchProtocol; needsLLM: boolean; reason: string } {
  const intent = detectQueryIntent(query);
  const today = new Date().toISOString().split('T')[0];
  const usage = freemiumUsage.get(userId);
  const researchUsedToday = usage?.lastReset === today ? usage.deepResearchUsed : 0;

  // Free users:
  // - Lookup queries: basic search (quick protocol)
  // - Research queries: 1 free research/day, then suggest upgrade
  if (userTier === 'free') {
    if (intent === 'lookup') {
      return { protocol: 'quick', needsLLM: false, reason: 'Simple lookup - knowledge base search' };
    }
    // Research query - check if they have free research available
    if (researchUsedToday < 1) {
      return { protocol: 'standard', needsLLM: true, reason: 'Free research - AI synthesis available' };
    }
    return { protocol: 'quick', needsLLM: false, reason: 'Research limit reached - upgrade for more' };
  }

  // Pro users: full research capabilities
  if (['assistant_pro', 'pro'].includes(userTier as string)) {
    if (intent === 'lookup') {
      return { protocol: 'standard', needsLLM: true, reason: 'Pro lookup with AI enhancement' };
    }
    return { protocol: 'deep', needsLLM: true, reason: 'Deep research with synthesis' };
  }

  // Builder+ users: comprehensive research
  return { protocol: 'comprehensive', needsLLM: true, reason: 'Full comprehensive research' };
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

    // Fallback: Use local AssistantKnowledgeService (embedded knowledge - always works)
    const { getAssistantKnowledgeService } = await import('@/lib/knowledge/AssistantKnowledgeService');
    const knowledgeService = getAssistantKnowledgeService();

    const searchResult = await knowledgeService.searchKnowledge(query.trim(), {
      maxWisdom: Math.min(limit, 10),
      maxPatterns: Math.min(limit, 10),
      maxGotchas: Math.min(limit, 5),
    });

    // Convert to agent search format
    const wisdomItems = searchResult.wisdom.map((item) => ({
      id: item.id,
      type: 'wisdom' as const,
      content: item.wisdom,
      title: item.title,
      domain: item.domain || 'general',
      score: item.score || 0.5,
      confidence: 0.9,
      source: 'embedded-knowledge',
      metadata: { application: item.application },
    }));

    const patternItems = searchResult.patterns.map((item) => ({
      id: item.id,
      type: 'pattern' as const,
      content: item.pattern,
      title: item.name,
      domain: item.domain || 'general',
      score: item.score || 0.5,
      confidence: 0.9,
      source: 'embedded-knowledge',
      metadata: { when: item.when, result: item.result },
    }));

    const gotchaItems = searchResult.gotchas.map((item) => ({
      id: item.id,
      type: 'gotcha' as const,
      content: `${item.symptom} → ${item.fix}`,
      title: item.title,
      domain: item.domain || 'general',
      score: item.score || 0.5,
      confidence: 0.9,
      source: 'embedded-knowledge',
      metadata: { cause: item.cause, prevention: item.prevention },
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

    // Detect query intent and freemium offer for free tier
    const queryIntent = detectQueryIntent(query.trim());
    let freemiumOffer: FreemiumOffer | null = null;
    if (userTier === 'free' && includeFreemium) {
      freemiumOffer = detectFreemiumOffer(query.trim(), userId, queryIntent);
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

    // Fallback to local embedded knowledge (always works)
    const { getAssistantKnowledgeService } = await import('@/lib/knowledge/AssistantKnowledgeService');
    const knowledgeService = getAssistantKnowledgeService();

    const searchResult = await knowledgeService.searchKnowledge(trimmedQuery, {
      maxWisdom: Math.min(limit, 5),
      maxPatterns: Math.min(limit, 5),
      maxGotchas: Math.min(limit, 3),
    });

    const searchTime = Date.now() - startTime;

    // Convert to consistent format
    const wisdom = searchResult.wisdom.map((w) => ({
      id: w.id,
      content: w.wisdom,
      title: w.title,
      domain: w.domain || 'general',
      score: w.score || 0.5,
      metadata: { application: w.application },
    }));

    const patterns = searchResult.patterns.map((p) => ({
      id: p.id,
      content: p.pattern,
      title: p.name,
      domain: p.domain || 'general',
      score: p.score || 0.5,
      metadata: { when: p.when, result: p.result },
    }));

    const gotchas = searchResult.gotchas.map((g) => ({
      id: g.id,
      content: `${g.symptom} → ${g.fix}`,
      title: g.title,
      domain: g.domain || 'general',
      score: g.score || 0.5,
      metadata: { cause: g.cause, prevention: g.prevention },
    }));

    return NextResponse.json({
      success: true,
      query: trimmedQuery,
      protocol,
      results: {
        wisdom,
        patterns,
        gotchas,
      },
      counts: {
        total: searchResult.totalResults,
        wisdom: wisdom.length,
        patterns: patterns.length,
        gotchas: gotchas.length,
      },
      metadata: {
        searchTimeMs: searchTime,
        sources: ['embedded-knowledge'],
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
