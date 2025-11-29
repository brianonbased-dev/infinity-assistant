'use client';

/**
 * MyCreations Component
 *
 * A user-friendly interface for managing user-uploaded and
 * assistant-generated content. Integrates with useAssistantStorage hook.
 *
 * Features:
 * - Grid/list view toggle
 * - Filter by content type
 * - Upload new content
 * - Download/delete content
 * - Storage usage indicator
 * - Generate new content with AI
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  useAssistantStorage,
  formatFileSize,
  getContentTypeIcon,
  type ContentType,
  type UserContent,
} from '@/hooks/useAssistantStorage';

// ============================================================================
// ICONS (inline SVG components for simplicity)
// ============================================================================

const GridIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const ListIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);

const UploadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const RefreshIcon = ({ spinning = false }: { spinning?: boolean }) => (
  <svg className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ContentCardProps {
  content: UserContent;
  viewMode: 'grid' | 'list';
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function ContentCard({ content, viewMode, onDownload, onDelete, isDeleting }: ContentCardProps) {
  const icon = getContentTypeIcon(content.contentType);
  const date = new Date(content.createdAt).toLocaleDateString();
  const isAssistantGenerated = content.metadata.createdBy === 'assistant';

  if (viewMode === 'list') {
    return (
      <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{content.name}</h4>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{formatFileSize(content.size)}</span>
              <span>&bull;</span>
              <span>{date}</span>
              {isAssistantGenerated && (
                <>
                  <span>&bull;</span>
                  <span className="text-purple-400">AI Generated</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onDownload(content.id)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Download"
          >
            <DownloadIcon />
          </button>
          <button
            onClick={() => onDelete(content.id)}
            disabled={isDeleting}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
            title="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="group relative bg-gray-900/50 rounded-xl border border-gray-800 hover:border-gray-700 transition-all overflow-hidden">
      {/* Preview area */}
      <div className="aspect-square flex items-center justify-center bg-gray-800/50 text-6xl">
        {icon}
      </div>

      {/* Info */}
      <div className="p-4">
        <h4 className="font-medium truncate mb-1">{content.name}</h4>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{formatFileSize(content.size)}</span>
          {isAssistantGenerated && (
            <span className="px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded">AI</span>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
        <button
          onClick={() => onDownload(content.id)}
          className="p-3 bg-blue-600 hover:bg-blue-700 rounded-full text-white transition-colors"
          title="Download"
        >
          <DownloadIcon />
        </button>
        <button
          onClick={() => onDelete(content.id)}
          disabled={isDeleting}
          className="p-3 bg-red-600 hover:bg-red-700 rounded-full text-white transition-colors disabled:opacity-50"
          title="Delete"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

interface StorageIndicatorProps {
  usage: {
    totalSize: number;
    limit: number;
    usedPercent: number;
    contentCount: number;
  } | null;
}

function StorageIndicator({ usage }: StorageIndicatorProps) {
  if (!usage) return null;

  const getBarColor = () => {
    if (usage.usedPercent > 90) return 'bg-red-500';
    if (usage.usedPercent > 70) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="p-4 bg-gray-800/50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">Storage Used</span>
        <span className="text-sm font-medium">
          {formatFileSize(usage.totalSize)} / {formatFileSize(usage.limit)}
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor()} transition-all duration-500`}
          style={{ width: `${Math.min(usage.usedPercent, 100)}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-gray-500">
        {usage.contentCount} items &bull; {usage.usedPercent.toFixed(1)}% used
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface MyCreationsProps {
  className?: string;
  compact?: boolean;
}

export function MyCreations({ className = '', compact = false }: MyCreationsProps) {
  const {
    content,
    isLoading,
    error,
    usage,
    totalCount,
    upload,
    download,
    deleteContent,
    refresh,
    loadMore,
    setFilter,
    clearFilter,
  } = useAssistantStorage();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeFilter, setActiveFilter] = useState<ContentType | null>(null);
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'user' | 'assistant'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [generateType, setGenerateType] = useState<'document' | 'report' | 'code' | 'data'>('document');
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Content type filters
  const contentTypes: Array<{ type: ContentType | null; label: string; icon: string }> = [
    { type: null, label: 'All', icon: '📁' },
    { type: 'document', label: 'Docs', icon: '📄' },
    { type: 'image', label: 'Images', icon: '🖼️' },
    { type: 'video', label: 'Videos', icon: '🎬' },
    { type: 'audio', label: 'Audio', icon: '🎵' },
    { type: 'code', label: 'Code', icon: '💻' },
    { type: 'data', label: 'Data', icon: '📊' },
  ];

  // Handle filter changes
  useEffect(() => {
    const filterOptions: Parameters<typeof setFilter>[0] = {};

    if (activeFilter) {
      filterOptions.contentType = activeFilter;
    }

    if (creatorFilter !== 'all') {
      filterOptions.createdBy = creatorFilter;
    }

    if (activeFilter || creatorFilter !== 'all') {
      setFilter(filterOptions);
    } else {
      clearFilter();
    }
  }, [activeFilter, creatorFilter, setFilter, clearFilter]);

  // Handle file upload
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        await upload(file, {
          name: file.name,
          tags: ['uploaded'],
        });
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [upload]);

  // Handle download
  const handleDownload = useCallback(async (id: string) => {
    const url = await download(id);
    if (url) {
      window.open(url, '_blank');
    }
  }, [download]);

  // Handle delete
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    setDeletingId(id);
    try {
      await deleteContent(id);
    } finally {
      setDeletingId(null);
    }
  }, [deleteContent]);

  // Handle AI generation
  const handleGenerate = useCallback(async () => {
    if (!generatePrompt.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: generateType,
          prompt: generatePrompt,
          options: {
            format: 'markdown',
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setShowGenerateModal(false);
          setGeneratePrompt('');
          await refresh();
        }
      }
    } finally {
      setIsGenerating(false);
    }
  }, [generatePrompt, generateType, refresh]);

  // Listen for assistant events
  useEffect(() => {
    const handleShowContent = (e: CustomEvent) => {
      if (e.detail?.contentType) {
        setActiveFilter(e.detail.contentType);
      }
    };

    const handleCreateContent = (e: CustomEvent) => {
      if (e.detail?.type) {
        setGenerateType(e.detail.type);
        setShowGenerateModal(true);
      }
    };

    window.addEventListener('assistant:show-content', handleShowContent as EventListener);
    window.addEventListener('assistant:create-content', handleCreateContent as EventListener);

    return () => {
      window.removeEventListener('assistant:show-content', handleShowContent as EventListener);
      window.removeEventListener('assistant:create-content', handleCreateContent as EventListener);
    };
  }, []);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">My Creations</h2>
            <p className="text-sm text-gray-400">
              {totalCount} items {activeFilter && `(${activeFilter})`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh */}
            <button
              onClick={refresh}
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshIcon spinning={isLoading} />
            </button>

            {/* View toggle */}
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                <GridIcon />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                <ListIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <UploadIcon />
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md,.json,.csv,.js,.ts,.html,.css"
          />

          {/* Generate button */}
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <SparklesIcon />
            Generate
          </button>
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2">
          {contentTypes.map(({ type, label, icon }) => (
            <button
              key={type || 'all'}
              onClick={() => setActiveFilter(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeFilter === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Creator filter */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-gray-500">Show:</span>
          {(['all', 'user', 'assistant'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setCreatorFilter(filter)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                creatorFilter === filter
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {filter === 'all' ? 'All' : filter === 'user' ? 'My Uploads' : 'AI Generated'}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {isLoading && content.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <RefreshIcon spinning />
            <span className="ml-2 text-gray-400">Loading...</span>
          </div>
        ) : content.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <span className="text-4xl mb-2">📁</span>
            <p>No content yet</p>
            <p className="text-sm">Upload files or generate content with AI</p>
          </div>
        ) : (
          <>
            <div className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
                : 'flex flex-col gap-2'
            }>
              {content.map((item) => (
                <ContentCard
                  key={item.id}
                  content={item}
                  viewMode={viewMode}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  isDeleting={deletingId === item.id}
                />
              ))}
            </div>

            {/* Load more */}
            {content.length < totalCount && (
              <div className="mt-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  {isLoading ? 'Loading...' : `Load more (${totalCount - content.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Storage usage (unless compact) */}
      {!compact && (
        <div className="flex-shrink-0 border-t border-gray-800 p-4">
          <StorageIndicator usage={usage} />
        </div>
      )}

      {/* Generate modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SparklesIcon />
                Generate Content
              </CardTitle>
              <CardDescription>
                Use AI to create documents, reports, code, or data exports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Type selector */}
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <div className="flex gap-2">
                  {(['document', 'report', 'code', 'data'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setGenerateType(type)}
                      className={`px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                        generateType === type
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt input */}
              <div>
                <label className="block text-sm font-medium mb-2">What would you like to create?</label>
                <textarea
                  value={generatePrompt}
                  onChange={(e) => setGeneratePrompt(e.target.value)}
                  placeholder="Describe what you want to generate..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!generatePrompt.trim() || isGenerating}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <RefreshIcon spinning />
                      Generating...
                    </>
                  ) : (
                    <>
                      <SparklesIcon />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default MyCreations;
