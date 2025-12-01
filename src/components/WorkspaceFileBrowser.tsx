'use client';

/**
 * Workspace File Browser Component
 *
 * Displays workspace files in a tree structure with:
 * - Expandable folders
 * - File preview with syntax highlighting
 * - File status indicators (created, modified, pending)
 * - Search/filter functionality
 * - Copy file contents
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileJson,
  FileText,
  Image,
  ChevronRight,
  ChevronDown,
  Search,
  Copy,
  Check,
  RefreshCw,
  Download,
  ExternalLink,
  Eye,
  Code,
  X,
} from 'lucide-react';

export interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string;
  language?: string;
  size?: number;
  status?: 'created' | 'modified' | 'pending' | 'unchanged';
  children?: WorkspaceFile[];
  lastModified?: Date;
}

interface WorkspaceFileBrowserProps {
  files: WorkspaceFile[];
  workspaceId: string;
  onFileSelect?: (file: WorkspaceFile) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

// File icon based on extension
function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'rb':
    case 'go':
    case 'rs':
    case 'java':
    case 'c':
    case 'cpp':
    case 'cs':
    case 'php':
    case 'swift':
    case 'kt':
      return <FileCode className="w-4 h-4 text-blue-400" />;
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'xml':
      return <FileJson className="w-4 h-4 text-yellow-400" />;
    case 'md':
    case 'txt':
    case 'doc':
    case 'docx':
      return <FileText className="w-4 h-4 text-gray-400" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image className="w-4 h-4 text-purple-400" />;
    default:
      return <File className="w-4 h-4 text-gray-500" />;
  }
}

// Get language for syntax highlighting
function getLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
  };

  return languageMap[ext || ''] || 'plaintext';
}

// Status badge color
function getStatusColor(status?: string) {
  switch (status) {
    case 'created':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'modified':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'pending':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

// File tree node component
function FileTreeNode({
  file,
  depth = 0,
  selectedFile,
  expandedFolders,
  onSelect,
  onToggleFolder,
}: {
  file: WorkspaceFile;
  depth?: number;
  selectedFile: WorkspaceFile | null;
  expandedFolders: Set<string>;
  onSelect: (file: WorkspaceFile) => void;
  onToggleFolder: (path: string) => void;
}) {
  const isFolder = file.type === 'folder';
  const isExpanded = expandedFolders.has(file.path);
  const isSelected = selectedFile?.path === file.path;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (isFolder) {
            onToggleFolder(file.path);
          } else {
            onSelect(file);
          }
        }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${
          isSelected
            ? 'bg-purple-500/20 text-purple-300'
            : 'hover:bg-gray-800 text-gray-300'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/Collapse icon for folders */}
        {isFolder ? (
          <span className="w-4 h-4 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-500" />
            )}
          </span>
        ) : (
          <span className="w-4" />
        )}

        {/* Icon */}
        {isFolder ? (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 text-amber-400" />
          ) : (
            <Folder className="w-4 h-4 text-amber-400" />
          )
        ) : (
          getFileIcon(file.name)
        )}

        {/* Name */}
        <span className="flex-1 truncate">{file.name}</span>

        {/* Status badge */}
        {file.status && file.status !== 'unchanged' && (
          <span className={`px-1.5 py-0.5 text-[10px] rounded border ${getStatusColor(file.status)}`}>
            {file.status}
          </span>
        )}
      </button>

      {/* Children */}
      {isFolder && isExpanded && file.children && (
        <div>
          {file.children.map((child) => (
            <FileTreeNode
              key={child.path}
              file={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              expandedFolders={expandedFolders}
              onSelect={onSelect}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// File preview component
function FilePreview({
  file,
  onClose,
  onCopy,
}: {
  file: WorkspaceFile;
  onClose: () => void;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const language = getLanguage(file.name);

  const handleCopy = useCallback(() => {
    if (file.content) {
      navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy();
    }
  }, [file.content, onCopy]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center gap-3">
          {getFileIcon(file.name)}
          <div>
            <div className="font-medium text-white">{file.name}</div>
            <div className="text-xs text-gray-500">{file.path}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {file.status && (
            <span className={`px-2 py-1 text-xs rounded border ${getStatusColor(file.status)}`}>
              {file.status}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Copy file contents"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Close preview"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-900/50">
        {file.content ? (
          <pre className="p-4 text-sm font-mono text-gray-300 whitespace-pre-wrap">
            <code className={`language-${language}`}>
              {file.content}
            </code>
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No preview available</p>
              <p className="text-sm">File content not loaded</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {file.size !== undefined && (
        <div className="px-4 py-2 border-t border-gray-700 bg-gray-800/30 text-xs text-gray-500">
          {formatFileSize(file.size)} {file.lastModified && `• Modified ${formatDate(file.lastModified)}`}
        </div>
      )}
    </div>
  );
}

// Utility functions
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Build flat file list for search
function flattenFiles(files: WorkspaceFile[]): WorkspaceFile[] {
  const result: WorkspaceFile[] = [];

  function traverse(items: WorkspaceFile[]) {
    for (const item of items) {
      result.push(item);
      if (item.children) {
        traverse(item.children);
      }
    }
  }

  traverse(files);
  return result;
}

export default function WorkspaceFileBrowser({
  files,
  workspaceId,
  onFileSelect,
  onRefresh,
  isLoading = false,
  className = '',
}: WorkspaceFileBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/', '/src']));
  const [showPreview, setShowPreview] = useState(true);

  // Flatten files for search
  const flatFiles = useMemo(() => flattenFiles(files), [files]);

  // Filter files based on search
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;

    const query = searchQuery.toLowerCase();
    const matchingPaths = new Set<string>();

    // Find all matching files
    flatFiles.forEach((file) => {
      if (file.name.toLowerCase().includes(query) || file.path.toLowerCase().includes(query)) {
        matchingPaths.add(file.path);
        // Also add all parent folders
        const parts = file.path.split('/');
        let currentPath = '';
        for (const part of parts) {
          if (part) {
            currentPath += '/' + part;
            matchingPaths.add(currentPath);
          }
        }
      }
    });

    // Filter tree to only include matching paths
    function filterTree(items: WorkspaceFile[]): WorkspaceFile[] {
      return items
        .filter((item) => matchingPaths.has(item.path))
        .map((item) => ({
          ...item,
          children: item.children ? filterTree(item.children) : undefined,
        }));
    }

    return filterTree(files);
  }, [files, flatFiles, searchQuery]);

  // Toggle folder expansion
  const handleToggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((file: WorkspaceFile) => {
    setSelectedFile(file);
    setShowPreview(true);
    onFileSelect?.(file);
  }, [onFileSelect]);

  // File counts
  const fileCounts = useMemo(() => {
    let total = 0;
    let created = 0;
    let modified = 0;

    flatFiles.forEach((file) => {
      if (file.type === 'file') {
        total++;
        if (file.status === 'created') created++;
        if (file.status === 'modified') modified++;
      }
    });

    return { total, created, modified };
  }, [flatFiles]);

  return (
    <div className={`flex h-full bg-gray-900 rounded-xl border border-gray-800 overflow-hidden ${className}`}>
      {/* File Tree Panel */}
      <div className="w-72 flex flex-col border-r border-gray-800">
        {/* Header */}
        <div className="p-3 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-white">Files</h3>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">{fileCounts.total} files</span>
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh files"
                >
                  <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
        </div>

        {/* Stats */}
        {(fileCounts.created > 0 || fileCounts.modified > 0) && (
          <div className="px-3 py-2 border-b border-gray-800 flex gap-3 text-xs">
            {fileCounts.created > 0 && (
              <span className="text-green-400">{fileCounts.created} created</span>
            )}
            {fileCounts.modified > 0 && (
              <span className="text-yellow-400">{fileCounts.modified} modified</span>
            )}
          </div>
        )}

        {/* File Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {searchQuery ? 'No matching files' : 'No files in workspace'}
            </div>
          ) : (
            filteredFiles.map((file) => (
              <FileTreeNode
                key={file.path}
                file={file}
                selectedFile={selectedFile}
                expandedFolders={expandedFolders}
                onSelect={handleFileSelect}
                onToggleFolder={handleToggleFolder}
              />
            ))
          )}
        </div>
      </div>

      {/* Preview Panel */}
      <div className="flex-1 flex flex-col">
        {selectedFile && showPreview ? (
          <FilePreview
            file={selectedFile}
            onClose={() => setShowPreview(false)}
            onCopy={() => {}}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Code className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Select a file to preview</p>
              <p className="text-sm mt-1">Click on any file in the tree</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
