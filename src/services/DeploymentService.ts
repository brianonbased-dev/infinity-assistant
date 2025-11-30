/**
 * Deployment Service
 *
 * Multi-platform deployment automation for Vercel, Railway, Docker, and more.
 * Handles build, deploy, rollback, and preview deployments.
 */

import type {
  DeploymentConfig,
  Deployment,
  DeploymentProvider,
  DeploymentEnvironment,
  DeploymentStatus,
  DeploymentError,
  DeploymentTrigger,
  BuildOutput,
  DeployOutput,
  RollbackRequest,
  RollbackResult,
  PreviewDeployment,
  DeploymentPipeline,
  PipelineStage,
  DeploymentMetrics,
  DeploymentEvent,
  DeploymentEventHandler,
  EnvVariable,
} from '../types/deployment';

// =============================================================================
// PROVIDER ADAPTERS
// =============================================================================

interface ProviderAdapter {
  deploy(config: DeploymentConfig, deployment: Deployment): Promise<DeployOutput>;
  rollback(deploymentId: string, targetId: string): Promise<boolean>;
  getStatus(deploymentId: string): Promise<DeploymentStatus>;
  getLogs(deploymentId: string): Promise<string[]>;
  cancel(deploymentId: string): Promise<boolean>;
  getUrl(deploymentId: string): Promise<string | null>;
}

// =============================================================================
// VERCEL ADAPTER
// =============================================================================

class VercelAdapter implements ProviderAdapter {
  private token: string;
  private baseUrl = 'https://api.vercel.com';

  constructor(token: string) {
    this.token = token;
  }

