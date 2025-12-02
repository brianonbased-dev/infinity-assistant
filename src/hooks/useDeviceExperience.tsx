/**
 * Device & User Experience Detection Hook
 *
 * Detects device type and tracks user experience level to provide:
 * - Mobile-first simplified UI for beginners
 * - Desktop-focused power features for experienced users
 * - Progressive disclosure based on user behavior
 *
 * Research-backed patterns:
 * - Mobile beginners: 3-5 core actions, large touch targets, single task per screen
 * - Desktop power users: Keyboard shortcuts, high information density, complex workflows
 * - Adaptive UI: Grows with user based on feature usage tracking
 *
 * @since 2025-12-02
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'power_user';
export type UIMode = 'simple' | 'standard' | 'advanced';

interface DeviceInfo {
  type: DeviceType;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  isPortrait: boolean;
  isOnline: boolean;
}

interface UserExperience {
  level: ExperienceLevel;
  sessionsCompleted: number;
  featuresUsed: string[];
  lastActiveAt: string;
  prefersPowerMode: boolean;
  completedOnboarding: boolean;
  queriesThisSession: number;
}

interface AdaptiveUIState {
  showAdvancedFeatures: boolean;
  showKeyboardShortcuts: boolean;
  enableDenseLayout: boolean;
  showModeToggles: boolean;
  simplifiedNavigation: boolean;
  largeTouchTargets: boolean;
  singleTaskMode: boolean;
}

export interface DeviceExperienceState {
  device: DeviceInfo;
  experience: UserExperience;
  uiMode: UIMode;
  adaptiveUI: AdaptiveUIState;
  // Computed helpers
  isMobile: boolean;
  isDesktop: boolean;
  isBeginner: boolean;
  isPowerUser: boolean;
  shouldShowFeature: (featureId: string) => boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'infinity_user_experience';
const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

// Features that should be hidden for beginners
const ADVANCED_FEATURES = [
  'mode_toggles',
  'keyboard_shortcuts',
  'command_palette',
  'dense_layout',
  'bulk_actions',
  'api_integration',
  'custom_workflows',
  'developer_tools',
];

// Features that unlock at each level
const FEATURE_UNLOCK_MAP: Record<ExperienceLevel, string[]> = {
  beginner: ['chat', 'search', 'basic_settings'],
  intermediate: ['mode_toggles', 'history', 'preferences', 'export'],
  power_user: ADVANCED_FEATURES,
};

// Thresholds for experience level progression
const EXPERIENCE_THRESHOLDS = {
  intermediate: { sessions: 3, queries: 10, features: 3 },
  power_user: { sessions: 10, queries: 50, features: 8 },
};

// ============================================================================
// DEVICE DETECTION
// ============================================================================

function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      type: 'desktop',
      isTouchDevice: false,
      screenWidth: 1920,
      screenHeight: 1080,
      isPortrait: false,
      isOnline: true,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  let type: DeviceType = 'desktop';
  if (width < MOBILE_BREAKPOINT) {
    type = 'mobile';
  } else if (width < TABLET_BREAKPOINT) {
    type = 'tablet';
  }

  return {
    type,
    isTouchDevice,
    screenWidth: width,
    screenHeight: height,
    isPortrait: height > width,
    isOnline: navigator.onLine,
  };
}

// ============================================================================
// EXPERIENCE LEVEL CALCULATION
// ============================================================================

function calculateExperienceLevel(exp: UserExperience): ExperienceLevel {
  // User explicitly chose power mode
  if (exp.prefersPowerMode) return 'power_user';

  const { sessions, queries, features } = EXPERIENCE_THRESHOLDS.power_user;
  if (
    exp.sessionsCompleted >= sessions &&
    exp.featuresUsed.length >= features
  ) {
    return 'power_user';
  }

  const intermediate = EXPERIENCE_THRESHOLDS.intermediate;
  if (
    exp.sessionsCompleted >= intermediate.sessions ||
    exp.featuresUsed.length >= intermediate.features
  ) {
    return 'intermediate';
  }

  return 'beginner';
}

// ============================================================================
// ADAPTIVE UI CALCULATION
// ============================================================================

function calculateAdaptiveUI(
  device: DeviceInfo,
  experience: UserExperience
): AdaptiveUIState {
  const level = calculateExperienceLevel(experience);
  const isMobile = device.type === 'mobile';
  const isBeginner = level === 'beginner';
  const isPowerUser = level === 'power_user';

  return {
    // Show advanced features only for intermediate+ users
    showAdvancedFeatures: !isBeginner,
    // Keyboard shortcuts only on desktop for power users
    showKeyboardShortcuts: device.type === 'desktop' && isPowerUser,
    // Dense layout only for desktop power users
    enableDenseLayout: device.type === 'desktop' && isPowerUser,
    // Mode toggles hidden for beginners (auto-mode handles intent)
    showModeToggles: !isBeginner,
    // Simplified nav for mobile beginners
    simplifiedNavigation: isMobile && isBeginner,
    // Large touch targets for mobile or beginners
    largeTouchTargets: isMobile || isBeginner,
    // Single task mode for mobile beginners
    singleTaskMode: isMobile && isBeginner,
  };
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useDeviceExperience(): DeviceExperienceState & {
  trackFeatureUsage: (featureId: string) => void;
  incrementQueries: () => void;
  togglePowerMode: () => void;
  completeOnboarding: () => void;
  resetExperience: () => void;
} {
  // Device state
  const [device, setDevice] = useState<DeviceInfo>(detectDevice);

  // Experience state (persisted)
  const [experience, setExperience] = useState<UserExperience>(() => {
    if (typeof window === 'undefined') {
      return {
        level: 'beginner',
        sessionsCompleted: 0,
        featuresUsed: [],
        lastActiveAt: new Date().toISOString(),
        prefersPowerMode: false,
        completedOnboarding: false,
        queriesThisSession: 0,
      };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Increment session count on load
        return {
          ...parsed,
          sessionsCompleted: (parsed.sessionsCompleted || 0) + 1,
          lastActiveAt: new Date().toISOString(),
          queriesThisSession: 0,
        };
      }
    } catch (e) {
      console.warn('[useDeviceExperience] Failed to load experience:', e);
    }

    return {
      level: 'beginner',
      sessionsCompleted: 1,
      featuresUsed: [],
      lastActiveAt: new Date().toISOString(),
      prefersPowerMode: false,
      completedOnboarding: false,
      queriesThisSession: 0,
    };
  });

  // Persist experience changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(experience));
    } catch (e) {
      console.warn('[useDeviceExperience] Failed to save experience:', e);
    }
  }, [experience]);

  // Handle window resize
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setDevice(detectDevice());
    };

    const handleOnline = () => {
      setDevice((prev) => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setDevice((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Calculate derived states
  const experienceLevel = useMemo(
    () => calculateExperienceLevel(experience),
    [experience]
  );

  const adaptiveUI = useMemo(
    () => calculateAdaptiveUI(device, experience),
    [device, experience]
  );

  const uiMode: UIMode = useMemo(() => {
    if (experienceLevel === 'power_user') return 'advanced';
    if (experienceLevel === 'intermediate') return 'standard';
    return 'simple';
  }, [experienceLevel]);

  // Feature visibility check
  const shouldShowFeature = useCallback(
    (featureId: string): boolean => {
      // Power users see everything
      if (experienceLevel === 'power_user') return true;

      // Check if feature is unlocked for current level
      const unlockedFeatures = [
        ...FEATURE_UNLOCK_MAP.beginner,
        ...(experienceLevel === 'intermediate'
          ? FEATURE_UNLOCK_MAP.intermediate
          : []),
      ];

      return unlockedFeatures.includes(featureId);
    },
    [experienceLevel]
  );

  // Track feature usage
  const trackFeatureUsage = useCallback((featureId: string) => {
    setExperience((prev) => {
      if (prev.featuresUsed.includes(featureId)) return prev;
      return {
        ...prev,
        featuresUsed: [...prev.featuresUsed, featureId],
      };
    });
  }, []);

  // Increment query count
  const incrementQueries = useCallback(() => {
    setExperience((prev) => ({
      ...prev,
      queriesThisSession: prev.queriesThisSession + 1,
    }));
  }, []);

  // Toggle power mode
  const togglePowerMode = useCallback(() => {
    setExperience((prev) => ({
      ...prev,
      prefersPowerMode: !prev.prefersPowerMode,
    }));
  }, []);

  // Complete onboarding
  const completeOnboarding = useCallback(() => {
    setExperience((prev) => ({
      ...prev,
      completedOnboarding: true,
    }));
  }, []);

  // Reset experience (for testing)
  const resetExperience = useCallback(() => {
    const fresh: UserExperience = {
      level: 'beginner',
      sessionsCompleted: 1,
      featuresUsed: [],
      lastActiveAt: new Date().toISOString(),
      prefersPowerMode: false,
      completedOnboarding: false,
      queriesThisSession: 0,
    };
    setExperience(fresh);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    device,
    experience: { ...experience, level: experienceLevel },
    uiMode,
    adaptiveUI,
    // Computed helpers
    isMobile: device.type === 'mobile',
    isDesktop: device.type === 'desktop',
    isBeginner: experienceLevel === 'beginner',
    isPowerUser: experienceLevel === 'power_user',
    shouldShowFeature,
    // Actions
    trackFeatureUsage,
    incrementQueries,
    togglePowerMode,
    completeOnboarding,
    resetExperience,
  };
}

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

/**
 * Wrapper component for progressive disclosure
 * Only renders children if user's experience level allows it
 */
export function ProgressiveFeature({
  featureId,
  children,
  fallback = null,
}: {
  featureId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { shouldShowFeature } = useDeviceExperience();

  if (!shouldShowFeature(featureId)) {
    return fallback;
  }

  return <>{children}</>;
}

/**
 * Mobile-only wrapper - only renders on mobile devices
 */
export function MobileOnly({ children }: { children: React.ReactNode }) {
  const { isMobile } = useDeviceExperience();
  if (!isMobile) return null;
  return <>{children}</>;
}

/**
 * Desktop-only wrapper - only renders on desktop devices
 */
export function DesktopOnly({ children }: { children: React.ReactNode }) {
  const { isDesktop } = useDeviceExperience();
  if (!isDesktop) return null;
  return <>{children}</>;
}

export default useDeviceExperience;