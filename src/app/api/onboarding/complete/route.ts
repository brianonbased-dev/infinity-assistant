/**
 * POST /api/onboarding/complete
 *
 * Mark onboarding as complete and save user preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error-handling';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.UAA2_SUPABASE_SERVICE_KEY!
);

// User preferences collected during onboarding
interface UserPreferences {
  role: string;
  experienceLevel: string;
  primaryGoals: string[];
  preferredMode: 'search' | 'assist' | 'build';
  interests: string[];
  communicationStyle: 'concise' | 'detailed' | 'conversational';
}

interface CompleteRequest {
  userId: string;
  stepsCompleted?: string[];
  preferences?: UserPreferences;
}

export async function POST(request: NextRequest) {
  try {
    const body: CompleteRequest = await request.json();
    const { userId, stepsCompleted = [], preferences } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Check if onboarding record exists
    const { data: existing } = await supabase
      .from('assistant_onboarding')
      .select('*')
      .eq('user_id', userId)
      .single();

    const onboardingData = {
      completed_at: new Date().toISOString(),
      steps_completed: stepsCompleted,
      preferences: preferences || null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('assistant_onboarding')
        .update(onboardingData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        onboarding: data,
        preferences: preferences,
      });
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('assistant_onboarding')
        .insert({
          user_id: userId,
          ...onboardingData,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        onboarding: data,
        preferences: preferences,
      });
    }
  } catch (error: unknown) {
    logger.error('[Assistant Onboarding] Error completing onboarding:', error);

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error) || 'Failed to complete onboarding',
      },
      { status: 500 }
    );
  }
}

