/**
 * Freemium Offer Service
 *
 * Detects when to offer free trials of paid features based on user queries.
 * Makes the free tier more valuable while showcasing what Pro/Builder can do.
 *
 * TRIGGERS:
 * 1. "How do I..." / "Help me..." → Offer free Assist response
 * 2. "Build..." / "Create..." / "Implement..." → Offer free mini-build
 * 3. Complex queries → Offer free deep research sample
 *
 * LIMITS:
 * - 3 free assist responses per day
 * - 1 free mini-build per week
 * - 1 free deep research per day
 */

export type FreemiumOfferType = 'assist' | 'build' | 'deep_research';

export interface FreemiumOffer {
  type: FreemiumOfferType;
  title: string;
  description: string;
  ctaText: string;
  upgradeText: string;
  tier: 'assistant_pro' | 'builder_pro';
  remainingToday: number;
  maxPerDay: number;
}

export interface FreemiumUsage {
  assistUsed: number;
  buildUsed: number;
  deepResearchUsed: number;
  lastReset: string; // ISO date
  weeklyBuildUsed: number;
  weeklyBuildReset: string; // ISO date
}

// Query patterns that suggest user wants help (Assist mode)
const ASSIST_PATTERNS = [
  /^how (do|can|should|would) (i|we|you)/i,
  /^help (me|us)/i,
  /^explain/i,
  /^what (is|are|does|should)/i,
  /^why (does|is|should|would)/i,
  /^can you (help|explain|show|tell)/i,
  /\?$/,  // Questions
];

// Query patterns that suggest user wants to build something
const BUILD_PATTERNS = [
  /^(build|create|implement|develop|make|generate|write|code)/i,
  /^(add|integrate|setup|configure|deploy)/i,
  /\b(api|endpoint|component|service|function|class|module)\b/i,
  /\b(architecture|design|pattern|structure)\b/i,
  /\b(react|next|node|typescript|python|rust|go)\b.*\b(app|application|project)\b/i,
];

// Query patterns that suggest complex research
const DEEP_RESEARCH_PATTERNS = [
  /\b(compare|comparison|versus|vs)\b/i,
  /\b(best practices?|recommendations?|approach)\b/i,
  /\b(trade-?offs?|pros and cons|advantages|disadvantages)\b/i,
  /\b(comprehensive|in-depth|detailed|thorough)\b/i,
  /\b(analysis|evaluation|assessment)\b/i,
];

/**
 * Detect what type of freemium offer to show based on query
 */
export function detectOfferType(query: string): FreemiumOfferType | null {
  const trimmedQuery = query.trim().toLowerCase();

  // Check build patterns first (more specific)
  for (const pattern of BUILD_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      return 'build';
    }
  }

  // Check deep research patterns
  for (const pattern of DEEP_RESEARCH_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      return 'deep_research';
    }
  }

  // Check assist patterns
  for (const pattern of ASSIST_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      return 'assist';
    }
  }

  return null;
}

/**
 * Get default freemium usage for new users
 */
export function getDefaultUsage(): FreemiumUsage {
  const today = new Date().toISOString().split('T')[0];
  return {
    assistUsed: 0,
    buildUsed: 0,
    deepResearchUsed: 0,
    lastReset: today,
    weeklyBuildUsed: 0,
    weeklyBuildReset: today,
  };
}

/**
 * Check and reset usage if needed (daily/weekly)
 */
