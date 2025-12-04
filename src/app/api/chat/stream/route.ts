/**
 * Infinity Agent - Streaming Chat API
 *
 * Streaming version of chat endpoint using Server-Sent Events (SSE)
 * Provides real-time response generation for improved UX
 *
 * Benefits:
 * - Perceived faster response time (first token arrives sooner)
 * - Better UX for long responses (progressive display)
 * - Reduced apparent latency
 * - Client can show typing indicators as chunks arrive
 *
 * Compatible with all chat features:
 * - UAA2++ 8-Phase Protocol
 * - Hierarchical memory compression
 * - Knowledge-rich responses
 * - Ethics & values integration
 * - Bilingual support
 * - Driving mode
 * - Speaker recognition
 */

import { NextRequest } from 'next/server';
import { CapabilityLimiter } from '@/lib/capability-limiter';
import { AgentCapabilityMode, UserTier, AgentExecutionContext } from '@/types/agent-capabilities';
import { getMasterPortalClient } from '@/services/MasterPortalClient';
import { getUserService } from '@/services/UserService';
import { getAssistantContextBuilder, getConversationMemoryService, getPhaseTransitionService } from '@/lib/knowledge';
import { detectLanguage, generateBilingualPrompt, type SupportedLanguage } from '@/services/BilingualService';
import { getAdaptiveCommunicationService } from '@/services/AdaptiveCommunicationService';
import { generateEssencePrompt, type EssenceConfig } from '@/app/api/speakers/essence/route';
import logger from '@/utils/logger';

// Import helper functions from main chat route
import type { DrivingContext } from '../route';

// Re-use types from main chat route
interface UserPreferences {
  role?: string;
  experienceLevel?: string;
  primaryGoals?: string[];
  preferredMode?: 'search' | 'assist' | 'build';
  interests?: string[];
  customInterests?: string[];
  communicationStyle?: 'concise' | 'detailed' | 'conversational';
  communicationAdaptation?: 'match' | 'balanced' | 'counterbalance';
  preferredLanguage?: SupportedLanguage;
}

interface ChatStreamRequest {
  message: string;
  conversationId?: string;
  userId?: string;
  userTier?: UserTier;
  mode?: 'search' | 'assist' | 'build';
  userContext?: string;
  preferences?: UserPreferences;
  essence?: EssenceConfig;
  sessionId?: string;
  drivingMode?: DrivingContext;
}

// Ethics context
interface EthicsContext {
  familyMode?: boolean;
  childSafetyLevel?: 'open' | 'family' | 'strict';
  professionalMode?: boolean;
}

// Helper functions (copied from main chat route)
function generateEthicsPrompt(context?: EthicsContext): string {
  const parts: string[] = [];

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

  parts.push(`
[ETHICAL GUIDELINES]
- Decline harmful, illegal, or dangerous requests with explanation
- Acknowledge uncertainty and limitations honestly
- Recommend professional help for medical, legal, or mental health concerns
- Present controversial topics with balanced perspectives
- Protect user privacy and confidentiality
- Never pretend to have emotions or consciousness you don't have`);

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

  parts.push(`
[TRANSPARENCY]
- Be clear that you are an AI assistant
- Acknowledge when you don't know something
- Correct mistakes promptly when discovered
- Explain your reasoning when helpful`);

  return parts.join('\n');
}

