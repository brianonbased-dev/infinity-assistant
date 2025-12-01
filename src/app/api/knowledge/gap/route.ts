/**
 * Knowledge Gap API Endpoint
 *
 * Captures knowledge gaps from free tier searches and creates
 * compressed knowledge (W/P/G format) for the knowledge base.
 *
 * When a free user searches for something not in the knowledge base:
 * 1. Record the gap (what they searched for)
 * 2. Use quick research to find an answer
 * 3. Return the answer to the user
 * 4. Create compressed knowledge entry for future searches
 * 5. Queue for deep research if topic is valuable
 */

import { NextRequest, NextResponse } from 'next/server';
import { getResearchMasterService, getKnowledgeHelpersService } from '@/lib/knowledge';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

interface KnowledgeGapRequest {
  query: string;
  userId?: string;
  source: 'free_search' | 'assist' | 'build';
  context?: string;
}

interface CompressedKnowledge {
  type: 'wisdom' | 'pattern' | 'gotcha';
  id: string;
  content: string;
  domain: string;
  confidence: number;
  source: string;
}

/**
 * POST /api/knowledge/gap
 *
 * Handle a knowledge gap - research, respond, and create knowledge
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: KnowledgeGapRequest = await request.json();
    const { query, userId, source, context } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();

    // Step 1: Record the knowledge gap
    const gapId = `gap_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      const supabase = getSupabaseClient();
      await supabase.from((TABLES as any).KNOWLEDGE_GAPS || 'knowledge_gaps').insert({
        id: gapId,
        query: trimmedQuery,
        user_id: userId || 'anonymous',
        source,
        context,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    } catch (dbError) {
      // Log but don't fail - we can still help the user
      logger.warn('[Knowledge Gap] Failed to record gap:', dbError);
    }

    // Step 2: Quick research to find an answer
    const researchService = getResearchMasterService();
    const researchResult = await researchService.research({
      topic: trimmedQuery,
      mode: 'quick', // Fast lookup for free tier
      context,
      requireSynthesis: true,
      includeGaps: false, // We already know there's a gap
    });

    // Step 3: Generate response for the user
    let userResponse: string;
    let compressedKnowledge: CompressedKnowledge[] = [];

    if (researchResult.findings.length > 0) {
      // Found something - synthesize a response
      const synthesis = researchResult.synthesis;
      userResponse = synthesis?.summary || researchResult.findings[0].content;

      // Add key insights if available
      if (synthesis?.keyInsights && synthesis.keyInsights.length > 0) {
        userResponse += '\n\n**Key Points:**\n' + synthesis.keyInsights.map(i => `- ${i}`).join('\n');
      }

      // Step 4: Create compressed knowledge from findings
      compressedKnowledge = await createCompressedKnowledge(trimmedQuery, researchResult.findings);
    } else {
      // No findings - provide a helpful response and trigger deep research
      userResponse = `I don't have specific information about "${trimmedQuery}" in my knowledge base yet.\n\n`;
      userResponse += `**What I can tell you:**\n`;
      userResponse += `- This topic has been noted for research\n`;
      userResponse += `- Our team will investigate and add this knowledge\n`;
      userResponse += `- Check back soon for updated information\n\n`;
      userResponse += `*Tip: Upgrade to Assistant Pro for AI-powered answers to any question.*`;

      // Queue for deep research
      try {
        const knowledgeHelpers = getKnowledgeHelpersService();
        const assessment = await knowledgeHelpers.needsResearch(trimmedQuery);

        if (assessment.needsResearch) {
          // Trigger research request
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/research`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: trimmedQuery,
              mode: 'standard',
              context: `Knowledge gap detected from free search. User query: ${trimmedQuery}`,
            }),
          }).catch(() => {
            // Non-blocking - research will happen async
          });
        }
      } catch (researchError) {
        logger.warn('[Knowledge Gap] Failed to trigger research:', researchError);
      }
    }

    // Step 5: Store compressed knowledge
    if (compressedKnowledge.length > 0) {
      try {
        const supabase = getSupabaseClient();

        for (const knowledge of compressedKnowledge) {
          await supabase.from((TABLES as any).KNOWLEDGE_BASE || 'knowledge_base').upsert({
            id: knowledge.id,
            type: knowledge.type,
            content: knowledge.content,
            domain: knowledge.domain,
            confidence: knowledge.confidence,
            source: knowledge.source,
            created_from_gap: gapId,
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'id',
          });
        }

        // Update gap status
        await supabase.from((TABLES as any).KNOWLEDGE_GAPS || 'knowledge_gaps').update({
          status: 'resolved',
          knowledge_created: compressedKnowledge.map(k => k.id),
          resolved_at: new Date().toISOString(),
        }).eq('id', gapId);

        logger.info('[Knowledge Gap] Created compressed knowledge', {
          gapId,
          knowledgeCount: compressedKnowledge.length,
          types: compressedKnowledge.map(k => k.type),
        });
      } catch (storeError) {
        logger.warn('[Knowledge Gap] Failed to store knowledge:', storeError);
      }
    }

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      response: userResponse,
      gapId,
      knowledgeCreated: compressedKnowledge.length,
      hadExistingKnowledge: researchResult.findings.length > 0,
      processingTime,
    });
  } catch (error) {
    logger.error('[Knowledge Gap] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process knowledge gap',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Create compressed knowledge entries from research findings
 */
