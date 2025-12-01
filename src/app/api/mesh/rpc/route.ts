/**
 * Mesh RPC Proxy API
 *
 * Proxies RPC calls through the mesh network to UAA2's Master RPC.
 * Enforces user-level access control based on subscription tier.
 *
 * POST /api/mesh/rpc - Execute RPC action(s)
 * GET /api/mesh/rpc - List available actions for current user level
 */

import { NextRequest, NextResponse } from 'next/server';
import { masterRpcClient, type RpcRequest } from '@/services/MasterRpcClient';
import { meshNodeClient, type MeshLevel } from '@/services/MeshNodeClient';
import { getCurrentUser } from '@/lib/auth';
import logger from '@/utils/logger';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * Determine mesh level from user's subscription tier
 */
function getMeshLevelFromTier(tier: string): MeshLevel {
  switch (tier) {
    case 'enterprise':
    case 'pro':
      return 'service';
    case 'master':
    case 'developer':
      return 'master';
    default:
      return 'user';
  }
}

/**
 * GET /api/mesh/rpc - List available RPC actions
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const domain = request.nextUrl.searchParams.get('domain') || undefined;

    // Set mesh level based on user tier
    const level = getMeshLevelFromTier(user.plan || 'free');
    meshNodeClient.setMeshLevel(level);

    // Get available actions
    const actions = await masterRpcClient.getActions(domain);

    // Filter to only actions available at user's level
    const availableActions = actions.filter(a => {
      const levelOrder: MeshLevel[] = ['user', 'service', 'master'];
      const userLevelIndex = levelOrder.indexOf(level);
      const requiredLevelIndex = levelOrder.indexOf(a.requiredLevel);
      return userLevelIndex >= requiredLevelIndex;
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          level,
          tier: user.plan || 'free',
          total: availableActions.length,
          actions: availableActions,
          hint: level === 'user'
            ? 'Upgrade to Pro or Enterprise for more capabilities'
            : undefined,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[MeshRPC] GET error', { error });
    return NextResponse.json(
      { error: 'Failed to get available actions' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/mesh/rpc - Execute RPC action(s)
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

    const body = await request.json();

    // Set mesh level based on user tier
    const level = getMeshLevelFromTier(user.plan || 'free');
    meshNodeClient.setMeshLevel(level);

    // Check for batch request
    if (body.batch && Array.isArray(body.batch)) {
      // Limit batch size for non-master users
      const maxBatchSize = level === 'master' ? 50 : level === 'service' ? 20 : 5;
      if (body.batch.length > maxBatchSize) {
        return NextResponse.json(
          {
            error: `Batch size exceeds limit`,
            limit: maxBatchSize,
            requested: body.batch.length,
            hint: level === 'user' ? 'Upgrade to Pro for larger batch operations' : undefined,
          },
          { status: 400, headers: corsHeaders }
        );
      }

      const result = await masterRpcClient.executeBatch(
        body.batch as RpcRequest[],
        {
          parallel: body.parallel ?? true,
          stopOnError: body.stopOnError ?? false,
        }
      );

      return NextResponse.json(
        {
          success: result.success,
          data: result,
          level,
        },
        { status: result.success ? 200 : 207, headers: corsHeaders }
      );
    }

    // Single action
    if (!body.action) {
      return NextResponse.json(
        {
          error: 'Missing action',
          hint: 'Provide { action: "domain.action", params: {...} }',
          example: { action: 'system.health' },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await masterRpcClient.execute(body.action, body.params);

    // Add user context to response
    return NextResponse.json(
      {
        success: result.success,
        data: result.data,
        error: result.error,
        errorCode: result.errorCode,
        requestId: result.requestId,
        action: result.action,
        duration: result.duration,
        level,
        tier: user.plan || 'free',
      },
      {
        status: result.success ? 200 : result.errorCode === 'ACCESS_DENIED' ? 403 : 400,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    logger.error('[MeshRPC] POST error', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute RPC' },
      { status: 500, headers: corsHeaders }
    );
  }
}
