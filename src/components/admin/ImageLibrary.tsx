'use client';

/**
 * Image Library Component
 *
 * Browse, search, upload, and manage images.
 * Includes drag & drop upload and category filtering.
 *
 * @since 2025-12-02
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  Search,
  FolderOpen,
  Grid,
  List,
  Trash2,
  Edit2,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Filter,
  X,
  Check,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { ImageEditor } from './ImageEditor';

type ImageCategory = 'logos' | 'icons' | 'backgrounds' | 'avatars' | 'banners' | 'products' | 'misc';

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
    usedIn?: string[];
    originalName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ImageLibraryProps {
  onSelect?: (image: AdminImage) => void;
  selectable?: boolean;
}

const CATEGORY_LABELS: Record<ImageCategory, string> = {
  logos: 'Logos',
  icons: 'Icons',
  backgrounds: 'Backgrounds',
  avatars: 'Avatars',
  banners: 'Banners',
  products: 'Products',
  misc: 'Miscellaneous',
};

export function ImageLibrary({ onSelect, selectable = false }: ImageLibraryProps) {
  const [images, setImages] = useState<AdminImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ImageCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedImage, setSelectedImage] = useState<AdminImage | null>(null);
  const [editingImage, setEditingImage] = useState<AdminImage | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch images
  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/images?${params}`);
      const data = await response.json();

      if (response.ok) {
        setImages(data.images || []);
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Upload handler
  const handleUpload = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);
        formData.append('category', selectedCategory === 'all' ? 'misc' : selectedCategory);

        const response = await fetch('/api/admin/images', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Upload failed');
        }
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      }
    }

    setUploading(false);
    fetchImages();
  }, [selectedCategory, fetchImages]);

  // Drag & drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, [handleUpload]);

  // Delete handler
  const handleDelete = useCallback(async (image: AdminImage) => {
    if (!confirm(`Delete "${image.name}"?`)) return;

    try {
      const response = await fetch(`/api/admin/images?id=${image.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchImages();
        if (selectedImage?.id === image.id) {
          setSelectedImage(null);
        }
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  }, [fetchImages, selectedImage]);

  // Copy URL
  const copyUrl = useCallback((url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Save edited image
  const handleSaveEdit = useCallback(async (imageData: string, editAction: string) => {
    if (!editingImage) return;

    const response = await fetch('/api/admin/images', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingImage.id,
        imageData,
        editAction,
      }),
    });

    if (response.ok) {
      setEditingImage(null);
      fetchImages();
    }
  }, [editingImage, fetchImages]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-purple-400" />
          Image Library
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 rounded text-sm"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload
          </button>
          <button onClick={fetchImages} className="p-2 hover:bg-gray-800 rounded" title="Refresh">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={e => e.target.files && handleUpload(e.target.files)}
            className="hidden"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-800">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search images..."
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value as ImageCategory | 'all')}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div
        className={`flex-1 overflow-auto p-4 ${dragActive ? 'bg-purple-900/20' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {dragActive && (
          <div className="absolute inset-4 border-2 border-dashed border-purple-500 rounded-lg flex items-center justify-center bg-purple-900/30 pointer-events-none z-10">
            <div className="text-center">
              <Upload className="w-12 h-12 text-purple-400 mx-auto mb-2" />
              <p className="text-purple-300">Drop images here</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FolderOpen className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 mb-2">No images found</p>
            <p className="text-gray-500 text-sm">Upload images or adjust your filters</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map(image => (
              <ImageCard
                key={image.id}
                image={image}
                selected={selectedImage?.id === image.id}
                selectable={selectable}
                onSelect={() => {
                  setSelectedImage(image);
                  if (selectable && onSelect) {
                    onSelect(image);
                  }
                }}
                onEdit={() => setEditingImage(image)}
                onDelete={() => handleDelete(image)}
                onCopyUrl={() => copyUrl(image.publicUrl, image.id)}
                copied={copiedId === image.id}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {images.map(image => (
              <ImageRow
                key={image.id}
                image={image}
                selected={selectedImage?.id === image.id}
                selectable={selectable}
                onSelect={() => {
                  setSelectedImage(image);
                  if (selectable && onSelect) {
                    onSelect(image);
                  }
                }}
                onEdit={() => setEditingImage(image)}
                onDelete={() => handleDelete(image)}
                onCopyUrl={() => copyUrl(image.publicUrl, image.id)}
                copied={copiedId === image.id}
                formatSize={formatSize}
              />
            ))}
          </div>
        )}
      </div>

      {/* Image Preview Panel */}
      {selectedImage && !selectable && (
        <div className="border-t border-gray-800 p-4 bg-gray-900">
          <div className="flex items-start gap-4">
            <div
              className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0"
              style={{
                backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
                backgroundSize: '10px 10px',
                backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
              }}
            >
              <img
                src={selectedImage.publicUrl}
                alt={selectedImage.name}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium truncate">{selectedImage.name}</h3>
              <p className="text-sm text-gray-400 mt-1">
                {selectedImage.category} &bull; {formatSize(selectedImage.size)}
                {selectedImage.hasTransparency && ' &bull; Has transparency'}
              </p>
              <p className="text-xs text-gray-500 mt-1 truncate">{selectedImage.publicUrl}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingImage(selectedImage)}
                className="p-2 bg-purple-600 hover:bg-purple-500 rounded"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => copyUrl(selectedImage.publicUrl, selectedImage.id)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                title="Copy URL"
              >
                {copiedId === selectedImage.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <a
                href={selectedImage.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={() => handleDelete(selectedImage)}
                className="p-2 bg-red-600 hover:bg-red-500 rounded"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Editor Modal */}
      {editingImage && (
        <ImageEditor
          imageUrl={editingImage.publicUrl}
          imageName={editingImage.name}
          onSave={handleSaveEdit}
          onClose={() => setEditingImage(null)}
        />
      )}
    </div>
  );
}

