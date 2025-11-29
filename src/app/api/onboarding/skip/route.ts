/**
 * POST /api/onboarding/skip
 *
 * Mark onboarding as skipped
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error-handling';

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

    const supabase = getSupabaseClient();

    // Check if onboarding record exists
    const { data: existing } = await supabase
      .from(TABLES.ONBOARDING)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from(TABLES.ONBOARDING)
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
        .from(TABLES.ONBOARDING)
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