async function createCompressedKnowledge(
  query: string,
  findings: Array<{ content: string; type: string; domain?: string; confidence: number }>
): Promise<CompressedKnowledge[]> {
  const knowledge: CompressedKnowledge[] = [];
  const timestamp = Date.now();

  // Extract domain from query or findings
  const domain = findings.find(f => f.domain)?.domain || extractDomain(query);

  for (let i = 0; i < Math.min(findings.length, 3); i++) {
    const finding = findings[i];

    // Determine knowledge type based on content
    const knowledgeType = classifyKnowledge(finding.content, finding.type);

    // Generate ID in W/P/G format
    const typePrefix = knowledgeType === 'wisdom' ? 'W' : knowledgeType === 'pattern' ? 'P' : 'G';
    const domainCode = domain.substring(0, 3).toUpperCase();
    const id = `${typePrefix}.${domainCode}.${timestamp.toString(36).toUpperCase()}_${i}`;

    // Compress content to essential insight
    const compressedContent = compressToEssence(finding.content, knowledgeType);

    knowledge.push({
      type: knowledgeType,
      id,
      content: compressedContent,
      domain,
      confidence: finding.confidence,
      source: `free_search:${query.substring(0, 50)}`,
    });
  }

  return knowledge;
}

/**
 * Classify knowledge type based on content
 */
function classifyKnowledge(content: string, originalType: string): 'wisdom' | 'pattern' | 'gotcha' {
  const lowerContent = content.toLowerCase();

  // Gotcha indicators
  if (
    lowerContent.includes('avoid') ||
    lowerContent.includes('don\'t') ||
    lowerContent.includes('mistake') ||
    lowerContent.includes('error') ||
    lowerContent.includes('warning') ||
    lowerContent.includes('pitfall') ||
    lowerContent.includes('careful')
  ) {
    return 'gotcha';
  }

  // Pattern indicators
  if (
    lowerContent.includes('pattern') ||
    lowerContent.includes('approach') ||
    lowerContent.includes('method') ||
    lowerContent.includes('technique') ||
    lowerContent.includes('strategy') ||
    lowerContent.includes('implement') ||
    lowerContent.includes('step')
  ) {
    return 'pattern';
  }

  // Default to wisdom for insights and principles
  return 'wisdom';
}

/**
 * Extract domain from query
 */
function extractDomain(query: string): string {
  const lowerQuery = query.toLowerCase();

  // Tech domains
  if (lowerQuery.includes('react') || lowerQuery.includes('next')) return 'react';
  if (lowerQuery.includes('typescript') || lowerQuery.includes('ts')) return 'typescript';
  if (lowerQuery.includes('node') || lowerQuery.includes('javascript')) return 'nodejs';
  if (lowerQuery.includes('python')) return 'python';
  if (lowerQuery.includes('database') || lowerQuery.includes('sql')) return 'database';
  if (lowerQuery.includes('api') || lowerQuery.includes('rest')) return 'api';
  if (lowerQuery.includes('docker') || lowerQuery.includes('kubernetes')) return 'devops';
  if (lowerQuery.includes('ai') || lowerQuery.includes('ml') || lowerQuery.includes('machine learning')) return 'ai';

  return 'general';
}

/**
 * Compress content to essential insight
 */
function compressToEssence(content: string, type: 'wisdom' | 'pattern' | 'gotcha'): string {
  // Remove fluff words and compress
  let compressed = content
    .replace(/\b(basically|essentially|generally|typically|usually|often|sometimes)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Limit length based on type
  const maxLength = type === 'wisdom' ? 200 : type === 'pattern' ? 300 : 150;

  if (compressed.length > maxLength) {
    // Find a good break point
    const breakPoint = compressed.lastIndexOf('.', maxLength);
    if (breakPoint > maxLength * 0.6) {
      compressed = compressed.substring(0, breakPoint + 1);
    } else {
      compressed = compressed.substring(0, maxLength) + '...';
    }
  }

  return compressed;
}

/**
 * GET /api/knowledge/gap
 *
 * Get knowledge gap statistics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // Get gap statistics
    const { data: gaps, error } = await supabase
      .from((TABLES as any).KNOWLEDGE_GAPS || 'knowledge_gaps')
      .select('status, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    const stats = {
      total: gaps?.length || 0,
      pending: gaps?.filter(g => g.status === 'pending').length || 0,
      resolved: gaps?.filter(g => g.status === 'resolved').length || 0,
      researching: gaps?.filter(g => g.status === 'researching').length || 0,
    };

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('[Knowledge Gap] Error getting stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get gap statistics' },
      { status: 500 }
    );
  }
}
