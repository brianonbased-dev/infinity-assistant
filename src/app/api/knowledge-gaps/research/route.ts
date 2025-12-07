/**
 * Knowledge Gap Research Automation API
 * 
 * Automatically researches and creates knowledge for identified gaps
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeGapService } from '@/lib/knowledge-gaps/KnowledgeGapService';
import { getResearchMasterService } from '@/lib/knowledge';
import { getJobKnowledgeTracker } from '@/lib/job-detection';
import { getInterestKnowledgeTracker } from '@/lib/life-context';
import logger from '@/utils/logger';

/**
 * POST /api/knowledge-gaps/research
 * 
 * Automatically research high-priority knowledge gaps
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { limit = 5, autoCreate = false } = body;

    const gapService = getKnowledgeGapService();
    const highPriorityGaps = await gapService.getHighPriorityGaps(limit);

    if (highPriorityGaps.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No high-priority knowledge gaps found',
        gapsResearched: 0
      });
    }

    const researchService = getResearchMasterService();
    const results = [];

    for (const gap of highPriorityGaps) {
      try {
        // Research the top queries for this gap
        const researchQueries = gap.queries.slice(0, 3); // Research top 3 queries
        const researchResults = [];

        for (const query of researchQueries) {
          const research = await researchService.research({
            topic: query,
            mode: gap.priority === 'high' ? 'comprehensive' : 'deep'
          });

          researchResults.push({
            query,
            findings: research.findings.length,
            knowledgeSynthesis: research.knowledgeSynthesis
          });

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Track experimental knowledge creation
        if (autoCreate && researchResults.length > 0) {
          if (gap.type === 'professional') {
            const jobTracker = getJobKnowledgeTracker();
            jobTracker.trackExperimentalKnowledge(gap.category as any);
          } else {
            const interestTracker = getInterestKnowledgeTracker();
            // Note: Would need life stage, but we'll track by interest for now
            interestTracker.trackExperimentalKnowledge(undefined, gap.category as any);
          }
        }

        results.push({
          gapId: gap.gapId,
          category: gap.category,
          type: gap.type,
          priority: gap.priority,
          queriesResearched: researchQueries.length,
          researchResults,
          status: 'completed'
        });

        logger.info('[Knowledge Gap Research] Completed research for gap:', {
          gapId: gap.gapId,
          category: gap.category,
          queriesResearched: researchQueries.length
        });
      } catch (error) {
        logger.error('[Knowledge Gap Research] Error researching gap:', {
          gapId: gap.gapId,
          error
        });

        results.push({
          gapId: gap.gapId,
          category: gap.category,
          type: gap.type,
          priority: gap.priority,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      gapsResearched: results.filter(r => r.status === 'completed').length,
      gapsFailed: results.filter(r => r.status === 'error').length,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    logger.error('[Knowledge Gap Research API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to research knowledge gaps' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/knowledge-gaps/research
 * 
 * Get high-priority knowledge gaps ready for research
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const priority = searchParams.get('priority') as 'high' | 'medium' | 'low' | null;

    const gapService = getKnowledgeGapService();
    const gaps = await gapService.identifyGaps(limit * 2);

    const filteredGaps = priority 
      ? gaps.filter(g => g.priority === priority).slice(0, limit)
      : gaps.slice(0, limit);

    return NextResponse.json({
      success: true,
      gaps: filteredGaps,
      count: filteredGaps.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    logger.error('[Knowledge Gap Research API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve knowledge gaps' },
      { status: 500 }
    );
  }
}

