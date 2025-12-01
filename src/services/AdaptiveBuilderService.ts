/**
 * Adaptive Builder Service
 *
 * Every human is different. This service adapts the builder experience based on:
 * - User's EXISTING profile from assistant onboarding (personality, preferences, style)
 * - Build history and past outcomes
 * - Relevant wisdom, patterns, and gotchas from knowledge base
 * - Learning from what works for similar users
 *
 * IMPORTANT: Users subscribing to Builder have ALREADY gone through assistant onboarding.
 * We already know their:
 * - Personality type and communication style
 * - Experience level and interests
 * - Preferred topics and pain points
 * - Learning style and goals
 *
 * This service PULLS from existing profile data - it does NOT re-detect or re-ask.
 *
 * Integration points:
 * - UserMemoryStorageService: User profile from assistant onboarding
 * - AdaptiveCommunicationService: Communication style and speaker profile
 * - Knowledge base (W/P/G) for context-aware suggestions
 * - Build history for learning from past outcomes
 *
 * @since 2025-12-01
 */

import { getMasterPortalClient } from './MasterPortalClient';
import { getUserMemoryStorageService, type UserProfile, type UserLocalMemory } from '@/lib/knowledge/UserMemoryStorageService';
import { getAdaptiveCommunicationService, type SpeakerProfile, type CommunicationStyle as SpeakerCommunicationStyle } from './AdaptiveCommunicationService';
import logger from '@/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export type PersonalityType =
  | 'analytical'      // Wants details, data, thorough explanations
  | 'driver'          // Wants efficiency, results, minimal fluff
  | 'expressive'      // Wants enthusiasm, creativity, big picture
  | 'amiable';        // Wants harmony, support, reassurance

export type LearningStyle =
  | 'visual'          // Prefers diagrams, screenshots, demos
  | 'verbal'          // Prefers detailed explanations
  | 'hands-on'        // Prefers to try things, learn by doing
  | 'reading';        // Prefers documentation, written guides

export type CommunicationTone =
  | 'professional'    // Formal, business-like
  | 'casual'          // Friendly, conversational
  | 'encouraging'     // Supportive, celebratory
  | 'direct';         // Straight to the point

export interface UserContext {
  userId: string;
  experienceLevel: 'easy' | 'medium' | 'experienced';
  personalityType?: PersonalityType;
  learningStyle?: LearningStyle;
  preferredTone?: CommunicationTone;
  buildHistory: BuildHistoryItem[];
  interests: string[];
  painPoints: string[];
  goals: string[];
}

export interface BuildHistoryItem {
  templateId: string;
  templateName: string;
  completedAt: Date;
  outcome: 'success' | 'abandoned' | 'modified';
  feedback?: string;
  tokensUsed: number;
}

export interface KnowledgeContext {
  relevantWisdom: WisdomItem[];
  relevantPatterns: PatternItem[];
  relevantGotchas: GotchaItem[];
  suggestedApproaches: string[];
}

export interface WisdomItem {
  id: string;
  title: string;
  content: string;
  domain: string;
  relevanceScore: number;
}

export interface PatternItem {
  id: string;
  name: string;
  description: string;
  useCase: string;
  relevanceScore: number;
}

export interface GotchaItem {
  id: string;
  title: string;
  description: string;
  prevention: string;
  relevanceScore: number;
}

export interface AdaptedQuestion {
  question: string;
  followUp?: string;
  options?: AdaptedOption[];
  knowledgeHint?: string;
  tone: CommunicationTone;
  personalityMatch: PersonalityType;
}

export interface AdaptedOption {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
  basedOnPattern?: string;
}

export interface AdaptationResult {
  adaptedQuestion: AdaptedQuestion;
  knowledgeContext: KnowledgeContext;
  suggestedNextSteps: string[];
  warnings: string[];
}

// ============================================================================
// PERSONALITY MAPPING (from existing profile data)
// ============================================================================
//
// NOTE: Personality is ALREADY KNOWN from assistant onboarding.
// We map the user's established communicationStyle to personality type.
// No real-time detection needed - we just use what we already know.
//
// Communication Style → Personality Type mapping:
// - 'concise' → 'driver' (wants efficiency)
// - 'detailed' → 'analytical' (wants thorough explanations)
// - 'conversational' → 'amiable' (wants friendly interaction)
// - (expressive detected from interests/topics containing creative/design/art)
//

// ============================================================================
// KNOWLEDGE ROUTING
// ============================================================================

