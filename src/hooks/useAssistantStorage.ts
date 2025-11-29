/**
 * useAssistantStorage Hook
 *
 * React hook for managing user content storage.
 * Provides easy access to upload, list, download, and delete content.
 *
 * Usage:
 * ```tsx
 * const {
 *   content,
 *   isLoading,
 *   upload,
 *   download,
 *   deleteContent,
 *   usage,
 * } = useAssistantStorage();
 *
 * // Upload a file
 * await upload(file, { name: 'my-doc.pdf', tags: ['work'] });
 *
 * // Download content
 * const url = await download(contentId);
 *
 * // Delete content
 * await deleteContent(contentId);
 * ```
 */

import { useState, useEffect, useCallback } from 'react';

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
  name: string;
  description?: string;
  contentType: ContentType;
  mimeType: string;
  size: number;
  metadata: {
    createdBy: 'user' | 'assistant';
    conversationId?: string;
    prompt?: string;
    tags: string[];
    isPublic: boolean;
  };
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
}

export interface StorageUsage {
  totalSize: number;
  contentCount: number;
  byType: Record<ContentType, { count: number; size: number }>;
  limit: number;
  usedPercent: number;
}

export interface UploadOptions {
  name: string;
  description?: string;
  folder?: string;
  tags?: string[];
  isPublic?: boolean;
}

export interface ListOptions {
  contentType?: ContentType;
  createdBy?: 'user' | 'assistant';
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'name' | 'size';
  sortOrder?: 'asc' | 'desc';
}

interface UseAssistantStorageReturn {
  // State
  content: UserContent[];
  isLoading: boolean;
  error: string | null;
  usage: StorageUsage | null;
  totalCount: number;

  // Actions
  upload: (file: File, options: UploadOptions) => Promise<UserContent | null>;
  download: (contentId: string) => Promise<string | null>;
  deleteContent: (contentId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;

  // Filters
  setFilter: (options: ListOptions) => void;
  clearFilter: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useAssistantStorage(): UseAssistantStorageReturn {
  const [content, setContent] = useState<UserContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilterState] = useState<ListOptions>({});
  const [offset, setOffset] = useState(0);

  // Fetch content list
  const fetchContent = useCallback(async (reset = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const currentOffset = reset ? 0 : offset;
      const params = new URLSearchParams();

      if (filter.contentType) params.set('contentType', filter.contentType);
      if (filter.createdBy) params.set('createdBy', filter.createdBy);
      if (filter.tags) params.set('tags', filter.tags.join(','));
      if (filter.sortBy) params.set('sortBy', filter.sortBy);
      if (filter.sortOrder) params.set('sortOrder', filter.sortOrder);
      params.set('limit', String(filter.limit || 20));
      params.set('offset', String(currentOffset));

      const response = await fetch(`/api/content?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch content');
      }

      const data = await response.json();

      if (reset) {
        setContent(data.content || []);
        setOffset(data.content?.length || 0);
      } else {
        setContent((prev) => [...prev, ...(data.content || [])]);
        setOffset((prev) => prev + (data.content?.length || 0));
      }

      setTotalCount(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setIsLoading(false);
    }
  }, [filter, offset]);

  // Fetch storage usage
  const fetchUsage = useCallback(async () => {
    try {
      const response = await fetch('/api/content/usage');
      if (response.ok) {
        const data = await response.json();
        setUsage(data);
      }
    } catch (err) {
      console.error('[useAssistantStorage] Usage fetch error:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchContent(true);
    fetchUsage();
  }, []);

  // Reload when filter changes
  useEffect(() => {
    fetchContent(true);
  }, [filter]);

  // Upload file
  const upload = useCallback(async (
    file: File,
    options: UploadOptions
  ): Promise<UserContent | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', options.name);
      if (options.description) formData.append('description', options.description);
      if (options.folder) formData.append('folder', options.folder);
      if (options.tags) formData.append('tags', JSON.stringify(options.tags));
      if (options.isPublic !== undefined) formData.append('isPublic', String(options.isPublic));

      const response = await fetch('/api/content/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const data = await response.json();

      // Add to local state
      if (data.content) {
        setContent((prev) => [data.content, ...prev]);
        setTotalCount((prev) => prev + 1);
      }

      // Refresh usage
      fetchUsage();

      return data.content || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      return null;
    }
  }, [fetchUsage]);

  // Download (get signed URL)
  const download = useCallback(async (contentId: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/content/${contentId}/download`);

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const data = await response.json();
      return data.url || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
      return null;
    }
  }, []);

  // Delete content
  const deleteContentFn = useCallback(async (contentId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete content');
      }

      // Remove from local state
      setContent((prev) => prev.filter((c) => c.id !== contentId));
      setTotalCount((prev) => prev - 1);

      // Refresh usage
      fetchUsage();

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      return false;
    }
  }, [fetchUsage]);

  // Refresh content
  const refresh = useCallback(async () => {
    await fetchContent(true);
    await fetchUsage();
  }, [fetchContent, fetchUsage]);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (!isLoading && content.length < totalCount) {
      await fetchContent(false);
    }
  }, [fetchContent, isLoading, content.length, totalCount]);

  // Set filter
  const setFilter = useCallback((options: ListOptions) => {
    setFilterState(options);
  }, []);

  // Clear filter
  const clearFilter = useCallback(() => {
    setFilterState({});
  }, []);

  return {
    content,
    isLoading,
    error,
    usage,
    totalCount,
    upload,
    download,
    deleteContent: deleteContentFn,
    refresh,
    loadMore,
    setFilter,
    clearFilter,
  };
}

// ============================================================================
// UTILITY HOOK: Format file size
// ============================================================================

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ============================================================================
// UTILITY HOOK: Get content type icon
// ============================================================================

export function getContentTypeIcon(type: ContentType): string {
  const icons: Record<ContentType, string> = {
    document: '📄',
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    code: '💻',
    data: '📊',
    other: '📁',
  };
  return icons[type] || '📁';
}
