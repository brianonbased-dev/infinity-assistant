'use client';

/**
 * Developer Workspace
 *
 * Main workspace component for Infinity Builder developer users.
 * Integrates orchestration, API setup, and tool configuration
 * into a unified developer experience.
 *
 * Features:
 * - 7-phase orchestration visualization
 * - API key management
 * - Tool configuration
 * - Real-time progress tracking
 * - IDE integration support
 *
 * @since 2025-12-01
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Code,
  Settings,
  Key,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  X,
  Maximize2,
  Minimize2,
  ExternalLink,
  Terminal,
  GitBranch,
  FolderOpen,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { DeveloperOrchestrationPanel } from './DeveloperOrchestrationPanel';
import { DeveloperAPISetup } from './DeveloperAPISetup';
import { DeveloperToolConfig } from './DeveloperToolConfig';
import { ideExtensionBridge, type SessionState } from '@/services/IDEExtensionBridge';

// Types
type WorkspaceView = 'orchestration' | 'api-setup' | 'tools' | 'getting-started';
type SetupStatus = 'incomplete' | 'partial' | 'complete';

interface DeveloperWorkspaceProps {
  workspaceId: string;
  workspaceType: string;
  workspaceName?: string;
  initialView?: WorkspaceView;
  onClose?: () => void;
  onBuildStart?: (sessionId: string) => void;
  onBuildComplete?: (sessionId: string) => void;
  className?: string;
}

interface SetupState {
  apiConfigured: boolean;
  toolsConfigured: boolean;
  ideConnected: boolean;
}

export function DeveloperWorkspace({
  workspaceId,
  workspaceType,
  workspaceName = 'My Workspace',
  initialView = 'getting-started',
  onClose,
  onBuildStart,
  onBuildComplete,
  className = '',
}: DeveloperWorkspaceProps) {
  const [currentView, setCurrentView] = useState<WorkspaceView>(initialView);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [setupState, setSetupState] = useState<SetupState>({
    apiConfigured: false,
    toolsConfigured: false,
    ideConnected: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check setup status
  useEffect(() => {
    checkSetupStatus();
  }, []);

  // Listen for session updates from IDE bridge
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = ideExtensionBridge.on('session:state', (msg) => {
      setSession(msg.payload);
    });

    return () => unsubscribe();
  }, [sessionId]);

  const checkSetupStatus = async () => {
    // In production, check actual configuration status
    // For now, simulate check
    setSetupState({
      apiConfigured: false,
      toolsConfigured: false,
      ideConnected: ideExtensionBridge.isConnected(),
    });
  };

  const getSetupStatus = (): SetupStatus => {
    const { apiConfigured, toolsConfigured, ideConnected } = setupState;
    if (apiConfigured && toolsConfigured) return 'complete';
    if (apiConfigured || toolsConfigured || ideConnected) return 'partial';
    return 'incomplete';
  };

  const handleAPISetupComplete = useCallback((data: any) => {
    setSetupState(prev => ({ ...prev, apiConfigured: true }));
    setCurrentView('tools');
  }, []);

  const handleToolConfigSave = useCallback((config: any) => {
    setSetupState(prev => ({ ...prev, toolsConfigured: true }));
  }, []);

  const handleStartBuild = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Create orchestration session
      const newSession = await ideExtensionBridge.createSession({
        workspaceId,
        workspaceType,
      });

      setSessionId(newSession.sessionId);
      setSession(newSession);
      setCurrentView('orchestration');
      onBuildStart?.(newSession.sessionId);
    } catch (err: any) {
      setError(err.message || 'Failed to start build');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, workspaceType, onBuildStart]);

  const handleSessionCreated = useCallback((id: string) => {
    setSessionId(id);
    onBuildStart?.(id);
  }, [onBuildStart]);

  const setupStatus = getSetupStatus();

  // Navigation items
  const navItems = [
    {
      id: 'getting-started' as WorkspaceView,
      label: 'Getting Started',
      icon: <Info className="w-4 h-4" />,
      badge: setupStatus === 'incomplete' ? '!' : undefined,
    },
    {
      id: 'orchestration' as WorkspaceView,
      label: 'Orchestration',
      icon: <Sparkles className="w-4 h-4" />,
      disabled: setupStatus === 'incomplete',
    },
    {
      id: 'api-setup' as WorkspaceView,
      label: 'API Setup',
      icon: <Key className="w-4 h-4" />,
      badge: !setupState.apiConfigured ? 'Setup' : undefined,
    },
    {
      id: 'tools' as WorkspaceView,
      label: 'Tools',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <div
      className={`flex h-full bg-[#1e1e1e] ${
        isExpanded ? 'fixed inset-0 z-50' : ''
      } ${className}`}
    >
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-56 border-r border-[#3c3c3c] bg-[#252526] flex flex-col">
          {/* Workspace Header */}
          <div className="p-4 border-b border-[#3c3c3c]">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-yellow-500" />
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-white truncate">
                  {workspaceName}
                </h2>
                <p className="text-xs text-gray-500">{workspaceType}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => !item.disabled && setCurrentView(item.id)}
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                  currentView === item.id
                    ? 'bg-blue-500/20 text-blue-400'
                    : item.disabled
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:bg-[#3c3c3c] hover:text-gray-300'
                }`}
              >
                {item.icon}
                <span className="text-sm">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Session Status */}
          {sessionId && (
            <div className="p-4 border-t border-[#3c3c3c]">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-gray-400">Session Active</span>
              </div>
              {session && (
                <div className="text-xs text-gray-500">
                  Phase: {session.currentPhase} • Cycle {session.currentCycle}
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div className="p-4 border-t border-[#3c3c3c]">
            <button
              onClick={handleStartBuild}
              disabled={loading || setupStatus === 'incomplete'}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                setupStatus === 'incomplete'
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Build
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-12 border-b border-[#3c3c3c] bg-[#252526] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded hover:bg-[#3c3c3c] text-gray-400"
            >
              {sidebarOpen ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            <span className="text-sm text-gray-300">
              {navItems.find(item => item.id === currentView)?.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded hover:bg-[#3c3c3c] text-gray-400"
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-[#3c3c3c] text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Getting Started View */}
          {currentView === 'getting-started' && (
            <GettingStartedView
              setupState={setupState}
              onNavigate={setCurrentView}
              onStartBuild={handleStartBuild}
              loading={loading}
            />
          )}

          {/* Orchestration View */}
          {currentView === 'orchestration' && (
            <DeveloperOrchestrationPanel
              sessionId={sessionId || undefined}
              workspaceId={workspaceId}
              workspaceType={workspaceType}
              onSessionCreated={handleSessionCreated}
            />
          )}

          {/* API Setup View */}
          {currentView === 'api-setup' && (
            <DeveloperAPISetup
              workspaceType={workspaceType}
              onComplete={handleAPISetupComplete}
              onSkip={() => setCurrentView('tools')}
            />
          )}

          {/* Tools View */}
          {currentView === 'tools' && (
            <DeveloperToolConfig
              workspaceId={workspaceId}
              onSave={handleToolConfigSave}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Getting Started View Component
function GettingStartedView({
  setupState,
  onNavigate,
  onStartBuild,
  loading,
}: {
  setupState: SetupState;
  onNavigate: (view: WorkspaceView) => void;
  onStartBuild: () => void;
  loading: boolean;
}) {
  const steps = [
    {
      id: 'api',
      title: 'Configure API Keys',
      description: 'Set up your API keys for AI assistance and integrations',
      icon: <Key className="w-5 h-5" />,
      action: () => onNavigate('api-setup'),
      completed: setupState.apiConfigured,
      required: true,
    },
    {
      id: 'tools',
      title: 'Configure Tools',
      description: 'Set up MCP tools and permissions for your workspace',
      icon: <Settings className="w-5 h-5" />,
      action: () => onNavigate('tools'),
      completed: setupState.toolsConfigured,
      required: false,
    },
    {
      id: 'ide',
      title: 'Connect IDE',
      description: 'Install the Infinity Builder extension in your IDE',
      icon: <Terminal className="w-5 h-5" />,
      action: () => window.open('https://marketplace.visualstudio.com', '_blank'),
      completed: setupState.ideConnected,
      required: false,
    },
  ];

  const requiredComplete = steps.filter(s => s.required).every(s => s.completed);
  const allComplete = steps.every(s => s.completed);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
          <Code className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Welcome to Infinity Builder
        </h1>
        <p className="text-gray-400">
          Let's set up your development workspace
        </p>
      </div>

      {/* Setup Steps */}
      <div className="space-y-4 mb-8">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`p-4 rounded-lg border transition-colors cursor-pointer ${
              step.completed
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-[#2a2a2a] border-[#3c3c3c] hover:border-gray-600'
            }`}
            onClick={step.action}
          >
            <div className="flex items-start gap-4">
              <div
                className={`p-2 rounded-lg ${
                  step.completed
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {step.completed ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  step.icon
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-200">{step.title}</h3>
                  {step.required && !step.completed && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{step.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </div>
          </div>
        ))}
      </div>

      {/* Start Button */}
      <div className="text-center">
        <button
          onClick={onStartBuild}
          disabled={loading || !requiredComplete}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
            requiredComplete
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Start Building
            </>
          )}
        </button>
        {!requiredComplete && (
          <p className="text-xs text-gray-500 mt-2">
            Complete the required steps above to start building
          </p>
        )}
      </div>

      {/* Quick Tips */}
      <div className="mt-12 p-4 bg-[#2a2a2a] rounded-lg border border-[#3c3c3c]">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Tips</h3>
        <ul className="space-y-2 text-sm text-gray-500">
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span>The orchestration follows 7 phases: Intake → Reflect → Execute → Compress → Grow → Re-Intake → Evolve → Autonomize</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span>Your tasks are tracked as TODOs and chained to the next agent automatically</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span>Install the VS Code extension for real-time phase visualization in your editor</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default DeveloperWorkspace;
