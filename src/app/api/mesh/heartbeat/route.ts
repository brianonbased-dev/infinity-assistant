/**
 * Mesh Heartbeat API
 *
 * Keeps registered support nodes alive in the mesh network.
 * Nodes should send heartbeats every 30 seconds.
 *
 * @since 2025-12-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import logger from '@/utils/logger';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Reference to the same in-memory store from register route
// In production, use Redis or database
const registeredNodesRef = new Map<string, {
  nodeId: string;
  lastHeartbeat: Date;
}>();

// Export for sharing with register route
export { registeredNodesRef };

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/mesh/heartbeat - Send heartbeat to keep node alive
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
    const { nodeId, metrics } = body;

    if (!nodeId) {
      return NextResponse.json(
        { error: 'nodeId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const now = new Date();

    // Update heartbeat in local store
    const existing = registeredNodesRef.get(nodeId);
    if (existing) {
      existing.lastHeartbeat = now;
    } else {
      // Auto-register if not found (reconnection scenario)
      registeredNodesRef.set(nodeId, {
        nodeId,
        lastHeartbeat: now,
      });
    }

    // Forward heartbeat to UAA2 master mesh
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
            action: 'user-node-heartbeat',
            payload: {
              nodeId,
              metrics,
              timestamp: now.toISOString(),
            },
          }),
        });
      }
    } catch (err) {
      // Don't fail heartbeat if UAA2 is unreachable
      logger.debug('[MeshHeartbeat] Failed to forward to UAA2:', err);
    }

    return NextResponse.json({
      success: true,
      nodeId,
      timestamp: now.toISOString(),
      nextHeartbeat: new Date(now.getTime() + 30000).toISOString(),
    }, { headers: corsHeaders });
  } catch (error) {
    logger.error('[MeshHeartbeat] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process heartbeat' },
      { status: 500, headers: corsHeaders }
    );
  }
}
