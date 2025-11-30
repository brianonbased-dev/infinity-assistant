/**
 * Project Persistence Service
 *
 * Handles project storage, versioning, branching, and collaboration.
 * Supports multiple storage backends (local, S3, Supabase).
 */

import { createHash } from 'crypto';
import type {
  Project,
  ProjectFile,
  ProjectDirectory,
  ProjectVersion,
  ProjectSnapshot,
  FileSnapshot,
  ProjectBranch,
  BranchMerge,
  MergeConflict,
  FileChange,
  FileDiff,
  DiffHunk,
  DiffLine,
  Collaborator,
  CollaboratorRole,
  CollaboratorPermissions,
  BuildContext,
  ProjectSettings,
  ProjectAnalytics,
  StorageProvider,
  StoredProject,
  ProjectExport,
  ProjectImport,
  ImportOptions,
  ProjectTemplate,
  ProjectEvent,
  ProjectEventHandler,
  ProjectStatus,
  ProjectType,
  TechStack,
  DirectoryStructure,
  DirectoryNode,
} from '../types/project-persistence';

// =============================================================================
// STORAGE ADAPTER INTERFACE
// =============================================================================

interface StorageAdapter {
  save(path: string, content: string): Promise<void>;
  load(path: string): Promise<string>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
  getMetadata(path: string): Promise<{ size: number; modified: string }>;
}

// =============================================================================
// LOCAL STORAGE ADAPTER
// =============================================================================

class LocalStorageAdapter implements StorageAdapter {
  private storage: Map<string, { content: string; modified: string }> = new Map();

  async save(path: string, content: string): Promise<void> {
    this.storage.set(path, {
      content,
      modified: new Date().toISOString(),
    });
  }

  async load(path: string): Promise<string> {
    const item = this.storage.get(path);
    if (!item) {
      throw new Error(`File not found: ${path}`);
    }
    return item.content;
  }

  async delete(path: string): Promise<void> {
    this.storage.delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.storage.has(path);
  }

  async list(prefix: string): Promise<string[]> {
    return Array.from(this.storage.keys()).filter((key) => key.startsWith(prefix));
  }

  async getMetadata(path: string): Promise<{ size: number; modified: string }> {
    const item = this.storage.get(path);
    if (!item) {
      throw new Error(`File not found: ${path}`);
    }
    return {
      size: new TextEncoder().encode(item.content).length,
      modified: item.modified,
    };
  }
}

// =============================================================================
// SUPABASE STORAGE ADAPTER
// =============================================================================

class SupabaseStorageAdapter implements StorageAdapter {
  private supabaseUrl: string;
  private supabaseKey: string;
  private bucket: string;

  constructor(url: string, key: string, bucket: string = 'projects') {
    this.supabaseUrl = url;
    this.supabaseKey = key;
    this.bucket = bucket;
  }

  async save(path: string, content: string): Promise<void> {
    const response = await fetch(
      `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/octet-stream',
        },
        body: content,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to save file: ${response.statusText}`);
    }
  }

  async load(path: string): Promise<string> {
    const response = await fetch(
      `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${path}`,
      {
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.statusText}`);
    }

    return response.text();
  }

  async delete(path: string): Promise<void> {
    const response = await fetch(
      `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${path}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/storage/v1/object/info/${this.bucket}/${path}`,
        {
          headers: {
            Authorization: `Bearer ${this.supabaseKey}`,
          },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const response = await fetch(
      `${this.supabaseUrl}/storage/v1/object/list/${this.bucket}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefix }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const data = await response.json();
    return data.map((item: { name: string }) => `${prefix}${item.name}`);
  }

  async getMetadata(path: string): Promise<{ size: number; modified: string }> {
    const response = await fetch(
      `${this.supabaseUrl}/storage/v1/object/info/${this.bucket}/${path}`,
      {
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get metadata: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      size: data.size,
      modified: data.updated_at,
    };
  }
}

// =============================================================================
// PROJECT PERSISTENCE SERVICE
// =============================================================================

export class ProjectPersistenceService {
  private static instance: ProjectPersistenceService;
  private storage: StorageAdapter;
  private projects: Map<string, Project> = new Map();
  private eventHandlers: Set<ProjectEventHandler> = new Set();
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor(storageProvider?: StorageProvider) {
    if (storageProvider?.type === 'supabase') {
      this.storage = new SupabaseStorageAdapter(
        storageProvider.credentials?.endpoint || '',
        storageProvider.credentials?.accessKey || '',
        storageProvider.bucket
      );
    } else {
      this.storage = new LocalStorageAdapter();
    }
  }

  static getInstance(storageProvider?: StorageProvider): ProjectPersistenceService {
    if (!ProjectPersistenceService.instance) {
      ProjectPersistenceService.instance = new ProjectPersistenceService(storageProvider);
    }
    return ProjectPersistenceService.instance;
  }

