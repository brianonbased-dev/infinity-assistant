/**
 * Local-First Preferences Hook
 *
 * Manages user preferences with localStorage as primary storage.
 * Syncs to database only when user opts in.
 */

import { useState, useEffect, useCallback } from 'react';

export interface UserPreferences {
  role: string;
  experienceLevel: string;
  primaryGoals: string[];
  preferredMode: 'search' | 'assist' | 'build';
  interests: string[];
  communicationStyle: 'concise' | 'detailed' | 'conversational';
}

const PREFERENCES_KEY = 'infinity_user_preferences';
const SYNC_PREFERENCES_KEY = 'infinity_sync_preferences';

const defaultPreferences: UserPreferences = {
  role: '',
  experienceLevel: '',
  primaryGoals: [],
  preferredMode: 'assist',
  interests: [],
  communicationStyle: 'conversational',
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
  loadFromDatabase: (userId: string) => Promise<void>;
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
    loadFromDatabase,
  };
}

/**
 * Generate system prompt addendum based on user preferences
 * This is used to personalize AI responses
 */
export function generatePreferencesPrompt(preferences: UserPreferences | null): string {
  if (!preferences) return '';

  const parts: string[] = [];

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

  // Interests for context
  if (preferences.interests && preferences.interests.length > 0) {
    parts.push(`Their interests include: ${preferences.interests.join(', ')}.`);
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

  if (parts.length === 0) return '';

  return `\n\n[User Context: ${parts.join(' ')}]`;
}
