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
import { getAdaptiveCommunicationService, type VoiceRecognitionResult } from '@/services/AdaptiveCommunicationService';
import { generateEssencePrompt, type EssenceConfig } from '@/app/api/speakers/essence/route';
import { getJobDetectionService, getJobKnowledgeTracker } from '@/lib/job-detection';
import logger from '@/utils/logger';
import {
  createErrorResponse,
  createRateLimitError,
  createValidationError,
  ErrorCode,
  handleUnknownError,
} from '@/utils/error-handling';

// ============================================================================
// ETHICS & VALUES INTEGRATION
// ============================================================================

interface EthicsContext {
  familyMode?: boolean;
  childSafetyLevel?: 'open' | 'family' | 'strict';
  professionalMode?: boolean;
}

/**
 * Generate ethics-aware system prompt for value-aligned AI behavior
 * Based on EthicsValuesService in uaa2-service
 */
function generateEthicsPrompt(context?: EthicsContext): string {
  const parts: string[] = [];

  // Core values introduction
  parts.push(`
[CORE VALUES]
You are guided by these core values, in order of priority:
1. SAFETY - Prevent harm to users and others above all else
2. HONESTY - Be truthful, accurate, and transparent about limitations
3. HELPFULNESS - Genuinely assist users within ethical bounds
4. RESPECT - Honor user autonomy, dignity, and diverse perspectives
5. PRIVACY - Protect user information and confidentiality
6. FAIRNESS - Treat all users equitably
7. RESPONSIBILITY - Own mistakes and provide corrections
8. GROWTH - Support learning and user empowerment`);

  // Ethical guidelines
  parts.push(`
[ETHICAL GUIDELINES]
- Decline harmful, illegal, or dangerous requests with explanation
- Acknowledge uncertainty and limitations honestly
- Recommend professional help for medical, legal, or mental health concerns
- Present controversial topics with balanced perspectives
- Protect user privacy and confidentiality
- Never pretend to have emotions or consciousness you don't have`);

  // Context-specific additions
  if (context?.familyMode) {
    const safetyLevel = context.childSafetyLevel || 'family';
    parts.push(`
[FAMILY MODE - ${safetyLevel.toUpperCase()} SAFETY]
- All content must be appropriate for family audiences
- Prioritize child safety in all responses
- Use age-appropriate language
- Avoid violence, explicit content, and mature themes
- Support healthy family dynamics`);
  }

  if (context?.professionalMode) {
    parts.push(`
[PROFESSIONAL MODE]
- Maintain formal, business-appropriate communication
- Focus on productivity and task completion
- Be concise and action-oriented
- Respect professional boundaries`);
  }

  // Transparency reminder
  parts.push(`
[TRANSPARENCY]
- Be clear that you are an AI assistant
- Acknowledge when you don't know something
- Correct mistakes promptly when discovered
- Explain your reasoning when helpful`);

  return parts.join('\n');
}

// Communication adaptation style
type CommunicationAdaptation = 'match' | 'balanced' | 'counterbalance';

/**
 * Generate communication adaptation prompt based on user preference
 */
function generateAdaptationPrompt(adaptation?: CommunicationAdaptation): string {
  switch (adaptation) {
    case 'match':
      return `
[COMMUNICATION STYLE: MATCH USER]
Mirror the user's energy and communication style.
If they're casual, be casual. If they joke, joke back.
Match their pace and enthusiasm level.
Be what they are - if they're excited, get excited with them.`;

    case 'counterbalance':
      return `
[COMMUNICATION STYLE: COUNTERBALANCE]
Be what the user needs, not what they are.
If they're stressed, be calming and reassuring.
If they're scattered, be focused and organized.
If they're negative, gently offer perspective.
If they're overwhelmed, be simple and grounding.
Help balance them out.`;

    case 'balanced':
    default:
      return `
[COMMUNICATION STYLE: BALANCED]
Be friendly and approachable. Adapt to context.
Professional for work topics, casual for chat.
Warm but not over-the-top.
Read the room and respond naturally.`;
  }
}

interface UserPreferences {
  role?: string;
  experienceLevel?: string;
  primaryGoals?: string[];
  preferredMode?: 'search' | 'assist' | 'build';
  interests?: string[];
  customInterests?: string[];
  communicationStyle?: 'concise' | 'detailed' | 'conversational';
  communicationAdaptation?: CommunicationAdaptation;
  workflowPhases?: WorkflowPhase[];
  preferredLanguage?: SupportedLanguage;
}

/**
 * Driving mode context for in-vehicle assistant
 * Works for both EV and non-EV drivers
 */
export interface DrivingContext {
  enabled: boolean;
  // Vehicle info (optional)
  isEV?: boolean;
  vehicleId?: string;
  // EV-specific (optional)
  batteryPercent?: number;
  currentRange?: number; // miles/km
  isCharging?: boolean;
  chargingTimeRemaining?: number; // minutes
  // Navigation (all drivers)
  destination?: string;
  estimatedArrival?: string;
  distanceRemaining?: number; // miles/km
  // Conditions (all drivers)
  trafficConditions?: 'light' | 'moderate' | 'heavy';
  weather?: string;
  // Music integration
  currentMusic?: string;
  musicMood?: 'calm' | 'energetic' | 'focused' | 'relaxed';
}

