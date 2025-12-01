'use client';

/**
 * Builder Dream Board Component
 *
 * A visual, creative workspace where users "dream up" their project vision.
 * Instead of a boring form, users interact with a dynamic board that captures:
 * - Project vision and goals
 * - Feature wishlists
 * - Style preferences
 * - Integration needs
 * - User stories
 *
 * The dream board is then sent to the AI for specification generation.
 * This approach:
 * - Feels creative and engaging, not like filling out forms
 * - Captures user intent in a natural way
 * - Works for all experience levels (more/less guidance based on level)
 * - Enables quantum parallel processing - AI sees EVERYTHING at once
 *
 * @since 2025-12-01
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  X,
  Lightbulb,
  Palette,
  Puzzle,
  Users,
  Rocket,
  Heart,
  Star,
  Zap,
  Cloud,
  Database,
  Lock,
  Globe,
  MessageSquare,
  CreditCard,
  Mail,
  Bell,
  Search,
  BarChart,
  Share2,
  Shield,
  Clock,
  ArrowRight,
  ArrowLeft,
  Check,
  Wand2,
  Loader2,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  ExperienceLevel,
  AgentConfig,
  BuilderTemplate,
  WorkspaceSpecification,
} from '@/services/BuilderOnboardingClient';

// ============================================================================
// TYPES
// ============================================================================

interface DreamItem {
  id: string;
  category: DreamCategory;
  content: string;
  icon?: string;
  priority: 'must-have' | 'nice-to-have' | 'future';
  createdAt: Date;
}

type DreamCategory =
  | 'vision'      // What's the big picture?
  | 'feature'     // What should it do?
  | 'style'       // How should it look/feel?
  | 'integration' // What should it connect to?
  | 'user'        // Who will use it?
  | 'constraint'; // What are the limits?

interface DreamBoard {
  projectName: string;
  tagline: string;
  items: DreamItem[];
  inspirations: string[];
  colorPreference?: string;
  targetAudience?: string;
  timeline?: string;
}

interface BuilderDreamBoardProps {
  template: BuilderTemplate;
  experienceLevel: ExperienceLevel;
  agentConfig: AgentConfig;
  onComplete: (dreamBoard: DreamBoard) => void;
  onBack?: () => void;
  isProcessing?: boolean;
}

// ============================================================================
// CATEGORY CONFIG
// ============================================================================

const DREAM_CATEGORIES: Record<DreamCategory, {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  placeholder: string;
  suggestions: string[];
}> = {
  vision: {
    title: 'The Vision',
    description: 'What\'s the big picture? What problem are you solving?',
    icon: Lightbulb,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    placeholder: 'I want to build...',
    suggestions: [
      'A place where users can...',
      'An app that makes it easy to...',
      'A platform for...',
      'Something that helps people...',
    ],
  },
  feature: {
    title: 'Features',
    description: 'What should your project be able to do?',
    icon: Puzzle,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    placeholder: 'Users should be able to...',
    suggestions: [
      'User authentication & profiles',
      'Search and filter content',
      'Real-time notifications',
      'Dashboard with analytics',
      'File uploads',
      'Social sharing',
      'Payment processing',
      'Email notifications',
    ],
  },
  style: {
    title: 'Look & Feel',
    description: 'How should it look? What\'s the vibe?',
    icon: Palette,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    placeholder: 'It should feel...',
    suggestions: [
      'Clean and minimal',
      'Bold and colorful',
      'Professional and corporate',
      'Playful and fun',
      'Dark mode by default',
      'Mobile-first design',
    ],
  },
  integration: {
    title: 'Integrations',
    description: 'What services should it connect to?',
    icon: Share2,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    placeholder: 'Connect to...',
    suggestions: [
      'Stripe for payments',
      'Auth0 / Supabase Auth',
      'OpenAI / Claude API',
      'Telegram / Discord',
      'Google Analytics',
      'SendGrid / Resend for email',
      'Cloudinary for images',
      'AWS S3 for storage',
    ],
  },
  user: {
    title: 'Users',
    description: 'Who will use this? What do they need?',
    icon: Users,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    placeholder: 'My users are...',
    suggestions: [
      'Developers who want to...',
      'Small business owners',
      'Content creators',
      'Students learning...',
      'Teams collaborating on...',
      'Anyone who needs to...',
    ],
  },
  constraint: {
    title: 'Constraints',
    description: 'Any limits or requirements to keep in mind?',
    icon: Shield,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    placeholder: 'It must...',
    suggestions: [
      'Work offline',
      'Be accessible (WCAG)',
      'Handle high traffic',
      'Be GDPR compliant',
      'Cost under $X/month',
      'Launch within 2 weeks',
    ],
  },
};

// Priority badges
const PRIORITY_BADGES: Record<DreamItem['priority'], {
  label: string;
  color: string;
  bgColor: string;
}> = {
  'must-have': { label: 'Must Have', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  'nice-to-have': { label: 'Nice to Have', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  'future': { label: 'Future', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function BuilderDreamBoard({
  template,
  experienceLevel,
  agentConfig,
  onComplete,
  onBack,
  isProcessing = false,
}: BuilderDreamBoardProps) {
  // Dream board state
  const [dreamBoard, setDreamBoard] = useState<DreamBoard>({
    projectName: template.name.toLowerCase().replace(/\s+/g, '-'),
    tagline: '',
    items: [],
    inspirations: [],
  });

  // UI state
  const [activeCategory, setActiveCategory] = useState<DreamCategory>('vision');
  const [inputValue, setInputValue] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<DreamCategory>>(
    new Set(['vision', 'feature'])
  );

  // Pre-populate with template suggestions for easy mode
  useEffect(() => {
    if (experienceLevel === 'easy' && dreamBoard.items.length === 0) {
      // Add some starter items based on template
      const starters: DreamItem[] = [
        {
          id: crypto.randomUUID(),
          category: 'vision',
          content: template.description,
          priority: 'must-have',
          createdAt: new Date(),
        },
      ];
      setDreamBoard(prev => ({ ...prev, items: starters }));
    }
  }, [experienceLevel, template, dreamBoard.items.length]);

  // Add a dream item
  const addDreamItem = useCallback((category: DreamCategory, content: string, priority: DreamItem['priority'] = 'must-have') => {
    if (!content.trim()) return;

    const newItem: DreamItem = {
      id: crypto.randomUUID(),
      category,
      content: content.trim(),
      priority,
      createdAt: new Date(),
    };

    setDreamBoard(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
    setInputValue('');
  }, []);

  // Remove a dream item
  const removeDreamItem = useCallback((id: string) => {
    setDreamBoard(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
    }));
  }, []);

  // Update item priority
  const updateItemPriority = useCallback((id: string, priority: DreamItem['priority']) => {
    setDreamBoard(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, priority } : item
      ),
    }));
  }, []);

  // Toggle category expansion
  const toggleCategory = useCallback((category: DreamCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Get items by category
  const getItemsByCategory = useCallback((category: DreamCategory) => {
    return dreamBoard.items.filter(item => item.category === category);
  }, [dreamBoard.items]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    // Ensure project name is set
    if (!dreamBoard.projectName.trim()) {
      setDreamBoard(prev => ({ ...prev, projectName: 'my-project' }));
    }
    onComplete(dreamBoard);
  }, [dreamBoard, onComplete]);

  // Check if ready to submit
  const canSubmit = dreamBoard.items.length > 0 &&
    (experienceLevel === 'easy' || dreamBoard.items.some(i => i.category === 'vision'));

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Dream Board</h2>
              <p className="text-sm text-gray-400">
                Paint your vision. The AI will build it.
              </p>
            </div>
          </div>

          {/* Project name input */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Project:</span>
            <input
              type="text"
              value={dreamBoard.projectName}
              onChange={(e) => setDreamBoard(prev => ({
                ...prev,
                projectName: e.target.value.toLowerCase().replace(/\s+/g, '-')
              }))}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="project-name"
            />
          </div>
        </div>

        {/* Tagline */}
        <input
          type="text"
          value={dreamBoard.tagline}
          onChange={(e) => setDreamBoard(prev => ({ ...prev, tagline: e.target.value }))}
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Describe your project in one sentence..."
        />
      </div>

      {/* Dream Board Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Category sections */}
          {(Object.keys(DREAM_CATEGORIES) as DreamCategory[]).map((category) => {
            const config = DREAM_CATEGORIES[category];
            const items = getItemsByCategory(category);
            const isExpanded = expandedCategories.has(category);
            const isActive = activeCategory === category;
            const Icon = config.icon;

            // For easy mode, show fewer categories
            if (experienceLevel === 'easy' && !['vision', 'feature', 'style'].includes(category)) {
              return null;
            }

            return (
              <div
                key={category}
                className={`rounded-xl border-2 transition-all ${
                  isActive
                    ? `border-gray-600 ${config.bgColor}`
                    : 'border-gray-800 bg-gray-800/30'
                }`}
              >
                {/* Category header */}
                <button
                  type="button"
                  onClick={() => {
                    toggleCategory(category);
                    setActiveCategory(category);
                  }}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-white">{config.title}</h3>
                      <p className="text-xs text-gray-400">{config.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {items.length > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${config.bgColor} ${config.color}`}>
                        {items.length}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Category content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Existing items */}
                    {items.length > 0 && (
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg group"
                          >
                            <GripVertical className="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                            <span className="flex-1 text-sm text-gray-200">{item.content}</span>

                            {/* Priority selector */}
                            <select
                              value={item.priority}
                              onChange={(e) => updateItemPriority(item.id, e.target.value as DreamItem['priority'])}
                              className={`px-2 py-1 rounded text-xs border-0 cursor-pointer ${PRIORITY_BADGES[item.priority].bgColor} ${PRIORITY_BADGES[item.priority].color}`}
                            >
                              <option value="must-have">Must Have</option>
                              <option value="nice-to-have">Nice to Have</option>
                              <option value="future">Future</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => removeDreamItem(item.id)}
                              className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new item */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={isActive ? inputValue : ''}
                        onChange={(e) => {
                          setActiveCategory(category);
                          setInputValue(e.target.value);
                        }}
                        onFocus={() => setActiveCategory(category)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && inputValue.trim()) {
                            addDreamItem(category, inputValue);
                          }
                        }}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder={config.placeholder}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (inputValue.trim()) {
                            addDreamItem(category, inputValue);
                          }
                        }}
                        disabled={!inputValue.trim() || !isActive}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quick suggestions */}
                    {experienceLevel !== 'experienced' && (
                      <div className="flex flex-wrap gap-2">
                        {config.suggestions.slice(0, experienceLevel === 'easy' ? 3 : 6).map((suggestion, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => addDreamItem(category, suggestion)}
                            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full border border-gray-700 transition-colors"
                          >
                            + {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary & Submit */}
      <div className="p-6 border-t border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Summary */}
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}

            <div className="text-sm text-gray-400">
              <span className="text-white font-medium">{dreamBoard.items.length}</span> ideas captured
              {dreamBoard.items.filter(i => i.priority === 'must-have').length > 0 && (
                <span className="ml-2">
                  (<span className="text-red-400">{dreamBoard.items.filter(i => i.priority === 'must-have').length}</span> must-have)
                </span>
              )}
            </div>
          </div>

          {/* Submit button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isProcessing}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                Generate Specification
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Help text */}
        {!canSubmit && (
          <p className="text-center text-sm text-gray-500 mt-2">
            Add at least one idea to your dream board to continue
          </p>
        )}
      </div>
    </div>
  );
}

// Export the DreamBoard type for use elsewhere
export type { DreamBoard, DreamItem, DreamCategory };
