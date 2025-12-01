/**
 * User Mesh Network API Routes
 *
 * Enables per-user mesh node registration and management.
 * Every InfinityAssistant user can join the mesh network.
 *
 * GET  /api/mesh/user - Get user's mesh node status
 * POST /api/mesh/user - Register user as mesh node
 * PUT  /api/mesh/user - Update user mesh settings
 * DELETE /api/mesh/user - Deactivate user mesh node
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserMeshService, UserMeshSettings } from '@/services/UserMeshService';
import { getCurrentUser } from '@/lib/auth';
import logger from '@/utils/logger';

// CORS headers for API responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * OPTIONS - Handle CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/mesh/user - Get user's mesh node status
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
    const userNode = await meshService.getUserNode(user.id);

    if (!userNode) {
      return NextResponse.json(
        {
          success: true,
          data: {
            registered: false,
            message: 'User is not registered as a mesh node',
            instructions: {
              register: 'POST /api/mesh/user to register',
              benefits: [
                'Connect with other users on the mesh',
                'Share and access knowledge across the network',
                'Sync your workspace with the mesh',
                'Get priority routing for LLM requests',
              ],
            },
          },
        },
        { headers: corsHeaders }
      );
    }

    const connections = await meshService.getUserConnections(user.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          registered: true,
          node: {
            nodeId: userNode.nodeId,
            nodeName: userNode.nodeName,
            status: userNode.status,
            tier: userNode.tier,
            capabilities: userNode.capabilities,
            apiKeyPreview: userNode.apiKeyPreview,
            createdAt: userNode.createdAt.toISOString(),
            lastActiveAt: userNode.lastActiveAt.toISOString(),
            settings: userNode.settings,
          },
          connections: connections.length,
          connectedUsers: connections.map(c => ({
            connectionId: c.id,
            status: c.status,
            connectedAt: c.connectedAt?.toISOString(),
          })),
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[UserMeshAPI] GET error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/mesh/user - Register user as mesh node
 *
 * Body: { settings?: Partial<UserMeshSettings> }
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

    const body = await request.json().catch(() => ({}));
    const { settings } = body;

    const meshService = getUserMeshService();
    const userNode = await meshService.registerUserNode(user.id, settings);

    logger.info('[UserMeshAPI] User registered as mesh node', {
      userId: user.id,
      nodeId: userNode.nodeId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          node: {
            nodeId: userNode.nodeId,
            nodeName: userNode.nodeName,
            status: userNode.status,
            tier: userNode.tier,
            capabilities: userNode.capabilities,
            createdAt: userNode.createdAt.toISOString(),
            settings: userNode.settings,
          },
          apiKey: userNode.apiKey, // Only returned once!
          important: 'Save your API key securely - it cannot be retrieved later!',
          usage: {
            authenticate: [
              `Authorization: Bearer ${userNode.apiKey}`,
              `X-Mesh-Key: ${userNode.apiKey}`,
            ],
            endpoints: {
              status: 'GET /api/mesh/user',
              settings: 'PUT /api/mesh/user',
              regenerateKey: 'POST /api/mesh/user/regenerate-key',
              connect: 'POST /api/mesh/user/connect',
            },
          },
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[UserMeshAPI] POST error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/mesh/user - Update user mesh settings
 *
 * Body: Partial<UserMeshSettings>
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

    const settings: Partial<UserMeshSettings> = await request.json();

    const meshService = getUserMeshService();
    const updatedNode = await meshService.updateUserSettings(user.id, settings);

    if (!updatedNode) {
      return NextResponse.json(
        { error: 'User is not registered as a mesh node' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          settings: updatedNode.settings,
          message: 'Mesh settings updated successfully',
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[UserMeshAPI] PUT error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/mesh/user - Deactivate user mesh node
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const meshService = getUserMeshService();

    // Update status to inactive (don't delete, preserve history)
    const result = await meshService.updateUserSettings(user.id, {
      allowRemoteAccess: false,
      shareKnowledge: false,
      meshVisibility: 'private',
    });

    if (!result) {
      return NextResponse.json(
        { error: 'User is not registered as a mesh node' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'Mesh node deactivated. You can reactivate by updating settings.',
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    logger.error('[UserMeshAPI] DELETE error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
