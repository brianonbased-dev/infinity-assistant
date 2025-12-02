/**
 * Admin Image Management API
 *
 * Endpoints for managing site images with editing capabilities.
 * Master tier only.
 *
 * @since 2025-12-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import logger from '@/utils/logger';

// Admin bucket for site assets
const ADMIN_BUCKET = 'admin-assets';

// Image categories for organization
export type ImageCategory =
  | 'logos'
  | 'icons'
  | 'backgrounds'
  | 'avatars'
  | 'banners'
  | 'products'
  | 'misc';

interface AdminImage {
  id: string;
  name: string;
  category: ImageCategory;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  hasTransparency: boolean;
  metadata: {
    alt?: string;
    description?: string;
    usedIn?: string[]; // Track where image is used
    originalName?: string;
    editHistory?: Array<{
      action: string;
      timestamp: string;
    }>;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * Check if user is master tier
 */
async function isMasterUser(request: NextRequest): Promise<{ isMaster: boolean; userId?: string }> {
  const user = await getCurrentUser(request);
  if (!user) return { isMaster: false };

  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from(TABLES.USERS)
    .select('tier')
    .eq('id', user.id)
    .single();

  return {
    isMaster: data?.tier === 'master',
    userId: user.id,
  };
}

/**
 * GET /api/admin/images
 * List all admin images
 */
export async function GET(request: NextRequest) {
  try {
    const { isMaster } = await isMasterUser(request);
    if (!isMaster) {
      return NextResponse.json({ error: 'Master access required' }, { status: 403 });
    }

    const url = new URL(request.url);
    const category = url.searchParams.get('category') as ImageCategory | null;
    const search = url.searchParams.get('search');

    const supabase = getSupabaseClient();

    let query = supabase
      .from('infinity_admin_images')
      .select('*')
      .order('updatedAt', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,metadata->>alt.ilike.%${search}%`);
    }

    const { data: images, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      images: images || [],
      categories: ['logos', 'icons', 'backgrounds', 'avatars', 'banners', 'products', 'misc'],
    });
  } catch (error) {
    logger.error('[Admin Images] List error:', error);
    return NextResponse.json({ error: 'Failed to list images' }, { status: 500 });
  }
}

/**
 * POST /api/admin/images
 * Upload new image
 */
export async function POST(request: NextRequest) {
  try {
    const { isMaster, userId } = await isMasterUser(request);
    if (!isMaster || !userId) {
      return NextResponse.json({ error: 'Master access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string;
    const category = (formData.get('category') as ImageCategory) || 'misc';
    const alt = formData.get('alt') as string;
    const description = formData.get('description') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPEG, GIF, SVG, WebP' },
        { status: 400 }
      );
    }

    // Generate storage path
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'png';
    const sanitizedName = (name || file.name).replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${category}/${timestamp}_${sanitizedName}.${extension}`;

    const supabase = getSupabaseClient();

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase
      .storage
      .from(ADMIN_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase
      .storage
      .from(ADMIN_BUCKET)
      .getPublicUrl(storagePath);

    // Check if PNG has transparency
    const hasTransparency = file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/webp';

    // Create image record
    const imageRecord: AdminImage = {
      id: `img_${timestamp}_${Math.random().toString(36).substring(2, 9)}`,
      name: name || file.name,
      category,
      storagePath,
      publicUrl: urlData.publicUrl,
      mimeType: file.type,
      size: file.size,
      hasTransparency,
      metadata: {
        alt,
        description,
        originalName: file.name,
        usedIn: [],
        editHistory: [{
          action: 'uploaded',
          timestamp: new Date().toISOString(),
        }],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
    };

    // Save to database
    const { error: dbError } = await supabase
      .from('infinity_admin_images')
      .insert(imageRecord);

    if (dbError) {
      // Cleanup uploaded file
      await supabase.storage.from(ADMIN_BUCKET).remove([storagePath]);
      throw new Error(`Database error: ${dbError.message}`);
    }

    logger.info('[Admin Images] Image uploaded', { id: imageRecord.id, category });

    return NextResponse.json({
      success: true,
      image: imageRecord,
    });
  } catch (error) {
    logger.error('[Admin Images] Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/images
 * Update image (replace with edited version)
 */
export async function PUT(request: NextRequest) {
  try {
    const { isMaster, userId } = await isMasterUser(request);
    if (!isMaster || !userId) {
      return NextResponse.json({ error: 'Master access required' }, { status: 403 });
    }

    const body = await request.json();
    const { id, imageData, editAction, metadata } = body;

    if (!id) {
      return NextResponse.json({ error: 'Image ID required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Get existing image
    const { data: existing, error: findError } = await supabase
      .from('infinity_admin_images')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // If imageData provided, upload new version
    if (imageData) {
      // imageData should be base64
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Determine mime type from data URL
      const mimeMatch = imageData.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

      // Upload new version (overwrite)
      const { error: uploadError } = await supabase
        .storage
        .from(ADMIN_BUCKET)
        .update(existing.storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
    }

    // Update record
    const editHistory = existing.metadata?.editHistory || [];
    if (editAction) {
      editHistory.push({
        action: editAction,
        timestamp: new Date().toISOString(),
      });
    }

    const { error: updateError } = await supabase
      .from('infinity_admin_images')
      .update({
        metadata: {
          ...existing.metadata,
          ...metadata,
          editHistory,
        },
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    logger.info('[Admin Images] Image updated', { id, action: editAction });

    return NextResponse.json({
      success: true,
      message: 'Image updated successfully',
    });
  } catch (error) {
    logger.error('[Admin Images] Update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/images
 * Delete an image
 */
export async function DELETE(request: NextRequest) {
  try {
    const { isMaster } = await isMasterUser(request);
    if (!isMaster) {
      return NextResponse.json({ error: 'Master access required' }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Image ID required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Get image to delete
    const { data: image, error: findError } = await supabase
      .from('infinity_admin_images')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Check if image is in use
    if (image.metadata?.usedIn && image.metadata.usedIn.length > 0) {
      return NextResponse.json(
        { error: `Image is in use: ${image.metadata.usedIn.join(', ')}` },
        { status: 400 }
      );
    }

    // Delete from storage
    await supabase.storage.from(ADMIN_BUCKET).remove([image.storagePath]);

    // Delete record
    await supabase.from('infinity_admin_images').delete().eq('id', id);

    logger.info('[Admin Images] Image deleted', { id });

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    logger.error('[Admin Images] Delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
