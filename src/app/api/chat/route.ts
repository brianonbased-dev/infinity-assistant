/**
 * Infinity Agent - Public Chat API
 *
 * Public-facing chat endpoint for InfinityAssistant.io users
 * Features: Search, Assist, Build
 * - Search: Knowledge base queries, research assistance
 * - Assist: Chat, code explanation, Q&A
 * - Build: Coming soon - code generation
 *
 * All agent operations go through Master Portal for orchestration
 */

import { NextRequest, NextResponse } from 'next/server';
import { CapabilityLimiter } from '@/lib/capability-limiter';
import { AgentCapabilityMode, UserTier, AgentExecutionContext } from '@/types/agent-capabilities';
import { withOptionalRateLimit } from '@/middleware/apiRateLimit';
import { getMasterPortalClient } from '@/services/MasterPortalClient';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error-handling';

interface UserPreferences {
  role?: string;
  experienceLevel?: string;
  primaryGoals?: string[];
  preferredMode?: 'search' | 'assist' | 'build';
  interests?: string[];
  communicationStyle?: 'concise' | 'detailed' | 'conversational';
}

interface ChatRequest {
  message: string;
  conversationId?: string;
  userId?: string;
  userTier?: UserTier;
  mode?: 'search' | 'assist' | 'build';
  userContext?: string;
  preferences?: UserPreferences;
}

interface ChatResponse {
  response: string;
  conversationId: string;
  rateLimit: {
    allowed: boolean;
    limit: number;
    remaining: number;
    reset_at?: string;
  };
  metadata?: {
    model?: string;
    tokensUsed?: number;
    processingTime?: number;
  };
}

/**
 * POST /api/chat
 *
 * Send message to Infinity Agent (public-facing)
 */