async function fetchRelevantKnowledge(
  templateId: string,
  userContext: UserContext,
  currentPhase: string
): Promise<KnowledgeContext> {
  const client = getMasterPortalClient();

  try {
    // Build search query based on context
    const searchTerms = [
      templateId,
      currentPhase,
      ...userContext.interests.slice(0, 3),
      ...userContext.goals.slice(0, 2),
    ].join(' ');

    const results = await client.searchKnowledge(searchTerms, {
      type: 'all',
      limit: 10,
    });

    // Transform and score results
    const wisdom: WisdomItem[] = results.grouped.wisdom.map((w: any) => ({
      id: w.id,
      title: w.title,
      content: w.content,
      domain: w.domain || 'general',
      relevanceScore: calculateRelevance(w, userContext),
    }));

    const patterns: PatternItem[] = results.grouped.patterns.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      useCase: p.use_case || '',
      relevanceScore: calculateRelevance(p, userContext),
    }));

    const gotchas: GotchaItem[] = results.grouped.gotchas.map((g: any) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      prevention: g.prevention || '',
      relevanceScore: calculateRelevance(g, userContext),
    }));

    // Generate suggested approaches based on patterns
    const suggestedApproaches = patterns
      .filter(p => p.relevanceScore > 0.7)
      .map(p => p.useCase)
      .slice(0, 3);

    return {
      relevantWisdom: wisdom.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3),
      relevantPatterns: patterns.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3),
      relevantGotchas: gotchas.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3),
      suggestedApproaches,
    };
  } catch (error) {
    logger.error('[AdaptiveBuilder] Error fetching knowledge:', error);
    return {
      relevantWisdom: [],
      relevantPatterns: [],
      relevantGotchas: [],
      suggestedApproaches: [],
    };
  }
}

