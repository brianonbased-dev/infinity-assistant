/**
 * CI/CD Pipeline Integration Service
 *
 * Generates GitHub Actions workflows, pre-commit hooks, PR checks,
 * and integrates with popular CI/CD providers.
 */

// ============================================================================
// Types
// ============================================================================

export interface Pipeline {
  id: string;
  name: string;
  projectId: string;
  provider: CICDProvider;
  triggers: PipelineTrigger[];
  stages: PipelineStage[];
  environment: PipelineEnvironment;
  secrets: PipelineSecret[];
  status: PipelineStatus;
  lastRun?: PipelineRun;
  config: PipelineConfig;
  createdAt: Date;
  updatedAt: Date;
}

export type CICDProvider =
  | 'github-actions'
  | 'gitlab-ci'
  | 'circleci'
  | 'jenkins'
  | 'azure-devops'
  | 'bitbucket-pipelines'
  | 'travis-ci'
  | 'vercel'
  | 'railway';

export interface PipelineTrigger {
  type: 'push' | 'pull_request' | 'schedule' | 'manual' | 'tag' | 'release';
  branches?: string[];
  paths?: string[];
  schedule?: string; // Cron expression
  tags?: string[];
}

export interface PipelineStage {
  id: string;
  name: string;
  jobs: PipelineJob[];
  dependsOn?: string[]; // Stage IDs
  condition?: string;
}

export interface PipelineJob {
  id: string;
  name: string;
  runner: JobRunner;
  steps: PipelineStep[];
  env?: Record<string, string>;
  timeout?: number; // minutes
  continueOnError?: boolean;
  matrix?: JobMatrix;
  services?: JobService[];
  artifacts?: JobArtifact[];
  cache?: JobCache;
}

export interface JobRunner {
  os: 'ubuntu-latest' | 'ubuntu-22.04' | 'ubuntu-20.04' | 'windows-latest' | 'macos-latest' | 'self-hosted';
  labels?: string[];
}

export interface PipelineStep {
  id: string;
  name: string;
  type: 'run' | 'action' | 'checkout' | 'setup' | 'upload' | 'download' | 'deploy';
  run?: string;
  uses?: string;
  with?: Record<string, string>;
  env?: Record<string, string>;
  if?: string;
  continueOnError?: boolean;
  timeout?: number;
}

export interface JobMatrix {
  include?: Record<string, string>[];
  exclude?: Record<string, string>[];
  values: Record<string, string[]>;
}

export interface JobService {
  name: string;
  image: string;
  ports?: number[];
  env?: Record<string, string>;
  options?: string;
}

export interface JobArtifact {
  name: string;
  path: string;
  retention?: number; // days
}

export interface JobCache {
  key: string;
  paths: string[];
  restoreKeys?: string[];
}

export interface PipelineEnvironment {
  name: string;
  url?: string;
  protection?: EnvironmentProtection;
}

export interface EnvironmentProtection {
  requiredReviewers?: string[];
  waitTimer?: number; // minutes
  branchPolicy?: string[];
}

export interface PipelineSecret {
  name: string;
  description?: string;
  required: boolean;
  scope: 'repository' | 'environment' | 'organization';
}

export type PipelineStatus = 'active' | 'disabled' | 'pending' | 'error';

export interface PipelineRun {
  id: string;
  pipelineId: string;
  number: number;
  status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled' | 'skipped';
  trigger: PipelineTrigger;
  commit?: string;
  branch?: string;
  stages: StageRun[];
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  logs?: string;
}

export interface StageRun {
  stageId: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled' | 'skipped';
  jobs: JobRun[];
  startedAt?: Date;
  completedAt?: Date;
}

export interface JobRun {
  jobId: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled' | 'skipped';
  steps: StepRun[];
  runner?: string;
  startedAt?: Date;
  completedAt?: Date;
  logs?: string;
}

export interface StepRun {
  stepId: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled' | 'skipped';
  output?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
}

export interface PipelineConfig {
  concurrency?: {
    group: string;
    cancelInProgress?: boolean;
  };
  timeout?: number;
  notifications?: NotificationConfig;
  badges?: boolean;
}

export interface NotificationConfig {
  slack?: { webhook: string; channel?: string };
  discord?: { webhook: string };
  email?: { recipients: string[] };
  onSuccess?: boolean;
  onFailure?: boolean;
}

// Pre-commit hook types
export interface PreCommitConfig {
  hooks: PreCommitHook[];
  skipCI?: string[];
  failFast?: boolean;
}

export interface PreCommitHook {
  id: string;
  name: string;
  type: 'lint' | 'format' | 'test' | 'security' | 'custom';
  command: string;
  files?: string; // Glob pattern
  exclude?: string;
  stages?: ('commit' | 'push' | 'merge-commit')[];
  passFilenames?: boolean;
}

