/**
 * Mesh Network Stats API
 *
 * GET /api/mesh/stats - Get mesh network statistics
 */

import { NextResponse } from 'next/server';
import { getUserMeshService } from '@/services/UserMeshService';
import { meshNodeClient } from '@/services/MeshNodeClient';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/mesh/stats - Get public mesh network statistics
 */
export async function GET() {
  try {
    const meshService = getUserMeshService();
    const userMeshStats = await meshService.getMeshStats();

    // Get main mesh node status
    const meshStatus = await meshNodeClient.checkAllNodes();

    return NextResponse.json(
      {
        success: true,
        data: {
          userMesh: {
            totalUsers: userMeshStats.totalUsers,
            activeNodes: userMeshStats.activeNodes,
            messagesExchanged: userMeshStats.messagesExchanged,
            knowledgeShared: userMeshStats.knowledgeShared,
          },
          infrastructure: {
            selfNode: meshStatus.selfNode
              ? {
                  id: meshStatus.selfNode.id,
                  name: meshStatus.selfNode.name,
                  status: meshStatus.selfNode.status,
                }
              : null,
            connectedNodes: meshStatus.connectedNodes.length,
            nodes: meshStatus.connectedNodes.map((node) => ({
              id: node.id,
              name: node.name,
              type: node.type,
              status: node.status,
              capabilities: node.capabilities,
            })),
          },
          lastUpdate: meshStatus.lastUpdate.toISOString(),
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[MeshStats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get mesh stats' },
      { status: 500, headers: corsHeaders }
    );
  }
}
