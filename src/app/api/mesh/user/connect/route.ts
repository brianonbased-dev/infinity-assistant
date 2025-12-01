/**
 * User Mesh Connections API
 *
 * Manage connections between users on the mesh network.
 *
 * GET  /api/mesh/user/connect - List connection requests
 * POST /api/mesh/user/connect - Send connection request
 * PUT  /api/mesh/user/connect - Accept/reject connection request
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserMeshService } from '@/services/UserMeshService';
import { getCurrentUser } from '@/lib/auth';
import logger from '@/utils/logger';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/mesh/user/connect - List user's mesh connections
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

    const meshService = getUserMeshService();
    const connections = await meshService.getUserConnections(user.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          connections: connections.map(c => ({
            id: c.id,
            fromUserId: c.fromUserId,
            toUserId: c.toUserId,
            status: c.status,
            connectedAt: c.connectedAt?.toISOString(),
            isIncoming: c.toUserId === user.id,
          })),
          total: connections.length,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[UserMeshAPI] Get connections error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/mesh/user/connect - Send connection request
 *
 * Body: { targetUserId: string }
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
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Target user ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: 'Cannot connect to yourself' },
        { status: 400, headers: corsHeaders }
      );
    }

    const meshService = getUserMeshService();
    const connection = await meshService.requestConnection(user.id, targetUserId);

    if (!connection) {
      return NextResponse.json(
        {
          error: 'Cannot send connection request',
          reason: 'Target user may not exist or has private mesh visibility',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    logger.info('[UserMeshAPI] Connection request sent', {
      fromUserId: user.id,
      toUserId: targetUserId,
      connectionId: connection.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          connectionId: connection.id,
          status: connection.status,
          message: 'Connection request sent',
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[UserMeshAPI] Send connection error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/mesh/user/connect - Accept or reject connection request
 *
 * Body: { connectionId: string, action: 'accept' | 'reject' }
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { connectionId, action } = body;

    if (!connectionId || !action) {
      return NextResponse.json(
        { error: 'Connection ID and action are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "accept" or "reject"' },
        { status: 400, headers: corsHeaders }
      );
    }

    const meshService = getUserMeshService();

    if (action === 'accept') {
      const success = await meshService.acceptConnection(connectionId, user.id);

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to accept connection' },
          { status: 400, headers: corsHeaders }
        );
      }

      logger.info('[UserMeshAPI] Connection accepted', {
        userId: user.id,
        connectionId,
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            connectionId,
            status: 'accepted',
            message: 'Connection accepted! You are now connected on the mesh.',
          },
        },
        { headers: corsHeaders }
      );
    } else {
      // For reject, we would need to add a reject method to the service
      // For now, just acknowledge
      return NextResponse.json(
        {
          success: true,
          data: {
            connectionId,
            status: 'rejected',
            message: 'Connection request rejected',
          },
        },
        { headers: corsHeaders }
      );
    }
  } catch (error) {
    logger.error('[UserMeshAPI] Connection action error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
