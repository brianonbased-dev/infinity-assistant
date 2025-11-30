/**
 * Infinity Agent - Public Chat API
 *
 * Public-facing chat endpoint for InfinityAssistant.io users
 * Features: Search, Assist, Build
 * - Search: Knowledge base queries, research assistance
 * - Assist: Chat, code explanation, Q&A
 * - Build: Architecture guidance (full generation via Builder)
 *
 * Uses uAA2++ 8-Phase Protocol for:
 * - Phase-aware conversation context
 * - Hierarchical memory with compression
 * - Knowledge-rich responses
 *
 * All agent operations go through Master Portal for orchestration
 */

import { NextRequest, NextResponse } from 'next/server';
import { CapabilityLimiter } from '@/lib/capability-limiter';
import { AgentCapabilityMode, UserTier, AgentExecutionContext } from '@/types/agent-capabilities';
import { withOptionalRateLimit } from '@/middleware/apiRateLimit';
import { getMasterPortalClient } from '@/services/MasterPortalClient';
import { getUserService } from '@/services/UserService';
import { getAssistantContextBuilder, getConversationMemoryService, getPhaseTransitionService, type WorkflowPhase } from '@/lib/knowledge';
import { detectLanguage, generateBilingualPrompt, type SupportedLanguage } from '@/services/BilingualService';
import logger from '@/utils/logger';

interface UserPreferences {
  role?: string;
  experienceLevel?: string;
  primaryGoals?: string[];
  preferredMode?: 'search' | 'assist' | 'build';
  interests?: string[];
  customInterests?: string[];
  communicationStyle?: 'concise' | 'detailed' | 'conversational';
  workflowPhases?: WorkflowPhase[];
  preferredLanguage?: SupportedLanguage;
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
    let memoryStored = false;
    let shouldAskToRemember = false;
    let potentialMemoryContent = '';

    try {
      // Process phase transition for training data
      const phaseService = getPhaseTransitionService();
      const userPhaseTransition = phaseService.processMessage(
        activeConversationId,
        filteredRequest.message,
        'user'
      );

      // Log phase transition for training pipeline
      if (userPhaseTransition) {
        logger.debug('[Infinity Agent] Phase transition detected', {
          conversationId: activeConversationId,
          from: userPhaseTransition.previousPhase,
          to: userPhaseTransition.newPhase,
          confidence: userPhaseTransition.confidence,
        });
      }

      // Check for explicit memory commands
      const memoryService = getConversationMemoryService();
      const memoryIntent = memoryService.detectMemoryIntent(filteredRequest.message);

      // Handle explicit "remember this" commands
      if (memoryIntent.shouldStore && memoryIntent.extractedContent) {
        await memoryService.storeExplicitKnowledge(
          activeConversationId,
          memoryIntent.extractedContent,
          memoryIntent.type
        );
        memoryStored = true;
      }

      // Check if we should ask the user about remembering
      if (memoryIntent.shouldAsk && memoryIntent.extractedContent) {
        shouldAskToRemember = true;
        potentialMemoryContent = memoryIntent.extractedContent;
      }

      // Build context using uAA2++ Knowledge Base
      const contextBuilder = getAssistantContextBuilder();
      const assistantContext = await contextBuilder.buildContext({
        conversationId: activeConversationId,
        userId,
        message: filteredRequest.message,
        mode: mode || 'assist',
        preferences: preferences ? {
          role: preferences.role,
          experienceLevel: preferences.experienceLevel,
          primaryGoals: preferences.primaryGoals,
          preferredMode: preferences.preferredMode,
          interests: preferences.interests,
          customInterests: preferences.customInterests,
          communicationStyle: preferences.communicationStyle,
          workflowPhases: preferences.workflowPhases,
        } : undefined,
        includeKnowledge: true,
      });

      // Generate system prompt from context
      let systemPrompt = contextBuilder.generateSystemPrompt(assistantContext);

      // Detect language and add bilingual support
      let detectedLanguage: SupportedLanguage = preferences?.preferredLanguage || 'en';
      if (!preferences?.preferredLanguage || preferences.preferredLanguage === 'en') {
        // Auto-detect language from message
        const detection = detectLanguage(filteredRequest.message);
        if (detection.confidence > 0.6 && detection.language !== 'en') {
          detectedLanguage = detection.language;
          logger.debug('[Infinity Agent] Detected language:', {
            language: detectedLanguage,
            confidence: detection.confidence,
          });
        }
      }

      // Add bilingual prompt if non-English
      if (detectedLanguage !== 'en') {
        const bilingualPrompt = generateBilingualPrompt(detectedLanguage);
        systemPrompt = `${systemPrompt}${bilingualPrompt}`;
      }

      // Enhance message with context
      let enhancedMessage = filteredRequest.message;

      // Add user-provided context if available
      if (userContext) {
        enhancedMessage = `${filteredRequest.message}\n\n[Additional Context: ${userContext}]`;
      }

      // Mode-specific message formatting
      if (mode === 'search') {
        enhancedMessage = `[SEARCH MODE] User query: "${filteredRequest.message}"\n\nPlease search the knowledge base and provide relevant patterns, wisdom, and best practices.`;
      } else if (mode === 'build') {
        enhancedMessage = `[BUILD MODE] User wants to build: "${filteredRequest.message}"\n\nProvide guidance on architecture, code structure, and implementation approach. Note: For full project generation and deployment, recommend Infinity Builder.`;
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

      // Prepend system prompt to message for knowledge-aware responses
      const messageWithContext = `${systemPrompt}\n\n---\n\n${enhancedMessage}`;

      // Call Master Portal to process query with enhanced context
      const masterPortal = getMasterPortalClient();
      const result = await masterPortal.processCustomerQuery(messageWithContext, {
        conversationId: activeConversationId,
        userId,
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

      // Add memory confirmation to response if something was stored
      if (memoryStored) {
        agentResponse = `*I've stored that in my memory.*\n\n${agentResponse}`;
      }

      // Add memory suggestion if we detected something important
      if (shouldAskToRemember && potentialMemoryContent) {
        agentResponse = `${agentResponse}\n\n---\n*Would you like me to remember "${potentialMemoryContent}"? Just say "remember this" or "don't remember" to let me know.*`;
      }

      // Record response in memory for context continuity
      await contextBuilder.recordResponse(activeConversationId, agentResponse);

      // Process assistant response for phase tracking (training data)
      phaseService.processMessage(
        activeConversationId,
        agentResponse,
        'assistant'
      );
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