export const POST = withOptionalRateLimit(async (request: NextRequest) => {
  const startTime = Date.now();

  // Create timeout signal (60 seconds)
  const timeoutSignal = AbortSignal.timeout(60000);
  const combinedController = new AbortController();
  const combinedSignal = combinedController.signal;

  if (request.signal.aborted) {
    combinedController.abort();
  } else {
    request.signal.addEventListener('abort', () => combinedController.abort());
  }

  if (timeoutSignal.aborted) {
    combinedController.abort();
  } else {
    timeoutSignal.addEventListener('abort', () => combinedController.abort());
  }

  try {
    if (combinedSignal.aborted) {
      return NextResponse.json(
        {
          error: 'Request cancelled',
          message: 'The request was cancelled before processing.',
        },
        { status: 499 }
      );
    }

    const body: ChatRequest = await request.json();
    const { message, conversationId, userId: providedUserId, userTier: providedTier, mode, userContext, preferences } = body;

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message too long. Maximum 5000 characters.' },
        { status: 400 }
      );
    }

    // Get user service
    const userService = getUserService();
    const userId = providedUserId || userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Get user tier
    const userTier = providedTier || (await userService.getUserTier(userId));

    // Check rate limit
    const currentUsage = await userService.getUserUsageCount(userId);
    const rateLimitCheck = CapabilityLimiter.checkRateLimit(
      {
        mode: AgentCapabilityMode.LIMITED,
        userId,
        userTier,
        allowedCapabilities: [],
      },
      currentUsage
    );

    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message:
            'You have reached your daily query limit. Please upgrade to Pro for unlimited access.',
          rateLimit: rateLimitCheck,
        },
        { status: 429 }
      );
    }

    // Create execution context
    const context: AgentExecutionContext = await CapabilityLimiter.getPublicContext(
      userId,
      userTier
    );

    // Generate or use conversation ID
    const activeConversationId =
      conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Filter request through capability limiter
    const filteredRequest = CapabilityLimiter.filterRequest(
      {
        message,
        conversationId: activeConversationId,
        userId,
      },
      context
    );

    // Process message with agent through Master Portal
    let agentResponse: string;
    let tokensUsed = 0;

    try {
      // Enhance message based on mode and user preferences
      let enhancedMessage = filteredRequest.message;
      let systemContext = '';

      // Build user context from preferences
      let personalizedContext = '';
      if (userContext) {
        personalizedContext = userContext;
      } else if (preferences) {
        // Generate personalized context from preferences
        const contextParts: string[] = [];

        if (preferences.role) {
          const roleDescriptions: Record<string, string> = {
            developer: 'a software developer',
            designer: 'a designer',
            product_manager: 'a product manager',
            data_analyst: 'a data analyst',
            student: 'a student learning technology',
            entrepreneur: 'an entrepreneur',
            researcher: 'a researcher',
            other: 'a professional',
          };
          contextParts.push(`The user is ${roleDescriptions[preferences.role] || preferences.role}.`);
        }

        if (preferences.experienceLevel) {
          const expDescriptions: Record<string, string> = {
            beginner: 'They are a beginner, so explain concepts clearly and avoid jargon.',
            intermediate: 'They have intermediate experience, so balance detail with efficiency.',
            advanced: 'They are advanced, so you can be technical and concise.',
            expert: 'They are an expert, so be direct and skip basic explanations.',
          };
          contextParts.push(expDescriptions[preferences.experienceLevel] || '');
        }

        if (preferences.communicationStyle) {
          const styleDescriptions: Record<string, string> = {
            concise: 'Keep responses brief and to the point. Use bullet points when possible.',
            detailed: 'Provide comprehensive explanations with examples and context.',
            conversational: 'Be friendly and conversational while remaining helpful.',
          };
          contextParts.push(styleDescriptions[preferences.communicationStyle] || '');
        }

        if (preferences.interests && preferences.interests.length > 0) {
          contextParts.push(`Their interests include: ${preferences.interests.join(', ')}.`);
        }

        if (contextParts.length > 0) {
          personalizedContext = `\n\n[User Context: ${contextParts.join(' ')}]`;
        }
      }

      if (mode === 'search') {
        systemContext = 'You are in SEARCH mode. Focus on finding and presenting relevant information from the knowledge base.';
        enhancedMessage = `[SEARCH MODE] User query: "${filteredRequest.message}"\n\nPlease search the knowledge base and provide relevant patterns, wisdom, and best practices.${personalizedContext}`;
      } else if (mode === 'build') {
        systemContext = 'You are in BUILD mode. Help users create applications, generate code, and design architectures.';
        enhancedMessage = `[BUILD MODE] User wants to build: "${filteredRequest.message}"\n\nProvide guidance on architecture, code structure, and implementation approach.${personalizedContext}`;
      } else {
        systemContext = 'You are in ASSIST mode. Provide helpful, conversational assistance.';
        enhancedMessage = `${filteredRequest.message}${personalizedContext}`;
      }

      if (combinedSignal.aborted) {
        return NextResponse.json(
          {
            error: 'Request cancelled',
            message: 'The request was cancelled before agent execution.',
          },
          { status: 499 }
        );
      }

      // Call Master Portal to process query
      const masterPortal = getMasterPortalClient();
      const result = await masterPortal.processCustomerQuery(enhancedMessage, {
        conversationId: activeConversationId,
        userId,
        // Pass through the actual mode (search/assist/build) for proper handling
        mode: mode || 'assist',
        limitedCapabilities: context.allowedCapabilities,
      });

      if (combinedSignal.aborted) {
        return NextResponse.json(
          {
            error: 'Request cancelled',
            message: 'The request was cancelled during agent execution.',
          },
          { status: 499 }
        );
      }

      agentResponse = result.response || 'I apologize, but I was unable to process your request.';
      tokensUsed = result.tokensUsed || 0;
    } catch (agentError: unknown) {
      if (agentError instanceof Error && agentError.name === 'AbortError') {
        return NextResponse.json(
          {
            error: 'Request cancelled',
            message: 'The request was cancelled.',
          },
          { status: 499 }
        );
      }

      if (timeoutSignal.aborted) {
        return NextResponse.json(
          {
            error: 'Request timeout',
            message: 'The request took too long to process. Please try again with a shorter query.',
          },
          { status: 504 }
        );
      }

      logger.error('[Infinity Agent] Agent execution error:', agentError);

      agentResponse =
        'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.';
    }

    // Record usage
    await userService.recordUsage(userId, activeConversationId, tokensUsed);

    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // Update rate limit info
    const updatedRateLimit = CapabilityLimiter.checkRateLimit(context, currentUsage + 1);

    // Build response
    const response: ChatResponse = {
      response: agentResponse,
      conversationId: activeConversationId,
      rateLimit: updatedRateLimit,
      metadata: {
        model: 'infinity-agent',
        tokensUsed,
        processingTime,
      },
    };

    // Set anonymous user cookie if new user
    const nextResponse = NextResponse.json(response, { status: 200 });

    if (!providedUserId) {
      nextResponse.cookies.set('infinity_anon_user', userId, {
        maxAge: 365 * 24 * 60 * 60,
        httpOnly: true,
        sameSite: 'strict',
      });
    }

    return nextResponse;
  } catch (error: unknown) {
    logger.error('[Infinity Agent] Error in chat endpoint:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/chat
 *
 * Get conversation history
 */
export const GET = withOptionalRateLimit(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const conversationId = searchParams.get('conversationId');
  const userService = getUserService();
  const userId = searchParams.get('userId') || userService.getAnonymousUserId(
    request.cookies.get('infinity_anon_user')?.value
  );

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
  }

  try {
    const { getSupabaseClient, TABLES } = await import('@/lib/supabase');
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from(TABLES.CONVERSATIONS)
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      conversationId,
      messages: data || [],
    });
  } catch (error) {
    logger.error('[Infinity Agent] Error fetching conversation:', error);

    return NextResponse.json({ error: 'Failed to fetch conversation history' }, { status: 500 });
  }
});

