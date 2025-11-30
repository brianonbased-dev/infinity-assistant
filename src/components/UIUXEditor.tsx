'use client';

/**
 * UI/UX Editor Component
 *
 * Visual editor for customizing the built workspace.
 * Users can select templates, adjust layouts, customize colors,
 * and fine-tune the UI/UX with assistance.
 *
 * This appears after the lotus growth phases complete,
 * allowing users to put their personal touch on the creation.
 *
 * Features:
 * - Template selection
 * - Color theme customization
 * - Layout adjustments
 * - Component customization
 * - Real-time preview
 * - AI-assisted suggestions
 */

import { useState, useCallback } from 'react';
import {
  Palette,
  Layout,
  Type,
  Image,
  Layers,
  Sparkles,
  Check,
  ChevronRight,
  Eye,
  Wand2,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface Template {
  id: string;
  name: string;
  description: string;
  preview: string; // URL or base64
  category: TemplateCategory;
  style: TemplateStyle;
}

export type TemplateCategory = 'minimal' | 'modern' | 'bold' | 'elegant' | 'playful';
export type TemplateStyle = 'light' | 'dark' | 'colorful' | 'monochrome';

export interface ColorTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface LayoutOption {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface UIUXEditorProps {
  workspaceId: string;
  projectName: string;
  onSave?: (config: EditorConfig) => void;
  onClose?: () => void;
}

export interface EditorConfig {
  template: string | null;
  colorTheme: ColorTheme | null;
  layout: string | null;
  customizations: Record<string, unknown>;
}

// ============================================================================
// DEFAULT DATA
// ============================================================================

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'minimal-clean',
    name: 'Clean Minimal',
    description: 'Simple, distraction-free design',
    preview: '',
    category: 'minimal',
    style: 'light',
  },
  {
    id: 'modern-gradient',
    name: 'Modern Gradient',
    description: 'Contemporary look with smooth gradients',
    preview: '',
    category: 'modern',
    style: 'colorful',
  },
  {
    id: 'dark-elegant',
    name: 'Dark Elegant',
    description: 'Sophisticated dark theme',
    preview: '',
    category: 'elegant',
    style: 'dark',
  },
  {
    id: 'bold-vibrant',
    name: 'Bold & Vibrant',
    description: 'Eye-catching colors and strong contrasts',
    preview: '',
    category: 'bold',
    style: 'colorful',
  },
  {
    id: 'playful-rounded',
    name: 'Playful',
    description: 'Fun, rounded corners and friendly feel',
    preview: '',
    category: 'playful',
    style: 'light',
  },
];

const DEFAULT_COLOR_THEMES: ColorTheme[] = [
  {
    id: 'ocean',
    name: 'Ocean',
    primary: '#0ea5e9',
    secondary: '#0284c7',
    accent: '#38bdf8',
    background: '#f0f9ff',
    text: '#0c4a6e',
  },
  {
    id: 'forest',
    name: 'Forest',
    primary: '#22c55e',
    secondary: '#16a34a',
    accent: '#4ade80',
    background: '#f0fdf4',
    text: '#14532d',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    primary: '#f97316',
    secondary: '#ea580c',
    accent: '#fb923c',
    background: '#fff7ed',
    text: '#7c2d12',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    primary: '#a855f7',
    secondary: '#9333ea',
    accent: '#c084fc',
    background: '#faf5ff',
    text: '#581c87',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    primary: '#6366f1',
    secondary: '#4f46e5',
    accent: '#818cf8',
    background: '#0f172a',
    text: '#e2e8f0',
  },
  {
    id: 'rose',
    name: 'Rose',
    primary: '#ec4899',
    secondary: '#db2777',
    accent: '#f472b6',
    background: '#fdf2f8',
    text: '#831843',
  },
];

