/**
 * Demo Workspace Storage Service
 *
 * Saves workspace configurations for free users in demo mode.
 * When users upgrade, their saved workspaces can be restored
 * and built with full functionality.
 *
 * Storage structure:
 * - infinity_demo_workspaces: Array of DemoWorkspace objects
 * - Each workspace contains the full configuration needed to build later
 */

import type { DreamBoard } from '@/components/BuilderDreamBoard';
import type { ExperienceLevel, WorkspaceSpecification } from '@/services/BuilderOnboardingClient';

export interface DemoWorkspace {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'demo_complete' | 'upgraded' | 'building' | 'completed';

  // Onboarding data
  experienceLevel: ExperienceLevel;
  dreamBoard?: DreamBoard;
  workspaceSpec?: WorkspaceSpecification;

  // Template selection (if used)
  templateId?: string;
  templateName?: string;

  // User customizations
  customizations?: {
    colors?: string[];
    fonts?: string[];
    features?: string[];
    integrations?: string[];
  };

  // Demo preview data
  previewUrl?: string;
  previewScreenshots?: string[];

  // Upgrade info
  estimatedTokens?: number;
  requiredTier?: 'builder_starter' | 'builder_pro' | 'builder_enterprise';
}

const STORAGE_KEY = 'infinity_demo_workspaces';
const MAX_DEMO_WORKSPACES = 5; // Limit free users to 5 saved workspaces

export class DemoWorkspaceStorage {
  private static instance: DemoWorkspaceStorage;

  private constructor() {}

  static getInstance(): DemoWorkspaceStorage {
    if (!DemoWorkspaceStorage.instance) {
      DemoWorkspaceStorage.instance = new DemoWorkspaceStorage();
    }
    return DemoWorkspaceStorage.instance;
  }

