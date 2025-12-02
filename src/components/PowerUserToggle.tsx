'use client';

/**
 * Power User Toggle Component
 *
 * Allows experienced users to toggle power mode for advanced features:
 * - Keyboard shortcuts
 * - Dense layout
 * - Command palette
 * - Advanced settings
 *
 * Progressive disclosure:
 * - Only shown after user reaches intermediate level
 * - Or after using the app for 3+ sessions
 *
 * @since 2025-12-02
 */

import { useState, useCallback } from 'react';
import {
  Zap,
  Settings,
  Keyboard,
  Layout,
  Terminal,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { useDeviceExperience } from '@/hooks/useDeviceExperience';

// ============================================================================
// TYPES
// ============================================================================

interface PowerUserToggleProps {
  className?: string;
  compact?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PowerUserToggle({ className = '', compact = false }: PowerUserToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    isPowerUser,
    isBeginner,
    experience,
    adaptiveUI,
    togglePowerMode,
    shouldShowFeature,
  } = useDeviceExperience();

  // Don't show for absolute beginners (less than 3 sessions)
  if (isBeginner && experience.sessionsCompleted < 3) {
    return null;
  }

  const handleToggle = useCallback(() => {
    togglePowerMode();
  }, [togglePowerMode]);

  // Compact mode - just a toggle button
  if (compact) {
    return (
      <button
        onClick={handleToggle}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
          isPowerUser
            ? 'bg-purple-600 text-white'
            : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
        } ${className}`}
        title={isPowerUser ? 'Disable power mode' : 'Enable power mode'}
      >
        <Zap className={`w-4 h-4 ${isPowerUser ? 'fill-current' : ''}`} />
        {!compact && <span className="text-sm font-medium">Power Mode</span>}
      </button>
    );
  }

  // Full mode with dropdown
  return (
    <div className={`relative ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
          isPowerUser
            ? 'bg-purple-600/20 border border-purple-500/50 text-purple-300'
            : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
        }`}
      >
        <Zap className={`w-4 h-4 ${isPowerUser ? 'text-purple-400 fill-current' : ''}`} />
        <span className="text-sm font-medium">Power Mode</span>
        {isPowerUser && <Check className="w-4 h-4 text-green-400" />}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 ml-1" />
        ) : (
          <ChevronDown className="w-4 h-4 ml-1" />
        )}
      </button>

      {/* Dropdown Panel */}
      {isExpanded && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Power User Mode</h3>
              <button
                onClick={handleToggle}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isPowerUser ? 'bg-purple-600' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    isPowerUser ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {isPowerUser
                ? 'Advanced features enabled'
                : 'Enable for keyboard shortcuts & more'}
            </p>
          </div>

          {/* Features List */}
          <div className="p-3 space-y-2">
            <FeatureItem
              icon={<Keyboard className="w-4 h-4" />}
              label="Keyboard Shortcuts"
              description="Cmd/Ctrl+K for command palette"
              enabled={adaptiveUI.showKeyboardShortcuts}
            />
            <FeatureItem
              icon={<Layout className="w-4 h-4" />}
              label="Dense Layout"
              description="More information on screen"
              enabled={adaptiveUI.enableDenseLayout}
            />
            <FeatureItem
              icon={<Terminal className="w-4 h-4" />}
              label="Command Palette"
              description="Quick access to all actions"
              enabled={shouldShowFeature('command_palette')}
            />
            <FeatureItem
              icon={<Settings className="w-4 h-4" />}
              label="Advanced Settings"
              description="API integration & custom workflows"
              enabled={shouldShowFeature('api_integration')}
            />
          </div>

          {/* Stats */}
          <div className="px-4 py-3 bg-gray-800/50 border-t border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Sessions: {experience.sessionsCompleted}</span>
              <span>Features used: {experience.featuresUsed.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FEATURE ITEM COMPONENT
// ============================================================================

interface FeatureItemProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
}

function FeatureItem({ icon, label, description, enabled }: FeatureItemProps) {
  return (
    <div
      className={`flex items-start gap-3 p-2 rounded-lg ${
        enabled ? 'bg-purple-500/10' : 'bg-gray-800/50 opacity-60'
      }`}
    >
      <div
        className={`mt-0.5 ${
          enabled ? 'text-purple-400' : 'text-gray-500'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${
              enabled ? 'text-white' : 'text-gray-400'
            }`}
          >
            {label}
          </span>
          {enabled && <Check className="w-3 h-3 text-green-400" />}
        </div>
        <p className="text-xs text-gray-500 truncate">{description}</p>
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { PowerUserToggle };
