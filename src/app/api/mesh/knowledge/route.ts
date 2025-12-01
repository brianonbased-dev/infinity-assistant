/**
 * Mesh Knowledge Search API
 *
 * Search knowledge base via UAA2 mesh network
 */

import { NextRequest, NextResponse } from 'next/server';
import { meshNodeClient } from '@/services/MeshNodeClient';

/**
 * POST /api/mesh/knowledge - Search knowledge via mesh
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, type, limit } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query required' },
        { status: 400 }
      );
    }

    // Check if UAA2 is online
    const uaa2Node = meshNodeClient.getNode('uaa2-service');
    if (!uaa2Node || uaa2Node.status !== 'online') {
      // Try to reconnect
      await meshNodeClient.checkNodeHealth('uaa2-service');
      const refreshedNode = meshNodeClient.getNode('uaa2-service');

      if (!refreshedNode || refreshedNode.status !== 'online') {
        return NextResponse.json(
          {
            error: 'UAA2 Service not available',
            status: refreshedNode?.status || 'unknown',
          },
          { status: 503 }
        );
      }
    }

    const results = await meshNodeClient.searchKnowledge(query, { type, limit });

    return NextResponse.json({
      ...(results && typeof results === 'object' ? results : { data: results }),
      source: 'uaa2-service',
    });
  } catch (error) {
    console.error('[Mesh Knowledge] Search error:', error);
    return NextResponse.json(
      { error: 'Knowledge search failed', message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mesh/knowledge - Get knowledge search status
 */
export async function GET() {
  const uaa2Node = meshNodeClient.getNode('uaa2-service');

  return NextResponse.json({
    available: uaa2Node?.status === 'online',
    node: uaa2Node
      ? {
          id: uaa2Node.id,
          status: uaa2Node.status,
          lastCheck: uaa2Node.lastCheck.toISOString(),
        }
      : null,
  });
}
