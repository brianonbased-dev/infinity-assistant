'use client';

/**
 * Developer Orchestration Panel
 *
 * Shows the uAA2++ 7-phase protocol progress for developers using
 * Infinity Builder tools in their IDEs (VS Code, etc.).
 *
 * Features:
 * - 7-phase progress visualization
 * - TodoChain with agent assignments
 * - Real-time status updates via WebSocket/SSE
 * - IDE-native styling (dark theme)
 *
 * @since 2025-12-01
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Circle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Code,
  Search,
  Building2,
  Shield,
  Rocket,
  Sparkles,
  AlertCircle,
  Clock,
  Zap,
  Brain,
  ListTodo,
  Settings,
  ExternalLink,
} from 'lucide-react';

// Types
type AgentPhase =
  | 'INTAKE'
  | 'REFLECT'
  | 'EXECUTE'
  | 'COMPRESS'
  | 'GROW'
  | 'RE-INTAKE'
  | 'EVOLVE'
  | 'AUTONOMIZE';

type PhaseStatus = 'pending' | 'active' | 'completed' | 'error';

type AgentMindset =
  | 'builder'
  | 'developer'
  | 'researcher'
  | 'architect'
  | 'optimizer'
  | 'security'
  | 'creative'
  | 'deployer'
  | 'orchestrator';

type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
type TodoPriority = 'low' | 'normal' | 'high' | 'critical';

interface TodoItem {
  id: string;
  content: string;
  activeForm: string;
  status: TodoStatus;
  priority: TodoPriority;
  phase: AgentPhase;
  assignedAgent?: AgentMindset;
  delegatedTo?: string;
  dependencies?: string[];
  createdAt: Date;
  completedAt?: Date;
}

interface PhaseInfo {
  phase: AgentPhase;
  status: PhaseStatus;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  message?: string;
}

interface OrchestrationSession {
  sessionId: string;
  workspaceId: string;
  workspaceType: string;
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'error';
  currentPhase: AgentPhase;
  currentCycle: number;
  phases: PhaseInfo[];
  todos: TodoItem[];
  activeAgent: AgentMindset;
  metrics: {
    totalTasks: number;
    completedTasks: number;
    blockedTasks: number;
    progress: number;
  };
}

interface DeveloperOrchestrationPanelProps {
  sessionId?: string;
  workspaceId: string;
  workspaceType: string;
  onSessionCreated?: (sessionId: string) => void;
  onPhaseChange?: (phase: AgentPhase) => void;
  onTodoUpdate?: (todos: TodoItem[]) => void;
  className?: string;
  compact?: boolean;
}

// Phase configuration
const PHASE_CONFIG: Record<AgentPhase, {
  name: string;
  shortName: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}> = {
  INTAKE: {
    name: 'Intake',
    shortName: 'IN',
    icon: <Brain className="w-4 h-4" />,
    color: '#3b82f6', // blue
    description: 'Understanding the task',
  },
  REFLECT: {
    name: 'Reflect',
    shortName: 'RF',
    icon: <Search className="w-4 h-4" />,
    color: '#8b5cf6', // violet
    description: 'Analyzing approach',
  },
  EXECUTE: {
    name: 'Execute',
    shortName: 'EX',
    icon: <Code className="w-4 h-4" />,
    color: '#10b981', // emerald
    description: 'Implementing solution',
  },
  COMPRESS: {
    name: 'Compress',
    shortName: 'CP',
    icon: <Zap className="w-4 h-4" />,
    color: '#f59e0b', // amber
    description: 'Optimizing results',
  },
  GROW: {
    name: 'Grow',
    shortName: 'GR',
    icon: <Sparkles className="w-4 h-4" />,
    color: '#ec4899', // pink
    description: 'Learning patterns',
  },
  'RE-INTAKE': {
    name: 'Re-Intake',
    shortName: 'RI',
    icon: <RotateCcw className="w-4 h-4" />,
    color: '#06b6d4', // cyan
    description: 'Refining understanding',
  },
  EVOLVE: {
    name: 'Evolve',
    shortName: 'EV',
    icon: <Building2 className="w-4 h-4" />,
    color: '#6366f1', // indigo
    description: 'Enhancing capabilities',
  },
  AUTONOMIZE: {
    name: 'Autonomize',
    shortName: 'AU',
    icon: <Rocket className="w-4 h-4" />,
    color: '#22c55e', // green
    description: 'Self-directing completion',
  },
};

const PHASE_ORDER: AgentPhase[] = [
  'INTAKE',
  'REFLECT',
  'EXECUTE',
  'COMPRESS',
  'GROW',
  'RE-INTAKE',
  'EVOLVE',
  'AUTONOMIZE',
];

// Mindset configuration
const MINDSET_CONFIG: Record<AgentMindset, {
  name: string;
  icon: React.ReactNode;
  color: string;
}> = {
  builder: { name: 'Builder', icon: <Building2 className="w-3 h-3" />, color: '#f97316' },
  developer: { name: 'Developer', icon: <Code className="w-3 h-3" />, color: '#3b82f6' },
  researcher: { name: 'Researcher', icon: <Search className="w-3 h-3" />, color: '#8b5cf6' },
  architect: { name: 'Architect', icon: <Building2 className="w-3 h-3" />, color: '#6366f1' },
  optimizer: { name: 'Optimizer', icon: <Zap className="w-3 h-3" />, color: '#eab308' },
  security: { name: 'Security', icon: <Shield className="w-3 h-3" />, color: '#ef4444' },
  creative: { name: 'Creative', icon: <Sparkles className="w-3 h-3" />, color: '#ec4899' },
  deployer: { name: 'Deployer', icon: <Rocket className="w-3 h-3" />, color: '#22c55e' },
  orchestrator: { name: 'Orchestrator', icon: <Brain className="w-3 h-3" />, color: '#06b6d4' },
};

export function DeveloperOrchestrationPanel({
  sessionId: initialSessionId,
  workspaceId,
  workspaceType,
  onSessionCreated,
  onPhaseChange,
  onTodoUpdate,
  className = '',
  compact = false,
}: DeveloperOrchestrationPanelProps) {
  const [session, setSession] = useState<OrchestrationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    phases: true,
    todos: true,
  });

  // Initialize session
  useEffect(() => {
    initializeSession();
  }, [initialSessionId, workspaceId, workspaceType]);

  // Poll for updates when active
  useEffect(() => {
    if (!session?.sessionId || session.status !== 'active') return;

    const interval = setInterval(() => {
      fetchSessionState(session.sessionId);
    }, 2000);

    return () => clearInterval(interval);
  }, [session?.sessionId, session?.status]);

  const initializeSession = async () => {
    setLoading(true);
    setError(null);

    try {
      if (initialSessionId) {
        await fetchSessionState(initialSessionId);
      } else {
        await createSession();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize session');
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    // In production, this calls the API
    // For now, simulate with mock data
    const mindset = getDefaultMindset(workspaceType);

    const mockSession: OrchestrationSession = {
      sessionId: `dev_session_${Date.now()}`,
      workspaceId,
      workspaceType,
      status: 'active',
      currentPhase: 'INTAKE',
      currentCycle: 0,
      phases: PHASE_ORDER.map((phase, index) => ({
        phase,
        status: index === 0 ? 'active' : 'pending',
        progress: index === 0 ? 15 : 0,
      })),
      todos: [],
      activeAgent: mindset,
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        blockedTasks: 0,
        progress: 0,
      },
    };

    setSession(mockSession);
    onSessionCreated?.(mockSession.sessionId);
  };

  const fetchSessionState = async (sessionId: string) => {
    // In production, call GET /api/developer/orchestration?sessionId=xxx
    // For now, simulate progress
    if (!session) return;

    // Simulate phase progression
    const currentIndex = PHASE_ORDER.indexOf(session.currentPhase);
    const currentPhaseInfo = session.phases[currentIndex];

    if (currentPhaseInfo.progress < 100) {
      // Progress within current phase
      setSession(prev => {
        if (!prev) return null;
        const newPhases = [...prev.phases];
        newPhases[currentIndex] = {
          ...newPhases[currentIndex],
          progress: Math.min(100, newPhases[currentIndex].progress + Math.random() * 15),
        };
        return { ...prev, phases: newPhases };
      });
    } else if (currentIndex < PHASE_ORDER.length - 1) {
      // Move to next phase
      const nextPhase = PHASE_ORDER[currentIndex + 1];
      setSession(prev => {
        if (!prev) return null;
        const newPhases = [...prev.phases];
        newPhases[currentIndex] = { ...newPhases[currentIndex], status: 'completed', progress: 100 };
        newPhases[currentIndex + 1] = { ...newPhases[currentIndex + 1], status: 'active', progress: 10 };
        return {
          ...prev,
          currentPhase: nextPhase,
          phases: newPhases,
        };
      });
      onPhaseChange?.(nextPhase);
    }
  };

  const getDefaultMindset = (type: string): AgentMindset => {
    const typeMap: Record<string, AgentMindset> = {
      'api-development': 'developer',
      'app-builder': 'builder',
      'research': 'researcher',
      'code-review': 'developer',
      'deployment': 'deployer',
      'security-audit': 'security',
      'optimization': 'optimizer',
      'design': 'creative',
    };
    return typeMap[type] || 'developer';
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const calculateOverallProgress = (): number => {
    if (!session) return 0;
    const totalPhases = session.phases.length;
    const completedWeight = session.phases.filter(p => p.status === 'completed').length;
    const activePhase = session.phases.find(p => p.status === 'active');
    const activeWeight = activePhase ? (activePhase.progress / 100) : 0;
    return Math.round(((completedWeight + activeWeight) / totalPhases) * 100);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-6 bg-[#1e1e1e] text-gray-400 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Initializing orchestration...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-[#1e1e1e] border border-red-500/30 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={initializeSession}
          className="mt-2 text-xs text-blue-400 hover:text-blue-300"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!session) return null;

  const overallProgress = calculateOverallProgress();
  const activePhaseConfig = PHASE_CONFIG[session.currentPhase];
  const activeMindsetConfig = MINDSET_CONFIG[session.activeAgent];

  // Compact view for IDE sidebar
  if (compact) {
    return (
      <div className={`bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg overflow-hidden ${className}`}>
        {/* Header */}
        <div className="px-3 py-2 border-b border-[#3c3c3c] bg-[#252526]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: activePhaseConfig.color }}
              />
              <span className="text-xs font-medium text-gray-300">
                {activePhaseConfig.shortName}
              </span>
            </div>
            <span className="text-xs text-gray-500">{overallProgress}%</span>
          </div>
          {/* Mini progress bar */}
          <div className="mt-1 h-1 bg-[#3c3c3c] rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${overallProgress}%`,
                backgroundColor: activePhaseConfig.color,
              }}
            />
          </div>
        </div>

        {/* Active todos */}
        <div className="px-3 py-2 max-h-32 overflow-y-auto">
          {session.todos.filter(t => t.status === 'in_progress').slice(0, 3).map(todo => (
            <div key={todo.id} className="flex items-center gap-2 py-1 text-xs">
              <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
              <span className="text-gray-400 truncate">{todo.activeForm}</span>
            </div>
          ))}
          {session.todos.filter(t => t.status === 'in_progress').length === 0 && (
            <div className="text-xs text-gray-500 italic">
              {activePhaseConfig.description}...
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full panel view
  return (
    <div className={`bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#3c3c3c] bg-[#252526]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${activePhaseConfig.color}20` }}
            >
              <span style={{ color: activePhaseConfig.color }}>
                {activePhaseConfig.icon}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-200">
                Developer Orchestration
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{workspaceType}</span>
                <span>•</span>
                <span className="flex items-center gap-1" style={{ color: activeMindsetConfig.color }}>
                  {activeMindsetConfig.icon}
                  {activeMindsetConfig.name}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-200">{overallProgress}%</span>
            <button className="p-1.5 rounded hover:bg-[#3c3c3c] text-gray-400">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Phase Progress */}
      <div className="border-b border-[#3c3c3c]">
        <button
          onClick={() => toggleSection('phases')}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-[#2a2a2a]"
        >
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Phases
          </span>
          {expandedSections.phases ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>

        {expandedSections.phases && (
          <div className="px-4 pb-3">
            {/* Phase timeline */}
            <div className="flex items-center gap-1">
              {session.phases.map((phaseInfo, index) => {
                const config = PHASE_CONFIG[phaseInfo.phase];
                const isActive = phaseInfo.status === 'active';
                const isCompleted = phaseInfo.status === 'completed';

                return (
                  <div
                    key={phaseInfo.phase}
                    className="flex-1 group relative"
                    title={`${config.name}: ${config.description}`}
                  >
                    {/* Progress bar segment */}
                    <div
                      className="h-2 rounded-sm overflow-hidden"
                      style={{ backgroundColor: '#3c3c3c' }}
                    >
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${phaseInfo.progress}%`,
                          backgroundColor: config.color,
                          opacity: isCompleted ? 1 : isActive ? 0.8 : 0.3,
                        }}
                      />
                    </div>

                    {/* Phase indicator */}
                    <div className="mt-1 flex justify-center">
                      {isCompleted ? (
                        <CheckCircle2
                          className="w-3 h-3"
                          style={{ color: config.color }}
                        />
                      ) : isActive ? (
                        <Loader2
                          className="w-3 h-3 animate-spin"
                          style={{ color: config.color }}
                        />
                      ) : (
                        <Circle className="w-3 h-3 text-gray-600" />
                      )}
                    </div>

                    {/* Label on hover */}
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] text-gray-500 whitespace-nowrap">
                        {config.shortName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current phase info */}
            <div className="mt-4 p-2 bg-[#2a2a2a] rounded-lg">
              <div className="flex items-center gap-2">
                <span style={{ color: activePhaseConfig.color }}>
                  {activePhaseConfig.icon}
                </span>
                <span className="text-sm font-medium text-gray-300">
                  {activePhaseConfig.name}
                </span>
                <span className="text-xs text-gray-500">
                  Cycle {session.currentCycle}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {activePhaseConfig.description}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Todos */}
      <div>
        <button
          onClick={() => toggleSection('todos')}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-[#2a2a2a]"
        >
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Tasks
            </span>
            <span className="text-xs text-gray-600">
              ({session.metrics.completedTasks}/{session.metrics.totalTasks})
            </span>
          </div>
          {expandedSections.todos ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>

        {expandedSections.todos && (
          <div className="px-4 pb-3 max-h-48 overflow-y-auto">
            {session.todos.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-500">
                Tasks will appear as the agent works...
              </div>
            ) : (
              <div className="space-y-1">
                {session.todos.map(todo => (
                  <TodoListItem key={todo.id} todo={todo} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[#3c3c3c] bg-[#252526]">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Session: {session.sessionId.slice(-8)}</span>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                session.status === 'active' ? 'bg-green-400 animate-pulse' :
                session.status === 'paused' ? 'bg-yellow-400' :
                'bg-gray-400'
              }`}
            />
            <span className="capitalize">{session.status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Todo List Item Component
function TodoListItem({ todo }: { todo: TodoItem }) {
  const statusConfig = {
    pending: { icon: <Circle className="w-3 h-3" />, color: 'text-gray-500' },
    in_progress: { icon: <Loader2 className="w-3 h-3 animate-spin" />, color: 'text-blue-400' },
    completed: { icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-400' },
    blocked: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-red-400' },
  };

  const priorityConfig = {
    low: 'border-l-gray-600',
    normal: 'border-l-blue-500',
    high: 'border-l-yellow-500',
    critical: 'border-l-red-500',
  };

  const config = statusConfig[todo.status];
  const phaseConfig = PHASE_CONFIG[todo.phase];

  return (
    <div
      className={`flex items-start gap-2 p-2 bg-[#2a2a2a] rounded border-l-2 ${priorityConfig[todo.priority]}`}
    >
      <span className={`mt-0.5 ${config.color}`}>{config.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs ${todo.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
          {todo.status === 'in_progress' ? todo.activeForm : todo.content}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-[10px] px-1 rounded"
            style={{
              backgroundColor: `${phaseConfig.color}20`,
              color: phaseConfig.color,
            }}
          >
            {phaseConfig.shortName}
          </span>
          {todo.assignedAgent && (
            <span className="text-[10px] text-gray-600">
              {MINDSET_CONFIG[todo.assignedAgent]?.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeveloperOrchestrationPanel;
