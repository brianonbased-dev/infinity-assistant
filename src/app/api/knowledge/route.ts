/**
 * Knowledge Base API
 *
 * Main knowledge management endpoint for Master Portal
 * Proxies to UAA2 knowledge base via mesh network
 *
 * GET /api/knowledge - Query knowledge entries with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMasterPortalClient } from '@/services/MasterPortalClient';
import { getCurrentUser } from '@/lib/auth';
import { isAdmin } from '@/lib/admin-access';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/knowledge - Query knowledge base
 *
 * Query params:
 * - type: Filter by knowledge type (all, research, pattern, technique, insight)
 * - domain: Filter by domain
 * - q: Search query
 * - limit: Max results (default 50)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    // Only admins can access knowledge management
    if (!user || !isAdmin(user.plan)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403, headers: corsHeaders }
      );
    }

    // Get query parameters
    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type') || 'all';
    const domain = searchParams.get('domain');
    const search = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query UAA2 knowledge base via Master Portal
    const masterPortal = getMasterPortalClient();

    const response = await masterPortal.executeRpc('knowledge.query', {
      type: type !== 'all' ? type : undefined,
      domain,
      search,
      limit,
      offset,
    });

    if (!response.success) {
      throw new Error(response.error || 'Knowledge query failed');
    }

    return NextResponse.json(
      {
        success: true,
        entries: response.data?.entries || [],
        total: response.data?.total || 0,
        type,
        domain,
        search,
        pagination: {
          limit,
          offset,
          hasMore: (response.data?.total || 0) > offset + limit,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Knowledge API] Query error:', error);
    return NextResponse.json(
      {
        error: 'Failed to query knowledge base',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