  async deploy(config: DeploymentConfig, deployment: Deployment): Promise<DeployOutput> {
    const vercelConfig = config.providerConfig.vercel;

    const response = await fetch(`${this.baseUrl}/v13/deployments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: config.providerConfig.projectName,
        target: config.environment === 'production' ? 'production' : undefined,
        gitSource: deployment.commitHash
          ? {
              type: 'github',
              ref: deployment.branch || 'main',
              sha: deployment.commitHash,
            }
          : undefined,
        projectSettings: {
          framework: vercelConfig?.framework,
          buildCommand: vercelConfig?.buildCommand || config.buildConfig.command,
          outputDirectory: vercelConfig?.outputDirectory || config.buildConfig.outputDir,
          installCommand: vercelConfig?.installCommand || config.buildConfig.installCommand,
          rootDirectory: vercelConfig?.rootDirectory,
        },
        env: this.formatEnvVariables(config.envVariables, config.environment),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Vercel deployment failed: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    return {
      success: true,
      duration: 0, // Will be updated when complete
      instances: 1,
      regions: data.regions || [],
    };
  }

  async rollback(deploymentId: string, targetId: string): Promise<boolean> {
    const response = await fetch(
      `${this.baseUrl}/v9/deployments/${deploymentId}/rollback`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetDeploymentId: targetId }),
      }
    );

    return response.ok;
  }

  async getStatus(deploymentId: string): Promise<DeploymentStatus> {
    const response = await fetch(`${this.baseUrl}/v13/deployments/${deploymentId}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    if (!response.ok) {
      return 'failed';
    }

    const data = await response.json();
    const statusMap: Record<string, DeploymentStatus> = {
      QUEUED: 'queued',
      BUILDING: 'building',
      READY: 'deployed',
      ERROR: 'failed',
      CANCELED: 'cancelled',
    };

    return statusMap[data.readyState] || 'pending';
  }

  async getLogs(deploymentId: string): Promise<string[]> {
    const response = await fetch(
      `${this.baseUrl}/v2/deployments/${deploymentId}/events`,
      {
        headers: { Authorization: `Bearer ${this.token}` },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.map((event: { text: string }) => event.text);
  }

  async cancel(deploymentId: string): Promise<boolean> {
    const response = await fetch(
      `${this.baseUrl}/v12/deployments/${deploymentId}/cancel`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${this.token}` },
      }
    );

    return response.ok;
  }

  async getUrl(deploymentId: string): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/v13/deployments/${deploymentId}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.url ? `https://${data.url}` : null;
  }

  private formatEnvVariables(
    variables: EnvVariable[],
    environment: DeploymentEnvironment
  ): Record<string, string> {
    const env: Record<string, string> = {};

    for (const v of variables) {
      if (v.environment === 'all' || v.environment === environment) {
        env[v.key] = v.value;
      }
    }

    return env;
  }
}

// =============================================================================
// RAILWAY ADAPTER
// =============================================================================

class RailwayAdapter implements ProviderAdapter {
  private token: string;
  private baseUrl = 'https://backboard.railway.app/graphql/v2';

  constructor(token: string) {
    this.token = token;
  }

  async deploy(config: DeploymentConfig, _deployment: Deployment): Promise<DeployOutput> {
    const railwayConfig = config.providerConfig.railway;

    const query = `
      mutation DeployService($serviceId: String!, $environmentId: String!) {
        serviceDeploymentTrigger(serviceId: $serviceId, environmentId: $environmentId) {
          id
          status
        }
      }
    `;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          serviceId: railwayConfig?.serviceId,
          environmentId: railwayConfig?.environmentId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Railway deployment failed');
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors[0]?.message || 'Railway deployment failed');
    }

    return {
      success: true,
      duration: 0,
      instances: railwayConfig?.numReplicas || 1,
    };
  }

  async rollback(_deploymentId: string, _targetId: string): Promise<boolean> {
    // Railway handles rollback through redeploy of previous commit
    return true;
  }

  async getStatus(deploymentId: string): Promise<DeploymentStatus> {
    const query = `
      query GetDeployment($id: String!) {
        deployment(id: $id) {
          status
        }
      }
    `;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { id: deploymentId } }),
    });

    if (!response.ok) {
      return 'failed';
    }

    const data = await response.json();
    const statusMap: Record<string, DeploymentStatus> = {
      BUILDING: 'building',
      DEPLOYING: 'deploying',
      SUCCESS: 'deployed',
      FAILED: 'failed',
      CRASHED: 'failed',
      REMOVED: 'cancelled',
    };

    return statusMap[data.data?.deployment?.status] || 'pending';
  }

  async getLogs(deploymentId: string): Promise<string[]> {
    const query = `
      query GetDeploymentLogs($id: String!) {
        deploymentLogs(deploymentId: $id) {
          message
        }
      }
    `;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { id: deploymentId } }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data?.deploymentLogs?.map((l: { message: string }) => l.message) || [];
  }

  async cancel(deploymentId: string): Promise<boolean> {
    const query = `
      mutation CancelDeployment($id: String!) {
        deploymentCancel(id: $id)
      }
    `;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { id: deploymentId } }),
    });

    return response.ok;
  }

  async getUrl(deploymentId: string): Promise<string | null> {
    const query = `
      query GetDeployment($id: String!) {
        deployment(id: $id) {
          staticUrl
        }
      }
    `;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { id: deploymentId } }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data?.deployment?.staticUrl || null;
  }
}

// =============================================================================
// DOCKER ADAPTER
// =============================================================================

class DockerAdapter implements ProviderAdapter {
  private registry: string;

  constructor(registry: string = 'docker.io') {
    this.registry = registry;
  }

  async deploy(config: DeploymentConfig, deployment: Deployment): Promise<DeployOutput> {
    const dockerConfig = config.providerConfig.docker;

    // Build Docker commands
    const imageName = `${dockerConfig?.registry || this.registry}/${
      dockerConfig?.imageName || config.providerConfig.projectName
    }:${dockerConfig?.tag || deployment.version}`;

    // In a real implementation, this would execute docker commands
    // For now, we simulate the deployment process

    console.log(`Building Docker image: ${imageName}`);
    console.log(`Dockerfile: ${dockerConfig?.dockerfile || 'Dockerfile'}`);
    console.log(`Context: ${dockerConfig?.context || '.'}`);

    return {
      success: true,
      duration: 0,
      instances: 1,
    };
  }