  /**
   * Get all saved demo workspaces
   */
  getWorkspaces(): DemoWorkspace[] {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[DemoWorkspaceStorage] Failed to load workspaces:', error);
      return [];
    }
  }

  /**
   * Get a specific workspace by ID
   */
  getWorkspace(id: string): DemoWorkspace | null {
    const workspaces = this.getWorkspaces();
    return workspaces.find((w) => w.id === id) || null;
  }

  /**
   * Save a new demo workspace
   */
  saveWorkspace(workspace: Omit<DemoWorkspace, 'id' | 'createdAt' | 'updatedAt'>): DemoWorkspace {
    const workspaces = this.getWorkspaces();

    // Check limit
    if (workspaces.length >= MAX_DEMO_WORKSPACES) {
      // Remove oldest draft workspace to make room
      const draftIndex = workspaces.findIndex((w) => w.status === 'draft');
      if (draftIndex !== -1) {
        workspaces.splice(draftIndex, 1);
      } else {
        throw new Error(
          `Maximum ${MAX_DEMO_WORKSPACES} demo workspaces allowed. Please delete one to continue.`
        );
      }
    }

    const now = new Date().toISOString();
    const newWorkspace: DemoWorkspace = {
      ...workspace,
      id: `demo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };

    workspaces.unshift(newWorkspace);
    this.persistWorkspaces(workspaces);

    return newWorkspace;
  }

  /**
   * Update an existing workspace
   */
  updateWorkspace(id: string, updates: Partial<DemoWorkspace>): DemoWorkspace | null {
    const workspaces = this.getWorkspaces();
    const index = workspaces.findIndex((w) => w.id === id);

    if (index === -1) return null;

    const updated: DemoWorkspace = {
      ...workspaces[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    workspaces[index] = updated;
    this.persistWorkspaces(workspaces);

    return updated;
  }

  /**
   * Delete a workspace
   */
  deleteWorkspace(id: string): boolean {
    const workspaces = this.getWorkspaces();
    const index = workspaces.findIndex((w) => w.id === id);

    if (index === -1) return false;

    workspaces.splice(index, 1);
    this.persistWorkspaces(workspaces);

    return true;
  }

  /**
   * Create workspace from dream board completion
   */
  createFromDreamBoard(
    name: string,
    experienceLevel: ExperienceLevel,
    dreamBoard: DreamBoard,
    workspaceSpec?: WorkspaceSpecification
  ): DemoWorkspace {
    // Get description from vision items or tagline
    const visionItems = dreamBoard.items?.filter(i => i.category === 'vision') || [];
    const description = visionItems.length > 0
      ? visionItems[0].content
      : dreamBoard.tagline || 'My project';

    return this.saveWorkspace({
      name,
      description,
      status: 'demo_complete',
      experienceLevel,
      dreamBoard,
      workspaceSpec,
      estimatedTokens: this.estimateTokens(experienceLevel, dreamBoard),
      requiredTier: this.getRequiredTier(experienceLevel),
    });
  }

  /**
   * Create workspace from template selection
   */
  createFromTemplate(
    name: string,
    templateId: string,
    templateName: string,
    experienceLevel: ExperienceLevel
  ): DemoWorkspace {
    return this.saveWorkspace({
      name,
      description: `Built from ${templateName} template`,
      status: 'demo_complete',
      experienceLevel,
      templateId,
      templateName,
      estimatedTokens: this.estimateTokens(experienceLevel),
      requiredTier: this.getRequiredTier(experienceLevel),
    });
  }

  /**
   * Mark workspace as upgraded (user has subscribed)
   */
  markAsUpgraded(id: string): DemoWorkspace | null {
    return this.updateWorkspace(id, { status: 'upgraded' });
  }

  /**
   * Get count of saved workspaces
   */
  getWorkspaceCount(): number {
    return this.getWorkspaces().length;
  }

  /**
   * Check if user can save more workspaces
   */
  canSaveMore(): boolean {
    return this.getWorkspaceCount() < MAX_DEMO_WORKSPACES;
  }

  /**
   * Estimate tokens needed to build workspace
   */
  private estimateTokens(
    experienceLevel: ExperienceLevel,
    dreamBoard?: DreamBoard
  ): number {
    let baseTokens = 100;

    // Adjust based on experience level
    switch (experienceLevel) {
      case 'easy':
        baseTokens = 150; // More guidance needed
        break;
      case 'medium':
        baseTokens = 100;
        break;
      case 'experienced':
        baseTokens = 75; // Less hand-holding
        break;
    }

    // Adjust based on dream board complexity
    if (dreamBoard && dreamBoard.items) {
      const featureCount = dreamBoard.items.filter(i => i.category === 'feature').length;
      const integrationCount = dreamBoard.items.filter(i => i.category === 'integration').length;

      baseTokens += featureCount * 10;
      baseTokens += integrationCount * 15;
    }

    return baseTokens;
  }

  /**
   * Determine required tier based on experience level
   */
  private getRequiredTier(
    experienceLevel: ExperienceLevel
  ): 'builder_starter' | 'builder_pro' | 'builder_enterprise' {
    switch (experienceLevel) {
      case 'easy':
        return 'builder_starter';
      case 'medium':
        return 'builder_pro';
      case 'experienced':
        return 'builder_pro';
      default:
        return 'builder_starter';
    }
  }

  /**
   * Persist workspaces to localStorage
   */
  private persistWorkspaces(workspaces: DemoWorkspace[]): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
    } catch (error) {
      console.error('[DemoWorkspaceStorage] Failed to save workspaces:', error);
    }
  }

  /**
   * Clear all demo workspaces
   */
  clearAll(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Export workspaces for backup
   */
  exportWorkspaces(): string {
    return JSON.stringify(this.getWorkspaces(), null, 2);
  }

  /**
   * Import workspaces from backup
   */
  importWorkspaces(json: string): boolean {
    try {
      const workspaces = JSON.parse(json) as DemoWorkspace[];
      if (!Array.isArray(workspaces)) return false;

      this.persistWorkspaces(workspaces.slice(0, MAX_DEMO_WORKSPACES));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a default workspace for new users at signup
   * This gives all users a workspace to start with
   */
  createDefaultWorkspace(
    userName?: string,
    productChoice?: 'assistant' | 'builder'
  ): DemoWorkspace {
    const name = userName ? `${userName}'s Workspace` : 'My First Workspace';
    const isBuilder = productChoice === 'builder';

    return this.saveWorkspace({
      name,
      description: isBuilder
        ? 'Your project workspace - design and build amazing things!'
        : 'Your personal assistant workspace',
      status: 'draft',
      experienceLevel: 'easy',
      customizations: {
        features: isBuilder
          ? ['dashboard', 'settings', 'analytics']
          : ['chat', 'search', 'assist'],
      },
      requiredTier: 'builder_starter',
    });
  }

  /**
   * Check if user has any workspaces
   */
  hasWorkspaces(): boolean {
    return this.getWorkspaceCount() > 0;
  }

  /**
   * Ensure user has at least one workspace (create default if none)
   */
  ensureDefaultWorkspace(
    userName?: string,
    productChoice?: 'assistant' | 'builder'
  ): DemoWorkspace {
    const workspaces = this.getWorkspaces();
    if (workspaces.length > 0) {
      return workspaces[0];
    }
    return this.createDefaultWorkspace(userName, productChoice);
  }
}

// Singleton export
export const demoWorkspaceStorage = DemoWorkspaceStorage.getInstance();

// Helper function
export function getDemoWorkspaceStorage(): DemoWorkspaceStorage {
  return DemoWorkspaceStorage.getInstance();
}
