/**
 * Beta Wrapper Service
 *
 * Manages the beta period for Infinity Assistant.
 * During beta (2 weeks from launch), all features are FREE.
 * After beta expires, users must subscribe to continue using pro features.
 *
 * BETA PERIOD:
 * - Start: December 1, 2024
 * - End: December 15, 2024 (2 weeks)
 *
 * BETA FEATURES:
 * - All search protocols (quick, standard, deep, comprehensive)
 * - AI Assist mode
 * - Build mode (code generation)
 * - Deep research
 * - Unlimited usage
 *
 * POST-BETA:
 * - Free tier: Search only (quick protocol)
 * - Assistant Pro: Search + Assist + Deep Research
 * - Builder Pro: All features
 *
 * @since 2025-11-29
 */

// Beta configuration
const BETA_CONFIG = {
  // Beta period dates
  START_DATE: new Date('2024-12-01T00:00:00Z'),
  END_DATE: new Date('2024-12-15T23:59:59Z'),

  // Beta version identifier
  VERSION: '1.0.0-beta',

  // Feature flags during beta
  FEATURES: {
    unlimitedSearch: true,
    allProtocols: true,
    assistMode: true,
    buildMode: true,
    deepResearch: true,
    comprehensiveResearch: true,
    freemiumOffers: false, // Disabled during beta (everything is free)
    knowledgeGapCapture: true,
  },

  // Beta usage limits (to prevent abuse)
  // Still generous but prevents excessive usage
  USAGE_LIMITS: {
    searchesPerDay: 200,        // 200 searches per day
    assistMessagesPerDay: 100,  // 100 AI assist messages per day
    buildsPerDay: 20,           // 20 code generations per day
    deepResearchPerDay: 10,     // 10 deep research queries per day
    comprehensivePerDay: 5,     // 5 comprehensive research per day
  },

  // Beta badge text
  BADGE_TEXT: 'BETA',
  BANNER_TEXT: 'Welcome to the Infinity Assistant Beta! All features are FREE during the beta period.',
  EXPIRY_WARNING_DAYS: 3, // Show warning 3 days before beta ends
};

export type BetaTier = 'beta_full_access';

export interface BetaStatus {
  isActive: boolean;
  isBeta: boolean;
  startDate: Date;
  endDate: Date;
  daysRemaining: number;
  hoursRemaining: number;
  version: string;
  features: typeof BETA_CONFIG.FEATURES;
  effectiveTier: BetaTier | 'free' | 'assistant_pro' | 'builder_pro';
  showExpiryWarning: boolean;
  badgeText: string;
  bannerText: string;
}

export interface BetaUser {
  id: string;
  email: string;
  signedUpAt: Date;
  betaParticipant: boolean;
  convertedToSubscription: boolean;
  subscriptionTier?: string;
}

export interface BetaUsage {
  userId: string;
  date: string; // YYYY-MM-DD
  searches: number;
  assistMessages: number;
  builds: number;
  deepResearch: number;
  comprehensive: number;
}

export interface UsageLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetAt: string; // ISO date of next reset (midnight UTC)
}

// In-memory beta user tracking (should be moved to database in production)
const betaUsers = new Map<string, BetaUser>();

// In-memory usage tracking (should be moved to Redis/database in production)
const betaUsage = new Map<string, BetaUsage>();

/**
 * Get today's date string in YYYY-MM-DD format
 */
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get next reset time (midnight UTC)
 */
function getNextResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

/**
 * Get or create usage record for a user
 */
function getOrCreateUsage(userId: string): BetaUsage {
  const today = getTodayString();
  const key = `${userId}:${today}`;

  let usage = betaUsage.get(key);
  if (!usage) {
    usage = {
      userId,
      date: today,
      searches: 0,
      assistMessages: 0,
      builds: 0,
      deepResearch: 0,
      comprehensive: 0,
    };
    betaUsage.set(key, usage);
  }

  return usage;
}

/**
 * Check if user can perform an action (within beta limits)
 */
export function checkBetaUsageLimit(
  userId: string,
  action: 'search' | 'assist' | 'build' | 'deepResearch' | 'comprehensive'
): UsageLimitResult {
  // If not in beta, return unlimited (will be handled by tier system)
  if (!isBetaPeriod()) {
    return {
      allowed: true,
      used: 0,
      limit: -1, // -1 means tier-based limits apply
      remaining: -1,
      resetAt: getNextResetTime(),
    };
  }

  const usage = getOrCreateUsage(userId);
  const limits = BETA_CONFIG.USAGE_LIMITS;

  let used: number;
  let limit: number;

  switch (action) {
    case 'search':
      used = usage.searches;
      limit = limits.searchesPerDay;
      break;
    case 'assist':
      used = usage.assistMessages;
      limit = limits.assistMessagesPerDay;
      break;
    case 'build':
      used = usage.builds;
      limit = limits.buildsPerDay;
      break;
    case 'deepResearch':
      used = usage.deepResearch;
      limit = limits.deepResearchPerDay;
      break;
    case 'comprehensive':
      used = usage.comprehensive;
      limit = limits.comprehensivePerDay;
      break;
    default:
      used = 0;
      limit = 100;
  }

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetAt: getNextResetTime(),
  };
}

/**
 * Record a usage action for a beta user
 */
export function recordBetaUsage(
  userId: string,
  action: 'search' | 'assist' | 'build' | 'deepResearch' | 'comprehensive'
): BetaUsage {
  const usage = getOrCreateUsage(userId);

  switch (action) {
    case 'search':
      usage.searches++;
      break;
    case 'assist':
      usage.assistMessages++;
      break;
    case 'build':
      usage.builds++;
      break;
    case 'deepResearch':
      usage.deepResearch++;
      break;
    case 'comprehensive':
      usage.comprehensive++;
      break;
  }

  return usage;
}

/**
 * Get all usage limits for a user
 */
export function getAllBetaUsageLimits(userId: string): Record<string, UsageLimitResult> {
  return {
    search: checkBetaUsageLimit(userId, 'search'),
    assist: checkBetaUsageLimit(userId, 'assist'),
    build: checkBetaUsageLimit(userId, 'build'),
    deepResearch: checkBetaUsageLimit(userId, 'deepResearch'),
    comprehensive: checkBetaUsageLimit(userId, 'comprehensive'),
  };
}

/**
 * Get usage stats for analytics
 */
export function getBetaUsageStats(): {
  totalRequests: number;
  byAction: Record<string, number>;
  uniqueUsers: number;
} {
  let totalRequests = 0;
  const byAction = {
    search: 0,
    assist: 0,
    build: 0,
    deepResearch: 0,
    comprehensive: 0,
  };
  const uniqueUserIds = new Set<string>();

  betaUsage.forEach((usage) => {
    uniqueUserIds.add(usage.userId);
    totalRequests += usage.searches + usage.assistMessages + usage.builds + usage.deepResearch + usage.comprehensive;
    byAction.search += usage.searches;
    byAction.assist += usage.assistMessages;
    byAction.build += usage.builds;
    byAction.deepResearch += usage.deepResearch;
    byAction.comprehensive += usage.comprehensive;
  });

  return {
    totalRequests,
    byAction,
    uniqueUsers: uniqueUserIds.size,
  };
}

/**
 * Check if we're currently in the beta period
 */
export function isBetaPeriod(): boolean {
  const now = new Date();
  return now >= BETA_CONFIG.START_DATE && now <= BETA_CONFIG.END_DATE;
}

/**
 * Get the current beta status
 */
export function getBetaStatus(): BetaStatus {
  const now = new Date();
  const isActive = isBetaPeriod();

  // Calculate time remaining
  const msRemaining = Math.max(0, BETA_CONFIG.END_DATE.getTime() - now.getTime());
  const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));

  // Determine effective tier
  const effectiveTier = isActive ? 'beta_full_access' : 'free';

  // Show warning if beta is ending soon
  const showExpiryWarning = isActive && daysRemaining <= BETA_CONFIG.EXPIRY_WARNING_DAYS;

  return {
    isActive,
    isBeta: isActive,
    startDate: BETA_CONFIG.START_DATE,
    endDate: BETA_CONFIG.END_DATE,
    daysRemaining,
    hoursRemaining,
    version: BETA_CONFIG.VERSION,
    features: isActive ? BETA_CONFIG.FEATURES : {
      unlimitedSearch: false,
      allProtocols: false,
      assistMode: false,
      buildMode: false,
      deepResearch: false,
      comprehensiveResearch: false,
      freemiumOffers: true,
      knowledgeGapCapture: true,
    },
    effectiveTier,
    showExpiryWarning,
    badgeText: isActive ? BETA_CONFIG.BADGE_TEXT : '',
    bannerText: isActive ? (
      showExpiryWarning
        ? `⚠️ Beta ends in ${daysRemaining} days! Subscribe now to keep your access.`
        : BETA_CONFIG.BANNER_TEXT
    ) : 'Beta period has ended. Subscribe to access pro features.',
  };
}

/**
 * Get the effective user tier (considering beta)
 */
export function getEffectiveTier(
  actualTier: 'free' | 'assistant_pro' | 'builder_pro' | 'builder_business' | 'builder_enterprise' | 'master'
): string {
  if (isBetaPeriod()) {
    // During beta, everyone gets full access (equivalent to builder_pro)
    return 'builder_pro';
  }
  return actualTier;
}

