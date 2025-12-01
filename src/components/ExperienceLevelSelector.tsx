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
 * @since 2025-12-01
 */

import { useState, useEffect } from 'react';
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
  agentConfig: AgentConfig;
}> = {
  easy: {
    title: 'Easy Mode',
    subtitle: 'Perfect for beginners',
    description: 'Infinity Assistant handles everything. Just answer a few simple questions and watch your project come to life.',
    icon: Sparkles,
    color: 'text-green-400',
    bgGradient: 'from-green-500/20 to-emerald-500/20',
    borderColor: 'border-green-500/50',
    features: [
      'Fully guided experience',
      'Minimal decisions required',
      'AI makes smart defaults',
      'Step-by-step explanations',
      'No technical knowledge needed',
    ],
    autonomyLevel: 100,
    questionsCount: '5-8',
    buildTime: '5-10 min',
    agentConfig: {
      experienceLevel: 'easy',
      autonomyLevel: 1.0,
      decisionThreshold: 0.7,
      exposedCapabilities: [
        'natural_language_input',
        'template_selection',
        'simple_customization',
        'binary_decisions',
      ],
      hiddenCapabilities: [
        'terminal_access',
        'code_editing',
        'git_operations',
        'database_console',
        'debugging_tools',
        'environment_config',
        'advanced_deployment',
      ],
      systemPromptAdditions: `You are helping a beginner build their first project.
Be encouraging, explain everything simply, and make decisions autonomously when confidence is above 70%.
Never show code unless absolutely necessary. Focus on outcomes, not implementation details.
Use analogies and simple language. Celebrate progress.`,
    },
  },
  medium: {
    title: 'Medium Mode',
    subtitle: 'Balanced for most users',
    description: 'A balanced experience with strategic questions. Some tools exposed for those who want more control.',
    icon: Zap,
    color: 'text-blue-400',
    bgGradient: 'from-blue-500/20 to-purple-500/20',
    borderColor: 'border-blue-500/50',
    features: [
      'Balanced guidance & control',
      'Strategic decision points',
      'Preview generated code',
      'Basic customization tools',
      'Helpful explanations',
    ],
    autonomyLevel: 60,
    questionsCount: '10-15',
    buildTime: '10-20 min',
    agentConfig: {
      experienceLevel: 'medium',
      autonomyLevel: 0.6,
      decisionThreshold: 0.85,
      exposedCapabilities: [
        'natural_language_input',
        'template_selection',
        'simple_customization',
        'binary_decisions',
        'code_preview',
        'file_browser',
        'basic_git',
        'environment_variables',
      ],
      hiddenCapabilities: [
        'terminal_access',
        'advanced_debugging',
        'database_console',
        'advanced_deployment',
      ],
      systemPromptAdditions: `You are helping an intermediate user build their project.
Explain key decisions and offer choices at strategic points.
Show code previews when relevant. Ask about preferences for important decisions.
Balance guidance with user autonomy. Make routine decisions automatically.`,
    },
  },
  experienced: {
    title: 'Experienced Mode',
    subtitle: 'Full control for developers',
    description: 'Direct access to all tools. Minimal interruptions. Built for developers who know what they want.',
    icon: Rocket,
    color: 'text-purple-400',
    bgGradient: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/50',
    features: [
      'Full tool access',
      'Terminal & code editing',
      'Git operations',
      'Database console',
      'Minimal AI interruptions',
    ],
    autonomyLevel: 20,
    questionsCount: '15-25',
    buildTime: '15-30 min',
    agentConfig: {
      experienceLevel: 'experienced',
      autonomyLevel: 0.2,
      decisionThreshold: 0.95,
      exposedCapabilities: [
        'natural_language_input',
        'template_selection',
        'simple_customization',
        'binary_decisions',
        'code_preview',
        'file_browser',
        'basic_git',
        'environment_variables',
        'terminal_access',
        'code_editing',
        'advanced_git',
        'database_console',
        'debugging_tools',
        'deployment_config',
        'custom_scripts',
      ],
      hiddenCapabilities: [],
      systemPromptAdditions: `You are assisting an experienced developer.
Be concise and technical. Avoid unnecessary explanations.
Provide direct access to tools. Only interrupt for critical decisions.
Respect their expertise. Offer suggestions but don't enforce them.
Focus on efficiency and developer experience.`,
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

  // Show detected level recommendation
  const showDetectionHint = detectedLevel && detectedConfidence && detectedConfidence > 0.6;

  const handleSelect = (level: ExperienceLevel) => {
    const config = EXPERIENCE_CONFIGS[level];
    onSelect(level, config.agentConfig);
  };

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-4">
          <Brain className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white">
          {templateName ? `Building ${templateName}` : 'Choose Your Experience Level'}
        </h2>
        <p className="text-gray-400 mt-2 max-w-xl mx-auto">
          Select how much guidance you want. More experience means more tools and freedom, less means more AI assistance.
        </p>

        {/* Detection hint */}
        {showDetectionHint && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full">
            <HelpCircle className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">
              Based on your profile, we recommend <strong className="text-purple-200">{EXPERIENCE_CONFIGS[detectedLevel].title}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Experience Level Cards */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
        {(Object.keys(EXPERIENCE_CONFIGS) as ExperienceLevel[]).map((level) => {
          const config = EXPERIENCE_CONFIGS[level];
          const isSelected = selectedLevel === level;
          const isHovered = hoveredLevel === level;
          const isRecommended = level === detectedLevel && showDetectionHint;
          const Icon = config.icon;

          return (
            <button
              key={level}
              type="button"
              onClick={() => handleSelect(level)}
              onMouseEnter={() => setHoveredLevel(level)}
              onMouseLeave={() => setHoveredLevel(null)}
              className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col ${
                isSelected
                  ? `bg-gradient-to-br ${config.bgGradient} ${config.borderColor}`
                  : isHovered
                    ? `bg-gray-800/80 border-gray-600`
                    : 'bg-gray-800/50 border-gray-700'
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
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <MessageCircle className="w-3 h-3" />
                  <span>{config.questionsCount} questions</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{config.buildTime}</span>
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
                      <Check className={`w-4 h-4 ${config.color} flex-shrink-0`} />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Select button */}
              <div className={`mt-4 py-2 text-center rounded-lg transition-colors ${
                isSelected
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-700/50 text-gray-300 group-hover:bg-gray-700'
              }`}>
                {isSelected ? 'Selected' : 'Select'}
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

      {/* Navigation */}
      <div className="mt-8 flex justify-between items-center">
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
        <div className="flex-1" />
        {selectedLevel && (
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-sm">
              Press <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Enter</kbd> or click Continue
            </span>
            <ArrowRight className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