export function checkAndResetUsage(usage: FreemiumUsage): FreemiumUsage {
  const today = new Date().toISOString().split('T')[0];
  const lastReset = new Date(usage.lastReset);
  const weeklyReset = new Date(usage.weeklyBuildReset);
  const now = new Date();

  // Daily reset
  if (usage.lastReset !== today) {
    usage = {
      ...usage,
      assistUsed: 0,
      deepResearchUsed: 0,
      lastReset: today,
    };
  }

  // Weekly reset (7 days)
  const daysSinceWeeklyReset = Math.floor(
    (now.getTime() - weeklyReset.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceWeeklyReset >= 7) {
    usage = {
      ...usage,
      weeklyBuildUsed: 0,
      weeklyBuildReset: today,
    };
  }

  return usage;
}

/**
 * Check if user can use a freemium feature
 */
export function canUseFreemium(
  usage: FreemiumUsage,
  offerType: FreemiumOfferType
): { allowed: boolean; remaining: number; max: number } {
  const checkedUsage = checkAndResetUsage(usage);

  switch (offerType) {
    case 'assist':
      return {
        allowed: checkedUsage.assistUsed < 3,
        remaining: Math.max(0, 3 - checkedUsage.assistUsed),
        max: 3,
      };
    case 'build':
      return {
        allowed: checkedUsage.weeklyBuildUsed < 1,
        remaining: Math.max(0, 1 - checkedUsage.weeklyBuildUsed),
        max: 1,
      };
    case 'deep_research':
      return {
        allowed: checkedUsage.deepResearchUsed < 1,
        remaining: Math.max(0, 1 - checkedUsage.deepResearchUsed),
        max: 1,
      };
    default:
      return { allowed: false, remaining: 0, max: 0 };
  }
}

/**
 * Record freemium usage
 */
export function recordUsage(
  usage: FreemiumUsage,
  offerType: FreemiumOfferType
): FreemiumUsage {
  const checkedUsage = checkAndResetUsage(usage);

  switch (offerType) {
    case 'assist':
      return { ...checkedUsage, assistUsed: checkedUsage.assistUsed + 1 };
    case 'build':
      return { ...checkedUsage, weeklyBuildUsed: checkedUsage.weeklyBuildUsed + 1 };
    case 'deep_research':
      return { ...checkedUsage, deepResearchUsed: checkedUsage.deepResearchUsed + 1 };
    default:
      return checkedUsage;
  }
}

/**
 * Generate freemium offer details
 */
export function generateOffer(
  offerType: FreemiumOfferType,
  usage: FreemiumUsage
): FreemiumOffer | null {
  const { allowed, remaining, max } = canUseFreemium(usage, offerType);

  if (!allowed) {
    return null;
  }

  switch (offerType) {
    case 'assist':
      return {
        type: 'assist',
        title: 'Try AI Assistant',
        description:
          "It looks like you're asking a question. Want me to give you a personalized answer with context and explanations?",
        ctaText: `Get AI Answer (${remaining} free today)`,
        upgradeText: 'Upgrade to Assistant Pro for unlimited AI conversations',
        tier: 'assistant_pro',
        remainingToday: remaining,
        maxPerDay: max,
      };

    case 'build':
      return {
        type: 'build',
        title: 'Try Free Mini-Build',
        description:
          "It looks like you want to build something. I can generate a starter implementation with best practices baked in.",
        ctaText: `Generate Code (${remaining} free this week)`,
        upgradeText: 'Upgrade to Builder Pro for unlimited code generation',
        tier: 'builder_pro',
        remainingToday: remaining,
        maxPerDay: max,
      };

    case 'deep_research':
      return {
        type: 'deep_research',
        title: 'Try Deep Research',
        description:
          "This looks like a complex topic. I can do comprehensive research with synthesis and recommendations.",
        ctaText: `Deep Research (${remaining} free today)`,
        upgradeText: 'Upgrade to Assistant Pro for unlimited deep research',
        tier: 'assistant_pro',
        remainingToday: remaining,
        maxPerDay: max,
      };

    default:
      return null;
  }
}

/**
 * Analyze query and generate appropriate freemium offer
 */
export function analyzeQueryForOffer(
  query: string,
  usage: FreemiumUsage
): FreemiumOffer | null {
  const offerType = detectOfferType(query);

  if (!offerType) {
    return null;
  }

  return generateOffer(offerType, usage);
}
