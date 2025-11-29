/**
 * Research API Endpoint
 *
 * Exposes the ResearchMasterService for deep research capabilities.
 * Used by uaa2-service via InfinityAssistantBridgeService.
 *
 * Features:
 * - Quick research (<500ms) - fast lookup
 * - Standard research (<2s) - balanced
 * - Deep research (<10s) - thorough
 * - Comprehensive research (<30s) - full protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getResearchMasterService, type ResearchQuery, type ResearchMode } from '@/lib/knowledge';
import logger from '@/utils/logger';

/**
 * POST /api/research
 *
 * Conduct research on a topic
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { topic, mode, context, domains, maxSources, includeExternal } = body as {
      topic: string;
      mode?: ResearchMode;
      context?: string;
      domains?: string[];
      maxSources?: number;
      includeExternal?: boolean;
    };

    // Validate topic
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Topic is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Build research query
    const query: ResearchQuery = {
      topic: topic.trim(),
      mode: mode || 'standard',
      context,
      domain: domains?.[0], // Use first domain as primary
      relatedTopics: domains?.slice(1), // Rest as related
      requireSynthesis: true,
      includeGaps: true,
    };

    // Set time budget based on mode
    if (mode === 'quick') {
      query.maxTimeMs = 500;
    } else if (mode === 'standard') {
      query.maxTimeMs = 2000;
    } else if (mode === 'deep') {
      query.maxTimeMs = 10000;
    } else if (mode === 'comprehensive') {
      query.maxTimeMs = 30000;
    }

    // Conduct research
    const researchService = getResearchMasterService();
    const result = await researchService.research(query);

    const endTime = Date.now();

    // Transform to bridge-compatible format
    const response = {
      success: true,
      result: {
        query: {
          topic: query.topic,
          mode: query.mode,
          context: query.context,
          domains: domains,
          maxSources,
          includeExternal,
        },
        findings: result.findings.map(f => ({
          id: f.id,
          content: f.content,
          source: f.source,
          sourceType: f.type,
          relevance: f.relevance,
          confidence: f.confidence,
          domain: f.domain,
          metadata: { references: f.references },
        })),
        synthesis: result.synthesis ? {
          summary: result.synthesis.summary,
          keyInsights: result.synthesis.keyInsights,
          recommendations: [], // Could be derived from insights
          gaps: result.synthesis.gaps,
          confidence: result.synthesis.confidence,
        } : {
          summary: `Research on "${topic}" completed with ${result.findings.length} findings.`,
          keyInsights: result.findings.slice(0, 3).map(f => f.content),
          recommendations: [],
          gaps: result.gaps,
          confidence: result.findings.length > 0 ? 0.7 : 0.3,
        },
        sources: {
          internal: result.findings.filter(f => f.source !== 'web-search').length,
          external: result.findings.filter(f => f.source === 'web-search').length,
          total: result.findings.length,
        },
        timing: {
          startTime,
          endTime,
          durationMs: endTime - startTime,
        },
        mode: query.mode || 'standard',
      },
    };

    logger.info('[Research API] Research completed', {
      topic,
      mode: query.mode,
      findingsCount: result.findings.length,
      durationMs: endTime - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[Research API] Error conducting research:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to conduct research',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/research
 *
 * Get research service status and metrics
 */
export async function GET() {
  try {
    const researchService = getResearchMasterService();
    const metrics = researchService.getMetrics();

    return NextResponse.json({
      success: true,
      status: 'available',
      metrics: {
        totalResearches: metrics.totalResearches,
        cacheHits: metrics.cacheHits,
        avgTimeMs: Math.round(metrics.avgTimeMs),
        avgFindings: Math.round(metrics.avgFindings * 10) / 10,
      },
      modes: ['quick', 'standard', 'deep', 'comprehensive'],
      timeBudgets: {
        quick: '< 500ms',
        standard: '< 2s',
        deep: '< 10s',
        comprehensive: '< 30s',
      },
    });
  } catch (error) {
    logger.error('[Research API] Error getting status:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to get research service status' },
      { status: 500 }
    );
  }
}