  // ===========================================================================
  // PROJECT CRUD OPERATIONS
  // ===========================================================================

  async createProject(params: {
    userId: string;
    workspaceId: string;
    name: string;
    description: string;
    type: ProjectType;
    techStack: TechStack;
    template?: ProjectTemplate;
  }): Promise<Project> {
    const projectId = this.generateId();
    const now = new Date().toISOString();

    const defaultSettings: ProjectSettings = {
      autoSave: true,
      autoSaveInterval: 30,
      autoValidate: true,
      autoFormat: true,
      strictMode: false,
      preferredPersona: 'assistant',
      knowledgeLevel: 'intermediate',
      explainDecisions: true,
      notifyOnBuild: true,
      notifyOnDeploy: true,
      notifyOnError: true,
    };

    const defaultAnalytics: ProjectAnalytics = {
      totalFiles: 0,
      totalLines: 0,
      totalSize: 0,
      totalVersions: 0,
      totalEdits: 0,
      averageSessionDuration: 0,
      totalBuilds: 0,
      successfulBuilds: 0,
      failedBuilds: 0,
      averageBuildTime: 0,
      lintErrors: 0,
      typeErrors: 0,
      aiGeneratedLines: 0,
      aiSuggestionAcceptRate: 0,
      knowledgePacketsUsed: 0,
      totalBuildTime: 0,
      timeByPhase: {},
    };

    const defaultBuildContext: BuildContext = {
      originalPrompt: '',
      refinedRequirements: [],
      architectureDecisions: [],
      currentPhase: 'setup',
      phaseHistory: [],
      knowledgePackets: [],
      appliedPatterns: [],
      avoidedGotchas: [],
      conversationSummary: '',
      keyDecisions: [],
    };

    const mainBranch: ProjectBranch = {
      id: this.generateId(),
      name: 'main',
      projectId,
      baseVersion: '0.0.0',
      currentVersion: '0.1.0',
      isDefault: true,
      isProtected: true,
      status: 'active',
      createdAt: now,
      createdBy: params.userId,
      lastCommit: now,
    };

    const project: Project = {
      id: projectId,
      userId: params.userId,
      workspaceId: params.workspaceId,
      name: params.name,
      description: params.description,
      type: params.type,
      status: 'draft',
      techStack: params.techStack,
      framework: this.getDefaultFramework(params.techStack),
      rootPath: `/projects/${projectId}`,
      files: [],
      directories: [],
      currentVersion: '0.1.0',
      versions: [],
      branches: [mainBranch],
      currentBranch: 'main',
      collaborators: [
        {
          userId: params.userId,
          email: '',
          name: 'Owner',
          role: 'owner',
          permissions: this.getPermissionsForRole('owner'),
          addedAt: now,
          addedBy: params.userId,
        },
      ],
      permissions: {
        isPublic: false,
        allowForks: false,
        allowComments: true,
        requireReview: false,
        protectedBranches: ['main'],
      },
      buildContext: defaultBuildContext,
      conversationHistory: [],
      createdAt: now,
      updatedAt: now,
      settings: defaultSettings,
      integrations: [],
      analytics: defaultAnalytics,
    };

    // Apply template if provided
    if (params.template) {
      project.files = await this.applyTemplate(project, params.template);
    }

    // Save project
    await this.saveProject(project);
    this.projects.set(projectId, project);

    // Create initial version
    await this.createVersion(projectId, {
      summary: 'Initial project creation',
      createdBy: params.userId,
    });

    // Start auto-save if enabled
    if (project.settings.autoSave) {
      this.startAutoSave(projectId);
    }

    this.emit({ type: 'project_created', data: project });

    return project;
  }

  async getProject(projectId: string): Promise<Project | null> {
    // Check cache first
    if (this.projects.has(projectId)) {
      return this.projects.get(projectId)!;
    }

    // Load from storage
    try {
      const projectPath = this.getProjectPath(projectId);
      const content = await this.storage.load(`${projectPath}/project.json`);
      const project = JSON.parse(content) as Project;
      this.projects.set(projectId, project);
      return project;
    } catch {
      return null;
    }
  }

  async updateProject(
    projectId: string,
    updates: Partial<Project>
  ): Promise<Project> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const updatedProject: Project = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.saveProject(updatedProject);
    this.projects.set(projectId, updatedProject);

    this.emit({ type: 'project_updated', data: updates });

