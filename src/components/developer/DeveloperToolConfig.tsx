'use client';

/**
 * Developer Tool Configuration UI
 *
 * Allows developers to configure MCP tools, IDE extensions,
 * and workspace settings for Infinity Builder integration.
 *
 * Features:
 * - MCP server configuration
 * - IDE extension settings
 * - Workspace preferences
 * - Tool permission management
 *
 * @since 2025-12-01
 */

import React, { useState, useCallback } from 'react';
import {
  Wrench,
  Plug,
  Settings,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Shield,
  Code,
  Terminal,
  Database,
  Globe,
  FileCode,
  Folder,
  GitBranch,
  Loader2,
  Info,
  Search,
} from 'lucide-react';

// Types
type ToolCategory = 'code' | 'file' | 'terminal' | 'database' | 'web' | 'git' | 'custom';

interface MCPTool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  serverUri?: string;
  enabled: boolean;
  permissions: ToolPermission[];
  config?: Record<string, any>;
}

interface ToolPermission {
  id: string;
  name: string;
  description: string;
  granted: boolean;
  risk: 'low' | 'medium' | 'high';
}

interface IDEExtension {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  version?: string;
  marketplace?: string;
}

interface WorkspaceConfig {
  autoSave: boolean;
  autoFormat: boolean;
  lintOnSave: boolean;
  testOnSave: boolean;
  gitAutoCommit: boolean;
  showPhaseOverlay: boolean;
  showTodoPanel: boolean;
  theme: 'dark' | 'light' | 'system';
}

interface DeveloperToolConfigProps {
  workspaceId: string;
  onSave?: (config: any) => void;
  className?: string;
}

// Category configuration
const CATEGORY_CONFIG: Record<ToolCategory, {
  name: string;
  icon: React.ReactNode;
  color: string;
}> = {
  code: { name: 'Code', icon: <Code className="w-4 h-4" />, color: '#3b82f6' },
  file: { name: 'File System', icon: <Folder className="w-4 h-4" />, color: '#22c55e' },
  terminal: { name: 'Terminal', icon: <Terminal className="w-4 h-4" />, color: '#f59e0b' },
  database: { name: 'Database', icon: <Database className="w-4 h-4" />, color: '#8b5cf6' },
  web: { name: 'Web', icon: <Globe className="w-4 h-4" />, color: '#06b6d4' },
  git: { name: 'Git', icon: <GitBranch className="w-4 h-4" />, color: '#ef4444' },
  custom: { name: 'Custom', icon: <Wrench className="w-4 h-4" />, color: '#6b7280' },
};

