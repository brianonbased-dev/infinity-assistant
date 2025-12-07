/**
 * Import Usage Data
 * 
 * Import usage data from CSV or JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserService } from '@/services/UserService';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

/**
 * Parse CSV content
 */
function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }

  return data;
}

/**
 * POST /api/import/usage
 * 
 * Import usage data from CSV or JSON
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const format = formData.get('format') as string || 'json'; // json or csv

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

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

    // Read file content
    const fileContent = await file.text();
    let usageData: any[] = [];

    if (format === 'csv') {
      usageData = parseCSV(fileContent);
    } else {
      const jsonData = JSON.parse(fileContent);
      usageData = jsonData.data || jsonData || [];
    }

    if (!Array.isArray(usageData) || usageData.length === 0) {
      return NextResponse.json(
        { error: 'Invalid file format or empty data' },
        { status: 400 }
      );
    }

    // Validate and transform data
    const supabase = getSupabaseClient();
    const records = usageData.map(row => ({
      user_id: actualUserId,
      endpoint: row.endpoint || row.date || 'unknown',
      requests: parseInt(row.requests || row.request_count || '1', 10) || 1,
      tokens_used: parseInt(row.tokens || row.tokens_used || '0', 10) || 0,
      cost: parseFloat(row.cost || '0') || 0,
      model: row.model || 'unknown',
      status: row.status || 'success',
      created_at: row.date || row.created_at || new Date().toISOString(),
    }));

    // Insert records (in batches for large files)
    const batchSize = 100;
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from(TABLES.USAGE)
        .insert(batch);

      if (error) {
        logger.error('[Import] Failed to import batch:', error);
        errors += batch.length;
      } else {
        imported += batch.length;
      }
    }

    logger.info('[Import] Usage data import completed:', {
      userId: actualUserId,
      imported,
      errors,
      total: records.length,
    });

    return NextResponse.json({
      success: true,
      imported,
      errors,
      total: records.length,
      message: `Successfully imported ${imported} records${errors > 0 ? ` (${errors} failed)` : ''}`,
    });
  } catch (error: unknown) {
    logger.error('[Import] Error importing usage data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import usage data' },
      { status: 500 }
    );
  }
}


