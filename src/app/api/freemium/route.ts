/**
 * Freemium API Endpoint
 *
 * Provides free trial experiences for paid features:
 * - Free AI Assist response (3/day)
 * - Free mini-build (1/week)
 * - Free deep research (1/day)
 *
 * This helps convert free users by giving them a taste of Pro features.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeQueryForOffer,
  canUseFreemium,
  recordUsage,
  getDefaultUsage,
  checkAndResetUsage,
  FreemiumOfferType,
  FreemiumUsage,
} from '@/services/FreemiumOfferService';
import { getResearchMasterService } from '@/lib/knowledge';
import logger from '@/utils/logger';

// In-memory usage store (should be moved to Redis/DB in production)
const usageStore = new Map<string, FreemiumUsage>();

function getUserUsage(userId: string): FreemiumUsage {
  let usage = usageStore.get(userId);
  if (!usage) {
    usage = getDefaultUsage();
    usageStore.set(userId, usage);
  }
  return checkAndResetUsage(usage);
}

function saveUserUsage(userId: string, usage: FreemiumUsage): void {
  usageStore.set(userId, usage);
}

/**
 * POST /api/freemium
 *
 * Execute a freemium feature trial
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { query, type, userId = 'anonymous' } = body as {
      query: string;
      type: FreemiumOfferType;
      userId?: string;
    };

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    if (!type || !['assist', 'build', 'deep_research'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid freemium type' },
        { status: 400 }
      );
    }

    // Check usage limits
    const usage = getUserUsage(userId);
    const { allowed, remaining } = canUseFreemium(usage, type);

    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Freemium limit reached',
          message: getExhaustedMessage(type),
          upgradeUrl: type === 'build' ? '/pricing#builder' : '/pricing#assistant',
        },
        { status: 429 }
      );
    }

    // Execute the freemium feature
    let response: string;

    switch (type) {
      case 'assist':
        response = await executeAssist(query);
        break;
      case 'build':
        response = await executeBuild(query);
        break;
      case 'deep_research':
        response = await executeDeepResearch(query);
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown type' },
          { status: 400 }
        );
    }

    // Record usage
    const newUsage = recordUsage(usage, type);
    saveUserUsage(userId, newUsage);

    const duration = Date.now() - startTime;

    logger.info('[Freemium API] Trial executed', {
      type,
      userId,
      query: query.substring(0, 100),
      durationMs: duration,
      remainingAfter: remaining - 1,
    });

    return NextResponse.json({
      success: true,
      type,
      response,
      usage: {
        remaining: remaining - 1,
        max: type === 'build' ? 1 : type === 'assist' ? 3 : 1,
        period: type === 'build' ? 'week' : 'day',
      },
      metadata: {
        durationMs: duration,
      },
      upgrade: {
        message: getUpgradeMessage(type),
        tier: type === 'build' ? 'builder_pro' : 'assistant_pro',
        url: type === 'build' ? '/pricing#builder' : '/pricing#assistant',
      },
    });
  } catch (error) {
    logger.error('[Freemium API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute freemium trial',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/freemium
 *
 * Check if query qualifies for freemium offer and get usage status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const userId = searchParams.get('userId') || 'anonymous';

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query parameter required' },
        { status: 400 }
      );
    }

    const usage = getUserUsage(userId);
    const offer = analyzeQueryForOffer(query, usage);

    return NextResponse.json({
      success: true,
      hasOffer: !!offer,
      offer,
      usage: {
        assist: {
          used: usage.assistUsed,
          remaining: Math.max(0, 3 - usage.assistUsed),
          max: 3,
          period: 'day',
        },
        build: {
          used: usage.weeklyBuildUsed,
          remaining: Math.max(0, 1 - usage.weeklyBuildUsed),
          max: 1,
          period: 'week',
        },
        deep_research: {
          used: usage.deepResearchUsed,
          remaining: Math.max(0, 1 - usage.deepResearchUsed),
          max: 1,
          period: 'day',
        },
      },
    });
  } catch (error) {
    logger.error('[Freemium API] Error checking offer:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to check freemium offer' },
      { status: 500 }
    );
  }
}

/**
 * Execute a free Assist response
 */
async function executeAssist(query: string): Promise<string> {
  // Use the research service for a quick, helpful response
  const researchService = getResearchMasterService();
  const result = await researchService.research({
    topic: query,
    mode: 'quick',
    requireSynthesis: true,
    maxTimeMs: 3000,
  });

  if (result.synthesis?.summary) {
    return result.synthesis.summary;
  }

  if (result.findings.length > 0) {
    return result.findings
      .slice(0, 3)
      .map((f) => f.content)
      .join('\n\n');
  }

  return `Based on your question "${query}", here's what I found:\n\nI couldn't find specific information in our knowledge base, but this topic relates to common patterns we see. With Assistant Pro, I could:\n- Have a conversation to understand your specific context\n- Search multiple sources for comprehensive answers\n- Remember our conversation for follow-up questions\n\nWould you like to try a search for related terms?`;
}

/**
 * Execute a free mini-build
 */
async function executeBuild(query: string): Promise<string> {
  // Generate a starter code template based on the query
  const researchService = getResearchMasterService();
  const result = await researchService.research({
    topic: `code implementation patterns for: ${query}`,
    mode: 'quick',
    requireSynthesis: true,
    maxTimeMs: 3000,
  });

  // Generate a simple starter template
  const template = generateStarterCode(query, result.findings);

  return template;
}