const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 'sidebar',
    name: 'Sidebar Navigation',
    description: 'Navigation on the left side',
    icon: Layout,
  },
  {
    id: 'topbar',
    name: 'Top Navigation',
    description: 'Navigation at the top',
    icon: Layout,
  },
  {
    id: 'centered',
    name: 'Centered Content',
    description: 'Content centered with max width',
    icon: Layers,
  },
  {
    id: 'fullwidth',
    name: 'Full Width',
    description: 'Edge-to-edge content',
    icon: Layout,
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

type EditorTab = 'templates' | 'colors' | 'layout' | 'preview';

export default function UIUXEditor({
  workspaceId,
  projectName,
  onSave,
  onClose,
}: UIUXEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<ColorTheme | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<string | null>(null);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  // Get AI suggestions
  const getAiSuggestion = useCallback(async () => {
    setIsAiSuggesting(true);
    // Simulate AI thinking
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Auto-select recommended options
    setSelectedTemplate('modern-gradient');
    setSelectedTheme(DEFAULT_COLOR_THEMES.find((t) => t.id === 'lavender') || null);
    setSelectedLayout('sidebar');

    setIsAiSuggesting(false);
  }, []);

  // Reset all selections
  const handleReset = useCallback(() => {
    setSelectedTemplate(null);
    setSelectedTheme(null);
    setSelectedLayout(null);
  }, []);

  // Save configuration
  const handleSave = useCallback(() => {
    const config: EditorConfig = {
      template: selectedTemplate,
      colorTheme: selectedTheme,
      layout: selectedLayout,
      customizations: {},
    };
    onSave?.(config);
  }, [selectedTemplate, selectedTheme, selectedLayout, onSave]);

  // Tab configuration
  const tabs: { id: EditorTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'templates', label: 'Templates', icon: Layers },
    { id: 'colors', label: 'Colors', icon: Palette },
    { id: 'layout', label: 'Layout', icon: Layout },
    { id: 'preview', label: 'Preview', icon: Eye },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Customize Your Creation</h2>
              <p className="text-sm text-gray-400">{projectName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={getAiSuggestion}
              disabled={isAiSuggesting}
              className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isAiSuggesting ? (
                <Sparkles className="w-4 h-4 animate-pulse" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              AI Suggest
            </button>
            <button
              onClick={handleReset}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Reset"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-800 px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors relative ${
                    isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Choose a Template</h3>
                <span className="text-sm text-gray-500">
                  {selectedTemplate ? '1 selected' : 'None selected'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {DEFAULT_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`group p-4 rounded-xl border transition-all text-left ${
                      selectedTemplate === template.id
                        ? 'bg-purple-500/20 border-purple-500'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {/* Preview Placeholder */}
                    <div className="aspect-video rounded-lg bg-gray-700/50 mb-3 flex items-center justify-center">
                      <Type className="w-8 h-8 text-gray-500" />
                    </div>

                    <h4 className="font-medium text-white text-sm">{template.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{template.description}</p>

                    {selectedTemplate === template.id && (
                      <div className="mt-2 flex items-center gap-1 text-purple-400 text-xs">
                        <Check className="w-3 h-3" />
                        Selected
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Colors Tab */}
          {activeTab === 'colors' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Color Theme</h3>
                <span className="text-sm text-gray-500">
                  {selectedTheme ? selectedTheme.name : 'None selected'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {DEFAULT_COLOR_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme)}
                    className={`group p-4 rounded-xl border transition-all ${
                      selectedTheme?.id === theme.id
                        ? 'bg-purple-500/20 border-purple-500'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {/* Color Preview */}
                    <div className="flex gap-1 mb-3">
                      <div
                        className="w-8 h-8 rounded-lg"
                        style={{ backgroundColor: theme.primary }}
                      />
                      <div
                        className="w-8 h-8 rounded-lg"
                        style={{ backgroundColor: theme.secondary }}
                      />
                      <div
                        className="w-8 h-8 rounded-lg"
                        style={{ backgroundColor: theme.accent }}
                      />
                    </div>

                    <h4 className="font-medium text-white text-sm">{theme.name}</h4>

                    {selectedTheme?.id === theme.id && (
                      <div className="mt-2 flex items-center gap-1 text-purple-400 text-xs">
                        <Check className="w-3 h-3" />
                        Selected
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Color Input */}
              <div className="mt-6 p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Custom Colors</h4>
                <p className="text-xs text-gray-500">
                  Custom color picker coming soon. For now, choose from the presets above.
                </p>
              </div>
            </div>
          )}

          {/* Layout Tab */}
          {activeTab === 'layout' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Layout Style</h3>
                <span className="text-sm text-gray-500">
                  {selectedLayout
                    ? LAYOUT_OPTIONS.find((l) => l.id === selectedLayout)?.name
                    : 'None selected'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {LAYOUT_OPTIONS.map((layout) => {
                  const Icon = layout.icon;
                  return (
                    <button
                      key={layout.id}
                      onClick={() => setSelectedLayout(layout.id)}
                      className={`group p-6 rounded-xl border transition-all text-center ${
                        selectedLayout === layout.id
                          ? 'bg-purple-500/20 border-purple-500'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <Icon className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                      <h4 className="font-medium text-white text-sm">{layout.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">{layout.description}</p>

                      {selectedLayout === layout.id && (
                        <div className="mt-3 flex items-center justify-center gap-1 text-purple-400 text-xs">
                          <Check className="w-3 h-3" />
                          Selected
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Preview</h3>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-400 hover:text-white transition-colors">
                    Desktop
                  </button>
                  <button className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-400 hover:text-white transition-colors">
                    Mobile
                  </button>
                </div>
              </div>

              {/* Preview Area */}
              <div className="aspect-video rounded-xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center">
                {selectedTemplate || selectedTheme || selectedLayout ? (
                  <div className="text-center">
                    <Eye className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400">
                      Preview will appear here based on your selections
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                      {selectedTemplate && (
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                          Template: {DEFAULT_TEMPLATES.find((t) => t.id === selectedTemplate)?.name}
                        </span>
                      )}
                      {selectedTheme && (
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                          Theme: {selectedTheme.name}
                        </span>
                      )}
                      {selectedLayout && (
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                          Layout: {LAYOUT_OPTIONS.find((l) => l.id === selectedLayout)?.name}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Layers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">Select options to see a preview</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 p-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {[selectedTemplate, selectedTheme, selectedLayout].filter(Boolean).length} of 3 options
            configured
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab('preview')}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedTemplate && !selectedTheme && !selectedLayout}
              className="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-purple-500/25"
            >
              <Save className="w-4 h-4" />
              Apply & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
