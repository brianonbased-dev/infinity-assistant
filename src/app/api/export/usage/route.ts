/**
 * Export Usage Data
 * 
 * Export user usage data to CSV or JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserService } from '@/services/UserService';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

/**
 * Convert data to CSV format
 */
function toCSV(data: any[], headers: string[]): string {
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in CSV
      if (typeof value === 'string') {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

/**
 * GET /api/export/usage
 * 
 * Export usage data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // json or csv
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get user ID from auth
    const userService = getUserService();
    const userId = userService.getAnonymousUserId(
      request.cookies.get('infinity_anon_user')?.value
    );

    // Check auth
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/email`);
    const authData = await authResponse.json();
    
    if (!authData.authenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const actualUserId = authData.user?.id || userId;
    const supabase = getSupabaseClient();

    // Build query
    let query = supabase
      .from(TABLES.USAGE)
      .select('*')
      .eq('user_id', actualUserId)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('[Export] Failed to fetch usage data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch usage data' },
        { status: 500 }
      );
    }

    const usageData = (data || []).map(row => ({
      date: row.created_at,
      endpoint: row.endpoint || 'unknown',
      requests: row.requests || 1,
      tokens: row.tokens_used || 0,
      cost: row.cost || 0,
      model: row.model || 'unknown',
      status: row.status || 'success',
    }));

    if (format === 'csv') {
      const csv = toCSV(usageData, ['date', 'endpoint', 'requests', 'tokens', 'cost', 'model', 'status']);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="usage-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      success: true,
      exportDate: new Date().toISOString(),
      format: 'json',
      recordCount: usageData.length,
      data: usageData,
    });
  } catch (error: unknown) {
    logger.error('[Export] Error exporting usage data:', error);
    return NextResponse.json(
      { error: 'Failed to export usage data' },
      { status: 500 }
    );
  }
}