/**
 * Execute a free deep research sample
 */
async function executeDeepResearch(query: string): Promise<string> {
  const researchService = getResearchMasterService();
  const result = await researchService.research({
    topic: query,
    mode: 'standard', // Use standard mode for free trial
    requireSynthesis: true,
    includeGaps: true,
    maxTimeMs: 5000,
  });

  let response = `## Deep Research: ${query}\n\n`;

  if (result.synthesis?.summary) {
    response += `### Summary\n${result.synthesis.summary}\n\n`;
  }

  if (result.synthesis?.keyInsights && result.synthesis.keyInsights.length > 0) {
    response += `### Key Insights\n`;
    result.synthesis.keyInsights.forEach((insight, i) => {
      response += `${i + 1}. ${insight}\n`;
    });
    response += '\n';
  }

  if (result.findings.length > 0) {
    response += `### Sources (${result.findings.length} found)\n`;
    result.findings.slice(0, 3).forEach((f) => {
      response += `- ${f.content.substring(0, 150)}...\n`;
    });
    response += '\n';
  }

  if (result.gaps && result.gaps.length > 0) {
    response += `### Knowledge Gaps\nWith Assistant Pro, I could explore:\n`;
    result.gaps.slice(0, 3).forEach((gap) => {
      response += `- ${gap}\n`;
    });
  }

  response += `\n---\n*This is a sample of deep research. Upgrade to Assistant Pro for comprehensive research with unlimited queries.*`;

  return response;
}

/**
 * Generate starter code based on query
 */
function generateStarterCode(
  query: string,
  findings: Array<{ content: string; domain?: string }>
): string {
  const lowerQuery = query.toLowerCase();

  // Detect technology from query
  const isReact = /react|next|component/i.test(lowerQuery);
  const isApi = /api|endpoint|route/i.test(lowerQuery);
  const isService = /service|class|module/i.test(lowerQuery);
  const isPython = /python|django|flask/i.test(lowerQuery);

  if (isReact) {
    return `// Starter React Component for: ${query}
// Generated by Infinity Builder (Free Trial)

'use client';

import { useState, useEffect } from 'react';

interface Props {
  // Add your props here
}

export function Component({ }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    // Initialize component
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <h1>Your Component</h1>
      {/* Add your UI here */}
    </div>
  );
}

// ---
// This is a starter template. With Builder Pro:
// - Full implementation with best practices
// - Error handling and edge cases
// - TypeScript types and validation
// - Tests and documentation`;
  }

  if (isApi) {
    return `// Starter API Route for: ${query}
// Generated by Infinity Builder (Free Trial)

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Add your logic here
    const data = {};

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate and process

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}

// ---
// This is a starter template. With Builder Pro:
// - Full validation and error handling
// - Database integration
// - Authentication/authorization
// - Rate limiting and caching`;
  }

  if (isPython) {
    return `# Starter Python Code for: ${query}
# Generated by Infinity Builder (Free Trial)

from typing import Optional, List, Dict

class Service:
    """
    Service for handling ${query}
    """

    def __init__(self):
        self.data = {}

    async def process(self, input_data: Dict) -> Dict:
        """
        Main processing method
        """
        # Add your logic here
        result = {}
        return result

    async def validate(self, data: Dict) -> bool:
        """
        Validate input data
        """
        return True

# Usage:
# service = Service()
# result = await service.process({"key": "value"})

# ---
# This is a starter template. With Builder Pro:
# - Full implementation with best practices
# - Type hints and validation
# - Tests and documentation
# - CI/CD configuration`;
  }

  // Default TypeScript service
  return `// Starter Service for: ${query}
// Generated by Infinity Builder (Free Trial)

export interface Config {
  // Add configuration options
}

export class Service {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async execute(input: unknown): Promise<unknown> {
    // Add your implementation
    return {};
  }

  private validate(data: unknown): boolean {
    // Add validation
    return true;
  }
}

// Usage:
// const service = new Service({});
// const result = await service.execute(data);

// ---
// This is a starter template. With Builder Pro:
// - Full implementation with patterns
// - Error handling and logging
// - TypeScript types
// - Unit tests`;
}

function getExhaustedMessage(type: FreemiumOfferType): string {
  switch (type) {
    case 'assist':
      return "You've used all 3 free AI responses for today. Upgrade to Assistant Pro for unlimited conversations!";
    case 'build':
      return "You've used your free build this week. Upgrade to Builder Pro for unlimited code generation!";
    case 'deep_research':
      return "You've used your free deep research for today. Upgrade to Assistant Pro for unlimited research!";
    default:
      return 'Freemium limit reached. Upgrade for unlimited access!';
  }
}

function getUpgradeMessage(type: FreemiumOfferType): string {
  switch (type) {
    case 'assist':
      return 'Enjoyed this? Get unlimited AI conversations with Assistant Pro';
    case 'build':
      return 'Need more code? Get unlimited generation with Builder Pro';
    case 'deep_research':
      return 'Want deeper insights? Get unlimited research with Assistant Pro';
    default:
      return 'Upgrade for unlimited access';
  }
}
