'use client';

/**
 * Builder Phase Overlay Component
 *
 * Displays a beautiful lotus growth visualization for the Builder workflow.
 * The lotus grows from seed to full bloom as the build progresses.
 *
 * Growth Stages (Lotus Metaphor):
 * - Seed: Planting the idea
 * - Roots: Establishing foundation
 * - Sprout: First growth emerges
 * - Stem: Building structure
 * - Bud: Taking shape
 * - Bloom: Coming to life
 * - Flourish: Full beauty
 * - Radiance: Complete & glowing
 *
 * Features:
 * - Clean, elegant lotus growth visualization
 * - Horizontal loading bar with stage markers
 * - Multiple choice decision points
 * - Workspace file creation tracking
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight,
  Circle,
  Loader2,
  FolderOpen,
  FileCode,
  MessageSquare,
  ArrowRight,
  X,
  Check,
  Sparkles,
} from 'lucide-react';

// Lotus growth stages
export type BuildPhase =
  | 'seed'      // Planting the idea
  | 'roots'     // Establishing foundation
  | 'sprout'    // First growth
  | 'stem'      // Building structure
  | 'bud'       // Taking shape
  | 'bloom'     // Coming to life
  | 'flourish'  // Full beauty
  | 'radiance'; // Complete & glowing

export type PhaseStatus = 'pending' | 'in_progress' | 'awaiting_input' | 'completed' | 'error';

export interface PhaseChoice {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface PhaseInfo {
  phase: BuildPhase;
  status: PhaseStatus;
  progress?: number;
  choices?: PhaseChoice[];
  selectedChoice?: string;
  error?: string;
  message?: string;
}

export interface WorkspaceFile {
  name: string;
  type: 'file' | 'folder';
  path: string;
  status: 'pending' | 'created' | 'modified';
}

export interface BuilderPhaseOverlayProps {
  projectName: string;
  projectDescription?: string;
  phases: PhaseInfo[];
  workspaceFiles: WorkspaceFile[];
  currentPhase: BuildPhase;
  overallProgress: number;
  isVisible: boolean;
  onClose?: () => void;
  onChoiceSelect?: (phase: BuildPhase, choiceId: string) => void;
  onApprove?: () => void;
  onCancel?: () => void;
}

// Lotus growth stage configuration
const PHASE_CONFIG: Record<BuildPhase, { emoji: string; title: string; description: string }> = {
  seed: {
    emoji: '🌱',
    title: 'Seed',
    description: 'Planting your idea',
  },
  roots: {
    emoji: '🌿',
    title: 'Roots',
    description: 'Establishing foundation',
  },
  sprout: {
    emoji: '🌾',
    title: 'Sprout',
    description: 'First growth emerges',
  },
  stem: {
    emoji: '🎋',
    title: 'Stem',
    description: 'Building structure',
  },
  bud: {
    emoji: '🌸',
    title: 'Bud',
    description: 'Taking shape',
  },
  bloom: {
    emoji: '🌺',
    title: 'Bloom',
    description: 'Coming to life',
  },
  flourish: {
    emoji: '🪷',
    title: 'Flourish',
    description: 'Full beauty',
  },
  radiance: {
    emoji: '✨',
    title: 'Radiance',
    description: 'Complete & glowing',
  },
};

const PHASE_ORDER: BuildPhase[] = [
  'seed',
  'roots',
  'sprout',
  'stem',
  'bud',
  'bloom',
  'flourish',
  'radiance',
];

// Color gradients for progress bar
const PHASE_COLORS: Record<BuildPhase, string> = {
  seed: '#92400e',      // amber-800
  roots: '#166534',     // green-800
  sprout: '#15803d',    // green-700
  stem: '#0d9488',      // teal-600
  bud: '#db2777',       // pink-600
  bloom: '#c026d3',     // fuchsia-600
  flourish: '#7c3aed',  // violet-600
  radiance: '#eab308',  // yellow-500
};

export default function BuilderPhaseOverlay({
  projectName,
  projectDescription,
  phases,
  workspaceFiles,
  currentPhase,
  overallProgress,
  isVisible,
  onClose,
  onChoiceSelect,
  onApprove,
  onCancel,
}: BuilderPhaseOverlayProps) {
  const [expandedPhase, setExpandedPhase] = useState<BuildPhase | null>(null);
  const [showFiles, setShowFiles] = useState(false);

  // Auto-expand current phase when awaiting input
  useEffect(() => {
    const currentInfo = phases.find(p => p.phase === currentPhase);
    if (currentInfo?.status === 'awaiting_input') {
      setExpandedPhase(currentPhase);
    }
  }, [currentPhase, phases]);

  const getPhaseStatus = useCallback(
    (phase: BuildPhase): PhaseStatus => {
      const phaseInfo = phases.find((p) => p.phase === phase);
      return phaseInfo?.status || 'pending';
    },
    [phases]
  );

  const getPhaseInfo = useCallback(
    (phase: BuildPhase): PhaseInfo | undefined => {
      return phases.find((p) => p.phase === phase);
    },
    [phases]
  );

  const getCurrentPhaseIndex = () => PHASE_ORDER.indexOf(currentPhase);

  const renderPhaseChoices = (phaseInfo: PhaseInfo) => {
    if (!phaseInfo.choices || phaseInfo.choices.length === 0) return null;

    return (
      <div className="mt-4 space-y-2">
        <p className="text-sm text-gray-400 mb-3">Choose an option to continue:</p>
        {phaseInfo.choices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => onChoiceSelect?.(phaseInfo.phase, choice.id)}
            className={`w-full p-3 rounded-lg border text-left transition-all ${
              phaseInfo.selectedChoice === choice.id
                ? 'bg-green-500/20 border-green-500 text-white'
                : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-700/50'
            } ${choice.recommended ? 'ring-1 ring-green-500/30' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{choice.label}</span>
                  {choice.recommended && (
                    <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                {choice.description && (
                  <p className="text-sm text-gray-500 mt-1">{choice.description}</p>
                )}
              </div>
              {phaseInfo.selectedChoice === choice.id && (
                <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-800 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-2xl">
                {PHASE_CONFIG[currentPhase].emoji}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{projectName}</h2>
                {projectDescription && (
                  <p className="text-sm text-gray-400 mt-0.5">{projectDescription}</p>
                )}
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Lotus Growth Progress Bar */}
        <div className="px-6 py-8 border-b border-gray-800/50">
          {/* Progress Track */}
          <div className="relative">
            {/* Background Track */}
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              {/* Gradient Progress Fill */}
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${overallProgress}%`,
                  background: `linear-gradient(90deg,
                    ${PHASE_COLORS.seed} 0%,
                    ${PHASE_COLORS.roots} 14%,
                    ${PHASE_COLORS.sprout} 28%,
                    ${PHASE_COLORS.stem} 42%,
                    ${PHASE_COLORS.bud} 56%,
                    ${PHASE_COLORS.bloom} 70%,
                    ${PHASE_COLORS.flourish} 84%,
                    ${PHASE_COLORS.radiance} 100%)`,
                }}
              />
            </div>

            {/* Phase Markers */}
            <div className="flex justify-between mt-4">
              {PHASE_ORDER.map((phase, index) => {
                const status = getPhaseStatus(phase);
                const config = PHASE_CONFIG[phase];
                const isCurrent = currentPhase === phase;
                const isComplete = status === 'completed';
                const isPending = status === 'pending';
                const isAwaiting = status === 'awaiting_input';
                const phaseProgress = (index / (PHASE_ORDER.length - 1)) * 100;
                const isPassed = overallProgress >= phaseProgress;

                return (
                  <div
                    key={phase}
                    className="flex flex-col items-center"
                    style={{ width: `${100 / PHASE_ORDER.length}%` }}
                  >
                    {/* Marker Circle */}
                    <button
                      onClick={() => setExpandedPhase(expandedPhase === phase ? null : phase)}
                      className={`
                        relative w-10 h-10 rounded-full flex items-center justify-center text-lg
                        transition-all duration-300 transform
                        ${isCurrent ? 'scale-125 ring-2 ring-offset-2 ring-offset-gray-900' : ''}
                        ${isComplete ? 'bg-green-500 ring-green-500' : ''}
                        ${isCurrent && !isComplete ? 'bg-gradient-to-br from-pink-500 to-purple-600 ring-purple-500 animate-pulse' : ''}
                        ${isAwaiting ? 'bg-amber-500 ring-amber-500' : ''}
                        ${isPending && !isCurrent ? 'bg-gray-700' : ''}
                        ${isPassed && !isComplete && !isCurrent ? 'bg-gray-600' : ''}
                        hover:scale-110 cursor-pointer
                      `}
                    >
                      {isComplete ? (
                        <Check className="w-5 h-5 text-white" />
                      ) : isCurrent && status === 'in_progress' ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : isAwaiting ? (
                        <MessageSquare className="w-4 h-4 text-white" />
                      ) : (
                        <span className={isPending ? 'opacity-50' : ''}>{config.emoji}</span>
                      )}
                    </button>

                    {/* Label */}
                    <div className="mt-2 text-center">
                      <p className={`text-xs font-medium ${
                        isCurrent ? 'text-white' :
                        isComplete ? 'text-green-400' :
                        'text-gray-500'
                      }`}>
                        {config.title}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Phase Status */}
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-full">
              {getPhaseStatus(currentPhase) === 'in_progress' && (
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              )}
              {getPhaseStatus(currentPhase) === 'awaiting_input' && (
                <Sparkles className="w-4 h-4 text-amber-400" />
              )}
              <span className="text-sm text-gray-300">
                {PHASE_CONFIG[currentPhase].description}
              </span>
              <span className="text-sm font-semibold text-white">
                {overallProgress}%
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Phase Details Column */}
            <div className="lg:col-span-2">
              {/* Current Phase Card */}
              {expandedPhase && (
                <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{PHASE_CONFIG[expandedPhase].emoji}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {PHASE_CONFIG[expandedPhase].title}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {PHASE_CONFIG[expandedPhase].description}
                      </p>
                    </div>
                  </div>

                  {/* Phase-specific content */}
                  {(() => {
                    const phaseInfo = getPhaseInfo(expandedPhase);
                    if (!phaseInfo) return null;

                    return (
                      <>
                        {phaseInfo.message && (
                          <p className="text-sm text-gray-300 mb-4 p-3 bg-gray-800/50 rounded-lg">
                            {phaseInfo.message}
                          </p>
                        )}

                        {phaseInfo.error && (
                          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-sm text-red-400">{phaseInfo.error}</p>
                          </div>
                        )}

                        {renderPhaseChoices(phaseInfo)}

                        {phaseInfo.status === 'completed' && (
                          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <Check className="w-4 h-4 text-green-400" />
                            <p className="text-sm text-green-400">Stage completed successfully</p>
                          </div>
                        )}

                        {phaseInfo.status === 'in_progress' && phaseInfo.progress !== undefined && (
                          <div className="mt-4">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span>Processing...</span>
                              <span>{phaseInfo.progress}%</span>
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                                style={{ width: `${phaseInfo.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {!expandedPhase && (
                <div className="text-center py-12 text-gray-500">
                  <p>Click on a growth stage above to see details</p>
                </div>
              )}
            </div>

            {/* Workspace Files Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                  Workspace
                </h3>
                <button
                  onClick={() => setShowFiles(!showFiles)}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  {showFiles ? 'Collapse' : 'Expand'}
                </button>
              </div>

              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <FolderOpen className="w-5 h-5 text-amber-500" />
                  <span className="text-white font-medium truncate">{projectName}</span>
                </div>

                {(showFiles || workspaceFiles.length <= 5) && (
                  <div className="space-y-2 ml-4">
                    {workspaceFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm"
                      >
                        {file.type === 'folder' ? (
                          <FolderOpen className="w-4 h-4 text-amber-500/70" />
                        ) : (
                          <FileCode className="w-4 h-4 text-blue-400/70" />
                        )}
                        <span
                          className={
                            file.status === 'created'
                              ? 'text-green-400'
                              : file.status === 'modified'
                                ? 'text-amber-400'
                                : 'text-gray-500'
                          }
                        >
                          {file.name}
                        </span>
                        {file.status === 'created' && (
                          <span className="text-xs text-green-500">+</span>
                        )}
                        {file.status === 'modified' && (
                          <span className="text-xs text-amber-500">~</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!showFiles && workspaceFiles.length > 5 && (
                  <p className="text-xs text-gray-500 ml-4">
                    +{workspaceFiles.length - 5} more files
                  </p>
                )}

                {workspaceFiles.length === 0 && (
                  <p className="text-sm text-gray-500 ml-4 italic">
                    Growing workspace...
                  </p>
                )}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white">
                    {phases.filter((p) => p.status === 'completed').length}
                  </p>
                  <p className="text-xs text-gray-500">Stages Complete</p>
                </div>
                <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white">
                    {workspaceFiles.filter((f) => f.status === 'created').length}
                  </p>
                  <p className="text-xs text-gray-500">Files Created</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Circle className="w-2 h-2 fill-purple-500 text-purple-500 animate-pulse" />
              <span>Your creation is growing...</span>
            </div>

            <div className="flex gap-3">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
              {onApprove && getPhaseStatus(currentPhase) === 'awaiting_input' && (
                <button
                  onClick={onApprove}
                  className="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-purple-500/25"
                >
                  <ArrowRight className="w-4 h-4" />
                  Continue Growing
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper function to create initial phases
 */
export function createInitialPhases(): PhaseInfo[] {
  return PHASE_ORDER.map((phase) => ({
    phase,
    status: 'pending',
    progress: 0,
  }));
}

/**
 * Helper function to calculate overall progress
 */
export function calculateOverallProgress(phases: PhaseInfo[]): number {
  const weights: Record<BuildPhase, number> = {
    seed: 10,
    roots: 10,
    sprout: 15,
    stem: 15,
    bud: 15,
    bloom: 15,
    flourish: 10,
    radiance: 10,
  };

  let completed = 0;
  let inProgress = 0;

  phases.forEach((p) => {
    if (p.status === 'completed') {
      completed += weights[p.phase];
    } else if (p.status === 'in_progress' && p.progress) {
      inProgress += (weights[p.phase] * p.progress) / 100;
    }
  });

  return Math.round(completed + inProgress);
}

/**
 * Export phase order and config for external use
 */
export { PHASE_ORDER, PHASE_CONFIG };
