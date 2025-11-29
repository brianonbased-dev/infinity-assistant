/**
 * GET /api/onboarding/check
 *
 * Check if user needs onboarding
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserService } from '@/services/UserService';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userService = getUserService();
    const userId = searchParams.get('userId') || userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    const supabase = getSupabaseClient();

    // Check if user has completed onboarding
    const { data: onboarding, error: onboardingError } = await supabase
      .from(TABLES.ONBOARDING)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (onboardingError && onboardingError.code !== 'PGRST116') {
      logger.error('[Assistant Onboarding] Error checking onboarding:', onboardingError);
    }

    // Check if user has any previous conversations
    const { count: conversationCount, error: conversationError } = await supabase
      .from(TABLES.CONVERSATIONS)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (conversationError) {
      logger.error('[Assistant Onboarding] Error checking conversations:', conversationError);
    }

    // User needs onboarding if:
    // 1. No onboarding record exists, OR
    // 2. Onboarding not completed and not skipped, AND
    // 3. No previous conversations
    const needsOnboarding =
      (!onboarding || (!onboarding.completed_at && !onboarding.skipped_at)) &&
      (conversationCount === 0 || !conversationCount);

    return NextResponse.json({
      needsOnboarding,
      onboarding: onboarding || null,
      preferences: onboarding?.preferences || null,
      hasConversations: (conversationCount || 0) > 0,
    });
  } catch (error: unknown) {
    logger.error('[Assistant Onboarding] Error:', error);

    return NextResponse.json(
      {
        needsOnboarding: false,
        error: 'Failed to check onboarding status',
      },
      { status: 500 }
    );
  }
}

