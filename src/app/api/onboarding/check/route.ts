/**
 * GET /api/onboarding/check
 *
 * Check if user needs onboarding
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserService } from '@/services/UserService';
import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error-handling';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.UAA2_SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userService = getUserService();
    const userId = searchParams.get('userId') || userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Check if user has completed onboarding
    const { data: onboarding, error: onboardingError } = await supabase
      .from('assistant_onboarding')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (onboardingError && onboardingError.code !== 'PGRST116') {
      logger.error('[Assistant Onboarding] Error checking onboarding:', onboardingError);
    }

    // Check if user has any previous conversations
    const { count: conversationCount, error: conversationError } = await supabase
      .from('assistant_conversations')
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