    return updatedProject;
  }

  async deleteProject(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Stop auto-save
    this.stopAutoSave(projectId);

    // Delete all project files from storage
    const projectPath = this.getProjectPath(projectId);
    const files = await this.storage.list(projectPath);
    await Promise.all(files.map((file) => this.storage.delete(file)));

    // Remove from cache
    this.projects.delete(projectId);

    this.emit({ type: 'project_deleted', data: { projectId } });
  }

  async listProjects(userId: string, workspaceId?: string): Promise<Project[]> {
    const projects: Project[] = [];

    // Load all projects for user
    const projectPaths = await this.storage.list('projects/');
    for (const path of projectPaths) {
      if (path.endsWith('/project.json')) {
        try {
          const content = await this.storage.load(path);
          const project = JSON.parse(content) as Project;
          if (
            project.userId === userId &&
            (!workspaceId || project.workspaceId === workspaceId)
          ) {
            projects.push(project);
          }
        } catch {
          // Skip invalid projects
        }
      }
    }

    return projects.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  // ===========================================================================
  // FILE OPERATIONS
  // ===========================================================================

  async createFile(
    projectId: string,
    params: {
      path: string;
      content: string;
      language?: string;
      aiGenerated?: boolean;
      generationPrompt?: string;
    }
  ): Promise<ProjectFile> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const fileId = this.generateId();
    const now = new Date().toISOString();
    const pathParts = params.path.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const extension = fileName.includes('.') ? fileName.split('.').pop() || '' : '';

    const file: ProjectFile = {
      id: fileId,
      path: params.path,
      name: fileName,
      extension,
      content: params.content,
      size: new TextEncoder().encode(params.content).length,
      hash: this.hashContent(params.content),
      version: 1,
      lastModified: now,
      modifiedBy: project.userId,
      language: params.language || this.detectLanguage(extension),
      generated: false,
      locked: false,
      aiGenerated: params.aiGenerated,
      generationPrompt: params.generationPrompt,
    };

    // Update project
    project.files.push(file);
    project.analytics.totalFiles++;
    project.analytics.totalLines += params.content.split('\n').length;
    project.analytics.totalSize += file.size;

    if (params.aiGenerated) {
      project.analytics.aiGeneratedLines += params.content.split('\n').length;
    }

    // Ensure directory structure
    await this.ensureDirectoryStructure(project, params.path);

    await this.saveProject(project);

    // Save file content separately for large files
    await this.storage.save(
      `${this.getProjectPath(projectId)}/files/${file.id}`,
      params.content
    );

    this.emit({ type: 'file_created', data: file });

    return file;
  }

  async updateFile(
    projectId: string,
    fileId: string,
    params: {
      content?: string;
      locked?: boolean;
    }
  ): Promise<ProjectFile> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const fileIndex = project.files.findIndex((f) => f.id === fileId);
    if (fileIndex === -1) {
      throw new Error(`File not found: ${fileId}`);
    }

    const file = project.files[fileIndex];
    const now = new Date().toISOString();

    if (params.content !== undefined) {
      const oldLines = file.content.split('\n').length;
      const newLines = params.content.split('\n').length;
      const oldSize = file.size;
      const newSize = new TextEncoder().encode(params.content).length;

      file.content = params.content;
      file.size = newSize;
      file.hash = this.hashContent(params.content);
      file.version++;
      file.lastModified = now;
      file.modifiedBy = project.userId;

      // Update analytics
      project.analytics.totalLines += newLines - oldLines;
      project.analytics.totalSize += newSize - oldSize;
      project.analytics.totalEdits++;
    }

    if (params.locked !== undefined) {
      file.locked = params.locked;
    }

    project.files[fileIndex] = file;
    await this.saveProject(project);

    // Update file content in storage
    await this.storage.save(
      `${this.getProjectPath(projectId)}/files/${file.id}`,
      file.content
    );

    this.emit({ type: 'file_updated', data: { fileId, changes: params } });

    return file;
  }

  async deleteFile(projectId: string, fileId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const fileIndex = project.files.findIndex((f) => f.id === fileId);
    if (fileIndex === -1) {
      throw new Error(`File not found: ${fileId}`);
    }

    const file = project.files[fileIndex];

    // Update analytics
    project.analytics.totalFiles--;
    project.analytics.totalLines -= file.content.split('\n').length;
    project.analytics.totalSize -= file.size;

    // Remove file
    project.files.splice(fileIndex, 1);
    await this.saveProject(project);

    // Delete from storage
    await this.storage.delete(`${this.getProjectPath(projectId)}/files/${fileId}`);

    this.emit({ type: 'file_deleted', data: { fileId } });
  }

  async getFile(projectId: string, fileId: string): Promise<ProjectFile | null> {
    const project = await this.getProject(projectId);
    if (!project) {
      return null;
    }
    return project.files.find((f) => f.id === fileId) || null;
  }

  async getFileByPath(projectId: string, path: string): Promise<ProjectFile | null> {
    const project = await this.getProject(projectId);
    if (!project) {
      return null;
    }
    return project.files.find((f) => f.path === path) || null;
  }

  // ===========================================================================
  // VERSION CONTROL
  // ===========================================================================

  async createVersion(
    projectId: string,
    params: {
      summary: string;
      createdBy: string;
      tags?: string[];
      isRelease?: boolean;
      releaseNotes?: string;
      checkpointId?: string;
    }
  ): Promise<ProjectVersion> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const versionId = this.generateId();
    const now = new Date().toISOString();

    // Calculate next version
    const newVersion = this.incrementVersion(project.currentVersion);

    // Create snapshot
    const snapshot = await this.createSnapshot(project);

    // Calculate changes from previous version
    const changes = await this.calculateChanges(project);

    const version: ProjectVersion = {
      id: versionId,
      version: newVersion,
      projectId,
      snapshot,
      changes,
      summary: params.summary,
      createdAt: now,
      createdBy: params.createdBy,
      buildPhase: project.buildContext.currentPhase,
      checkpointId: params.checkpointId,
      tags: params.tags || [],
      isRelease: params.isRelease || false,
      releaseNotes: params.releaseNotes,
    };

    // Save version
    await this.storage.save(
      `${this.getProjectPath(projectId)}/versions/${versionId}.json`,
      JSON.stringify(version)
    );

    // Update project
    project.versions.push(version);
    project.currentVersion = newVersion;
    project.analytics.totalVersions++;

    await this.saveProject(project);

    this.emit({ type: 'version_created', data: version });

    return version;
  }

  async getVersion(projectId: string, versionId: string): Promise<ProjectVersion | null> {
    try {
      const content = await this.storage.load(
        `${this.getProjectPath(projectId)}/versions/${versionId}.json`
      );
      return JSON.parse(content) as ProjectVersion;
    } catch {
      return null;
    }
  }

  async listVersions(projectId: string): Promise<ProjectVersion[]> {
    const project = await this.getProject(projectId);
    if (!project) {
      return [];
    }
    return project.versions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async revertToVersion(projectId: string, versionId: string): Promise<Project> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const version = await this.getVersion(projectId, versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    // Create a backup version first
    await this.createVersion(projectId, {
      summary: `Backup before revert to ${version.version}`,
      createdBy: project.userId,
      tags: ['backup', 'pre-revert'],
    });

    // Restore files from snapshot
    project.files = Object.entries(version.snapshot.files).map(([path, snap]) => {
      const pathParts = path.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const extension = fileName.includes('.') ? fileName.split('.').pop() || '' : '';

      return {
        id: this.generateId(),
        path,
        name: fileName,
        extension,
        content: snap.content,
        size: snap.size,
        hash: snap.hash,
        version: 1,
        lastModified: new Date().toISOString(),
        modifiedBy: project.userId,
        language: this.detectLanguage(extension),
        generated: false,
        locked: false,
      };
    });

    project.currentVersion = version.version;

    await this.saveProject(project);

    return project;
  }

  // ===========================================================================
  // BRANCHING
  // ===========================================================================

  async createBranch(
    projectId: string,
    params: {
      name: string;
      baseBranch?: string;
      description?: string;
      purpose?: 'feature' | 'bugfix' | 'experiment' | 'release';
      createdBy: string;
    }
  ): Promise<ProjectBranch> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Check if branch name already exists
    if (project.branches.some((b) => b.name === params.name)) {
      throw new Error(`Branch already exists: ${params.name}`);
    }

    const baseBranch = project.branches.find(
      (b) => b.name === (params.baseBranch || project.currentBranch)
    );
    if (!baseBranch) {
      throw new Error(`Base branch not found`);
    }

    const branchId = this.generateId();
    const now = new Date().toISOString();

    const branch: ProjectBranch = {
      id: branchId,
      name: params.name,
      projectId,
      baseBranch: baseBranch.name,
      baseVersion: project.currentVersion,
      currentVersion: project.currentVersion,
      isDefault: false,
      isProtected: false,
      status: 'active',
      createdAt: now,
      createdBy: params.createdBy,
      lastCommit: now,
      description: params.description,
      purpose: params.purpose,
    };

    // Save branch snapshot
    const snapshot = await this.createSnapshot(project);
    await this.storage.save(
      `${this.getProjectPath(projectId)}/branches/${branchId}/snapshot.json`,
      JSON.stringify(snapshot)
    );

    project.branches.push(branch);
    await this.saveProject(project);

    this.emit({ type: 'branch_created', data: branch });

    return branch;
  }

  async switchBranch(projectId: string, branchName: string): Promise<Project> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const branch = project.branches.find((b) => b.name === branchName);
    if (!branch) {
      throw new Error(`Branch not found: ${branchName}`);
    }

    // Save current branch state
    const currentBranch = project.branches.find((b) => b.name === project.currentBranch);
    if (currentBranch) {
      const currentSnapshot = await this.createSnapshot(project);
      await this.storage.save(
        `${this.getProjectPath(projectId)}/branches/${currentBranch.id}/snapshot.json`,
        JSON.stringify(currentSnapshot)
      );
    }

    // Load target branch snapshot
    try {
      const snapshotContent = await this.storage.load(
        `${this.getProjectPath(projectId)}/branches/${branch.id}/snapshot.json`
      );
      const snapshot = JSON.parse(snapshotContent) as ProjectSnapshot;

      // Restore files from branch snapshot
      project.files = Object.entries(snapshot.files).map(([path, snap]) => {
        const pathParts = path.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const extension = fileName.includes('.') ? fileName.split('.').pop() || '' : '';

        return {
          id: this.generateId(),
          path,
          name: fileName,
          extension,
          content: snap.content,
          size: snap.size,
          hash: snap.hash,
          version: 1,
          lastModified: new Date().toISOString(),
          modifiedBy: project.userId,
          language: this.detectLanguage(extension),
          generated: false,
          locked: false,
        };
      });
    } catch {
      // Branch might not have a snapshot yet (e.g., just created)
    }

    project.currentBranch = branchName;
    project.currentVersion = branch.currentVersion;
    await this.saveProject(project);

    return project;
  }

  async mergeBranch(
    projectId: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<BranchMerge> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const source = project.branches.find((b) => b.name === sourceBranch);
    const target = project.branches.find((b) => b.name === targetBranch);

    if (!source || !target) {
      throw new Error(`Branch not found`);
    }

    if (target.isProtected && !this.canMergeToProtected(project, targetBranch)) {
      throw new Error(`Cannot merge to protected branch: ${targetBranch}`);
    }

    const mergeId = this.generateId();
    const now = new Date().toISOString();

    // Load both branch snapshots
    const sourceSnapshot = await this.loadBranchSnapshot(projectId, source.id);
    const targetSnapshot = await this.loadBranchSnapshot(projectId, target.id);

    // Detect conflicts
    const conflicts = this.detectConflicts(sourceSnapshot, targetSnapshot);

    const merge: BranchMerge = {
      id: mergeId,
      sourceBranch,
      targetBranch,
      status: conflicts.length > 0 ? 'conflicted' : 'pending',
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };

    if (conflicts.length === 0) {
      // Auto-merge if no conflicts
      await this.performMerge(project, sourceSnapshot, targetSnapshot, target);
      merge.status = 'merged';
      merge.mergedAt = now;
      merge.mergedBy = project.userId;

      // Mark source branch as merged
      source.status = 'merged';
    }

    await this.saveProject(project);

    this.emit({ type: 'branch_merged', data: merge });

    return merge;
  }

  // ===========================================================================
  // COLLABORATION
  // ===========================================================================

  async addCollaborator(
    projectId: string,
    params: {
      userId: string;
      email: string;
      name: string;
      role: CollaboratorRole;
      addedBy: string;
    }
  ): Promise<Collaborator> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Check if user already a collaborator
    if (project.collaborators.some((c) => c.userId === params.userId)) {
      throw new Error(`User is already a collaborator`);
    }

    const collaborator: Collaborator = {
      userId: params.userId,
      email: params.email,
      name: params.name,
      role: params.role,
      permissions: this.getPermissionsForRole(params.role),
      addedAt: new Date().toISOString(),
      addedBy: params.addedBy,
    };

    project.collaborators.push(collaborator);
    await this.saveProject(project);

    this.emit({ type: 'collaborator_added', data: collaborator });

    return collaborator;
  }

  async removeCollaborator(projectId: string, userId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const index = project.collaborators.findIndex((c) => c.userId === userId);
    if (index === -1) {
      throw new Error(`Collaborator not found`);
    }

    const collaborator = project.collaborators[index];
    if (collaborator.role === 'owner') {
      throw new Error(`Cannot remove project owner`);
    }

    project.collaborators.splice(index, 1);
    await this.saveProject(project);

    this.emit({ type: 'collaborator_removed', data: { userId } });
  }

  async updateCollaboratorRole(
    projectId: string,
    userId: string,
    role: CollaboratorRole
  ): Promise<Collaborator> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const collaborator = project.collaborators.find((c) => c.userId === userId);
    if (!collaborator) {
      throw new Error(`Collaborator not found`);
    }

    if (collaborator.role === 'owner') {
      throw new Error(`Cannot change owner role`);
    }

    collaborator.role = role;
    collaborator.permissions = this.getPermissionsForRole(role);

    await this.saveProject(project);

    return collaborator;
  }

  // ===========================================================================
  // EXPORT / IMPORT
  // ===========================================================================

  async exportProject(
    projectId: string,
    options?: {
      includeHistory?: boolean;
      includeAnalytics?: boolean;
      includeIntegrations?: boolean;
    }
  ): Promise<ProjectExport> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const exportData: ProjectExport = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: project.userId,
      project,
      versions: options?.includeHistory ? project.versions : [],
      branches: project.branches,
      includeHistory: options?.includeHistory,
      includeAnalytics: options?.includeAnalytics,
      includeIntegrations: options?.includeIntegrations,
    };

    // Strip sensitive data if not including integrations
    if (!options?.includeIntegrations) {
      exportData.project.integrations = [];
    }

    // Strip analytics if not included
    if (!options?.includeAnalytics) {
      exportData.project.analytics = {
        totalFiles: 0,
        totalLines: 0,
        totalSize: 0,
        totalVersions: 0,
        totalEdits: 0,
        averageSessionDuration: 0,
        totalBuilds: 0,
        successfulBuilds: 0,
        failedBuilds: 0,
        averageBuildTime: 0,
        lintErrors: 0,
        typeErrors: 0,
        aiGeneratedLines: 0,
        aiSuggestionAcceptRate: 0,
        knowledgePacketsUsed: 0,
        totalBuildTime: 0,
        timeByPhase: {},
      };
    }

    return exportData;
  }

  async importProject(
    importData: ProjectImport,
    userId: string,
    workspaceId: string
  ): Promise<Project> {
    let exportData: ProjectExport;

    if (typeof importData.data === 'string') {
      // Load from URL or file path
      exportData = JSON.parse(importData.data) as ProjectExport;
    } else {
      exportData = importData.data;
    }

    const projectId = this.generateId();
    const now = new Date().toISOString();

    const project: Project = {
      ...exportData.project,
      id: projectId,
      userId,
      workspaceId,
      name: importData.options.newName || exportData.project.name,
      createdAt: now,
      updatedAt: now,
      rootPath: `/projects/${projectId}`,
    };

    // Reset collaborators unless preserving
    if (!importData.options.preserveCollaborators) {
      project.collaborators = [
        {
          userId,
          email: '',
          name: 'Owner',
          role: 'owner',
          permissions: this.getPermissionsForRole('owner'),
          addedAt: now,
          addedBy: userId,
        },
      ];
    }

    // Reset versions unless preserving history
    if (!importData.options.preserveHistory) {
      project.versions = [];
      project.currentVersion = '0.1.0';
    }

    await this.saveProject(project);
    this.projects.set(projectId, project);

    // Create initial version
    await this.createVersion(projectId, {
      summary: `Imported from ${importData.source}`,
      createdBy: userId,
    });

    return project;
  }

  // ===========================================================================
  // EVENT HANDLING
  // ===========================================================================

  subscribe(handler: ProjectEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: ProjectEvent): void {
    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    });
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private getProjectPath(projectId: string): string {
    return `projects/${projectId}`;
  }

  private async saveProject(project: Project): Promise<void> {
    const projectPath = this.getProjectPath(project.id);
    await this.storage.save(`${projectPath}/project.json`, JSON.stringify(project));
  }

  private getDefaultFramework(techStack: TechStack): string {
    const frameworks: Record<TechStack, string> = {
      nextjs: 'Next.js 14',
      react: 'React 18',
      vue: 'Vue 3',
      svelte: 'SvelteKit',
      express: 'Express.js',
      fastapi: 'FastAPI',
      django: 'Django 5',
      rails: 'Ruby on Rails 7',
      tauri: 'Tauri 2',
      electron: 'Electron',
      react_native: 'React Native',
      flutter: 'Flutter',
    };
    return frameworks[techStack];
  }

  private detectLanguage(extension: string): string {
    const languages: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cs: 'csharp',
      cpp: 'cpp',
      c: 'c',
      html: 'html',
      css: 'css',
      scss: 'scss',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      sql: 'sql',
      sh: 'bash',
      dart: 'dart',
    };
    return languages[extension.toLowerCase()] || 'plaintext';
  }

  private getPermissionsForRole(role: CollaboratorRole): CollaboratorPermissions {
    const permissions: Record<CollaboratorRole, CollaboratorPermissions> = {
      owner: {
        canEdit: true,
        canDelete: true,
        canDeploy: true,
        canInvite: true,
        canManageSettings: true,
        canViewAnalytics: true,
        canRevert: true,
        canMerge: true,
      },
      admin: {
        canEdit: true,
        canDelete: true,
        canDeploy: true,
        canInvite: true,
        canManageSettings: true,
        canViewAnalytics: true,
        canRevert: true,
        canMerge: true,
      },
      developer: {
        canEdit: true,
        canDelete: false,
        canDeploy: true,
        canInvite: false,
        canManageSettings: false,
        canViewAnalytics: true,
        canRevert: true,
        canMerge: true,
      },
      reviewer: {
        canEdit: false,
        canDelete: false,
        canDeploy: false,
        canInvite: false,
        canManageSettings: false,
        canViewAnalytics: true,
        canRevert: false,
        canMerge: false,
      },
      viewer: {
        canEdit: false,
        canDelete: false,
        canDeploy: false,
        canInvite: false,
        canManageSettings: false,
        canViewAnalytics: false,
        canRevert: false,
        canMerge: false,
      },
    };
    return permissions[role];
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2]++; // Increment patch version
    if (parts[2] >= 100) {
      parts[2] = 0;
      parts[1]++;
    }
    if (parts[1] >= 100) {
      parts[1] = 0;
      parts[0]++;
    }
    return parts.join('.');
  }

  private async createSnapshot(project: Project): Promise<ProjectSnapshot> {
    const files: Record<string, FileSnapshot> = {};

    for (const file of project.files) {
      files[file.path] = {
        path: file.path,
        content: file.content,
        hash: file.hash,
        size: file.size,
      };
    }

    const tree = this.buildDirectoryTree(project);

    return {
      files,
      structure: {
        root: project.rootPath,
        tree,
      },
      config: {
        packageJson: {},
        tsConfig: {},
        envTemplate: {},
      },
      dependencies: {
        dependencies: {},
        devDependencies: {},
        lockfileVersion: 3,
        hash: '',
      },
    };
  }

  private buildDirectoryTree(project: Project): DirectoryNode {
    const root: DirectoryNode = {
      name: project.name,
      type: 'directory',
      children: [],
    };

    const pathMap = new Map<string, DirectoryNode>();
    pathMap.set('', root);

    // Sort files by path depth
    const sortedFiles = [...project.files].sort((a, b) => {
      return a.path.split('/').length - b.path.split('/').length;
    });

    for (const file of sortedFiles) {
      const parts = file.path.split('/').filter(Boolean);
      let currentPath = '';

      for (let i = 0; i < parts.length - 1; i++) {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];

        if (!pathMap.has(currentPath)) {
          const dirNode: DirectoryNode = {
            name: parts[i],
            type: 'directory',
            children: [],
          };
          pathMap.set(currentPath, dirNode);

          const parent = pathMap.get(parentPath);
          if (parent && parent.children) {
            parent.children.push(dirNode);
          }
        }
      }

      const fileName = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');
      const parent = pathMap.get(parentPath);

      if (parent && parent.children) {
        parent.children.push({
          name: fileName,
          type: 'file',
          fileId: file.id,
        });
      }
    }

    return root;
  }

  private async calculateChanges(project: Project): Promise<FileChange[]> {
    const changes: FileChange[] = [];

    // Get previous version if exists
    if (project.versions.length === 0) {
      // All files are new
      for (const file of project.files) {
        changes.push({
          type: 'added',
          path: file.path,
        });
      }
      return changes;
    }

    const previousVersion = project.versions[project.versions.length - 1];
    const previousFiles = previousVersion.snapshot.files;

    // Check for modified and deleted files
    for (const [path, snap] of Object.entries(previousFiles)) {
      const currentFile = project.files.find((f) => f.path === path);

      if (!currentFile) {
        changes.push({
          type: 'deleted',
          path,
        });
      } else if (currentFile.hash !== snap.hash) {
        changes.push({
          type: 'modified',
          path,
          diff: this.createDiff(snap.content, currentFile.content),
        });
      }
    }

    // Check for new files
    for (const file of project.files) {
      if (!previousFiles[file.path]) {
        changes.push({
          type: 'added',
          path: file.path,
        });
      }
    }

    return changes;
  }

  private createDiff(oldContent: string, newContent: string): FileDiff {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const hunks: DiffHunk[] = [];
    let additions = 0;
    let deletions = 0;

    // Simple line-by-line diff
    let i = 0;
    let j = 0;
    let currentHunk: DiffHunk | null = null;

    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        // Context line
        if (currentHunk) {
          currentHunk.lines.push({
            type: 'context',
            content: oldLines[i],
            lineNumber: { old: i + 1, new: j + 1 },
          });
        }
        i++;
        j++;
      } else {
        // Start new hunk if needed
        if (!currentHunk) {
          currentHunk = {
            oldStart: i + 1,
            oldLines: 0,
            newStart: j + 1,
            newLines: 0,
            lines: [],
          };
          hunks.push(currentHunk);
        }

        // Deletion
        if (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) {
          currentHunk.lines.push({
            type: 'delete',
            content: oldLines[i],
            lineNumber: { old: i + 1 },
          });
          currentHunk.oldLines++;
          deletions++;
          i++;
        }

        // Addition
        if (j < newLines.length && (i >= oldLines.length || oldLines[i] !== newLines[j])) {
          currentHunk.lines.push({
            type: 'add',
            content: newLines[j],
            lineNumber: { new: j + 1 },
          });
          currentHunk.newLines++;
          additions++;
          j++;
        }
      }
    }

    return { hunks, additions, deletions };
  }

  private async ensureDirectoryStructure(
    project: Project,
    filePath: string
  ): Promise<void> {
    const parts = filePath.split('/').filter(Boolean);
    let currentPath = '';

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];

      const existingDir = project.directories.find((d) => d.path === currentPath);
      if (!existingDir) {
        project.directories.push({
          id: this.generateId(),
          path: currentPath,
          name: parts[i],
          children: [],
        });
      }
    }
  }

  private async applyTemplate(
    project: Project,
    template: ProjectTemplate
  ): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    const now = new Date().toISOString();

    for (const templateFile of template.files) {
      const pathParts = templateFile.path.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const extension = fileName.includes('.') ? fileName.split('.').pop() || '' : '';

      let content = templateFile.content;

      // Replace template variables
      if (templateFile.isTemplate) {
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, project.name);
        content = content.replace(/\{\{PROJECT_ID\}\}/g, project.id);
        // Add more variable replacements as needed
      }

      files.push({
        id: this.generateId(),
        path: templateFile.path,
        name: fileName,
        extension,
        content,
        size: new TextEncoder().encode(content).length,
        hash: this.hashContent(content),
        version: 1,
        lastModified: now,
        modifiedBy: project.userId,
        language: this.detectLanguage(extension),
        generated: true,
        locked: false,
      });
    }

    return files;
  }

  private async loadBranchSnapshot(
    projectId: string,
    branchId: string
  ): Promise<ProjectSnapshot> {
    const content = await this.storage.load(
      `${this.getProjectPath(projectId)}/branches/${branchId}/snapshot.json`
    );
    return JSON.parse(content) as ProjectSnapshot;
  }

  private detectConflicts(
    sourceSnapshot: ProjectSnapshot,
    targetSnapshot: ProjectSnapshot
  ): MergeConflict[] {
    const conflicts: MergeConflict[] = [];

    for (const [path, sourceFile] of Object.entries(sourceSnapshot.files)) {
      const targetFile = targetSnapshot.files[path];

      if (targetFile && sourceFile.hash !== targetFile.hash) {
        // Both branches modified the same file
        conflicts.push({
          filePath: path,
          type: 'content',
          sourceContent: sourceFile.content,
          targetContent: targetFile.content,
        });
      }
    }

    return conflicts;
  }

  private canMergeToProtected(_project: Project, _branchName: string): boolean {
    // Implement merge permissions check
    return true; // For now, allow all merges
  }

  private async performMerge(
    project: Project,
    sourceSnapshot: ProjectSnapshot,
    _targetSnapshot: ProjectSnapshot,
    targetBranch: ProjectBranch
  ): Promise<void> {
    // Apply source changes to target
    for (const [path, sourceFile] of Object.entries(sourceSnapshot.files)) {
      const existingFile = project.files.find((f) => f.path === path);

      if (existingFile) {
        existingFile.content = sourceFile.content;
        existingFile.hash = sourceFile.hash;
        existingFile.size = sourceFile.size;
        existingFile.lastModified = new Date().toISOString();
        existingFile.version++;
      } else {
        const pathParts = path.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const extension = fileName.includes('.') ? fileName.split('.').pop() || '' : '';

        project.files.push({
          id: this.generateId(),
          path,
          name: fileName,
          extension,
          content: sourceFile.content,
          size: sourceFile.size,
          hash: sourceFile.hash,
          version: 1,
          lastModified: new Date().toISOString(),
          modifiedBy: project.userId,
          language: this.detectLanguage(extension),
          generated: false,
          locked: false,
        });
      }
    }

    // Update target branch version
    targetBranch.currentVersion = this.incrementVersion(targetBranch.currentVersion);
    targetBranch.lastCommit = new Date().toISOString();
  }

  private startAutoSave(projectId: string): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    const timer = setInterval(async () => {
      const currentProject = this.projects.get(projectId);
      if (currentProject) {
        await this.saveProject(currentProject);
      }
    }, project.settings.autoSaveInterval * 1000);

    this.autoSaveTimers.set(projectId, timer);
  }

  private stopAutoSave(projectId: string): void {
    const timer = this.autoSaveTimers.get(projectId);
    if (timer) {
      clearInterval(timer);
      this.autoSaveTimers.delete(projectId);
    }
  }
}

// Export singleton
export const projectPersistence = ProjectPersistenceService.getInstance();
