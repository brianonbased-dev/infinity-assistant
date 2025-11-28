/**
 * POST /api/onboarding/skip
 *
 * Mark onboarding as skipped
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error-handling';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.UAA2_SUPABASE_SERVICE_KEY!
);

interface SkipRequest {
  userId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SkipRequest = await request.json();
    const { userId } = body;

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

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('assistant_onboarding')
        .update({
          skipped_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        onboarding: data,
      });
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('assistant_onboarding')
        .insert({
          user_id: userId,
          skipped_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        onboarding: data,
      });
    }
  } catch (error: unknown) {
    logger.error('[Assistant Onboarding] Error skipping onboarding:', error);

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error) || 'Failed to skip onboarding',
      },
      { status: 500 }
    );
  }
}

