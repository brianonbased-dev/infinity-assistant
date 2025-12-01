/**
 * useBuilderWorkspace Hook
 *
 * React hook for managing Builder workspace state and interactions.
 * Connects the UI to the BuilderWorkspaceService.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BuilderWorkspace,
  BuildPhase,
  PhaseProgress,
  WorkspaceFile,
  calculateWorkspaceProgress,
} from '@/types/builder-workspace';
import {
  getBuilderWorkspaceService,
  WorkspaceUpdate,
} from '@/services/BuilderWorkspaceService';
import type { PhaseInfo } from '@/components/BuilderPhaseOverlay';

export interface UseBuilderWorkspaceResult {
  // State
  workspace: BuilderWorkspace | null;
  isBuilding: boolean;
  phases: PhaseInfo[];
  workspaceFiles: WorkspaceFile[];
  currentPhase: BuildPhase;
  overallProgress: number;
  error: string | null;

  // Actions
  startBuild: (name: string, request: string, description?: string) => Promise<void>;
  selectChoice: (phase: BuildPhase, choiceId: string) => Promise<void>;
  cancelBuild: () => Promise<void>;
  reset: () => void;
}

export function useBuilderWorkspace(): UseBuilderWorkspaceResult {
  const [workspace, setWorkspace] = useState<BuilderWorkspace | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const service = getBuilderWorkspaceService();

  // Convert workspace phases to PhaseInfo for the overlay
  const phases: PhaseInfo[] = workspace?.phases.map((p) => ({
    phase: p.phase,
    status: p.status === 'skipped' ? 'completed' : p.status,
    progress: p.progress,
    choices: p.choices,
    selectedChoice: p.selectedChoice,
    error: p.error,
    message: p.message,
  })) as PhaseInfo[] || [];

  const workspaceFiles: WorkspaceFile[] = workspace?.files || [];
  const currentPhase: BuildPhase = workspace?.currentPhase || 'seed';
  const overallProgress = workspace ? calculateWorkspaceProgress(workspace.phases) : 0;

  // Handle workspace updates
  const handleUpdate = useCallback((update: WorkspaceUpdate) => {
    setWorkspace({ ...update.workspace });

    if (update.type === 'status_update') {
      if (update.status === 'completed' || update.status === 'cancelled' || update.status === 'error') {
        setIsBuilding(false);
      }
    }
  }, []);

  // Start a new build
  const startBuild = useCallback(async (
    name: string,
    request: string,
    description?: string
  ) => {
    try {
      setError(null);
      setIsBuilding(true);

      // Clean up previous subscription
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      // Create new workspace
      const newWorkspace = await service.createWorkspace(name, request, description);
      setWorkspace(newWorkspace);

      // Subscribe to updates
      unsubscribeRef.current = service.subscribe(newWorkspace.id, handleUpdate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start build');
      setIsBuilding(false);
    }
  }, [service, handleUpdate]);

  // Select a choice for a phase
  const selectChoice = useCallback(async (phase: BuildPhase, choiceId: string) => {
    if (!workspace) return;

    try {
      await service.selectChoice(workspace.id, phase, choiceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select choice');
    }
  }, [workspace, service]);

  // Cancel the current build
  const cancelBuild = useCallback(async () => {
    if (!workspace) return;

    try {
      await service.cancelBuild(workspace.id);
      setIsBuilding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel build');
    }
  }, [workspace, service]);

  // Reset state
  const reset = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setWorkspace(null);
    setIsBuilding(false);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    workspace,
    isBuilding,
    phases,
    workspaceFiles,
    currentPhase,
    overallProgress,
    error,
    startBuild,
    selectChoice,
    cancelBuild,
    reset,
  };
}

export default useBuilderWorkspace;