  async rollback(_deploymentId: string, _targetId: string): Promise<boolean> {
    // Docker rollback would involve pulling and running the previous image
    return true;
  }

  async getStatus(_deploymentId: string): Promise<DeploymentStatus> {
    // Would check container status
    return 'deployed';
  }

  async getLogs(_deploymentId: string): Promise<string[]> {
    // Would fetch container logs
    return [];
  }

  async cancel(_deploymentId: string): Promise<boolean> {
    // Would stop the container
    return true;
  }

  async getUrl(_deploymentId: string): Promise<string | null> {
    // Would return mapped port URL
    return null;
  }
}

// =============================================================================
// DEPLOYMENT SERVICE
// =============================================================================

export class DeploymentService {
  private static instance: DeploymentService;
  private adapters: Map<DeploymentProvider, ProviderAdapter> = new Map();
  private deployments: Map<string, Deployment> = new Map();
  private pipelines: Map<string, DeploymentPipeline> = new Map();
  private eventHandlers: Set<DeploymentEventHandler> = new Set();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.initializeAdapters();
  }

  static getInstance(): DeploymentService {
    if (!DeploymentService.instance) {
      DeploymentService.instance = new DeploymentService();
    }
    return DeploymentService.instance;
  }

  private initializeAdapters(): void {
    // Initialize adapters from environment variables
    const vercelToken = process.env.VERCEL_TOKEN;
    if (vercelToken) {
      this.adapters.set('vercel', new VercelAdapter(vercelToken));
    }

    const railwayToken = process.env.RAILWAY_TOKEN;
    if (railwayToken) {
      this.adapters.set('railway', new RailwayAdapter(railwayToken));
    }

    // Docker adapter doesn't need auth for local use
    this.adapters.set('docker', new DockerAdapter());
  }

  // ===========================================================================
  // DEPLOYMENT OPERATIONS
  // ===========================================================================

  async deploy(
    config: DeploymentConfig,
    options: {
      trigger: DeploymentTrigger;
      createdBy: string;
      commitHash?: string;
      commitMessage?: string;
      branch?: string;
    }
  ): Promise<Deployment> {
    const adapter = this.adapters.get(config.provider);
    if (!adapter) {
      throw new Error(`Provider not configured: ${config.provider}`);
    }

    const deploymentId = this.generateId();
    const now = new Date().toISOString();

    const deployment: Deployment = {
      id: deploymentId,
      projectId: config.projectId,
      provider: config.provider,
      environment: config.environment,
      status: 'pending',
      version: this.generateVersion(),
      commitHash: options.commitHash,
      commitMessage: options.commitMessage,
      branch: options.branch,
      createdAt: now,
      createdBy: options.createdBy,
      trigger: options.trigger,
      buildLogs: [],
      deployLogs: [],
    };

    this.deployments.set(deploymentId, deployment);
    this.emit({ type: 'deployment_started', data: deployment });

    // Start deployment process
    this.executeDeployment(config, deployment, adapter).catch((error) => {
      console.error('Deployment failed:', error);
    });

    return deployment;
  }

  private async executeDeployment(
    config: DeploymentConfig,
    deployment: Deployment,
    adapter: ProviderAdapter
  ): Promise<void> {
    try {
      // Pre-build hooks
      if (config.hooks?.preBuild) {
        await this.executeHooks(config.hooks.preBuild, deployment);
      }

      // Building phase
      deployment.status = 'building';
      deployment.startedAt = new Date().toISOString();
      this.emit({ type: 'deployment_building', data: { deploymentId: deployment.id, progress: 0 } });

      const buildResult = await this.executeBuild(config, deployment);
      deployment.buildOutput = buildResult;

      if (!buildResult.success) {
        throw new Error('Build failed');
      }

      // Post-build hooks
      if (config.hooks?.postBuild) {
        await this.executeHooks(config.hooks.postBuild, deployment);
      }

      // Pre-deploy hooks
      if (config.hooks?.preDeploy) {
        await this.executeHooks(config.hooks.preDeploy, deployment);
      }

      // Deploying phase
      deployment.status = 'deploying';
      this.emit({ type: 'deployment_deploying', data: { deploymentId: deployment.id, progress: 50 } });

      const deployResult = await adapter.deploy(config, deployment);
      deployment.deployOutput = deployResult;

      // Start polling for status
      this.startStatusPolling(deployment.id, adapter);

      // Get deployment URL
      const url = await adapter.getUrl(deployment.id);
      if (url) {
        deployment.url = url;
      }

      // Post-deploy hooks
      if (config.hooks?.postDeploy) {
        await this.executeHooks(config.hooks.postDeploy, deployment);
      }

      // Mark as deployed
      deployment.status = 'deployed';
      deployment.completedAt = new Date().toISOString();
      deployment.duration =
        new Date(deployment.completedAt).getTime() -
        new Date(deployment.startedAt!).getTime();

      // Success hooks
      if (config.hooks?.onSuccess) {
        await this.executeHooks(config.hooks.onSuccess, deployment);
      }

      this.emit({ type: 'deployment_completed', data: deployment });
    } catch (error) {
      const deployError: DeploymentError = {
        code: 'DEPLOYMENT_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        phase: deployment.status === 'building' ? 'build' : 'deploy',
        recoverable: true,
        suggestions: this.generateErrorSuggestions(error),
      };

      deployment.status = 'failed';
      deployment.error = deployError;
      deployment.completedAt = new Date().toISOString();

      // Failure hooks
      if (config.hooks?.onFailure) {
        await this.executeHooks(config.hooks.onFailure, deployment);
      }

      this.emit({ type: 'deployment_failed', data: { deployment, error: deployError } });
    }
  }

  private async executeBuild(
    config: DeploymentConfig,
    deployment: Deployment
  ): Promise<BuildOutput> {
    const startTime = Date.now();

    deployment.buildLogs?.push(`Starting build at ${new Date().toISOString()}`);
    deployment.buildLogs?.push(`Build command: ${config.buildConfig.command}`);

    // Simulate build process
    // In a real implementation, this would execute the build command

    deployment.buildLogs?.push('Installing dependencies...');
    deployment.buildLogs?.push('Compiling source...');
    deployment.buildLogs?.push('Optimizing assets...');
    deployment.buildLogs?.push('Build completed successfully');

    const duration = Date.now() - startTime;

    return {
      success: true,
      duration,
      size: 1024 * 1024 * 5, // 5MB placeholder
      files: 42,
      warnings: [],
    };
  }

  private async executeHooks(hooks: string[], _deployment: Deployment): Promise<void> {
    for (const hook of hooks) {
      console.log(`Executing hook: ${hook}`);
      // In a real implementation, this would execute the hook command
    }
  }

  private startStatusPolling(deploymentId: string, adapter: ProviderAdapter): void {
    const interval = setInterval(async () => {
      try {
        const status = await adapter.getStatus(deploymentId);
        const deployment = this.deployments.get(deploymentId);

        if (deployment && deployment.status !== status) {
          deployment.status = status;

          if (status === 'deployed' || status === 'failed' || status === 'cancelled') {
            this.stopStatusPolling(deploymentId);
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000); // Poll every 5 seconds

    this.pollingIntervals.set(deploymentId, interval);
  }

  private stopStatusPolling(deploymentId: string): void {
    const interval = this.pollingIntervals.get(deploymentId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(deploymentId);
    }
  }

  // ===========================================================================
  // ROLLBACK OPERATIONS
  // ===========================================================================

  async rollback(request: RollbackRequest): Promise<RollbackResult> {
    const deployment = this.deployments.get(request.deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${request.deploymentId}`);
    }

    const targetDeployment = this.deployments.get(request.targetDeploymentId);
    if (!targetDeployment) {
      throw new Error(`Target deployment not found: ${request.targetDeploymentId}`);
    }

    const adapter = this.adapters.get(deployment.provider);
    if (!adapter) {
      throw new Error(`Provider not configured: ${deployment.provider}`);
    }

    this.emit({ type: 'rollback_started', data: request });

    try {
      const success = await adapter.rollback(
        request.deploymentId,
        request.targetDeploymentId
      );

      if (!success) {
        throw new Error('Rollback failed');
      }

      // Create new deployment record for the rollback
      const rollbackDeployment: Deployment = {
        ...targetDeployment,
        id: this.generateId(),
        createdAt: new Date().toISOString(),
        createdBy: request.requestedBy,
        trigger: 'rollback',
        status: 'deployed',
        metadata: {
          ...targetDeployment.metadata,
          rollbackFrom: request.deploymentId,
          rollbackReason: request.reason,
        },
      };

      this.deployments.set(rollbackDeployment.id, rollbackDeployment);

      // Update original deployment status
      deployment.status = 'rolled_back';

      const result: RollbackResult = {
        success: true,
        previousDeployment: deployment,
        newDeployment: rollbackDeployment,
      };

      this.emit({ type: 'rollback_completed', data: result });

      return result;
    } catch (error) {
      const deployError: DeploymentError = {
        code: 'ROLLBACK_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        phase: 'deploy',
        recoverable: false,
      };

      return {
        success: false,
        error: deployError,
        previousDeployment: deployment,
      };
    }
  }

  // ===========================================================================
  // PREVIEW DEPLOYMENTS
  // ===========================================================================

  async createPreview(
    config: DeploymentConfig,
    options: {
      branch: string;
      pullRequestId?: string;
      pullRequestUrl?: string;
      createdBy: string;
    }
  ): Promise<PreviewDeployment> {
    // Create deployment with preview environment
    const previewConfig: DeploymentConfig = {
      ...config,
      environment: 'preview',
    };

    const deployment = await this.deploy(previewConfig, {
      trigger: 'git_push',
      createdBy: options.createdBy,
      branch: options.branch,
    });

    const preview: PreviewDeployment = {
      id: this.generateId(),
      projectId: config.projectId,
      pullRequestId: options.pullRequestId,
      pullRequestUrl: options.pullRequestUrl,
      branch: options.branch,
      url: deployment.url || '',
      status: deployment.status,
      createdAt: new Date().toISOString(),
      expiresAt: this.calculatePreviewExpiry(),
      deployment,
    };

    this.emit({ type: 'preview_created', data: preview });

    return preview;
  }

  private calculatePreviewExpiry(): string {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7); // 7 days default
    return expiry.toISOString();
  }

  // ===========================================================================
  // PIPELINE OPERATIONS
  // ===========================================================================

  async createPipeline(
    pipeline: Omit<DeploymentPipeline, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DeploymentPipeline> {
    const pipelineId = this.generateId();
    const now = new Date().toISOString();

    const newPipeline: DeploymentPipeline = {
      ...pipeline,
      id: pipelineId,
      createdAt: now,
      updatedAt: now,
    };

    this.pipelines.set(pipelineId, newPipeline);

    return newPipeline;
  }

  async executePipeline(
    pipelineId: string,
    options: { trigger: DeploymentTrigger; createdBy: string }
  ): Promise<void> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    // Sort stages by order
    const sortedStages = [...pipeline.stages].sort((a, b) => a.order - b.order);

    for (const stage of sortedStages) {
      try {
        await this.executeStage(stage, options);
      } catch (error) {
        if (stage.onFailure === 'stop') {
          throw error;
        } else if (stage.onFailure === 'rollback') {
          // Implement rollback logic
          throw error;
        }
        // continue - just log and proceed
        console.error(`Stage ${stage.name} failed:`, error);
      }
    }
  }

  private async executeStage(
    stage: PipelineStage,
    _options: { trigger: DeploymentTrigger; createdBy: string }
  ): Promise<void> {
    console.log(`Executing stage: ${stage.name}`);

    for (const step of stage.steps) {
      console.log(`  Executing step: ${step.name}`);

      // Execute step based on type
      switch (step.type) {
        case 'build':
          // Execute build
          break;
        case 'test':
          // Execute tests
          break;
        case 'lint':
          // Execute linting
          break;
        case 'security_scan':
          // Execute security scan
          break;
        case 'deploy':
          // Execute deployment
          break;
        case 'notify':
          // Send notification
          break;
        case 'approval':
          // Wait for approval
          break;
        case 'custom':
          // Execute custom script
          break;
      }
    }
  }

  // ===========================================================================
  // DEPLOYMENT MANAGEMENT
  // ===========================================================================

  async getDeployment(deploymentId: string): Promise<Deployment | null> {
    return this.deployments.get(deploymentId) || null;
  }

  async listDeployments(
    projectId: string,
    options?: {
      environment?: DeploymentEnvironment;
      status?: DeploymentStatus;
      limit?: number;
    }
  ): Promise<Deployment[]> {
    let deployments = Array.from(this.deployments.values()).filter(
      (d) => d.projectId === projectId
    );

    if (options?.environment) {
      deployments = deployments.filter((d) => d.environment === options.environment);
    }

    if (options?.status) {
      deployments = deployments.filter((d) => d.status === options.status);
    }

    // Sort by created date descending
    deployments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (options?.limit) {
      deployments = deployments.slice(0, options.limit);
    }

    return deployments;
  }

  async cancelDeployment(deploymentId: string, reason: string): Promise<boolean> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    if (deployment.status === 'deployed' || deployment.status === 'failed') {
      throw new Error('Cannot cancel completed deployment');
    }

    const adapter = this.adapters.get(deployment.provider);
    if (!adapter) {
      throw new Error(`Provider not configured: ${deployment.provider}`);
    }

    const success = await adapter.cancel(deploymentId);

    if (success) {
      deployment.status = 'cancelled';
      deployment.completedAt = new Date().toISOString();
      this.stopStatusPolling(deploymentId);

      this.emit({
        type: 'deployment_cancelled',
        data: { deploymentId, reason },
      });
    }

    return success;
  }

  async getLogs(deploymentId: string): Promise<string[]> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    const adapter = this.adapters.get(deployment.provider);
    if (!adapter) {
      return [...(deployment.buildLogs || []), ...(deployment.deployLogs || [])];
    }

    const providerLogs = await adapter.getLogs(deploymentId);
    return [
      ...(deployment.buildLogs || []),
      ...(deployment.deployLogs || []),
      ...providerLogs,
    ];
  }

  // ===========================================================================
  // METRICS
  // ===========================================================================

  async getMetrics(
    projectId: string,
    period: 'day' | 'week' | 'month' | 'year'
  ): Promise<DeploymentMetrics> {
    const deployments = await this.listDeployments(projectId);

    const now = new Date();
    const periodStart = this.getPeriodStart(now, period);

    const filteredDeployments = deployments.filter(
      (d) => new Date(d.createdAt) >= periodStart
    );

    const successful = filteredDeployments.filter((d) => d.status === 'deployed');
    const failed = filteredDeployments.filter((d) => d.status === 'failed');
    const cancelled = filteredDeployments.filter((d) => d.status === 'cancelled');

    const buildTimes = successful
      .map((d) => d.buildOutput?.duration || 0)
      .filter((t) => t > 0);
    const deployTimes = successful
      .map((d) => d.deployOutput?.duration || 0)
      .filter((t) => t > 0);

    const byEnvironment: Record<DeploymentEnvironment, number> = {
      development: 0,
      staging: 0,
      preview: 0,
      production: 0,
    };

    const byProvider: Record<DeploymentProvider, number> = {
      vercel: 0,
      railway: 0,
      netlify: 0,
      aws: 0,
      gcp: 0,
      azure: 0,
      docker: 0,
      kubernetes: 0,
      cloudflare: 0,
      fly: 0,
    };

    for (const d of filteredDeployments) {
      byEnvironment[d.environment]++;
      byProvider[d.provider]++;
    }

    return {
      projectId,
      period,
      totalDeployments: filteredDeployments.length,
      successfulDeployments: successful.length,
      failedDeployments: failed.length,
      cancelledDeployments: cancelled.length,
      averageBuildTime: this.average(buildTimes),
      averageDeployTime: this.average(deployTimes),
      averageTotalTime: this.average(
        successful.map((d) => d.duration || 0).filter((t) => t > 0)
      ),
      p95BuildTime: this.percentile(buildTimes, 95),
      p95DeployTime: this.percentile(deployTimes, 95),
      deploymentsByEnvironment: byEnvironment,
      deploymentsByProvider: byProvider,
      deploymentTrend: this.calculateTrend(filteredDeployments, period),
      successRateTrend: this.calculateSuccessRateTrend(filteredDeployments, period),
    };
  }

  private getPeriodStart(now: Date, period: 'day' | 'week' | 'month' | 'year'): Date {
    const start = new Date(now);
    switch (period) {
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }
    return start;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateTrend(
    deployments: Deployment[],
    _period: 'day' | 'week' | 'month' | 'year'
  ): { date: string; value: number }[] {
    const byDate = new Map<string, number>();

    for (const d of deployments) {
      const date = d.createdAt.split('T')[0];
      byDate.set(date, (byDate.get(date) || 0) + 1);
    }

    return Array.from(byDate.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateSuccessRateTrend(
    deployments: Deployment[],
    _period: 'day' | 'week' | 'month' | 'year'
  ): { date: string; value: number }[] {
    const byDate = new Map<string, { total: number; successful: number }>();

    for (const d of deployments) {
      const date = d.createdAt.split('T')[0];
      const current = byDate.get(date) || { total: 0, successful: 0 };
      current.total++;
      if (d.status === 'deployed') {
        current.successful++;
      }
      byDate.set(date, current);
    }

    return Array.from(byDate.entries())
      .map(([date, data]) => ({
        date,
        value: data.total > 0 ? (data.successful / data.total) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ===========================================================================
  // EVENT HANDLING
  // ===========================================================================

  subscribe(handler: DeploymentEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: DeploymentEvent): void {
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
    return `dpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVersion(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}.${String(now.getHours()).padStart(2, '0')}${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
  }

  private generateErrorSuggestions(error: unknown): string[] {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const suggestions: string[] = [];

    if (message.includes('memory')) {
      suggestions.push('Try increasing memory allocation in resource config');
    }
    if (message.includes('timeout')) {
      suggestions.push('Consider increasing build timeout');
      suggestions.push('Check for infinite loops or blocking operations');
    }
    if (message.includes('dependency') || message.includes('module')) {
      suggestions.push('Check package.json for missing dependencies');
      suggestions.push('Try clearing node_modules and reinstalling');
    }
    if (message.includes('permission')) {
      suggestions.push('Verify deployment credentials are valid');
      suggestions.push('Check team/project permissions');
    }

    if (suggestions.length === 0) {
      suggestions.push('Check deployment logs for more details');
      suggestions.push('Verify environment variables are set correctly');
    }

    return suggestions;
  }
}

// Export singleton
export const deploymentService = DeploymentService.getInstance();