// Default MCP tools
const DEFAULT_MCP_TOOLS: MCPTool[] = [
  {
    id: 'read-file',
    name: 'Read File',
    description: 'Read contents of files in the workspace',
    category: 'file',
    enabled: true,
    permissions: [
      { id: 'read', name: 'Read Access', description: 'Read files in workspace', granted: true, risk: 'low' },
    ],
  },
  {
    id: 'write-file',
    name: 'Write File',
    description: 'Create or modify files in the workspace',
    category: 'file',
    enabled: true,
    permissions: [
      { id: 'write', name: 'Write Access', description: 'Create and modify files', granted: true, risk: 'medium' },
      { id: 'delete', name: 'Delete Access', description: 'Delete files', granted: false, risk: 'high' },
    ],
  },
  {
    id: 'bash',
    name: 'Bash Commands',
    description: 'Execute shell commands in the terminal',
    category: 'terminal',
    enabled: true,
    permissions: [
      { id: 'execute', name: 'Execute Commands', description: 'Run shell commands', granted: true, risk: 'high' },
      { id: 'install', name: 'Install Packages', description: 'Install npm/pip packages', granted: true, risk: 'medium' },
    ],
  },
  {
    id: 'grep',
    name: 'Search Code',
    description: 'Search for patterns in code files',
    category: 'code',
    enabled: true,
    permissions: [
      { id: 'search', name: 'Search Access', description: 'Search file contents', granted: true, risk: 'low' },
    ],
  },
  {
    id: 'glob',
    name: 'Find Files',
    description: 'Find files by pattern matching',
    category: 'file',
    enabled: true,
    permissions: [
      { id: 'glob', name: 'Glob Access', description: 'List files by pattern', granted: true, risk: 'low' },
    ],
  },
  {
    id: 'web-fetch',
    name: 'Web Fetch',
    description: 'Fetch content from URLs',
    category: 'web',
    enabled: true,
    permissions: [
      { id: 'fetch', name: 'HTTP Access', description: 'Make HTTP requests', granted: true, risk: 'medium' },
    ],
  },
  {
    id: 'git',
    name: 'Git Operations',
    description: 'Execute git commands for version control',
    category: 'git',
    enabled: true,
    permissions: [
      { id: 'read', name: 'Read History', description: 'View git history and status', granted: true, risk: 'low' },
      { id: 'write', name: 'Commit Changes', description: 'Stage and commit changes', granted: true, risk: 'medium' },
      { id: 'push', name: 'Push/Pull', description: 'Push to and pull from remote', granted: false, risk: 'high' },
    ],
  },
  {
    id: 'database',
    name: 'Database Tools',
    description: 'Query and manage database connections',
    category: 'database',
    enabled: false,
    permissions: [
      { id: 'query', name: 'Read Query', description: 'Execute SELECT queries', granted: true, risk: 'low' },
      { id: 'write', name: 'Write Query', description: 'Execute INSERT/UPDATE', granted: false, risk: 'high' },
    ],
  },
];

// IDE Extensions
const IDE_EXTENSIONS: IDEExtension[] = [
  {
    id: 'infinity-builder',
    name: 'Infinity Builder',
    description: 'Core extension for AI-powered development',
    installed: true,
    version: '1.0.0',
    marketplace: 'https://marketplace.visualstudio.com',
  },
  {
    id: 'prettier',
    name: 'Prettier',
    description: 'Code formatter',
    installed: true,
    version: '10.1.0',
  },
  {
    id: 'eslint',
    name: 'ESLint',
    description: 'JavaScript/TypeScript linter',
    installed: true,
    version: '2.4.4',
  },
  {
    id: 'tailwind-intellisense',
    name: 'Tailwind CSS IntelliSense',
    description: 'Tailwind CSS class autocomplete',
    installed: false,
    marketplace: 'https://marketplace.visualstudio.com',
  },
  {
    id: 'gitlens',
    name: 'GitLens',
    description: 'Git supercharged',
    installed: false,
    marketplace: 'https://marketplace.visualstudio.com',
  },
];

