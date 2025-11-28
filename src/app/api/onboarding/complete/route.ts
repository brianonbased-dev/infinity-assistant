/**
 * POST /api/onboarding/complete
 *
 * Mark onboarding as complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error-handling';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.UAA2_SUPABASE_SERVICE_KEY!
);

interface CompleteRequest {
  userId: string;
  workspaceCreated?: boolean;
  builderIntroduced?: boolean;
  stepsCompleted?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: CompleteRequest = await request.json();
    const { userId, workspaceCreated = false, builderIntroduced = false, stepsCompleted = [] } = body;

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
          completed_at: new Date().toISOString(),
          workspace_created: workspaceCreated || existing.workspace_created,
          builder_introduced: builderIntroduced || existing.builder_introduced,
          steps_completed: stepsCompleted.length > 0 ? stepsCompleted : existing.steps_completed,
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
          completed_at: new Date().toISOString(),
          workspace_created: workspaceCreated,
          builder_introduced: builderIntroduced,
          steps_completed: stepsCompleted,
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