function ImageCard({
  image,
  selected,
  selectable,
  onSelect,
  onEdit,
  onDelete,
  onCopyUrl,
  copied,
}: {
  image: AdminImage;
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyUrl: () => void;
  copied: boolean;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-lg overflow-hidden cursor-pointer transition-all ${
        selected ? 'ring-2 ring-purple-500' : 'hover:ring-2 hover:ring-gray-600'
      }`}
    >
      <div
        className="aspect-square"
        style={{
          backgroundImage: 'linear-gradient(45deg, #2a2a3e 25%, transparent 25%), linear-gradient(-45deg, #2a2a3e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a3e 75%), linear-gradient(-45deg, transparent 75%, #2a2a3e 75%)',
          backgroundSize: '10px 10px',
          backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
        }}
      >
        <img
          src={image.publicUrl}
          alt={image.name}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-sm text-white truncate">{image.name}</p>
          <p className="text-xs text-gray-400">{image.category}</p>
        </div>

        {!selectable && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 bg-gray-800/80 hover:bg-purple-600 rounded"
              title="Edit"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onCopyUrl(); }}
              className="p-1.5 bg-gray-800/80 hover:bg-gray-600 rounded"
              title="Copy URL"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 bg-gray-800/80 hover:bg-red-600 rounded"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {selected && selectable && (
        <div className="absolute top-2 right-2 p-1 bg-purple-600 rounded-full">
          <Check className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}

function ImageRow({
  image,
  selected,
  selectable,
  onSelect,
  onEdit,
  onDelete,
  onCopyUrl,
  copied,
  formatSize,
}: {
  image: AdminImage;
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyUrl: () => void;
  copied: boolean;
  formatSize: (bytes: number) => string;
}) {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${
        selected ? 'bg-purple-900/30 ring-1 ring-purple-500' : 'bg-gray-900 hover:bg-gray-800'
      }`}
    >
      <div
        className="w-12 h-12 rounded overflow-hidden flex-shrink-0"
        style={{
          backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
        }}
      >
        <img
          src={image.publicUrl}
          alt={image.name}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white truncate">{image.name}</p>
        <p className="text-sm text-gray-400">
          {CATEGORY_LABELS[image.category]} &bull; {formatSize(image.size)}
          {image.hasTransparency && (
            <span className="ml-2 px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">
              Transparent
            </span>
          )}
        </p>
      </div>

      {!selectable && (
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-2 hover:bg-gray-700 rounded"
            title="Edit"
          >
            <Edit2 className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onCopyUrl(); }}
            className="p-2 hover:bg-gray-700 rounded"
            title="Copy URL"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-2 hover:bg-red-600/20 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
          </button>
        </div>
      )}

      {selected && selectable && (
        <div className="p-1 bg-purple-600 rounded-full">
          <Check className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}

export default ImageLibrary;