export function DeveloperToolConfig({
  workspaceId,
  onSave,
  className = '',
}: DeveloperToolConfigProps) {
  const [activeTab, setActiveTab] = useState<'tools' | 'extensions' | 'workspace'>('tools');
  const [tools, setTools] = useState<MCPTool[]>(DEFAULT_MCP_TOOLS);
  const [extensions, setExtensions] = useState<IDEExtension[]>(IDE_EXTENSIONS);
  const [workspaceConfig, setWorkspaceConfig] = useState<WorkspaceConfig>({
    autoSave: true,
    autoFormat: true,
    lintOnSave: true,
    testOnSave: false,
    gitAutoCommit: false,
    showPhaseOverlay: true,
    showTodoPanel: true,
    theme: 'dark',
  });
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter tools by search
  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group tools by category
  const toolsByCategory = filteredTools.reduce((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<ToolCategory, MCPTool[]>);

  // Toggle tool enabled
  const toggleTool = useCallback((toolId: string) => {
    setTools(prev => prev.map(tool =>
      tool.id === toolId ? { ...tool, enabled: !tool.enabled } : tool
    ));
  }, []);

  // Toggle permission
  const togglePermission = useCallback((toolId: string, permissionId: string) => {
    setTools(prev => prev.map(tool =>
      tool.id === toolId
        ? {
            ...tool,
            permissions: tool.permissions.map(perm =>
              perm.id === permissionId ? { ...perm, granted: !perm.granted } : perm
            ),
          }
        : tool
    ));
  }, []);

  // Save configuration
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // In production, save to API
      await new Promise(resolve => setTimeout(resolve, 500));
      onSave?.({ tools, extensions, workspaceConfig });
    } finally {
      setSaving(false);
    }
  }, [tools, extensions, workspaceConfig, onSave]);

  return (
    <div className={`bg-[#1e1e1e] rounded-xl border border-[#3c3c3c] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#3c3c3c] bg-[#252526]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Settings className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Tool Configuration</h2>
              <p className="text-sm text-gray-500">Manage tools and workspace settings</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-4">
          {(['tools', 'extensions', 'workspace'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab === 'tools' && 'MCP Tools'}
              {tab === 'extensions' && 'Extensions'}
              {tab === 'workspace' && 'Workspace'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-h-[600px] overflow-y-auto">
        {/* MCP Tools Tab */}
        {activeTab === 'tools' && (
          <div>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tools..."
                className="w-full pl-10 pr-4 py-2 bg-[#2a2a2a] border border-[#3c3c3c] rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            {/* Tools by category */}
            {Object.entries(toolsByCategory).map(([category, categoryTools]) => {
              const config = CATEGORY_CONFIG[category as ToolCategory];
              return (
                <div key={category} className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ color: config.color }}>{config.icon}</span>
                    <h3 className="text-sm font-medium text-gray-300">{config.name}</h3>
                    <span className="text-xs text-gray-600">({categoryTools.length})</span>
                  </div>

                  <div className="space-y-2">
                    {categoryTools.map(tool => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        expanded={expandedTool === tool.id}
                        onToggle={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
                        onToggleEnabled={() => toggleTool(tool.id)}
                        onTogglePermission={(permId) => togglePermission(tool.id, permId)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Extensions Tab */}
        {activeTab === 'extensions' && (
          <div className="space-y-3">
            {extensions.map(ext => (
              <div
                key={ext.id}
                className="p-4 bg-[#2a2a2a] rounded-lg border border-[#3c3c3c]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gray-700">
                      <Plug className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-200">{ext.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{ext.description}</p>
                      {ext.version && (
                        <span className="text-xs text-gray-600 mt-1">v{ext.version}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ext.installed ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Installed
                      </span>
                    ) : (
                      <button className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30">
                        <Plus className="w-3 h-3" />
                        Install
                      </button>
                    )}
                    {ext.marketplace && (
                      <a
                        href={ext.marketplace}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-gray-500 hover:text-gray-400"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Workspace Tab */}
        {activeTab === 'workspace' && (
          <div className="space-y-6">
            {/* Editor Settings */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Editor Settings</h3>
              <div className="space-y-3">
                <ToggleSetting
                  label="Auto Save"
                  description="Automatically save files when focus changes"
                  value={workspaceConfig.autoSave}
                  onChange={v => setWorkspaceConfig(prev => ({ ...prev, autoSave: v }))}
                />
                <ToggleSetting
                  label="Auto Format"
                  description="Format code on save using Prettier"
                  value={workspaceConfig.autoFormat}
                  onChange={v => setWorkspaceConfig(prev => ({ ...prev, autoFormat: v }))}
                />
                <ToggleSetting
                  label="Lint on Save"
                  description="Run ESLint when saving files"
                  value={workspaceConfig.lintOnSave}
                  onChange={v => setWorkspaceConfig(prev => ({ ...prev, lintOnSave: v }))}
                />
                <ToggleSetting
                  label="Test on Save"
                  description="Run related tests when saving files"
                  value={workspaceConfig.testOnSave}
                  onChange={v => setWorkspaceConfig(prev => ({ ...prev, testOnSave: v }))}
                />
              </div>
            </div>

            {/* Git Settings */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Git Settings</h3>
              <div className="space-y-3">
                <ToggleSetting
                  label="Auto Commit"
                  description="Automatically commit changes at phase completion"
                  value={workspaceConfig.gitAutoCommit}
                  onChange={v => setWorkspaceConfig(prev => ({ ...prev, gitAutoCommit: v }))}
                />
              </div>
            </div>

            {/* UI Settings */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">UI Settings</h3>
              <div className="space-y-3">
                <ToggleSetting
                  label="Show Phase Overlay"
                  description="Display phase progress during orchestration"
                  value={workspaceConfig.showPhaseOverlay}
                  onChange={v => setWorkspaceConfig(prev => ({ ...prev, showPhaseOverlay: v }))}
                />
                <ToggleSetting
                  label="Show Todo Panel"
                  description="Display task list in sidebar"
                  value={workspaceConfig.showTodoPanel}
                  onChange={v => setWorkspaceConfig(prev => ({ ...prev, showTodoPanel: v }))}
                />
              </div>
            </div>

            {/* Theme */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Theme</h3>
              <div className="flex gap-2">
                {(['dark', 'light', 'system'] as const).map(theme => (
                  <button
                    key={theme}
                    onClick={() => setWorkspaceConfig(prev => ({ ...prev, theme }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                      workspaceConfig.theme === theme
                        ? 'bg-blue-500 text-white'
                        : 'bg-[#2a2a2a] text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Tool Card Component
function ToolCard({
  tool,
  expanded,
  onToggle,
  onToggleEnabled,
  onTogglePermission,
}: {
  tool: MCPTool;
  expanded: boolean;
  onToggle: () => void;
  onToggleEnabled: () => void;
  onTogglePermission: (permId: string) => void;
}) {
  const categoryConfig = CATEGORY_CONFIG[tool.category];

  return (
    <div
      className={`rounded-lg border transition-colors ${
        tool.enabled
          ? 'bg-[#2a2a2a] border-[#3c3c3c]'
          : 'bg-[#1e1e1e] border-gray-700/50 opacity-60'
      }`}
    >
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={onToggle}
      >
        <button
          onClick={e => {
            e.stopPropagation();
            onToggleEnabled();
          }}
          className={`w-10 h-5 rounded-full transition-colors relative ${
            tool.enabled ? 'bg-green-500' : 'bg-gray-600'
          }`}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              tool.enabled ? 'left-5' : 'left-0.5'
            }`}
          />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-200">{tool.name}</h4>
            {tool.permissions.some(p => p.risk === 'high' && p.granted) && (
              <span title="High-risk permissions granted">
                <Shield className="w-3 h-3 text-red-400" />
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{tool.description}</p>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-[#3c3c3c]">
          <h5 className="text-xs font-medium text-gray-400 mt-3 mb-2">Permissions</h5>
          <div className="space-y-2">
            {tool.permissions.map(perm => (
              <div
                key={perm.id}
                className="flex items-center justify-between p-2 bg-[#1e1e1e] rounded"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      perm.risk === 'high'
                        ? 'bg-red-500'
                        : perm.risk === 'medium'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    title={`${perm.risk} risk`}
                  />
                  <div>
                    <p className="text-xs font-medium text-gray-300">{perm.name}</p>
                    <p className="text-[10px] text-gray-500">{perm.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => onTogglePermission(perm.id)}
                  disabled={!tool.enabled}
                  className={`px-2 py-1 text-xs rounded ${
                    perm.granted
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-700 text-gray-500'
                  } disabled:opacity-50`}
                >
                  {perm.granted ? 'Granted' : 'Denied'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Toggle Setting Component
function ToggleSetting({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#2a2a2a] rounded-lg">
      <div>
        <p className="text-sm font-medium text-gray-300">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors relative ${
          value ? 'bg-blue-500' : 'bg-gray-600'
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            value ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export default DeveloperToolConfig;
