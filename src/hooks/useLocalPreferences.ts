/**
 * Local-First Preferences Hook
 *
 * Manages user preferences with localStorage as primary storage.
 * Syncs to database only when user opts in.
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Assistant Mode - companion for personal use, professional for work
 */
export type AssistantMode = 'companion' | 'professional';

/**
 * Unified User Preferences
 *
 * Combines both companion (AssistantOnboarding) and builder (BuilderOnboarding) preferences
 * into a single interface for seamless settings management.
 */
export interface UserPreferences {
  // === CORE IDENTITY ===
  name?: string; // User's name (companion mode)
  nickname?: string; // How assistant should address them
  role: string; // Professional role (developer, designer, etc.)
  experienceLevel: string; // beginner, intermediate, advanced, expert

  // === MODE & WORKFLOW ===
  assistantMode?: AssistantMode; // companion or professional
  preferredMode: 'search' | 'assist' | 'build';
  workflowPhases: ('research' | 'plan' | 'deliver')[];
  primaryGoals: string[];

  // === INTERESTS ===
  interests: string[];
  customInterests: string[]; // User-added technologies/topics

  // === COMMUNICATION ===
  communicationStyle: 'concise' | 'detailed' | 'conversational';
  communicationAdaptation?: 'match' | 'balanced' | 'counterbalance';
  preferredLanguage: 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' | 'ar';

  // === ESSENCE/PERSONALITY (unified from AssistantOnboarding) ===
  essence?: {
    voiceTone?: 'friendly' | 'professional' | 'playful' | 'supportive' | 'neutral';
    responseStyle?: 'concise' | 'detailed' | 'balanced';
    personalityTraits?: string[];
    customGreeting?: string;
    // Family mode settings
    familyMode?: boolean;
    familyMembers?: string[];
    childSafetyLevel?: 'open' | 'family' | 'strict';
  };

  // === TIME/CONTEXT ===
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night' | 'auto';

  // === SUBSCRIPTION ===
  tier?: 'free' | 'assistant_pro' | 'builder_pro' | 'builder_business' | 'builder_enterprise';
}

const PREFERENCES_KEY = 'infinity_user_preferences';
const SYNC_PREFERENCES_KEY = 'infinity_sync_preferences';

const defaultPreferences: UserPreferences = {
  // Core identity
  name: '',
  nickname: '',
  role: '',
  experienceLevel: '',
  // Mode & workflow
  assistantMode: 'companion',
  preferredMode: 'assist',
  workflowPhases: ['research', 'plan', 'deliver'],
  primaryGoals: [],
  // Interests
  interests: [],
  customInterests: [],
  // Communication
  communicationStyle: 'conversational',
  communicationAdaptation: 'balanced',
  preferredLanguage: 'en',
  // Essence/personality
  essence: {
    voiceTone: 'friendly',
    responseStyle: 'balanced',
    familyMode: false,
    familyMembers: [],
    childSafetyLevel: 'family',
  },
  // Time/context
  timeOfDay: 'auto',
  // Subscription
  tier: 'free',
};

interface UseLocalPreferencesReturn {
  preferences: UserPreferences | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  syncEnabled: boolean;
  savePreferences: (prefs: UserPreferences) => void;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  clearPreferences: () => void;
  setSyncEnabled: (enabled: boolean) => void;
  syncToDatabase: (userId: string) => Promise<boolean>;
  syncToApi: () => Promise<boolean>; // Sync to user preferences API
  loadFromDatabase: (userId: string) => Promise<void>;
  loadFromApi: () => Promise<void>; // Load from user preferences API
}

