/**
 * Regenerate User Mesh API Key
 *
 * POST /api/mesh/user/regenerate-key - Generate a new API key for user's mesh node
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserMeshService } from '@/services/UserMeshService';
import { getCurrentUser } from '@/lib/auth';
import logger from '@/utils/logger';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/mesh/user/regenerate-key - Regenerate API key
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const meshService = getUserMeshService();
    const newApiKey = await meshService.regenerateApiKey(user.id);

    if (!newApiKey) {
      return NextResponse.json(
        { error: 'User is not registered as a mesh node' },
        { status: 404, headers: corsHeaders }
      );
    }

    logger.info('[UserMeshAPI] API key regenerated', { userId: user.id });

    return NextResponse.json(
      {
        success: true,
        data: {
          apiKey: newApiKey,
          apiKeyPreview: `${newApiKey.slice(0, 8)}...${newApiKey.slice(-4)}`,
          important: 'Save your new API key securely - it cannot be retrieved later!',
          note: 'Your previous API key has been invalidated.',
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[UserMeshAPI] Regenerate key error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