/**
 * Check if a feature is available (considering beta)
 */
export function isFeatureAvailable(
  feature: keyof typeof BETA_CONFIG.FEATURES,
  userTier: string
): boolean {
  if (isBetaPeriod()) {
    return BETA_CONFIG.FEATURES[feature];
  }

  // Post-beta feature availability
  const tierFeatures: Record<string, Partial<typeof BETA_CONFIG.FEATURES>> = {
    free: {
      unlimitedSearch: false,
      allProtocols: false,
      assistMode: false,
      buildMode: false,
      deepResearch: false,
      comprehensiveResearch: false,
      freemiumOffers: true,
      knowledgeGapCapture: true,
    },
    assistant_pro: {
      unlimitedSearch: true,
      allProtocols: true,
      assistMode: true,
      buildMode: false,
      deepResearch: true,
      comprehensiveResearch: false,
      freemiumOffers: false,
      knowledgeGapCapture: true,
    },
    builder_pro: {
      unlimitedSearch: true,
      allProtocols: true,
      assistMode: true,
      buildMode: true,
      deepResearch: true,
      comprehensiveResearch: true,
      freemiumOffers: false,
      knowledgeGapCapture: true,
    },
  };

  return tierFeatures[userTier]?.[feature] ?? false;
}

/**
 * Register a beta user
 */
export function registerBetaUser(email: string, userId?: string): BetaUser {
  const id = userId || `beta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const user: BetaUser = {
    id,
    email,
    signedUpAt: new Date(),
    betaParticipant: isBetaPeriod(),
    convertedToSubscription: false,
  };

  betaUsers.set(id, user);
  betaUsers.set(email, user); // Index by email too

  return user;
}

/**
 * Get a beta user
 */
export function getBetaUser(identifier: string): BetaUser | undefined {
  return betaUsers.get(identifier);
}

/**
 * Mark a beta user as converted to subscription
 */
export function convertBetaUser(identifier: string, subscriptionTier: string): boolean {
  const user = betaUsers.get(identifier);
  if (user) {
    user.convertedToSubscription = true;
    user.subscriptionTier = subscriptionTier;
    return true;
  }
  return false;
}

/**
 * Get all beta users (for analytics)
 */
export function getAllBetaUsers(): BetaUser[] {
  const uniqueUsers = new Map<string, BetaUser>();
  betaUsers.forEach((user) => {
    uniqueUsers.set(user.id, user);
  });
  return Array.from(uniqueUsers.values());
}

/**
 * Get beta conversion stats
 */
export function getBetaConversionStats(): {
  totalBetaUsers: number;
  convertedUsers: number;
  conversionRate: number;
  tierBreakdown: Record<string, number>;
} {
  const users = getAllBetaUsers();
  const converted = users.filter((u) => u.convertedToSubscription);

  const tierBreakdown: Record<string, number> = {};
  converted.forEach((u) => {
    if (u.subscriptionTier) {
      tierBreakdown[u.subscriptionTier] = (tierBreakdown[u.subscriptionTier] || 0) + 1;
    }
  });

  return {
    totalBetaUsers: users.length,
    convertedUsers: converted.length,
    conversionRate: users.length > 0 ? converted.length / users.length : 0,
    tierBreakdown,
  };
}

/**
 * Format beta expiry message
 */
export function formatBetaExpiryMessage(status: BetaStatus): string {
  if (!status.isBeta) {
    return 'The beta period has ended. Subscribe to continue using pro features.';
  }

  if (status.daysRemaining === 0) {
    return `Beta ends in ${status.hoursRemaining} hours! Subscribe now to keep your access.`;
  }

  if (status.daysRemaining === 1) {
    return 'Beta ends tomorrow! Subscribe now to keep your access.';
  }

  if (status.showExpiryWarning) {
    return `Beta ends in ${status.daysRemaining} days. Subscribe now to keep your access.`;
  }

  return `${status.daysRemaining} days remaining in beta. Enjoy full access to all features!`;
}

// Export config for use in components
export const BETA_VERSION = BETA_CONFIG.VERSION;
export const BETA_BADGE = BETA_CONFIG.BADGE_TEXT;
export const BETA_USAGE_LIMITS = BETA_CONFIG.USAGE_LIMITS;

export default {
  isBetaPeriod,
  getBetaStatus,
  getEffectiveTier,
  isFeatureAvailable,
  registerBetaUser,
  getBetaUser,
  convertBetaUser,
  getAllBetaUsers,
  getBetaConversionStats,
  formatBetaExpiryMessage,
  checkBetaUsageLimit,
  recordBetaUsage,
  getAllBetaUsageLimits,
  getBetaUsageStats,
  BETA_VERSION,
  BETA_BADGE,
  BETA_USAGE_LIMITS,
};