export function useLocalPreferences(): UseLocalPreferencesReturn {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [syncEnabled, setSyncEnabledState] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences(parsed);
        setHasCompletedOnboarding(true);
      }

      const syncStored = localStorage.getItem(SYNC_PREFERENCES_KEY);
      setSyncEnabledState(syncStored === 'true');
    } catch (error) {
      console.error('[useLocalPreferences] Error loading from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((prefs: UserPreferences) => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
      setPreferences(prefs);
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error('[useLocalPreferences] Error saving to localStorage:', error);
    }
  }, []);

  // Update partial preferences
  const updatePreferences = useCallback((partial: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...(prev || defaultPreferences), ...partial };
      try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('[useLocalPreferences] Error updating localStorage:', error);
      }
      return updated;
    });
  }, []);

  // Clear all preferences
  const clearPreferences = useCallback(() => {
    try {
      localStorage.removeItem(PREFERENCES_KEY);
      setPreferences(null);
      setHasCompletedOnboarding(false);
    } catch (error) {
      console.error('[useLocalPreferences] Error clearing localStorage:', error);
    }
  }, []);

  // Set sync preference
  const setSyncEnabled = useCallback((enabled: boolean) => {
    try {
      localStorage.setItem(SYNC_PREFERENCES_KEY, enabled ? 'true' : 'false');
      setSyncEnabledState(enabled);
    } catch (error) {
      console.error('[useLocalPreferences] Error setting sync preference:', error);
    }
  }, []);

  // Sync preferences to database
  const syncToDatabase = useCallback(async (userId: string): Promise<boolean> => {
    if (!preferences || !userId) return false;

    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          stepsCompleted: ['local-sync'],
          preferences,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('[useLocalPreferences] Error syncing to database:', error);
      return false;
    }
  }, [preferences]);

  // Load preferences from database
  const loadFromDatabase = useCallback(async (userId: string): Promise<void> => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/onboarding/check?userId=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.preferences) {
          // Merge database preferences with local (local takes precedence for existing values)
          const merged = { ...data.preferences, ...preferences };
          savePreferences(merged);
        }
      }
    } catch (error) {
      console.error('[useLocalPreferences] Error loading from database:', error);
    }
  }, [preferences, savePreferences]);

  // Sync to user preferences API (works with anonymous users via cookie)
  const syncToApi = useCallback(async (): Promise<boolean> => {
    if (!preferences) return false;

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for anonymous user ID
        body: JSON.stringify({ preferences }),
      });

      if (response.ok) {
        console.log('[useLocalPreferences] Synced preferences to API');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[useLocalPreferences] Error syncing to API:', error);
      return false;
    }
  }, [preferences]);

  // Load preferences from user preferences API
  const loadFromApi = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'GET',
        credentials: 'include', // Include cookies for anonymous user ID
      });

      if (response.ok) {
        const data = await response.json();
        if (data.preferences && Object.keys(data.preferences).length > 0) {
          // Merge API preferences with local (local takes precedence if it has values)
          const hasLocalPrefs = preferences && Object.keys(preferences).some(
            (key) => {
              const val = preferences[key as keyof UserPreferences];
              return val !== '' && val !== undefined && (!Array.isArray(val) || val.length > 0);
            }
          );

          if (hasLocalPrefs) {
            // Local takes precedence, merge API values for missing fields
            const merged = { ...defaultPreferences, ...data.preferences, ...preferences };
            savePreferences(merged);
          } else {
            // Use API preferences as base
            savePreferences({ ...defaultPreferences, ...data.preferences });
          }
          console.log('[useLocalPreferences] Loaded preferences from API');
        }
      }
    } catch (error) {
      console.error('[useLocalPreferences] Error loading from API:', error);
    }
  }, [preferences, savePreferences]);

  // Auto-sync to API when preferences change and sync is enabled
  useEffect(() => {
    if (syncEnabled && preferences && hasCompletedOnboarding) {
      // Debounce the sync to avoid too many API calls
      const timeoutId = setTimeout(() => {
        syncToApi();
      }, 2000); // Wait 2 seconds after last change

      return () => clearTimeout(timeoutId);
    }
  }, [syncEnabled, preferences, hasCompletedOnboarding, syncToApi]);

  return {
    preferences,
    isLoading,
    hasCompletedOnboarding,
    syncEnabled,
    savePreferences,
    updatePreferences,
    clearPreferences,
    setSyncEnabled,
    syncToDatabase,
    syncToApi,
    loadFromDatabase,
    loadFromApi,
  };
}

/**
 * Generate system prompt addendum based on user preferences
 * This is used to personalize AI responses
 */
