/**
 * User Preferences API
 *
 * Save and retrieve user preferences for personalized experience
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

/**
 * Unified UserPreferences interface
 * Supports both companion (AssistantOnboarding) and builder (BuilderOnboarding) modes
 */
interface UserPreferences {
  // Core identity
  name?: string;
  nickname?: string;
  role?: string;
  experienceLevel?: string;

  // Mode & workflow
  assistantMode?: 'companion' | 'professional';
  preferredMode?: 'search' | 'assist' | 'build';
  workflowPhases?: ('research' | 'plan' | 'deliver')[];
  primaryGoals?: string[];

  // Interests
  interests?: string[];
  customInterests?: string[];

  // Communication
  communicationStyle?: 'concise' | 'detailed' | 'conversational';
  communicationAdaptation?: 'match' | 'balanced' | 'counterbalance';
  preferredLanguage?: 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' | 'ar';

  // UI preferences
  theme?: 'light' | 'dark' | 'system';
  notifications?: boolean;

  // Device experience settings
  deviceExperience?: {
    prefersPowerMode?: boolean;
    completedOnboarding?: boolean;
    sessionsCompleted?: number;
    featuresUsed?: string[];
  };

  // Essence/personality settings
  essence?: {
    voiceTone?: 'friendly' | 'professional' | 'playful' | 'supportive' | 'neutral';
    responseStyle?: 'concise' | 'detailed' | 'balanced';
    personalityTraits?: string[];
    customGreeting?: string;
    familyMode?: boolean;
    familyMembers?: string[];
    childSafetyLevel?: 'open' | 'family' | 'strict';
  };

  // Time/context
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night' | 'auto';

  // Subscription tier
  tier?: 'free' | 'assistant_pro' | 'builder_pro' | 'builder_business' | 'builder_enterprise';
}

// GET - Retrieve preferences
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    // Allow anonymous users via cookie as fallback
    const anonUserId = request.cookies.get('infinity_anon_user')?.value;
    const effectiveUserId = user?.id || anonUserId;

    if (!effectiveUserId) {
      return NextResponse.json({ preferences: {} });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLES.PREFERENCES)
      .select('preferences')
      .eq('user_id', effectiveUserId)
      .single();

    if (error || !data) {
      return NextResponse.json({ preferences: {} });
    }

    return NextResponse.json({ preferences: data.preferences || {} });
  } catch (error) {
    logger.error('[User Preferences] GET Error:', error);
    return NextResponse.json({ preferences: {} });
  }
}

// POST - Save preferences
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const anonUserId = request.cookies.get('infinity_anon_user')?.value;
    const effectiveUserId = user?.id || anonUserId;

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'User identification required' }, { status: 400 });
    }

    const body: { preferences: UserPreferences } = await request.json();
    const { preferences } = body;

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json({ error: 'Invalid preferences' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(TABLES.PREFERENCES)
      .upsert({
        user_id: effectiveUserId,
        preferences,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw error;
    }

    logger.info(`[User Preferences] Saved for user ${effectiveUserId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[User Preferences] POST Error:', error);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