function calculateRelevance(item: any, context: UserContext): number {
  let score = 0.5; // Base score

  // Boost if matches user interests
  const itemText = `${item.title || ''} ${item.description || ''} ${item.content || ''}`.toLowerCase();
  context.interests.forEach(interest => {
    if (itemText.includes(interest.toLowerCase())) {
      score += 0.1;
    }
  });

  // Boost if addresses user pain points
  context.painPoints.forEach(pain => {
    if (itemText.includes(pain.toLowerCase())) {
      score += 0.15;
    }
  });

  // Adjust based on experience level
  if (context.experienceLevel === 'easy' && itemText.includes('beginner')) {
    score += 0.1;
  } else if (context.experienceLevel === 'experienced' && itemText.includes('advanced')) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

// ============================================================================
// QUESTION ADAPTATION
// ============================================================================

function adaptQuestionForPersonality(
  baseQuestion: string,
  personality: PersonalityType,
  tone: CommunicationTone
): string {
  // Prefix/suffix based on personality
  const prefixes: Record<PersonalityType, string> = {
    analytical: "I'd like to understand in detail - ",
    driver: "",
    expressive: "This is exciting! ",
    amiable: "I'd love to hear - ",
  };

  const suffixes: Record<PersonalityType, string> = {
    analytical: " Feel free to be as detailed as you'd like.",
    driver: "",
    expressive: " Share your vision!",
    amiable: " No pressure, take your time.",
  };

  // Tone adjustments
  let question = baseQuestion;

  if (tone === 'encouraging') {
    question = question.replace(/\?$/, "? You're doing great!");
  } else if (tone === 'direct') {
    // Remove fluff words
    question = question.replace(/just |maybe |perhaps |a bit /gi, '');
  }

  return `${prefixes[personality]}${question}${suffixes[personality]}`;
}

function generateOptionsFromPatterns(
  patterns: PatternItem[],
  baseOptions: AdaptedOption[]
): AdaptedOption[] {
  // Enhance options with pattern-based recommendations
  const enhancedOptions = [...baseOptions];

  patterns.forEach(pattern => {
    // Find matching option and mark as recommended
    const matchingOption = enhancedOptions.find(
      opt => opt.label.toLowerCase().includes(pattern.name.toLowerCase())
    );

    if (matchingOption) {
      matchingOption.recommended = true;
      matchingOption.basedOnPattern = pattern.name;
    }
  });

  return enhancedOptions;
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

export class AdaptiveBuilderService {
  private userContextCache: Map<string, UserContext> = new Map();
  private userMemoryService = getUserMemoryStorageService();
  private communicationService = getAdaptiveCommunicationService();

  /**
   * Process a user message - updates communication service for any micro-adjustments
   * Note: Major personality/style already known from assistant onboarding
   */
  processUserMessage(userId: string, message: string): void {
    // The communication service tracks minor style shifts within sessions
    // but doesn't override the established profile
    this.communicationService.analyzeMessage(userId, message, userId);
  }

  /**
   * Get personality type from existing user profile
   * This is ALREADY KNOWN from assistant onboarding - we don't re-detect
   */
  getDetectedPersonality(userId: string): PersonalityType {
    const cached = this.userContextCache.get(userId);
    if (cached?.personalityType) {
      return cached.personalityType;
    }
    // Default until profile is loaded
    return 'amiable';
  }

  /**
   * Load user context from existing profile (from assistant onboarding)
   * This pulls all the data we already have - no re-detection needed
   */
  async getUserContext(
    userId: string,
    experienceLevel: 'easy' | 'medium' | 'experienced'
  ): Promise<UserContext> {
    const cached = this.userContextCache.get(userId);
    if (cached) {
      return { ...cached, experienceLevel };
    }

    // PULL from existing user profile (from assistant onboarding)
    const localMemory = await this.userMemoryService.getLocalMemory(userId);
    const profile = localMemory.profile;

    // Map communication style to personality type
    const personalityType = this.mapCommunicationStyleToPersonality(profile.communicationStyle);

    // Map communication style to tone
    const preferredTone = this.mapCommunicationStyleToTone(profile.communicationStyle);

    // Extract pain points from gotchas
    const painPoints = localMemory.gotchas.map(g => g.problem).slice(0, 5);

    // Extract goals from wisdom/patterns
    const goals = localMemory.wisdom
      .filter(w => w.content.toLowerCase().includes('goal') || w.content.toLowerCase().includes('want'))
      .map(w => w.content)
      .slice(0, 5);

    const context: UserContext = {
      userId,
      experienceLevel,
      personalityType,
      learningStyle: this.inferLearningStyle(profile),
      preferredTone,
      buildHistory: [], // Will be populated from build records
      interests: profile.interests || [],
      painPoints,
      goals,
    };

    this.userContextCache.set(userId, context);
    logger.info(`[AdaptiveBuilder] Loaded existing profile for ${userId}:`, {
      personality: personalityType,
      tone: preferredTone,
      interests: context.interests.length,
    });

    return context;
  }

  /**
   * Map user's communication style (from onboarding) to personality type
   */
  private mapCommunicationStyleToPersonality(style: string): PersonalityType {
    switch (style) {
      case 'concise':
        return 'driver'; // Wants efficiency, minimal fluff
      case 'detailed':
        return 'analytical'; // Wants thorough explanations
      case 'conversational':
      default:
        return 'amiable'; // Wants friendly, supportive interaction
    }
  }

  /**
   * Map communication style to preferred tone
   */
  private mapCommunicationStyleToTone(style: string): CommunicationTone {
    switch (style) {
      case 'concise':
        return 'direct';
      case 'detailed':
        return 'professional';
      case 'conversational':
      default:
        return 'casual';
    }
  }

  /**
   * Infer learning style from profile data
   */
  private inferLearningStyle(profile: UserProfile): LearningStyle {
    // Check interests for clues
    const interests = (profile.interests || []).join(' ').toLowerCase();
    const topics = (profile.preferredTopics || []).join(' ').toLowerCase();
    const combined = `${interests} ${topics}`;

    if (combined.includes('visual') || combined.includes('design') || combined.includes('diagram')) {
      return 'visual';
    }
    if (combined.includes('document') || combined.includes('read') || combined.includes('guide')) {
      return 'reading';
    }
    if (combined.includes('explain') || combined.includes('talk') || combined.includes('discuss')) {
      return 'verbal';
    }
    // Default for builders - they want to build!
    return 'hands-on';
  }

  /**
   * Update user context with new information (rare - profile already established)
   */
  updateUserContext(userId: string, updates: Partial<UserContext>): void {
    const existing = this.userContextCache.get(userId);
    if (existing) {
      this.userContextCache.set(userId, { ...existing, ...updates });
    }
  }

  /**
   * Adapt a question based on user context and knowledge
   */
  async adaptQuestion(
    userId: string,
    templateId: string,
    phase: string,
    baseQuestion: string,
    baseOptions?: AdaptedOption[]
  ): Promise<AdaptationResult> {
    // Get user context
    const context = await this.getUserContext(userId, 'easy');

    // Fetch relevant knowledge
    const knowledge = await fetchRelevantKnowledge(templateId, context, phase);

    // Detect personality from conversation
    const personality = this.getDetectedPersonality(userId);
    const tone = context.preferredTone || 'casual';

    // Adapt question
    const adaptedQuestionText = adaptQuestionForPersonality(baseQuestion, personality, tone);

    // Generate knowledge hint if relevant
    let knowledgeHint: string | undefined;
    if (knowledge.relevantWisdom.length > 0) {
      const topWisdom = knowledge.relevantWisdom[0];
      knowledgeHint = `Pro tip: ${topWisdom.title}`;
    }

    // Enhance options with pattern recommendations
    const adaptedOptions = baseOptions
      ? generateOptionsFromPatterns(knowledge.relevantPatterns, baseOptions)
      : undefined;

    // Generate warnings from gotchas
    const warnings = knowledge.relevantGotchas
      .filter(g => g.relevanceScore > 0.8)
      .map(g => `Watch out: ${g.title}`);

    return {
      adaptedQuestion: {
        question: adaptedQuestionText,
        options: adaptedOptions,
        knowledgeHint,
        tone,
        personalityMatch: personality,
      },
      knowledgeContext: knowledge,
      suggestedNextSteps: knowledge.suggestedApproaches,
      warnings,
    };
  }

  /**
   * Get personalized suggestions for a build phase
   */
  async getPhraseSuggestions(
    userId: string,
    templateId: string,
    phase: string
  ): Promise<string[]> {
    const context = await this.getUserContext(userId, 'easy');
    const knowledge = await fetchRelevantKnowledge(templateId, context, phase);

    const suggestions: string[] = [];

    // Add pattern-based suggestions
    knowledge.relevantPatterns.forEach(pattern => {
      suggestions.push(`Consider using ${pattern.name}: ${pattern.description}`);
    });

    // Add wisdom-based suggestions
    knowledge.relevantWisdom.forEach(wisdom => {
      suggestions.push(wisdom.content);
    });

    return suggestions.slice(0, 5);
  }

  /**
   * Record build outcome for learning
   */
  recordBuildOutcome(
    userId: string,
    templateId: string,
    templateName: string,
    outcome: 'success' | 'abandoned' | 'modified',
    tokensUsed: number,
    feedback?: string
  ): void {
    const context = this.userContextCache.get(userId);
    if (context) {
      context.buildHistory.push({
        templateId,
        templateName,
        completedAt: new Date(),
        outcome,
        feedback,
        tokensUsed,
      });
      this.userContextCache.set(userId, context);

      // TODO: Persist to user profile service
      logger.info(`[AdaptiveBuilder] Recorded build outcome for ${userId}: ${outcome}`);
    }
  }

  /**
   * Get communication style from existing profile
   * This uses what we ALREADY KNOW from assistant onboarding
   */
  getCommunicationStyle(userId: string): {
    tone: CommunicationTone;
    verbosity: 'concise' | 'detailed' | 'balanced';
    encouragement: boolean;
    technicalLevel: 'beginner' | 'intermediate' | 'advanced';
  } {
    const context = this.userContextCache.get(userId);

    // Use cached context if available (already derived from profile)
    if (context) {
      const styleMap: Record<PersonalityType, {
        tone: CommunicationTone;
        verbosity: 'concise' | 'detailed' | 'balanced';
        encouragement: boolean;
      }> = {
        analytical: { tone: 'professional', verbosity: 'detailed', encouragement: false },
        driver: { tone: 'direct', verbosity: 'concise', encouragement: false },
        expressive: { tone: 'encouraging', verbosity: 'balanced', encouragement: true },
        amiable: { tone: 'casual', verbosity: 'balanced', encouragement: true },
      };

      const style = styleMap[context.personalityType || 'amiable'];

      // Technical level based on experience
      const technicalLevel = context.experienceLevel === 'easy'
        ? 'beginner'
        : context.experienceLevel === 'experienced'
          ? 'advanced'
          : 'intermediate';

      return {
        ...style,
        technicalLevel,
      };
    }

    // Default (profile not loaded yet)
    return {
      tone: 'casual',
      verbosity: 'balanced',
      encouragement: true,
      technicalLevel: 'intermediate',
    };
  }

  /**
   * Get user's wisdom, patterns, and gotchas from their existing memory
   * This is their PERSONAL knowledge, not template knowledge
   */
  async getUserKnowledge(userId: string): Promise<{
    wisdom: string[];
    patterns: string[];
    gotchas: string[];
  }> {
    const localMemory = await this.userMemoryService.getLocalMemory(userId);

    return {
      wisdom: localMemory.wisdom.map(w => w.content),
      patterns: localMemory.patterns.map(p => `${p.name}: ${p.description}`),
      gotchas: localMemory.gotchas.map(g => `${g.problem} → ${g.solution}`),
    };
  }

  /**
   * Check if user has been through assistant onboarding
   * (they should have if they're subscribing to Builder)
   */
  async hasCompletedOnboarding(userId: string): Promise<boolean> {
    const localMemory = await this.userMemoryService.getLocalMemory(userId);
    // If they have profile data or any memories, they've been through onboarding
    return (
      !!localMemory.profile.name ||
      localMemory.profile.interests.length > 0 ||
      localMemory.wisdom.length > 0 ||
      localMemory.patterns.length > 0
    );
  }
}

// Singleton instance
let adaptiveBuilderService: AdaptiveBuilderService | null = null;

export function getAdaptiveBuilderService(): AdaptiveBuilderService {
  if (!adaptiveBuilderService) {
    adaptiveBuilderService = new AdaptiveBuilderService();
  }
  return adaptiveBuilderService;
}