// PR Check types
export interface PRCheckConfig {
  checks: PRCheck[];
  requiredChecks: string[];
  autoMerge?: AutoMergeConfig;
}

export interface PRCheck {
  id: string;
  name: string;
  type: 'status' | 'code-review' | 'test' | 'lint' | 'security' | 'coverage' | 'custom';
  required: boolean;
  context?: string;
  targetBranches?: string[];
}

export interface AutoMergeConfig {
  enabled: boolean;
  method: 'merge' | 'squash' | 'rebase';
  requiredApprovals: number;
  deleteSourceBranch?: boolean;
}

// Template types for pipeline generation
export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  provider: CICDProvider;
  language: string;
  framework?: string;
  stages: PipelineStage[];
  requiredSecrets: PipelineSecret[];
}

export interface PipelineGenerationRequest {
  projectId: string;
  provider: CICDProvider;
  language: string;
  framework?: string;
  features: PipelineFeature[];
  deployment?: DeploymentTarget;
}

export type PipelineFeature =
  | 'lint'
  | 'format'
  | 'test'
  | 'coverage'
  | 'security-scan'
  | 'build'
  | 'docker'
  | 'deploy'
  | 'notifications'
  | 'caching'
  | 'matrix-testing'
  | 'preview-environments';

export interface DeploymentTarget {
  platform: 'vercel' | 'railway' | 'aws' | 'gcp' | 'azure' | 'heroku' | 'netlify' | 'docker';
  environment: 'development' | 'staging' | 'production';
  autoDeploy?: boolean;
}

// ============================================================================
// Workflow Generator
// ============================================================================

class GitHubActionsGenerator {
  /**
   * Generate a complete GitHub Actions workflow YAML
   */
  generateWorkflow(pipeline: Pipeline): string {
    const workflow: Record<string, unknown> = {
      name: pipeline.name,
      on: this.generateTriggers(pipeline.triggers),
      ...(pipeline.config.concurrency && { concurrency: pipeline.config.concurrency }),
      env: this.generateGlobalEnv(pipeline.environment),
      jobs: this.generateJobs(pipeline.stages)
    };

    return this.toYAML(workflow);
  }

  private generateTriggers(triggers: PipelineTrigger[]): Record<string, unknown> {
    const on: Record<string, unknown> = {};

    for (const trigger of triggers) {
      switch (trigger.type) {
        case 'push':
          on.push = {
            ...(trigger.branches && { branches: trigger.branches }),
            ...(trigger.paths && { paths: trigger.paths })
          };
          break;
        case 'pull_request':
          on.pull_request = {
            ...(trigger.branches && { branches: trigger.branches }),
            ...(trigger.paths && { paths: trigger.paths })
          };
          break;
        case 'schedule':
          on.schedule = [{ cron: trigger.schedule }];
          break;
        case 'manual':
          on.workflow_dispatch = {};
          break;
        case 'tag':
          on.push = { tags: trigger.tags || ['v*'] };
          break;
        case 'release':
          on.release = { types: ['published'] };
          break;
      }
    }

    return on;
  }

  private generateGlobalEnv(env: PipelineEnvironment): Record<string, string> {
    return {
      CI: 'true',
      ...(env.name && { ENVIRONMENT: env.name })
    };
  }

  private generateJobs(stages: PipelineStage[]): Record<string, unknown> {
    const jobs: Record<string, unknown> = {};

    for (const stage of stages) {
      for (const job of stage.jobs) {
        const jobConfig: Record<string, unknown> = {
          name: job.name,
          'runs-on': job.runner.os,
          ...(job.timeout && { 'timeout-minutes': job.timeout }),
          ...(job.continueOnError && { 'continue-on-error': job.continueOnError }),
          ...(stage.dependsOn && { needs: stage.dependsOn }),
          ...(stage.condition && { if: stage.condition }),
          ...(job.env && { env: job.env }),
          steps: this.generateSteps(job.steps)
        };

        if (job.matrix) {
          jobConfig.strategy = {
            matrix: job.matrix.values,
            ...(job.matrix.include && { include: job.matrix.include }),
            ...(job.matrix.exclude && { exclude: job.matrix.exclude })
          };
        }

        if (job.services && job.services.length > 0) {
          jobConfig.services = this.generateServices(job.services);
        }

        jobs[job.id] = jobConfig;
      }
    }

    return jobs;
  }

