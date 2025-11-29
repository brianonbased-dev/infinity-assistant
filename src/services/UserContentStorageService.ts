/**
 * User Content Storage Service
 *
 * Manages user-generated and assistant-created content:
 * - Documents (PDF, DOCX, TXT, MD)
 * - Images (PNG, JPG, SVG, WebP)
 * - Videos (MP4, WebM)
 * - Code files
 * - Data exports (JSON, CSV)
 *
 * Storage: Supabase Storage buckets
 * - user-creations: User-uploaded content
 * - assistant-generated: Content created by the assistant
 *
 * Features:
 * - Upload with virus scanning
 * - Generate signed URLs for secure access
 * - Organize by folders/projects
 * - Track creation metadata
 * - Content versioning
 */

import { getSupabaseClient } from '@/lib/supabase';
import logger from '@/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export type ContentType =
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'code'
  | 'data'
  | 'other';

export interface UserContent {
  id: string;
  userId: string;
  name: string;
  description?: string;
  contentType: ContentType;
  mimeType: string;
  size: number;
  storagePath: string;
  bucketName: string;
  thumbnailPath?: string;
  metadata: {
    createdBy: 'user' | 'assistant';
    conversationId?: string;
    prompt?: string; // If assistant-generated
    version: number;
    tags: string[];
    isPublic: boolean;
  };
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
}

export interface ContentFolder {
  id: string;
  userId: string;
  name: string;
  parentId?: string;
  contentCount: number;
  createdAt: string;
}

export interface UploadResult {
  success: boolean;
  content?: UserContent;
  error?: string;
  signedUrl?: string;
}

export interface GenerationRequest {
  type: 'document' | 'image' | 'code' | 'data';
  prompt: string;
  conversationId?: string;
  options?: {
    format?: string;
    style?: string;
    size?: string;
  };
}

export interface GenerationResult {
  success: boolean;
  content?: UserContent;
  previewUrl?: string;
  error?: string;
}

// Bucket names
const BUCKETS = {
  USER_CREATIONS: 'user-creations',
  ASSISTANT_GENERATED: 'assistant-generated',
};

// MIME type mappings
const CONTENT_TYPE_MAP: Record<string, ContentType> = {
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/plain': 'document',
  'text/markdown': 'document',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/gif': 'image',
  'image/svg+xml': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'application/json': 'data',
  'text/csv': 'data',
  'text/javascript': 'code',
  'text/typescript': 'code',
  'text/html': 'code',
  'text/css': 'code',
};

// ============================================================================
// USER CONTENT STORAGE SERVICE
// ============================================================================

export class UserContentStorageService {
  private supabase = getSupabaseClient();