function generateAdaptationPrompt(adaptation?: 'match' | 'balanced' | 'counterbalance'): string {
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

function generateDrivingPrompt(context: DrivingContext): string {
  const parts: string[] = [];

  parts.push(`
[DRIVING MODE ACTIVE]
The user is currently driving. Adapt your responses:
- Keep responses SHORT and CONCISE (2-3 sentences max unless asked for more)
- Use simple, clear language suitable for voice reading
- Avoid lists, code blocks, or complex formatting
- Prioritize safety - never encourage distracted driving
- If asked to do something complex, suggest they pull over first`);

  if (context.destination || context.distanceRemaining || context.estimatedArrival) {
    const navParts: string[] = [];
    if (context.destination) navParts.push(`Heading to: ${context.destination}`);
    if (context.distanceRemaining) navParts.push(`${context.distanceRemaining} miles remaining`);
    if (context.estimatedArrival) navParts.push(`ETA: ${context.estimatedArrival}`);
    parts.push(`\n[Navigation: ${navParts.join(' | ')}]`);
  }

  if (context.trafficConditions || context.weather) {
    const condParts: string[] = [];
    if (context.trafficConditions) condParts.push(`Traffic: ${context.trafficConditions}`);
    if (context.weather) condParts.push(`Weather: ${context.weather}`);
    parts.push(`\n[Conditions: ${condParts.join(' | ')}]`);
  }

  if (context.isEV) {
    const evParts: string[] = [];

    if (context.batteryPercent !== undefined) {
      evParts.push(`Battery: ${context.batteryPercent}%`);

      if (context.batteryPercent <= 20) {
        parts.push(`\n⚠️ [LOW BATTERY ALERT: ${context.batteryPercent}% - Consider suggesting nearby charging stations if relevant]`);
      }
    }

    if (context.currentRange !== undefined) {
      evParts.push(`Range: ${context.currentRange} mi`);

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

  if (context.currentMusic || context.musicMood) {
    const musicParts: string[] = [];
    if (context.currentMusic) musicParts.push(`Playing: ${context.currentMusic}`);
    if (context.musicMood) musicParts.push(`Mood: ${context.musicMood}`);
    parts.push(`\n[Music: ${musicParts.join(' | ')}]`);
  }

  parts.push(`\n
[Response Format for Driving]
- Start with the key information
- Use natural speech patterns
- Say numbers clearly (e.g., "twenty miles" not "20mi")
- End with a brief, helpful note if appropriate`);

  return parts.join('');
}

/**
 * POST /api/chat/stream
 *
 * Streaming chat endpoint using Server-Sent Events
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: ChatStreamRequest = await request.json();
    const { message, conversationId, userId: providedUserId, userTier: providedTier, mode, userContext, preferences, essence, sessionId, drivingMode } = body;

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Message is required and must be a non-empty string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (message.length > 5000) {
      return new Response(
        JSON.stringify({ error: 'Message too long. Maximum 5000 characters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'You\'ve been busy today! You\'ve reached your daily conversation limit. Come back tomorrow or upgrade to Pro for unlimited conversations.',
          rateLimit: rateLimitCheck,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
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

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Helper to send SSE event
        const sendEvent = (event: string, data: any) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        try {
          // Process phase transition
          const phaseService = getPhaseTransitionService();
          const userPhaseTransition = phaseService.processMessage(
            activeConversationId,
            filteredRequest.message,
            'user'
          );

          if (userPhaseTransition) {
            sendEvent('phase', {
              from: userPhaseTransition.previousPhase,
              to: userPhaseTransition.newPhase,
              confidence: userPhaseTransition.confidence,
            });
          }

          // Check for memory commands
          const memoryService = getConversationMemoryService();
          const memoryIntent = memoryService.detectMemoryIntent(filteredRequest.message);
          let memoryStored = false;

          if (memoryIntent.shouldStore && memoryIntent.extractedContent) {
            await memoryService.storeExplicitKnowledge(
              activeConversationId,
              memoryIntent.extractedContent,
              memoryIntent.type
            );
            memoryStored = true;
            sendEvent('memory', { stored: true, content: memoryIntent.extractedContent });
          }

          // Build context
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
            } : undefined,
            includeKnowledge: true,
          });

          // Generate system prompt
          let systemPrompt = contextBuilder.generateSystemPrompt(assistantContext);

          // Add ethics prompt
          const ethicsContext: EthicsContext = {
            familyMode: essence?.familyMode,
            childSafetyLevel: essence?.childSafetyLevel,
            professionalMode: preferences?.communicationStyle === 'concise',
          };
          const ethicsPrompt = generateEthicsPrompt(ethicsContext);

          // Add communication adaptation
          const adaptationPrompt = generateAdaptationPrompt(preferences?.communicationAdaptation);

          systemPrompt = `${ethicsPrompt}${adaptationPrompt}\n\n${systemPrompt}`;

          // Language detection
          let detectedLanguage: SupportedLanguage = preferences?.preferredLanguage || 'en';
          if (!preferences?.preferredLanguage || preferences.preferredLanguage === 'en') {
            const detection = detectLanguage(filteredRequest.message);
            if (detection.confidence > 0.6 && detection.language !== 'en') {
              detectedLanguage = detection.language;
              sendEvent('language', { detected: detectedLanguage, confidence: detection.confidence });
            }
          }

          if (detectedLanguage !== 'en') {
            const bilingualPrompt = generateBilingualPrompt(detectedLanguage);
            systemPrompt = `${systemPrompt}${bilingualPrompt}`;
          }

          // Speaker recognition
          try {
            const adaptiveService = getAdaptiveCommunicationService();
            const speakerSessionId = sessionId || activeConversationId;
            const speakerRecognition = adaptiveService.identifySpeaker(
              speakerSessionId,
              filteredRequest.message
            );

            if (speakerRecognition.isNewVoice || speakerRecognition.speakerName) {
              sendEvent('speaker', {
                speakerId: speakerRecognition.speakerId,
                speakerName: speakerRecognition.speakerName,
                ageGroup: speakerRecognition.ageGroup,
                greeting: speakerRecognition.suggestedGreeting,
              });
            }

            if (speakerRecognition.matchedProfile) {
              const profile = speakerRecognition.matchedProfile;
              const speakerContext = [];

              if (profile.name) speakerContext.push(`Speaking with: ${profile.name}`);
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
            logger.debug('[Stream] Speaker recognition skipped:', speakerError);
          }

          // Add essence
          if (essence) {
            const essencePrompt = generateEssencePrompt(essence);
            systemPrompt = `${systemPrompt}${essencePrompt}`;
            sendEvent('essence', { applied: true, voiceTone: essence.voiceTone });
          }

          // Add driving mode
          if (drivingMode?.enabled) {
            const drivingPrompt = generateDrivingPrompt(drivingMode);
            systemPrompt = `${systemPrompt}${drivingPrompt}`;
            sendEvent('driving', { enabled: true, isEV: drivingMode.isEV });
          }

          // Enhance message
          let enhancedMessage = filteredRequest.message;

          if (userContext) {
            enhancedMessage = `${filteredRequest.message}\n\n[Additional Context: ${userContext}]`;
          }

          if (mode === 'search') {
            enhancedMessage = `[SEARCH MODE] User query: "${filteredRequest.message}"\n\nPlease search the knowledge base and provide relevant patterns, wisdom, and best practices.`;
          } else if (mode === 'build') {
            enhancedMessage = `[BUILD MODE] User wants to build: "${filteredRequest.message}"\n\nProvide guidance on architecture, code structure, and implementation approach. Note: For full project generation and deployment, recommend Infinity Builder.`;
          }

          const messageWithContext = `${systemPrompt}\n\n---\n\n${enhancedMessage}`;

          // Call Master Portal for streaming
          const masterPortal = getMasterPortalClient();

          // Send start event
          sendEvent('start', { conversationId: activeConversationId });

          // NOTE: For now, we'll simulate streaming by chunking the response
          // In the future, Master Portal should support native streaming
          const result = await masterPortal.processCustomerQuery(messageWithContext, {
            conversationId: activeConversationId,
            userId,
            mode: mode || 'assist',
            limitedCapabilities: context.allowedCapabilities,
          });

          const agentResponse = result.response || 'I apologize, but I was unable to process your request.';
          const tokensUsed = result.tokensUsed || 0;

          // Simulate streaming by chunking response (word by word or sentence by sentence)
          const words = agentResponse.split(' ');
          let buffer = '';

          for (let i = 0; i < words.length; i++) {
            buffer += (i > 0 ? ' ' : '') + words[i];

            // Send chunks every 3-5 words for smoother streaming
            if (i % 4 === 0 || i === words.length - 1) {
              sendEvent('chunk', { text: buffer });
              buffer = '';

              // Small delay to simulate real streaming (remove in production with real streaming)
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }

          // Add memory confirmation
          if (memoryStored) {
            sendEvent('chunk', { text: '\n\n*I\'ve stored that in my memory.*' });
          }

          // Record response
          await contextBuilder.recordResponse(activeConversationId, agentResponse);

          // Process assistant phase
          phaseService.processMessage(activeConversationId, agentResponse, 'assistant');

          // Record usage
          await userService.recordUsage(userId, activeConversationId, tokensUsed);

          const processingTime = Date.now() - startTime;

          // Send completion event
          sendEvent('done', {
            conversationId: activeConversationId,
            metadata: {
              tokensUsed,
              processingTime,
              drivingMode: drivingMode?.enabled || false,
            },
          });

          controller.close();
        } catch (error) {
          logger.error('[Stream] Error during streaming:', error);
          sendEvent('error', {
            message: 'An error occurred during response generation',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    logger.error('[Stream] Error in streaming endpoint:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again later.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