  private generateSteps(steps: PipelineStep[]): Record<string, unknown>[] {
    return steps.map(step => {
      const stepConfig: Record<string, unknown> = {
        name: step.name,
        ...(step.if && { if: step.if }),
        ...(step.continueOnError && { 'continue-on-error': step.continueOnError }),
        ...(step.timeout && { 'timeout-minutes': step.timeout }),
        ...(step.env && { env: step.env })
      };

      switch (step.type) {
        case 'checkout':
          stepConfig.uses = step.uses || 'actions/checkout@v4';
          break;
        case 'setup':
          stepConfig.uses = step.uses;
          if (step.with) stepConfig.with = step.with;
          break;
        case 'action':
          stepConfig.uses = step.uses;
          if (step.with) stepConfig.with = step.with;
          break;
        case 'run':
          stepConfig.run = step.run;
          break;
        case 'upload':
          stepConfig.uses = 'actions/upload-artifact@v4';
          stepConfig.with = step.with;
          break;
        case 'download':
          stepConfig.uses = 'actions/download-artifact@v4';
          stepConfig.with = step.with;
          break;
        case 'deploy':
          stepConfig.uses = step.uses;
          if (step.with) stepConfig.with = step.with;
          break;
      }

      return stepConfig;
    });
  }

  private generateServices(services: JobService[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const service of services) {
      result[service.name] = {
        image: service.image,
        ...(service.ports && { ports: service.ports.map(p => `${p}:${p}`) }),
        ...(service.env && { env: service.env }),
        ...(service.options && { options: service.options })
      };
    }

    return result;
  }

  private toYAML(obj: Record<string, unknown>, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;

      if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object') {
            const itemYaml = this.toYAML(item as Record<string, unknown>, indent + 2);
            const lines = itemYaml.split('\n').filter(l => l.trim());
            if (lines.length > 0) {
              yaml += `${spaces}  - ${lines[0].trim()}\n`;
              for (let i = 1; i < lines.length; i++) {
                yaml += `${spaces}    ${lines[i].trim()}\n`;
              }
            }
          } else {
            yaml += `${spaces}  - ${item}\n`;
          }
        }
      } else if (typeof value === 'object') {
        yaml += `${spaces}${key}:\n`;
        yaml += this.toYAML(value as Record<string, unknown>, indent + 1);
      } else if (typeof value === 'string' && (value.includes('\n') || value.includes(':'))) {
        yaml += `${spaces}${key}: |\n`;
        for (const line of value.split('\n')) {
          yaml += `${spaces}  ${line}\n`;
        }
      } else if (typeof value === 'boolean') {
        yaml += `${spaces}${key}: ${value}\n`;
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }

    return yaml;
  }
}

// ============================================================================
// Pre-commit Generator
// ============================================================================

class PreCommitGenerator {
  /**
   * Generate pre-commit configuration file
   */
  generateConfig(config: PreCommitConfig): string {
    const repos: Record<string, unknown>[] = [
      {
        repo: 'local',
        hooks: config.hooks.map(hook => ({
          id: hook.id,
          name: hook.name,
          entry: hook.command,
          language: 'system',
          ...(hook.files && { files: hook.files }),
          ...(hook.exclude && { exclude: hook.exclude }),
          ...(hook.stages && { stages: hook.stages }),
          ...(hook.passFilenames !== undefined && { pass_filenames: hook.passFilenames })
        }))
      }
    ];

    return [
      '# Pre-commit configuration',
      '# Install: pip install pre-commit && pre-commit install',
      '',
      `fail_fast: ${config.failFast ?? true}`,
      '',
      'repos:',
      ...this.formatRepos(repos)
    ].join('\n');
  }

  private formatRepos(repos: Record<string, unknown>[]): string[] {
    const lines: string[] = [];

    for (const repo of repos) {
      lines.push(`  - repo: ${repo.repo}`);

      if (repo.hooks && Array.isArray(repo.hooks)) {
        lines.push('    hooks:');
        for (const hook of repo.hooks) {
          lines.push(`      - id: ${hook.id}`);
          lines.push(`        name: ${hook.name}`);
          lines.push(`        entry: ${hook.entry}`);
          lines.push(`        language: ${hook.language}`);

          if (hook.files) lines.push(`        files: ${hook.files}`);
          if (hook.exclude) lines.push(`        exclude: ${hook.exclude}`);
          if (hook.stages) lines.push(`        stages: [${hook.stages.join(', ')}]`);
          if (hook.pass_filenames !== undefined) {
            lines.push(`        pass_filenames: ${hook.pass_filenames}`);
          }
        }
      }
    }

    return lines;
  }

  /**
   * Generate Git hooks script
   */
  generateHookScript(hookType: 'pre-commit' | 'pre-push' | 'commit-msg', commands: string[]): string {
    return [
      '#!/bin/sh',
      '# Generated by Infinity Assistant CI/CD Service',
      '',
      '# Colors for output',
      'RED="\\033[0;31m"',
      'GREEN="\\033[0;32m"',
      'YELLOW="\\033[1;33m"',
      'NC="\\033[0m" # No Color',
      '',
      'echo "${YELLOW}Running ' + hookType + ' hooks...${NC}"',
      '',
      ...commands.map(cmd => [
        `echo "Running: ${cmd}"`,
        cmd,
        'if [ $? -ne 0 ]; then',
        `  echo "\${RED}${hookType} hook failed: ${cmd}\${NC}"`,
        '  exit 1',
        'fi',
        ''
      ]).flat(),
      'echo "${GREEN}All ' + hookType + ' hooks passed!${NC}"',
      'exit 0'
    ].join('\n');
  }
}

