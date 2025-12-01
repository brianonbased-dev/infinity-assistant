'use client';

/**
 * Experience Level Selector Component
 *
 * Allows users to select their experience level for the Builder:
 * - Easy (Inexperienced): Full orchestration, minimal questions, Infinity Assistant handles everything
 * - Medium (Intermediate): Balanced autonomy, strategic questions, some tool exposure
 * - Experienced (Advanced): Minimal orchestration, full tool access, developer-centric workflow
 *
 * Based on research about developer flow state and autonomy preferences:
 * - Inexperienced devs want guidance and hand-holding
 * - Experienced devs want tools and freedom, not interruptions
 *
 * Enhanced with smooth animations and transitions for a polished UX.
 *
 * @since 2025-12-01
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Zap,
  Rocket,
  Check,
  ArrowRight,
  ArrowLeft,
  Brain,
  Wrench,
  Shield,
  Clock,
  MessageCircle,
  Code,
  Terminal,
  Settings,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import type { ExperienceLevel, AgentConfig } from '@/services/BuilderOnboardingClient';

interface ExperienceLevelSelectorProps {
  selectedLevel: ExperienceLevel | null;
  onSelect: (level: ExperienceLevel, config: AgentConfig) => void;
  onBack?: () => void;
  detectedLevel?: ExperienceLevel;
  detectedConfidence?: number;
  detectedReasons?: string[];
  templateName?: string;
}

// Experience level configurations (mirrors uaa2-service)
const EXPERIENCE_CONFIGS: Record<ExperienceLevel, {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgGradient: string;
  borderColor: string;
  features: string[];
  autonomyLevel: number;
  questionsCount: string;
  buildTime: string;
  bestFor: string;
  tokenCost: 'high' | 'medium' | 'low';
  agentConfig: AgentConfig;
}> = {
  easy: {
    title: 'Companion Builder',
    subtitle: 'Sit back • Relax • We handle it',
    description: 'Chill while we build. Listen to music, take a tour, explore. We only interrupt when you need to make a choice.',
    icon: Sparkles,
    color: 'text-green-400',
    bgGradient: 'from-green-500/20 to-emerald-500/20',
    borderColor: 'border-green-500/50',
    features: [
      'Ambient experience with music',
      'Interactive tours while building',
      'Watch AI work in real-time',
      'Only notified for key decisions',
      'Everything handled automatically',
    ],
    autonomyLevel: 100,
    questionsCount: '5-8',
    buildTime: '5-10 min',
    tokenCost: 'high',
    bestFor: 'Non-technical founders, busy executives, hands-off building',
    agentConfig: {
      experienceLevel: 'easy',
      autonomyLevel: 1.0,
      decisionThreshold: 0.7,
      exposedCapabilities: [
        // Ambient experience
        'ambient_mode',
        'music_player',
        'interactive_tours',
        'exploration_mode',
        // Core UI IDE capabilities
        'visual_ide',
        'natural_language_input',
        'template_selection',
        'progress_visualization',
        'friendly_explanations',
        // Browser automation from uaa2-service
        'browser_automation',
        'browser_tools',
        'oauth_flow_handling',
        'payment_setup',
        // Cloud agent orchestration
        'cloud_agents',
        'automated_deployment',
        'credential_management',
        // Notification system
        'smart_notifications',
        'decision_prompts',
      ],
      hiddenCapabilities: [
        'terminal_access',
        'code_editing',
        'git_operations',
        'database_console',
        'debugging_tools',
        'raw_api_access',
      ],
      systemPromptAdditions: `You are a white-glove companion creating a relaxing build experience.
Start by getting to know the user - ask what kind of music they like and play it for them.
Let them know they can explore around, take a tour, or just watch you work.
Handle EVERYTHING automatically. Only notify them when you absolutely need a decision.
When you need input, be gentle: "Hey! Quick question when you have a sec..."
Make this feel like a premium spa experience - they relax, you handle the complexity.
Use browser automation so they can watch the magic happen.
Cloud agents do all the heavy lifting. Focus on outcomes, not process.`,
    },
  },
  medium: {
    title: 'Guided Builder',
    subtitle: 'Learn as you build • More control',
    description: 'Step-by-step guidance with explanations. You make decisions, AI assists. See the code, understand the architecture, build skills.',
    icon: Zap,
    color: 'text-blue-400',
    bgGradient: 'from-blue-500/20 to-purple-500/20',
    borderColor: 'border-blue-500/50',
    features: [
      'Interactive tutorials & walkthroughs',
      'Code with inline explanations',
      'Preview changes before applying',
      'Checkpoint save & restore',
      'Gradual tool exposure',
    ],
    autonomyLevel: 60,
    questionsCount: '8-12',
    buildTime: '10-20 min',
    tokenCost: 'medium',
    bestFor: 'Learners, hobbyists, aspiring developers',
    agentConfig: {
      experienceLevel: 'medium',
      autonomyLevel: 0.6,
      decisionThreshold: 0.85,
      exposedCapabilities: [
        // Core capabilities
        'natural_language_input',
        'template_selection',
        'code_preview',
        'file_browser',
        'basic_git',
        'environment_variables',
        // Learning-focused capabilities
        'interactive_tutorials',
        'code_annotations',
        'architecture_diagrams',
        'decision_explanations',
        'learn_mode_tips',
        // Safety & exploration
        'preview_changes',
        'checkpoint_restore',
        'sandbox_mode',
        // Gradual exposure (upgrade path to Developer)
        'terminal_preview',
        'simple_debugging',
        'api_explorer',
        // Limited browser tools for demos
        'browser_preview',
      ],
      hiddenCapabilities: [
        'full_browser_automation',
        'full_terminal_access',
        'advanced_debugging',
        'database_console',
        'advanced_deployment',
        'custom_scripts',
        'live_logs',
        'raw_api_access',
      ],
      systemPromptAdditions: `You are a knowledgeable guide helping someone learn while building.
Explain key decisions and the "why" behind choices. Show code with helpful comments.
Offer choices at important junctures. Make routine decisions automatically.
Balance teaching moments with progress - don't overwhelm.
Use interactive tutorials for complex concepts. Show architecture diagrams.
Always offer to preview changes before applying them. Create checkpoints before modifications.
Provide simple debugging explanations when errors occur. Use the API explorer for hands-on learning.
This is their opportunity to grow skills - celebrate progress and build confidence.`,
    },
  },
  experienced: {
    title: 'Developer Platform',
    subtitle: 'API-first • Full control • Usage analytics',
    description: 'Complete platform access with REST/GraphQL APIs, MCP server, webhooks, and usage dashboard. Integrate InfinityAssistant into your workflow.',
    icon: Rocket,
    color: 'text-purple-400',
    bgGradient: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/50',
    features: [
      'REST & GraphQL API access',
      'MCP server for IDE integration',
      'Usage stats & analytics dashboard',
      'Webhook event subscriptions',
      'SDK, CLI & RPC endpoints',
    ],
    autonomyLevel: 20,
    questionsCount: '3-5',
    buildTime: 'You control it',
    tokenCost: 'low',
    bestFor: 'Professional developers, technical founders, CI/CD pipelines',
    agentConfig: {
      experienceLevel: 'experienced',
      autonomyLevel: 0.2,
      decisionThreshold: 0.95,
      exposedCapabilities: [
        // Core capabilities
        'natural_language_input',
        'template_selection',
        'code_preview',
        'file_browser',
        // API & Integration
        'rest_api_access',
        'graphql_api_access',
        'mcp_server_integration',
        'rpc_endpoints',
        'webhook_subscriptions',
        'sdk_access',
        'cli_tools',
        // Platform features
        'usage_analytics',
        'usage_dashboard',
        'api_key_management',
        'rate_limit_control',
        'streaming_responses',
        'batch_operations',
        'custom_templates',
        'workspace_management',
        'deployment_automation',
        'team_collaboration',
        // Browser tools available via API
        'browser_tools_api',
      ],
      hiddenCapabilities: [],
      systemPromptAdditions: `You are assisting an experienced developer using the platform.
Be terse and technical. Skip explanations unless asked.
Provide API endpoints, MCP tool references, RPC methods, and SDK snippets.
They use their own IDE - focus on integration patterns and API usage.
Only interrupt for breaking changes or security issues.
Show usage stats when relevant. Respect their autonomy.
Focus on shipping fast with quality.`,
    },
  },
};

export default function ExperienceLevelSelector({
  selectedLevel,
  onSelect,
  onBack,
  detectedLevel,
  detectedConfidence,
  detectedReasons,
  templateName,
}: ExperienceLevelSelectorProps) {
  const [hoveredLevel, setHoveredLevel] = useState<ExperienceLevel | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const [cardsVisible, setCardsVisible] = useState(false);
  const [isProceedingNext, setIsProceedingNext] = useState(false);

  // Show detected level recommendation
  const showDetectionHint = detectedLevel && detectedConfidence && detectedConfidence > 0.6;

  // Staggered entrance animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setCardsVisible(true);
      setIsAnimating(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSelect = useCallback((level: ExperienceLevel) => {
    const config = EXPERIENCE_CONFIGS[level];
    onSelect(level, config.agentConfig);
  }, [onSelect]);

  // Keyboard navigation - Enter to proceed when level selected
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selectedLevel && !isProceedingNext) {
        setIsProceedingNext(true);
        // Visual feedback before proceeding
        setTimeout(() => {
          handleSelect(selectedLevel);
        }, 200);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLevel, isProceedingNext, handleSelect]);

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header with fade-in animation */}
      <div className={`text-center mb-8 transition-all duration-500 ${cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-4 shadow-lg shadow-purple-500/30 animate-pulse-slow">
          <Brain className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white">
          {templateName ? `Building ${templateName}` : 'Choose Your Experience Level'}
        </h2>
        <p className="text-gray-400 mt-2 max-w-xl mx-auto">
          Select how much guidance you want. More experience means more tools and freedom, less means more AI assistance.
        </p>

        {/* Detection hint with slide-in animation */}
        {showDetectionHint && (
          <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full transition-all duration-700 delay-300 ${cardsVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <HelpCircle className="w-4 h-4 text-purple-400 animate-bounce-subtle" />
            <span className="text-sm text-purple-300">
              Based on your profile, we recommend <strong className="text-purple-200">{EXPERIENCE_CONFIGS[detectedLevel].title}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Experience Level Cards with staggered entrance */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
        {(Object.keys(EXPERIENCE_CONFIGS) as ExperienceLevel[]).map((level, index) => {
          const config = EXPERIENCE_CONFIGS[level];
          const isSelected = selectedLevel === level;
          const isHovered = hoveredLevel === level;
          const isRecommended = level === detectedLevel && showDetectionHint;
          const Icon = config.icon;

          // Staggered delay for card entrance
          const animationDelay = index * 100;

          return (
            <button
              key={level}
              type="button"
              onClick={() => handleSelect(level)}
              onMouseEnter={() => setHoveredLevel(level)}
              onMouseLeave={() => setHoveredLevel(null)}
              style={{ transitionDelay: `${animationDelay}ms` }}
              className={`relative p-6 rounded-2xl border-2 text-left flex flex-col transform transition-all duration-500 ease-out ${
                cardsVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
              } ${
                isSelected
                  ? `bg-gradient-to-br ${config.bgGradient} ${config.borderColor} shadow-lg shadow-${level === 'easy' ? 'green' : level === 'medium' ? 'blue' : 'purple'}-500/20 scale-[1.02]`
                  : isHovered
                    ? `bg-gray-800/80 border-gray-600 scale-[1.01] shadow-md`
                    : 'bg-gray-800/50 border-gray-700 hover:shadow-md'
              }`}
            >
              {/* Recommended badge */}
              {isRecommended && !isSelected && (
                <div className="absolute -top-2 -right-2 px-2 py-1 bg-purple-500 text-white text-xs font-medium rounded-full">
                  Recommended
                </div>
              )}

              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                  <Check className={`w-4 h-4 ${config.color}`} />
                </div>
              )}

              {/* Icon and title */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.bgGradient} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${config.color}`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{config.title}</h3>
                  <p className="text-sm text-gray-400">{config.subtitle}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-300 mb-4">
                {config.description}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <MessageCircle className="w-3 h-3" />
                  <span>{config.questionsCount}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{config.buildTime}</span>
                </div>
                <div className={`flex items-center gap-1.5 text-xs ${
                  config.tokenCost === 'high' ? 'text-amber-400' :
                  config.tokenCost === 'medium' ? 'text-blue-400' :
                  'text-green-400'
                }`}>
                  <Zap className="w-3 h-3" />
                  <span>{config.tokenCost === 'high' ? 'Premium' : config.tokenCost === 'medium' ? 'Standard' : 'Efficient'}</span>
                </div>
              </div>

              {/* Autonomy bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>AI Autonomy</span>
                  <span>{config.autonomyLevel}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${
                      level === 'easy'
                        ? 'from-green-500 to-emerald-500'
                        : level === 'medium'
                          ? 'from-blue-500 to-purple-500'
                          : 'from-purple-500 to-pink-500'
                    } transition-all duration-500`}
                    style={{ width: `${config.autonomyLevel}%` }}
                  />
                </div>
              </div>

              {/* Features */}
              <div className="flex-1">
                <ul className="space-y-2">
                  {config.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Check className={`w-4 h-4 ${config.color} shrink-0`} />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Best for section */}
              <div className={`mt-4 p-3 rounded-lg ${config.bgGradient} bg-gradient-to-br border ${config.borderColor.replace('border-', 'border-').replace('/50', '/30')}`}>
                <p className="text-xs text-gray-400 mb-1">Best for:</p>
                <p className={`text-xs ${config.color}`}>{config.bestFor}</p>
              </div>

              {/* Select button */}
              <div className={`mt-4 py-2.5 text-center rounded-lg font-medium transition-all duration-200 ${
                isSelected
                  ? `bg-gradient-to-r ${
                      level === 'easy' ? 'from-green-500 to-emerald-500' :
                      level === 'medium' ? 'from-blue-500 to-purple-500' :
                      'from-purple-500 to-pink-500'
                    } text-white shadow-lg`
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
              }`}>
                {isSelected ? '✓ Selected' : 'Select'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Tool comparison (on hover/expanded) */}
      {hoveredLevel && (
        <div className="mt-6 max-w-5xl mx-auto w-full">
          <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              {EXPERIENCE_CONFIGS[hoveredLevel].title} - Available Tools
            </h4>
            <div className="flex flex-wrap gap-2">
              {EXPERIENCE_CONFIGS[hoveredLevel].agentConfig.exposedCapabilities.map((cap) => (
                <span
                  key={cap}
                  className={`px-2 py-1 rounded text-xs ${
                    hoveredLevel === 'easy'
                      ? 'bg-green-500/20 text-green-300'
                      : hoveredLevel === 'medium'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-purple-500/20 text-purple-300'
                  }`}
                >
                  {cap.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation with enhanced continue button */}
      <div className={`mt-8 flex justify-between items-center transition-all duration-500 delay-500 ${cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
        )}
        <div className="flex-1" />
        {selectedLevel && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              Press <kbd className="px-2 py-1 bg-gray-700 rounded text-xs font-mono">Enter</kbd>
            </span>
            <button
              type="button"
              onClick={() => {
                if (!isProceedingNext) {
                  setIsProceedingNext(true);
                  setTimeout(() => handleSelect(selectedLevel), 200);
                }
              }}
              disabled={isProceedingNext}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                isProceedingNext
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : selectedLevel === 'easy'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-lg shadow-green-500/30 hover:shadow-green-500/50'
                    : selectedLevel === 'medium'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50'
              }`}
            >
              {isProceedingNext ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