export function generatePreferencesPrompt(preferences: UserPreferences | null): string {
  if (!preferences) return '';

  const parts: string[] = [];

  // User name/nickname for personalization
  if (preferences.nickname) {
    parts.push(`Address the user as "${preferences.nickname}".`);
  } else if (preferences.name) {
    parts.push(`The user's name is ${preferences.name}.`);
  }

  // Assistant mode context
  if (preferences.assistantMode === 'companion') {
    parts.push('You are a friendly personal companion assistant.');
  } else if (preferences.assistantMode === 'professional') {
    parts.push('You are a professional work assistant.');
  }

  // Role context
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
    parts.push(`The user is ${roleDescriptions[preferences.role] || preferences.role}.`);
  }

  // Experience level
  if (preferences.experienceLevel) {
    const expDescriptions: Record<string, string> = {
      beginner: 'They are a beginner, so explain concepts clearly and avoid jargon.',
      intermediate: 'They have intermediate experience, so balance detail with efficiency.',
      advanced: 'They are advanced, so you can be technical and concise.',
      expert: 'They are an expert, so be direct and skip basic explanations.',
    };
    parts.push(expDescriptions[preferences.experienceLevel] || '');
  }

  // Communication style
  if (preferences.communicationStyle) {
    const styleDescriptions: Record<string, string> = {
      concise: 'Keep responses brief and to the point. Use bullet points when possible.',
      detailed: 'Provide comprehensive explanations with examples and context.',
      conversational: 'Be friendly and conversational while remaining helpful.',
    };
    parts.push(styleDescriptions[preferences.communicationStyle] || '');
  }

  // Interests for context (combine preset and custom)
  const allInterests = [
    ...(preferences.interests || []),
    ...(preferences.customInterests || []),
  ];
  if (allInterests.length > 0) {
    parts.push(`Their interests include: ${allInterests.join(', ')}.`);
  }

  // Workflow phases preference
  if (preferences.workflowPhases && preferences.workflowPhases.length > 0) {
    const phaseDescriptions: Record<string, string> = {
      research: 'Research (exploring options and gathering information)',
      plan: 'Plan (organizing and strategizing)',
      deliver: 'Deliver (implementing and completing)',
    };
    const phaseTexts = preferences.workflowPhases
      .map((p) => phaseDescriptions[p] || p)
      .join(' → ');
    parts.push(`Their preferred workflow: ${phaseTexts}.`);
  }

  // Primary goals
  if (preferences.primaryGoals && preferences.primaryGoals.length > 0) {
    const goalDescriptions: Record<string, string> = {
      learn: 'learning new skills',
      build: 'building projects',
      research: 'conducting research',
      solve_problems: 'solving technical problems',
      explore: 'exploring ideas',
      collaborate: 'collaborating with others',
    };
    const goalTexts = preferences.primaryGoals
      .map((g) => goalDescriptions[g] || g)
      .join(', ');
    parts.push(`They are focused on: ${goalTexts}.`);
  }

  // Language preference - bilingual support
  if (preferences.preferredLanguage && preferences.preferredLanguage !== 'en') {
    const languageNames: Record<string, string> = {
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ja: 'Japanese',
      ko: 'Korean',
      zh: 'Chinese',
      ar: 'Arabic',
    };
    const langName = languageNames[preferences.preferredLanguage] || preferences.preferredLanguage;
    parts.push(`IMPORTANT: The user prefers ${langName}. Respond bilingually - first in ${langName}, then in English after a "---" separator.`);
  }

  // Communication adaptation preference
  if (preferences.communicationAdaptation) {
    const adaptDescriptions: Record<string, string> = {
      match: 'Mirror the user\'s energy and communication style - if they\'re excited, be excited.',
      balanced: 'Be friendly and adaptable - professional for work, casual for chat.',
      counterbalance: 'Be what they need - calm when stressed, focused when scattered.',
    };
    parts.push(adaptDescriptions[preferences.communicationAdaptation] || '');
  }

  // Essence/personality settings
  if (preferences.essence) {
    const essenceParts: string[] = [];

    if (preferences.essence.voiceTone) {
      essenceParts.push(`Voice tone: ${preferences.essence.voiceTone}`);
    }

    if (preferences.essence.responseStyle) {
      essenceParts.push(`Response style: ${preferences.essence.responseStyle}`);
    }

    if (preferences.essence.customGreeting) {
      essenceParts.push(`Custom greeting: "${preferences.essence.customGreeting}"`);
    }

    if (preferences.essence.familyMode) {
      const safetyLevel = preferences.essence.childSafetyLevel || 'family';
      essenceParts.push(`Family mode active (${safetyLevel} safety)`);
    }

    if (essenceParts.length > 0) {
      parts.push(`Personality: ${essenceParts.join(', ')}.`);
    }
  }

  if (parts.length === 0) return '';

  return `\n\n[User Context: ${parts.join(' ')}]`;
}
