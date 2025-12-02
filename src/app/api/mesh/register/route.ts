/**
 * Mesh Registration API
 *
 * Allows admin users to register as support nodes in the mesh network.
 * When an admin connects, they become a support node that can:
 * - Receive mesh broadcasts
 * - Contribute to mesh health
 * - Be available for knowledge/settings support requests
 *
 * @since 2025-12-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import logger from '@/utils/logger';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// In-memory store for registered support nodes
// In production, this would be in Redis or a database
const registeredNodes = new Map<string, {
  nodeId: string;
  nodeType: string;
  level: string;
  userId: string;
  capabilities: string[];
  registeredAt: Date;
  lastHeartbeat: Date;
}>();

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/mesh/register - List registered support nodes
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

    const nodes = Array.from(registeredNodes.values()).map(node => ({
      nodeId: node.nodeId,
      nodeType: node.nodeType,
      level: node.level,
      capabilities: node.capabilities,
      registeredAt: node.registeredAt,
      lastHeartbeat: node.lastHeartbeat,
      isOnline: Date.now() - node.lastHeartbeat.getTime() < 60000, // 60s timeout
    }));

    return NextResponse.json({
      success: true,
      nodes,
      total: nodes.length,
      onlineCount: nodes.filter(n => n.isOnline).length,
    }, { headers: corsHeaders });
  } catch (error) {
    logger.error('[MeshRegister] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to list nodes' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/mesh/register - Register as a support node
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

    // Only master tier can register as support nodes
    if (user.plan !== 'master' && user.tier !== 'master') {
      return NextResponse.json(
        { error: 'Master access required to register as support node' },
        { status: 403, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { nodeId, nodeType, level, userId, capabilities } = body;

    if (!nodeId) {
      return NextResponse.json(
        { error: 'nodeId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const now = new Date();

    registeredNodes.set(nodeId, {
      nodeId,
      nodeType: nodeType || 'admin-support',
      level: level || 'master',
      userId: userId || user.id,
      capabilities: capabilities || ['admin-support'],
      registeredAt: now,
      lastHeartbeat: now,
    });

    logger.info('[MeshRegister] Node registered', {
      nodeId,
      nodeType,
      level,
      userId: userId || user.id,
    });

    // Forward registration to UAA2 master mesh if available
    try {
      const uaa2Url = process.env.UAA2_SERVICE_URL || process.env.UAA2_MESH_URL;
      if (uaa2Url) {
        await fetch(`${uaa2Url}/api/mesh/nodes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'infinityassistant',
          },
          body: JSON.stringify({
            action: 'register-user-node',
            payload: {
              nodeId,
              nodeName: `Admin Support (${userId || user.id})`,
              type: nodeType || 'admin-support',
              capabilities: capabilities || ['admin-support'],
              level: level || 'master',
              userId: userId || user.id,
              serviceId: 'infinityassistant',
            },
          }),
        });
      }
    } catch (err) {
      logger.warn('[MeshRegister] Failed to forward registration to UAA2:', err);
    }

    return NextResponse.json({
      success: true,
      nodeId,
      message: 'Registered as mesh support node',
      registeredAt: now.toISOString(),
    }, { headers: corsHeaders });
  } catch (error) {
    logger.error('[MeshRegister] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to register node' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/mesh/register - Unregister from mesh
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

    const body = await request.json();
    const { nodeId } = body;

    if (!nodeId) {
      return NextResponse.json(
        { error: 'nodeId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const wasRegistered = registeredNodes.has(nodeId);
    registeredNodes.delete(nodeId);

    if (wasRegistered) {
      logger.info('[MeshRegister] Node unregistered', { nodeId });

      // Forward unregistration to UAA2 master mesh
      try {
        const uaa2Url = process.env.UAA2_SERVICE_URL || process.env.UAA2_MESH_URL;
        if (uaa2Url) {
          await fetch(`${uaa2Url}/api/mesh/nodes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Service-Name': 'infinityassistant',
            },
            body: JSON.stringify({
              action: 'unregister-node',
              payload: { nodeId },
            }),
          });
        }
      } catch (err) {
        logger.warn('[MeshRegister] Failed to forward unregistration to UAA2:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: wasRegistered ? 'Node unregistered' : 'Node was not registered',
    }, { headers: corsHeaders });
  } catch (error) {
    logger.error('[MeshRegister] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to unregister node' },
      { status: 500, headers: corsHeaders }
    );
  }
}