// ============================================================================
// Pipeline Templates
// ============================================================================

class PipelineTemplates {
  private templates: Map<string, PipelineTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Node.js/TypeScript template
    this.templates.set('nodejs-typescript', {
      id: 'nodejs-typescript',
      name: 'Node.js TypeScript',
      description: 'CI/CD for Node.js TypeScript projects',
      provider: 'github-actions',
      language: 'typescript',
      stages: [
        {
          id: 'build-test',
          name: 'Build & Test',
          jobs: [
            {
              id: 'build',
              name: 'Build',
              runner: { os: 'ubuntu-latest' },
              steps: [
                { id: 'checkout', name: 'Checkout', type: 'checkout' },
                { id: 'setup-node', name: 'Setup Node.js', type: 'setup', uses: 'actions/setup-node@v4', with: { 'node-version': '20', 'cache': 'npm' } },
                { id: 'install', name: 'Install dependencies', type: 'run', run: 'npm ci' },
                { id: 'lint', name: 'Lint', type: 'run', run: 'npm run lint' },
                { id: 'typecheck', name: 'Type check', type: 'run', run: 'npm run typecheck' },
                { id: 'test', name: 'Test', type: 'run', run: 'npm test' },
                { id: 'build', name: 'Build', type: 'run', run: 'npm run build' }
              ],
              cache: { key: "npm-${{ hashFiles('**/package-lock.json') }}", paths: ['~/.npm'] }
            }
          ]
        }
      ],
      requiredSecrets: []
    });

    // Next.js template
    this.templates.set('nextjs', {
      id: 'nextjs',
      name: 'Next.js',
      description: 'CI/CD for Next.js applications',
      provider: 'github-actions',
      language: 'typescript',
      framework: 'nextjs',
      stages: [
        {
          id: 'build-test',
          name: 'Build & Test',
          jobs: [
            {
              id: 'build',
              name: 'Build',
              runner: { os: 'ubuntu-latest' },
              steps: [
                { id: 'checkout', name: 'Checkout', type: 'checkout' },
                { id: 'setup-node', name: 'Setup Node.js', type: 'setup', uses: 'actions/setup-node@v4', with: { 'node-version': '20', 'cache': 'npm' } },
                { id: 'install', name: 'Install dependencies', type: 'run', run: 'npm ci' },
                { id: 'lint', name: 'Lint', type: 'run', run: 'npm run lint' },
                { id: 'test', name: 'Test', type: 'run', run: 'npm test -- --coverage', continueOnError: true },
                { id: 'build', name: 'Build', type: 'run', run: 'npm run build' }
              ]
            }
          ]
        },
        {
          id: 'deploy',
          name: 'Deploy',
          dependsOn: ['build-test'],
          condition: "github.ref == 'refs/heads/main'",
          jobs: [
            {
              id: 'deploy-vercel',
              name: 'Deploy to Vercel',
              runner: { os: 'ubuntu-latest' },
              steps: [
                { id: 'checkout', name: 'Checkout', type: 'checkout' },
                { id: 'deploy', name: 'Deploy', type: 'action', uses: 'amondnet/vercel-action@v25', with: { 'vercel-token': '${{ secrets.VERCEL_TOKEN }}', 'vercel-org-id': '${{ secrets.VERCEL_ORG_ID }}', 'vercel-project-id': '${{ secrets.VERCEL_PROJECT_ID }}', 'vercel-args': '--prod' } }
              ]
            }
          ]
        }
      ],
      requiredSecrets: [
        { name: 'VERCEL_TOKEN', required: true, scope: 'repository' },
        { name: 'VERCEL_ORG_ID', required: true, scope: 'repository' },
        { name: 'VERCEL_PROJECT_ID', required: true, scope: 'repository' }
      ]
    });

    // Python template
    this.templates.set('python', {
      id: 'python',
      name: 'Python',
      description: 'CI/CD for Python projects',
      provider: 'github-actions',
      language: 'python',
      stages: [
        {
          id: 'test',
          name: 'Test',
          jobs: [
            {
              id: 'test',
              name: 'Test',
              runner: { os: 'ubuntu-latest' },
              matrix: { values: { 'python-version': ['3.10', '3.11', '3.12'] } },
              steps: [
                { id: 'checkout', name: 'Checkout', type: 'checkout' },
                { id: 'setup-python', name: 'Setup Python', type: 'setup', uses: 'actions/setup-python@v5', with: { 'python-version': '${{ matrix.python-version }}' } },
                { id: 'install', name: 'Install dependencies', type: 'run', run: 'pip install -r requirements.txt' },
                { id: 'lint', name: 'Lint', type: 'run', run: 'pip install ruff && ruff check .' },
                { id: 'test', name: 'Test', type: 'run', run: 'pip install pytest pytest-cov && pytest --cov' }
              ]
            }
          ]
        }
      ],
      requiredSecrets: []
    });

