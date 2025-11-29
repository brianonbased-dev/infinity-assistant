/**
 * User Preferences API
 *
 * Save and retrieve user preferences for personalized experience
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import logger from '@/utils/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.UAA2_SUPABASE_SERVICE_KEY!
);

interface UserPreferences {
  role?: string;
  experienceLevel?: string;
  primaryGoals?: string[];
  preferredMode?: 'search' | 'assist' | 'build';
  interests?: string[];
  communicationStyle?: 'concise' | 'detailed' | 'conversational';
  theme?: 'light' | 'dark' | 'system';
  notifications?: boolean;
}

// GET - Retrieve preferences
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    // Allow anonymous users via cookie
    const anonUserId = request.cookies.get('infinity_anon_user')?.value;
    const effectiveUserId = userId || anonUserId;

    if (!effectiveUserId) {
      return NextResponse.json({ preferences: {} });
    }

    const { data, error } = await supabase
      .from('infinity_assistant_preferences')
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
    const { userId } = await auth();
    const anonUserId = request.cookies.get('infinity_anon_user')?.value;
    const effectiveUserId = userId || anonUserId;

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'User identification required' }, { status: 400 });
    }

    const body: { preferences: UserPreferences } = await request.json();
    const { preferences } = body;

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json({ error: 'Invalid preferences' }, { status: 400 });
    }

    const { error } = await supabase
      .from('infinity_assistant_preferences')
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