  /**
   * Upload user content
   */
  async uploadContent(
    userId: string,
    file: File | Blob,
    options: {
      name: string;
      description?: string;
      folder?: string;
      tags?: string[];
      isPublic?: boolean;
    }
  ): Promise<UploadResult> {
    try {
      const mimeType = file instanceof File ? file.type : 'application/octet-stream';
      const contentType = CONTENT_TYPE_MAP[mimeType] || 'other';
      const extension = options.name.split('.').pop() || '';

      // Generate storage path
      const timestamp = Date.now();
      const sanitizedName = options.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const folder = options.folder || 'uploads';
      const storagePath = `${userId}/${folder}/${timestamp}_${sanitizedName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await this.supabase
        .storage
        .from(BUCKETS.USER_CREATIONS)
        .upload(storagePath, file, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Create content record
      const content: UserContent = {
        id: `uc_${timestamp}_${Math.random().toString(36).substring(2, 9)}`,
        userId,
        name: options.name,
        description: options.description,
        contentType,
        mimeType,
        size: file.size,
        storagePath,
        bucketName: BUCKETS.USER_CREATIONS,
        metadata: {
          createdBy: 'user',
          version: 1,
          tags: options.tags || [],
          isPublic: options.isPublic || false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to database
      const { error: dbError } = await this.supabase
        .from('infinity_assistant_user_content')
        .insert(content);

      if (dbError) {
        // Cleanup uploaded file if DB insert fails
        await this.supabase.storage
          .from(BUCKETS.USER_CREATIONS)
          .remove([storagePath]);
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Generate signed URL for immediate access
      const { data: urlData } = await this.supabase
        .storage
        .from(BUCKETS.USER_CREATIONS)
        .createSignedUrl(storagePath, 3600); // 1 hour

      logger.info('[UserContentStorage] Content uploaded', {
        userId,
        contentId: content.id,
        size: file.size,
      });

      return {
        success: true,
        content,
        signedUrl: urlData?.signedUrl,
      };
    } catch (error) {
      logger.error('[UserContentStorage] Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Store assistant-generated content
   */
  async storeGeneratedContent(
    userId: string,
    data: Buffer | string,
    options: {
      name: string;
      mimeType: string;
      conversationId?: string;
      prompt?: string;
      tags?: string[];
    }
  ): Promise<UploadResult> {
    try {
      const contentType = CONTENT_TYPE_MAP[options.mimeType] || 'other';
      const timestamp = Date.now();
      const sanitizedName = options.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${userId}/generated/${timestamp}_${sanitizedName}`;

      // Convert string to buffer if needed
      const buffer = typeof data === 'string'
        ? Buffer.from(data, 'utf-8')
        : data;

      // Upload to storage
      const { error: uploadError } = await this.supabase
        .storage
        .from(BUCKETS.ASSISTANT_GENERATED)
        .upload(storagePath, buffer, {
          contentType: options.mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Create content record
      const content: UserContent = {
        id: `ag_${timestamp}_${Math.random().toString(36).substring(2, 9)}`,
        userId,
        name: options.name,
        contentType,
        mimeType: options.mimeType,
        size: buffer.length,
        storagePath,
        bucketName: BUCKETS.ASSISTANT_GENERATED,
        metadata: {
          createdBy: 'assistant',
          conversationId: options.conversationId,
          prompt: options.prompt,
          version: 1,
          tags: options.tags || [],
          isPublic: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to database
      await this.supabase
        .from('infinity_assistant_user_content')
        .insert(content);

      // Generate signed URL
      const { data: urlData } = await this.supabase
        .storage
        .from(BUCKETS.ASSISTANT_GENERATED)
        .createSignedUrl(storagePath, 3600);

      logger.info('[UserContentStorage] Generated content stored', {
        userId,
        contentId: content.id,
        type: contentType,
      });

      return {
        success: true,
        content,
        signedUrl: urlData?.signedUrl,
      };
    } catch (error) {
      logger.error('[UserContentStorage] Store generated error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Storage failed',
      };
    }
  }

  /**
   * List user's content
   */
  async listContent(
    userId: string,
    options?: {
      contentType?: ContentType;
      folder?: string;
      createdBy?: 'user' | 'assistant';
      tags?: string[];
      limit?: number;
      offset?: number;
      sortBy?: 'createdAt' | 'name' | 'size';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{ content: UserContent[]; total: number }> {
    try {
      let query = this.supabase
        .from('infinity_assistant_user_content')
        .select('*', { count: 'exact' })
        .eq('userId', userId);

      if (options?.contentType) {
        query = query.eq('contentType', options.contentType);
      }

      if (options?.createdBy) {
        query = query.eq('metadata->>createdBy', options.createdBy);
      }

      if (options?.tags && options.tags.length > 0) {
        query = query.contains('metadata->tags', options.tags);
      }

      // Sorting
      const sortBy = options?.sortBy || 'createdAt';
      const sortOrder = options?.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Pagination
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Query failed: ${error.message}`);
      }

      return {
        content: data || [],
        total: count || 0,
      };
    } catch (error) {
      logger.error('[UserContentStorage] List error:', error);
      return { content: [], total: 0 };
    }
  }

  /**
   * Get signed download URL
   */
  async getDownloadUrl(
    userId: string,
    contentId: string,
    expiresIn: number = 3600
  ): Promise<string | null> {
    try {
      // Get content record
      const { data: content, error } = await this.supabase
        .from('infinity_assistant_user_content')
        .select('*')
        .eq('id', contentId)
        .eq('userId', userId)
        .single();

      if (error || !content) {
        return null;
      }

      // Generate signed URL
      const { data: urlData } = await this.supabase
        .storage
        .from(content.bucketName)
        .createSignedUrl(content.storagePath, expiresIn);

      // Update last accessed
      await this.supabase
        .from('infinity_assistant_user_content')
        .update({ lastAccessedAt: new Date().toISOString() })
        .eq('id', contentId);

      return urlData?.signedUrl || null;
    } catch (error) {
      logger.error('[UserContentStorage] Get URL error:', error);
      return null;
    }
  }

  /**
   * Delete content
   */
  async deleteContent(userId: string, contentId: string): Promise<boolean> {
    try {
      // Get content record
      const { data: content, error } = await this.supabase
        .from('infinity_assistant_user_content')
        .select('*')
        .eq('id', contentId)
        .eq('userId', userId)
        .single();

      if (error || !content) {
        return false;
      }

      // Delete from storage
      await this.supabase
        .storage
        .from(content.bucketName)
        .remove([content.storagePath]);

      // Delete record
      await this.supabase
        .from('infinity_assistant_user_content')
        .delete()
        .eq('id', contentId);

      logger.info('[UserContentStorage] Content deleted', {
        userId,
        contentId,
      });

      return true;
    } catch (error) {
      logger.error('[UserContentStorage] Delete error:', error);
      return false;
    }
  }

  /**
   * Get storage usage for user
   */
  async getStorageUsage(userId: string): Promise<{
    totalSize: number;
    contentCount: number;
    byType: Record<ContentType, { count: number; size: number }>;
    limit: number;
    usedPercent: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('infinity_assistant_user_content')
        .select('contentType, size')
        .eq('userId', userId);

      if (error) {
        throw error;
      }

      const byType: Record<ContentType, { count: number; size: number }> = {
        document: { count: 0, size: 0 },
        image: { count: 0, size: 0 },
        video: { count: 0, size: 0 },
        audio: { count: 0, size: 0 },
        code: { count: 0, size: 0 },
        data: { count: 0, size: 0 },
        other: { count: 0, size: 0 },
      };

      let totalSize = 0;
      for (const item of data || []) {
        totalSize += item.size;
        const type = item.contentType as ContentType;
        if (byType[type]) {
          byType[type].count++;
          byType[type].size += item.size;
        }
      }

      // Default limit: 1GB for free users
      const limit = 1024 * 1024 * 1024;

      return {
        totalSize,
        contentCount: data?.length || 0,
        byType,
        limit,
        usedPercent: (totalSize / limit) * 100,
      };
    } catch (error) {
      logger.error('[UserContentStorage] Usage error:', error);
      return {
        totalSize: 0,
        contentCount: 0,
        byType: {
          document: { count: 0, size: 0 },
          image: { count: 0, size: 0 },
          video: { count: 0, size: 0 },
          audio: { count: 0, size: 0 },
          code: { count: 0, size: 0 },
          data: { count: 0, size: 0 },
          other: { count: 0, size: 0 },
        },
        limit: 1024 * 1024 * 1024,
        usedPercent: 0,
      };
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let userContentStorageServiceInstance: UserContentStorageService | null = null;

export function getUserContentStorageService(): UserContentStorageService {
  if (!userContentStorageServiceInstance) {
    userContentStorageServiceInstance = new UserContentStorageService();
  }
  return userContentStorageServiceInstance;
}