    // Docker template
    this.templates.set('docker', {
      id: 'docker',
      name: 'Docker',
      description: 'Build and push Docker images',
      provider: 'github-actions',
      language: 'any',
      stages: [
        {
          id: 'build-push',
          name: 'Build & Push',
          jobs: [
            {
              id: 'docker',
              name: 'Build Docker Image',
              runner: { os: 'ubuntu-latest' },
              steps: [
                { id: 'checkout', name: 'Checkout', type: 'checkout' },
                { id: 'setup-qemu', name: 'Set up QEMU', type: 'action', uses: 'docker/setup-qemu-action@v3' },
                { id: 'setup-buildx', name: 'Set up Docker Buildx', type: 'action', uses: 'docker/setup-buildx-action@v3' },
                { id: 'login', name: 'Login to Docker Hub', type: 'action', uses: 'docker/login-action@v3', with: { username: '${{ secrets.DOCKERHUB_USERNAME }}', password: '${{ secrets.DOCKERHUB_TOKEN }}' } },
                { id: 'build-push', name: 'Build and push', type: 'action', uses: 'docker/build-push-action@v5', with: { push: 'true', tags: '${{ secrets.DOCKERHUB_USERNAME }}/${{ github.event.repository.name }}:latest', platforms: 'linux/amd64,linux/arm64' } }
              ]
            }
          ]
        }
      ],
      requiredSecrets: [
        { name: 'DOCKERHUB_USERNAME', required: true, scope: 'repository' },
        { name: 'DOCKERHUB_TOKEN', required: true, scope: 'repository' }
      ]
    });
  }

  getTemplate(id: string): PipelineTemplate | undefined {
    return this.templates.get(id);
  }

  getTemplates(): PipelineTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByLanguage(language: string): PipelineTemplate[] {
    return this.getTemplates().filter(t => t.language === language || t.language === 'any');
  }
}

// ============================================================================
// Main Service
// ============================================================================

type CICDEvent = 'pipeline:created' | 'pipeline:updated' | 'pipeline:run:started' | 'pipeline:run:completed';
type EventHandler = (data: unknown) => void;

export class CICDPipelineService {
  private static instance: CICDPipelineService;
  private pipelines: Map<string, Pipeline> = new Map();
  private runs: Map<string, PipelineRun[]> = new Map();
  private githubGenerator: GitHubActionsGenerator;
  private preCommitGenerator: PreCommitGenerator;
  private templates: PipelineTemplates;
  private eventHandlers: Map<CICDEvent, EventHandler[]> = new Map();

  private constructor() {
    this.githubGenerator = new GitHubActionsGenerator();
    this.preCommitGenerator = new PreCommitGenerator();
    this.templates = new PipelineTemplates();
  }

  static getInstance(): CICDPipelineService {
    if (!CICDPipelineService.instance) {
      CICDPipelineService.instance = new CICDPipelineService();
    }
    return CICDPipelineService.instance;
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  subscribe(event: CICDEvent, handler: EventHandler): () => void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);