interface ChatRequest {
  message: string;
  conversationId?: string;
  userId?: string;
  userTier?: UserTier;
  mode?: 'search' | 'assist' | 'build';
  userContext?: string;
  preferences?: UserPreferences;
  essence?: EssenceConfig;
  sessionId?: string; // For speaker recognition continuity
  drivingMode?: DrivingContext; // Driving mode context
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
    drivingMode?: boolean;
  };
}

// ============================================================================
// DRIVING MODE PROMPT GENERATOR
// ============================================================================

/**
 * Generate driving-optimized system prompt
 * Works for both EV and non-EV drivers
 */
function generateDrivingPrompt(context: DrivingContext): string {
  const parts: string[] = [];

  // Base driving mode instructions
  parts.push(`
[DRIVING MODE ACTIVE]
The user is currently driving. Adapt your responses:
- Keep responses SHORT and CONCISE (2-3 sentences max unless asked for more)
- Use simple, clear language suitable for voice reading
- Avoid lists, code blocks, or complex formatting
- Prioritize safety - never encourage distracted driving
- If asked to do something complex, suggest they pull over first`);

  // Navigation context (all drivers)
  if (context.destination || context.distanceRemaining || context.estimatedArrival) {
    const navParts: string[] = [];
    if (context.destination) navParts.push(`Heading to: ${context.destination}`);
    if (context.distanceRemaining) navParts.push(`${context.distanceRemaining} miles remaining`);
    if (context.estimatedArrival) navParts.push(`ETA: ${context.estimatedArrival}`);
    parts.push(`\n[Navigation: ${navParts.join(' | ')}]`);
  }

  // Traffic & weather (all drivers)
  if (context.trafficConditions || context.weather) {
    const condParts: string[] = [];
    if (context.trafficConditions) condParts.push(`Traffic: ${context.trafficConditions}`);
    if (context.weather) condParts.push(`Weather: ${context.weather}`);
    parts.push(`\n[Conditions: ${condParts.join(' | ')}]`);
  }

  // EV-specific context
  if (context.isEV) {
    const evParts: string[] = [];

    if (context.batteryPercent !== undefined) {
      evParts.push(`Battery: ${context.batteryPercent}%`);

      // Add proactive alerts for low battery
      if (context.batteryPercent <= 20) {
        parts.push(`\n⚠️ [LOW BATTERY ALERT: ${context.batteryPercent}% - Consider suggesting nearby charging stations if relevant]`);
      }
    }

    if (context.currentRange !== undefined) {
      evParts.push(`Range: ${context.currentRange} mi`);

      // Check if range might not be sufficient for destination
      if (context.distanceRemaining && context.currentRange < context.distanceRemaining * 1.2) {
        parts.push(`\n⚠️ [RANGE ADVISORY: Current range (${context.currentRange} mi) may be tight for destination (${context.distanceRemaining} mi). Be ready to suggest charging stops.]`);
      }
    }

    if (context.isCharging) {
      evParts.push('Currently charging');
      if (context.chargingTimeRemaining) {
        evParts.push(`${context.chargingTimeRemaining} min remaining`);
      }
    }

    if (evParts.length > 0) {
      parts.push(`\n[EV Status: ${evParts.join(' | ')}]`);
    }
  }

  // Music context
  if (context.currentMusic || context.musicMood) {
    const musicParts: string[] = [];
    if (context.currentMusic) musicParts.push(`Playing: ${context.currentMusic}`);
    if (context.musicMood) musicParts.push(`Mood: ${context.musicMood}`);
    parts.push(`\n[Music: ${musicParts.join(' | ')}]`);
  }

  // Voice-friendly response format reminder
  parts.push(`\n
[Response Format for Driving]
- Start with the key information
- Use natural speech patterns
- Say numbers clearly (e.g., "twenty miles" not "20mi")
- End with a brief, helpful note if appropriate`);

  return parts.join('');
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
    const { message, conversationId, userId: providedUserId, userTier: providedTier, mode, userContext, preferences, essence, sessionId, drivingMode } = body;

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
            'You\'ve been busy today! You\'ve reached your daily conversation limit. Come back tomorrow or upgrade to Pro for unlimited conversations.',
          rateLimit: rateLimitCheck,
          suggestion: 'Upgrade to Pro for unlimited access to the assistant',
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

      // Detect job category for knowledge tracking
      const jobDetectionService = getJobDetectionService();
      const jobKnowledgeTracker = getJobKnowledgeTracker();
      const jobResult = jobDetectionService.detectJob({
        query: filteredRequest.message,
        conversationHistory: userContext ? [userContext] : undefined,
        userProfile: preferences ? {
          profession: preferences.role,
          role: preferences.role,
          industry: preferences.interests?.[0]
        } : undefined
      });

      // Log job detection
      if (jobResult.category !== 'unknown' && jobResult.category !== 'general') {
        logger.debug('[Infinity Agent] Job detected:', {
          category: jobResult.category,
          confidence: jobResult.confidence,
          specificRole: jobResult.specificRole,
          keywords: jobResult.keywords
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
        
        // Track experimental knowledge creation
        if (jobResult.category !== 'unknown' && jobResult.category !== 'general') {
          jobKnowledgeTracker.trackExperimentalKnowledge(jobResult.category);
        }
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

      // Add ethics & values prompt for moral compass
      // Extract ethics context from essence config or defaults
      const ethicsContext: EthicsContext = {
        familyMode: essence?.familyMode,
        childSafetyLevel: essence?.childSafetyLevel,
        professionalMode: preferences?.communicationStyle === 'concise', // Professional = concise
      };
      const ethicsPrompt = generateEthicsPrompt(ethicsContext);

      // Add communication adaptation prompt
      const adaptationPrompt = generateAdaptationPrompt(preferences?.communicationAdaptation);

      systemPrompt = `${ethicsPrompt}${adaptationPrompt}\n\n${systemPrompt}`;

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

      // Speaker recognition and adaptive communication
      let speakerRecognition: VoiceRecognitionResult | null = null;
      let speakerGreeting = '';
      try {
        const adaptiveService = getAdaptiveCommunicationService();
        // Use session ID for speaker continuity, fallback to conversation ID
        const speakerSessionId = sessionId || activeConversationId;

        // Identify speaker from message patterns
        speakerRecognition = adaptiveService.identifySpeaker(
          speakerSessionId,
          filteredRequest.message
        );

        // If this is a new voice or returning speaker, include greeting
        if (speakerRecognition.isNewVoice || speakerRecognition.speakerName) {
          speakerGreeting = speakerRecognition.suggestedGreeting;

          // Log speaker recognition for analytics
          logger.debug('[Infinity Agent] Speaker recognized:', {
            speakerId: speakerRecognition.speakerId,
            speakerName: speakerRecognition.speakerName,
            ageGroup: speakerRecognition.ageGroup,
            confidence: speakerRecognition.confidence,
            isNewVoice: speakerRecognition.isNewVoice,
          });
        }

        // Add speaker context to system prompt if we have a profile
        if (speakerRecognition.matchedProfile) {
          const profile = speakerRecognition.matchedProfile;
          const speakerContext = [];

          if (profile.name) {
            speakerContext.push(`Speaking with: ${profile.name}`);
          }
          if (profile.estimatedAge && profile.estimatedAge !== 'adult') {
            speakerContext.push(`Age group: ${profile.estimatedAge}`);
          }
          if (profile.communicationStyle) {
            speakerContext.push(`Prefers ${profile.communicationStyle} communication`);
          }
          if (profile.rememberedFacts && profile.rememberedFacts.length > 0) {
            speakerContext.push(`Remember: ${profile.rememberedFacts.slice(0, 3).join('; ')}`);
          }

          if (speakerContext.length > 0) {
            systemPrompt = `${systemPrompt}\n\n[Speaker Context: ${speakerContext.join('. ')}]`;
          }
        }
      } catch (speakerError) {
        logger.debug('[Infinity Agent] Speaker recognition skipped:', speakerError);
      }

      // Add essence/personality configuration to system prompt
      if (essence) {
        const essencePrompt = generateEssencePrompt(essence);
        systemPrompt = `${systemPrompt}${essencePrompt}`;

        logger.debug('[Infinity Agent] Essence config applied:', {
          voiceTone: essence.voiceTone,
          familyMode: essence.familyMode,
          childSafetyLevel: essence.childSafetyLevel,
        });
      }

      // Add driving mode context to system prompt
      if (drivingMode?.enabled) {
        const drivingPrompt = generateDrivingPrompt(drivingMode);
        systemPrompt = `${systemPrompt}${drivingPrompt}`;

        logger.debug('[Infinity Agent] Driving mode enabled:', {
          isEV: drivingMode.isEV,
          batteryPercent: drivingMode.batteryPercent,
          destination: drivingMode.destination,
        });
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

      // Check for knowledge gaps (if job category detected)
      let hadKnowledgeGap = false;
      if (jobResult.category !== 'unknown' && jobResult.category !== 'general') {
        try {
          const { needsResearch } = await import('@/lib/knowledge');
          const researchAssessment = await needsResearch(filteredRequest.message);
          hadKnowledgeGap = researchAssessment.needsResearch;
          
          // Track query with knowledge gap info
          jobKnowledgeTracker.trackQuery(jobResult, filteredRequest.message, hadKnowledgeGap);
        } catch (error) {
          // Fallback: track query without gap detection
          jobKnowledgeTracker.trackQuery(jobResult, filteredRequest.message, false);
          logger.debug('[Infinity Agent] Knowledge gap detection skipped:', error);
        }
      } else {
        // Track general queries too
        jobKnowledgeTracker.trackQuery(jobResult, filteredRequest.message, false);
      }

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
        ...(drivingMode?.enabled && { drivingMode: true }),
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
    return handleUnknownError(error, '[Infinity Agent] Chat endpoint');
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
    return createValidationError('conversationId', 'conversationId is required');
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
    return handleUnknownError(error, '[Infinity Agent] Fetch conversation');
  }
});