    return () => {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    };
  }

  private emit(event: CICDEvent, data: unknown): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  // ---------------------------------------------------------------------------
  // Pipeline Management
  // ---------------------------------------------------------------------------

  async createPipeline(
    name: string,
    projectId: string,
    provider: CICDProvider,
    config: Partial<PipelineConfig> = {}
  ): Promise<Pipeline> {
    const id = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const pipeline: Pipeline = {
      id,
      name,
      projectId,
      provider,
      triggers: [{ type: 'push', branches: ['main'] }, { type: 'pull_request' }],
      stages: [],
      environment: { name: 'production' },
      secrets: [],
      status: 'pending',
      config: {
        concurrency: { group: `$\{{ github.workflow }}-$\{{ github.ref }}`, cancelInProgress: true },
        timeout: 30,
        badges: true,
        ...config
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.pipelines.set(id, pipeline);
    this.emit('pipeline:created', pipeline);

    return pipeline;
  }

  async getPipeline(id: string): Promise<Pipeline | undefined> {
    return this.pipelines.get(id);
  }

  async getPipelinesByProject(projectId: string): Promise<Pipeline[]> {
    return Array.from(this.pipelines.values()).filter(p => p.projectId === projectId);
  }

  async updatePipeline(id: string, updates: Partial<Pipeline>): Promise<Pipeline | undefined> {
    const pipeline = this.pipelines.get(id);
    if (!pipeline) return undefined;

    const updated = { ...pipeline, ...updates, updatedAt: new Date() };
    this.pipelines.set(id, updated);
    this.emit('pipeline:updated', updated);

    return updated;
  }

  async deletePipeline(id: string): Promise<boolean> {
    const deleted = this.pipelines.delete(id);
    this.runs.delete(id);
    return deleted;
  }

  // ---------------------------------------------------------------------------
  // Pipeline Generation
  // ---------------------------------------------------------------------------

  async generatePipeline(request: PipelineGenerationRequest): Promise<Pipeline> {
    // Find appropriate template
    const templateId = request.framework || request.language;
    const template = this.templates.getTemplate(templateId) ||
                     this.templates.getTemplatesByLanguage(request.language)[0];

    // Create base pipeline
    const pipeline = await this.createPipeline(
      `${request.framework || request.language} CI/CD`,
      request.projectId,
      request.provider
    );

    // Apply template stages
    if (template) {
      pipeline.stages = JSON.parse(JSON.stringify(template.stages));
      pipeline.secrets = [...template.requiredSecrets];
    }

    // Add requested features
    this.addFeatures(pipeline, request.features);

    // Add deployment if requested
    if (request.deployment) {
      this.addDeployment(pipeline, request.deployment);
    }

    this.pipelines.set(pipeline.id, pipeline);
    return pipeline;
  }

  private addFeatures(pipeline: Pipeline, features: PipelineFeature[]): void {
    // Find or create the main build stage
    let buildStage = pipeline.stages.find(s => s.id === 'build-test');
    if (!buildStage) {
      buildStage = { id: 'build-test', name: 'Build & Test', jobs: [] };
      pipeline.stages.unshift(buildStage);
    }

    let mainJob = buildStage.jobs[0];
    if (!mainJob) {
      mainJob = {
        id: 'build',
        name: 'Build',
        runner: { os: 'ubuntu-latest' },
        steps: [{ id: 'checkout', name: 'Checkout', type: 'checkout' }]
      };
      buildStage.jobs.push(mainJob);
    }

    for (const feature of features) {
      switch (feature) {
        case 'coverage':
          mainJob.steps.push({
            id: 'coverage',
            name: 'Upload coverage',
            type: 'action',
            uses: 'codecov/codecov-action@v4',
            with: { token: '${{ secrets.CODECOV_TOKEN }}' }
          });
          pipeline.secrets.push({ name: 'CODECOV_TOKEN', required: false, scope: 'repository' });
          break;

        case 'security-scan':
          mainJob.steps.push({
            id: 'security',
            name: 'Security scan',
            type: 'action',
            uses: 'github/codeql-action/analyze@v3'
          });
          break;

        case 'docker':
          pipeline.stages.push({
            id: 'docker',
            name: 'Docker',
            dependsOn: ['build-test'],
            jobs: [{
              id: 'docker-build',
              name: 'Build Docker Image',
              runner: { os: 'ubuntu-latest' },
              steps: [
                { id: 'checkout', name: 'Checkout', type: 'checkout' },
                { id: 'buildx', name: 'Set up Buildx', type: 'action', uses: 'docker/setup-buildx-action@v3' },
                { id: 'build', name: 'Build', type: 'action', uses: 'docker/build-push-action@v5', with: { push: 'false', tags: 'app:latest' } }
              ]
            }]
          });
          break;

        case 'caching':
          mainJob.cache = {
            key: "${{ runner.os }}-${{ hashFiles('**/package-lock.json', '**/yarn.lock') }}",
            paths: ['node_modules', '~/.npm', '~/.cache']
          };
          break;

        case 'matrix-testing':
          mainJob.matrix = {
            values: {
              'node-version': ['18', '20', '22'],
              os: ['ubuntu-latest', 'windows-latest']
            }
          };
          mainJob.runner = { os: '${{ matrix.os }}' as 'ubuntu-latest' };
          break;

        case 'notifications':
          pipeline.config.notifications = {
            slack: { webhook: '${{ secrets.SLACK_WEBHOOK }}' },
            onFailure: true
          };
          pipeline.secrets.push({ name: 'SLACK_WEBHOOK', required: false, scope: 'repository' });
          break;
      }
    }
  }

  private addDeployment(pipeline: Pipeline, target: DeploymentTarget): void {
    const deployStage: PipelineStage = {
      id: 'deploy',
      name: `Deploy to ${target.environment}`,
      dependsOn: ['build-test'],
      condition: target.environment === 'production'
        ? "github.ref == 'refs/heads/main'"
        : undefined,
      jobs: []
    };

    switch (target.platform) {
      case 'vercel':
        deployStage.jobs.push({
          id: 'deploy-vercel',
          name: 'Deploy to Vercel',
          runner: { os: 'ubuntu-latest' },
          steps: [
            { id: 'checkout', name: 'Checkout', type: 'checkout' },
            {
              id: 'deploy',
              name: 'Deploy',
              type: 'action',
              uses: 'amondnet/vercel-action@v25',
              with: {
                'vercel-token': '${{ secrets.VERCEL_TOKEN }}',
                'vercel-org-id': '${{ secrets.VERCEL_ORG_ID }}',
                'vercel-project-id': '${{ secrets.VERCEL_PROJECT_ID }}',
                'vercel-args': target.environment === 'production' ? '--prod' : ''
              }
            }
          ]
        });
        pipeline.secrets.push(
          { name: 'VERCEL_TOKEN', required: true, scope: 'repository' },
          { name: 'VERCEL_ORG_ID', required: true, scope: 'repository' },
          { name: 'VERCEL_PROJECT_ID', required: true, scope: 'repository' }
        );
        break;

      case 'railway':
        deployStage.jobs.push({
          id: 'deploy-railway',
          name: 'Deploy to Railway',
          runner: { os: 'ubuntu-latest' },
          steps: [
            { id: 'checkout', name: 'Checkout', type: 'checkout' },
            {
              id: 'deploy',
              name: 'Deploy',
              type: 'run',
              run: 'npm install -g @railway/cli && railway up',
              env: { RAILWAY_TOKEN: '${{ secrets.RAILWAY_TOKEN }}' }
            }
          ]
        });
        pipeline.secrets.push({ name: 'RAILWAY_TOKEN', required: true, scope: 'repository' });
        break;

      case 'aws':
        deployStage.jobs.push({
          id: 'deploy-aws',
          name: 'Deploy to AWS',
          runner: { os: 'ubuntu-latest' },
          steps: [
            { id: 'checkout', name: 'Checkout', type: 'checkout' },
            {
              id: 'configure-aws',
              name: 'Configure AWS',
              type: 'action',
              uses: 'aws-actions/configure-aws-credentials@v4',
              with: {
                'aws-access-key-id': '${{ secrets.AWS_ACCESS_KEY_ID }}',
                'aws-secret-access-key': '${{ secrets.AWS_SECRET_ACCESS_KEY }}',
                'aws-region': 'us-east-1'
              }
            },
            { id: 'deploy', name: 'Deploy', type: 'run', run: 'aws s3 sync ./dist s3://${{ secrets.S3_BUCKET }}' }
          ]
        });
        pipeline.secrets.push(
          { name: 'AWS_ACCESS_KEY_ID', required: true, scope: 'repository' },
          { name: 'AWS_SECRET_ACCESS_KEY', required: true, scope: 'repository' },
          { name: 'S3_BUCKET', required: true, scope: 'repository' }
        );
        break;
    }

    pipeline.stages.push(deployStage);
  }

  // ---------------------------------------------------------------------------
  // Workflow Generation
  // ---------------------------------------------------------------------------

  generateWorkflowYAML(pipeline: Pipeline): string {
    switch (pipeline.provider) {
      case 'github-actions':
        return this.githubGenerator.generateWorkflow(pipeline);
      default:
        throw new Error(`Provider ${pipeline.provider} not yet supported`);
    }
  }

  generateWorkflowFiles(pipeline: Pipeline): { path: string; content: string }[] {
    const files: { path: string; content: string }[] = [];

    switch (pipeline.provider) {
      case 'github-actions':
        files.push({
          path: `.github/workflows/${pipeline.name.toLowerCase().replace(/\s+/g, '-')}.yml`,
          content: this.generateWorkflowYAML(pipeline)
        });
        break;
    }

    return files;
  }

  // ---------------------------------------------------------------------------
  // Pre-commit Hooks
  // ---------------------------------------------------------------------------

  generatePreCommitConfig(language: string, features: string[]): PreCommitConfig {
    const hooks: PreCommitHook[] = [];

    if (language === 'typescript' || language === 'javascript') {
      if (features.includes('lint')) {
        hooks.push({
          id: 'eslint',
          name: 'ESLint',
          type: 'lint',
          command: 'npx eslint --fix',
          files: '\\.(js|jsx|ts|tsx)$',
          passFilenames: true
        });
      }

      if (features.includes('format')) {
        hooks.push({
          id: 'prettier',
          name: 'Prettier',
          type: 'format',
          command: 'npx prettier --write',
          files: '\\.(js|jsx|ts|tsx|json|md|css|scss)$',
          passFilenames: true
        });
      }

      if (features.includes('typecheck')) {
        hooks.push({
          id: 'typecheck',
          name: 'TypeScript',
          type: 'lint',
          command: 'npx tsc --noEmit',
          files: '\\.tsx?$',
          passFilenames: false
        });
      }
    }

    if (language === 'python') {
      if (features.includes('lint')) {
        hooks.push({
          id: 'ruff',
          name: 'Ruff',
          type: 'lint',
          command: 'ruff check --fix',
          files: '\\.py$',
          passFilenames: true
        });
      }

      if (features.includes('format')) {
        hooks.push({
          id: 'black',
          name: 'Black',
          type: 'format',
          command: 'black',
          files: '\\.py$',
          passFilenames: true
        });
      }
    }

    // Security checks
    if (features.includes('security')) {
      hooks.push({
        id: 'secrets',
        name: 'Detect secrets',
        type: 'security',
        command: 'npx secretlint',
        passFilenames: true
      });
    }

    return { hooks, failFast: true };
  }

  generatePreCommitFile(config: PreCommitConfig): string {
    return this.preCommitGenerator.generateConfig(config);
  }

  generateGitHook(hookType: 'pre-commit' | 'pre-push' | 'commit-msg', commands: string[]): string {
    return this.preCommitGenerator.generateHookScript(hookType, commands);
  }

  // ---------------------------------------------------------------------------
  // PR Checks
  // ---------------------------------------------------------------------------

  generatePRCheckConfig(checks: string[]): PRCheckConfig {
    const prChecks: PRCheck[] = [];

    if (checks.includes('lint')) {
      prChecks.push({ id: 'lint', name: 'Lint', type: 'lint', required: true });
    }

    if (checks.includes('test')) {
      prChecks.push({ id: 'test', name: 'Tests', type: 'test', required: true });
    }

    if (checks.includes('coverage')) {
      prChecks.push({ id: 'coverage', name: 'Code Coverage', type: 'coverage', required: false });
    }

    if (checks.includes('security')) {
      prChecks.push({ id: 'security', name: 'Security Scan', type: 'security', required: true });
    }

    if (checks.includes('review')) {
      prChecks.push({ id: 'review', name: 'Code Review', type: 'code-review', required: true });
    }

    return {
      checks: prChecks,
      requiredChecks: prChecks.filter(c => c.required).map(c => c.id),
      autoMerge: {
        enabled: false,
        method: 'squash',
        requiredApprovals: 1,
        deleteSourceBranch: true
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Pipeline Runs
  // ---------------------------------------------------------------------------

  async triggerRun(pipelineId: string, trigger: PipelineTrigger): Promise<PipelineRun> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    const pipelineRuns = this.runs.get(pipelineId) || [];
    const runNumber = pipelineRuns.length + 1;

    const run: PipelineRun = {
      id: `run-${Date.now()}`,
      pipelineId,
      number: runNumber,
      status: 'pending',
      trigger,
      stages: pipeline.stages.map(stage => ({
        stageId: stage.id,
        status: 'pending',
        jobs: stage.jobs.map(job => ({
          jobId: job.id,
          status: 'pending',
          steps: job.steps.map(step => ({
            stepId: step.id,
            status: 'pending'
          }))
        }))
      })),
      startedAt: new Date()
    };

    pipelineRuns.push(run);
    this.runs.set(pipelineId, pipelineRuns);

    this.emit('pipeline:run:started', run);

    // Simulate run execution
    this.simulateRun(run);

    return run;
  }

  private async simulateRun(run: PipelineRun): Promise<void> {
    run.status = 'running';

    for (const stage of run.stages) {
      stage.status = 'running';
      stage.startedAt = new Date();

      for (const job of stage.jobs) {
        job.status = 'running';
        job.startedAt = new Date();

        for (const step of job.steps) {
          step.status = 'running';
          step.startedAt = new Date();

          // Simulate step execution
          await new Promise(resolve => setTimeout(resolve, 100));

          step.status = 'success';
          step.completedAt = new Date();
          step.duration = step.completedAt.getTime() - step.startedAt.getTime();
        }

        job.status = 'success';
        job.completedAt = new Date();
      }

      stage.status = 'success';
      stage.completedAt = new Date();
    }

    run.status = 'success';
    run.completedAt = new Date();
    run.duration = run.completedAt.getTime() - run.startedAt.getTime();

    this.emit('pipeline:run:completed', run);
  }

  async getRuns(pipelineId: string): Promise<PipelineRun[]> {
    return this.runs.get(pipelineId) || [];
  }

  async getRun(pipelineId: string, runId: string): Promise<PipelineRun | undefined> {
    const runs = this.runs.get(pipelineId) || [];
    return runs.find(r => r.id === runId);
  }

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  getTemplates(): PipelineTemplate[] {
    return this.templates.getTemplates();
  }

  getTemplate(id: string): PipelineTemplate | undefined {
    return this.templates.getTemplate(id);
  }
}

export default CICDPipelineService;
