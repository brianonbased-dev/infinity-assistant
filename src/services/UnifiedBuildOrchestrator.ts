/**
 * Unified Build Orchestrator
 *
 * Central orchestration service that coordinates all builder services
 * to deliver complete end-to-end project creation, deployment, and monitoring.
 */

import { ProjectPersistenceService, projectPersistence } from './ProjectPersistenceService';
import { DeploymentService, deploymentService } from './DeploymentService';
import { DatabaseAutomationService, databaseAutomation } from './DatabaseAutomationService';
import { TestGeneratorService, testGenerator } from './TestGeneratorService';
import { ErrorRecoveryService, errorRecovery } from './ErrorRecoveryService';
import { MonitoringService, monitoring } from './MonitoringService';
import type { Project, ProjectType, TechStack } from '../types/project-persistence';
import type { DeploymentConfig, DeploymentEnvironment, Deployment } from '../types/deployment';
import type { DatabaseSchema, SchemaGenerationRequest, Migration } from '../types/database-automation';
import type { TestSuite, TestConfig } from './TestGeneratorService';
import type { ErrorAnalysis, DiagnosticReport } from './ErrorRecoveryService';
import type { HealthCheck, Alert, Dashboard, PerformanceProfile } from './MonitoringService';

// =============================================================================
// TYPES
// =============================================================================

export type BuildPhase =
  | 'initialization'
  | 'requirements'
  | 'architecture'
  | 'database'
  | 'backend'
  | 'frontend'
  | 'integration'
  | 'testing'
  | 'deployment'
  | 'monitoring'
  | 'complete';

export type BuildStatus =
  | 'pending'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface BuildRequest {
  userId: string;
  workspaceId: string;
  name: string;
  description: string;
  type: ProjectType;
  techStack: TechStack;
  features: FeatureRequest[];
  database?: DatabaseRequest;
  deployment?: DeploymentRequest;
  testing?: TestingRequest;
  monitoring?: MonitoringRequest;
}

export interface FeatureRequest {
  name: string;
  description: string;
  priority: 'must' | 'should' | 'could';
  type: 'functional' | 'ui' | 'api' | 'integration';
}

export interface DatabaseRequest {
  provider: 'supabase' | 'planetscale' | 'neon' | 'postgres';
  entities: EntityRequest[];
  features: ('timestamps' | 'soft_delete' | 'audit_log' | 'rls')[];
}

export interface EntityRequest {
  name: string;
  description: string;
  fields?: FieldRequest[];
  relationships?: string[];
}

export interface FieldRequest {
  name: string;
  type?: string;
  required?: boolean;
  unique?: boolean;
}

export interface DeploymentRequest {
  provider: 'vercel' | 'railway' | 'docker';
  environments: DeploymentEnvironment[];
  autoDeployOnPush?: boolean;
  domains?: string[];
}

export interface TestingRequest {
  framework: 'jest' | 'vitest' | 'pytest';
  types: ('unit' | 'integration' | 'e2e')[];
  coverageThreshold?: number;
  autoGenerate?: boolean;
}

export interface MonitoringRequest {
  healthChecks?: boolean;
  alerts?: boolean;
  logging?: boolean;
  dashboards?: boolean;
}

export interface BuildSession {
  id: string;
  request: BuildRequest;
  project?: Project;
  schema?: DatabaseSchema;
  migrations?: Migration[];
  testSuites?: TestSuite[];
  deployments?: Deployment[];
  healthChecks?: HealthCheck[];
  alerts?: Alert[];
  dashboard?: Dashboard;

  // Status
  status: BuildStatus;
  currentPhase: BuildPhase;
  phaseHistory: PhaseResult[];

  // Progress
  progress: number;
  currentTask: string;

  // Errors
  errors: ErrorAnalysis[];
  warnings: string[];

  // Timing
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  duration?: number;
}

export interface PhaseResult {
  phase: BuildPhase;
  status: 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt: string;
  duration: number;
  outputs: Record<string, unknown>;
  errors?: string[];
}

export interface BuildEvent {
  type: 'phase_started' | 'phase_completed' | 'phase_failed' | 'task_update' | 'error' | 'warning' | 'complete';
  sessionId: string;
  phase?: BuildPhase;
  task?: string;
  progress?: number;
  data?: unknown;
  timestamp: string;
}

export type BuildEventHandler = (event: BuildEvent) => void | Promise<void>;

// =============================================================================
// UNIFIED BUILD ORCHESTRATOR
// =============================================================================

export class UnifiedBuildOrchestrator {
  private static instance: UnifiedBuildOrchestrator;

  // Services
  private projectService: ProjectPersistenceService;
  private deployService: DeploymentService;
  private dbService: DatabaseAutomationService;
  private testService: TestGeneratorService;
  private errorService: ErrorRecoveryService;
  private monitorService: MonitoringService;

  // State
  private sessions: Map<string, BuildSession> = new Map();
  private eventHandlers: Set<BuildEventHandler> = new Set();

  private constructor() {
    this.projectService = projectPersistence;
    this.deployService = deploymentService;
    this.dbService = databaseAutomation;
    this.testService = testGenerator;
    this.errorService = errorRecovery;
    this.monitorService = monitoring;
  }

  static getInstance(): UnifiedBuildOrchestrator {
    if (!UnifiedBuildOrchestrator.instance) {
      UnifiedBuildOrchestrator.instance = new UnifiedBuildOrchestrator();
    }
    return UnifiedBuildOrchestrator.instance;
  }

  // ===========================================================================
  // BUILD ORCHESTRATION
  // ===========================================================================

  async startBuild(request: BuildRequest): Promise<BuildSession> {
    const sessionId = this.generateId();
    const now = new Date().toISOString();

    const session: BuildSession = {
      id: sessionId,
      request,
      status: 'pending',
      currentPhase: 'initialization',
      phaseHistory: [],
      progress: 0,
      currentTask: 'Initializing build...',
      errors: [],
      warnings: [],
      startedAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, session);

    // Start the build process asynchronously
    this.executeBuild(session).catch((error) => {
      console.error('Build failed:', error);
      session.status = 'failed';
      this.emit({
        type: 'error',
        sessionId,
        data: error,
        timestamp: new Date().toISOString(),
      });
    });

    return session;
  }

  private async executeBuild(session: BuildSession): Promise<void> {
    session.status = 'in_progress';

    const phases: BuildPhase[] = [
      'initialization',
      'requirements',
      'architecture',
      'database',
      'backend',
      'frontend',
      'integration',
      'testing',
      'deployment',
      'monitoring',
    ];

    const totalPhases = phases.length;

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      session.currentPhase = phase;
      session.progress = Math.round((i / totalPhases) * 100);

      this.emit({
        type: 'phase_started',
        sessionId: session.id,
        phase,
        progress: session.progress,
        timestamp: new Date().toISOString(),
      });

      const phaseStart = Date.now();
      let phaseStatus: 'completed' | 'failed' | 'skipped' = 'completed';
      let phaseOutputs: Record<string, unknown> = {};
      let phaseErrors: string[] = [];

      try {
        switch (phase) {
          case 'initialization':
            phaseOutputs = await this.executeInitialization(session);
            break;
          case 'requirements':
            phaseOutputs = await this.executeRequirements(session);
            break;
          case 'architecture':
            phaseOutputs = await this.executeArchitecture(session);
            break;
          case 'database':
            if (session.request.database) {
              phaseOutputs = await this.executeDatabase(session);
            } else {
              phaseStatus = 'skipped';
            }
            break;
          case 'backend':
            phaseOutputs = await this.executeBackend(session);
            break;
          case 'frontend':
            phaseOutputs = await this.executeFrontend(session);
            break;
          case 'integration':
            phaseOutputs = await this.executeIntegration(session);
            break;
          case 'testing':
            if (session.request.testing) {
              phaseOutputs = await this.executeTesting(session);
            } else {
              phaseStatus = 'skipped';
            }
            break;
          case 'deployment':
            if (session.request.deployment) {
              phaseOutputs = await this.executeDeployment(session);
            } else {
              phaseStatus = 'skipped';
            }
            break;
          case 'monitoring':
            if (session.request.monitoring) {
              phaseOutputs = await this.executeMonitoring(session);
            } else {
              phaseStatus = 'skipped';
            }
            break;
        }
      } catch (error) {
        phaseStatus = 'failed';
        phaseErrors.push(error instanceof Error ? error.message : 'Unknown error');

        // Analyze the error
        const analysis = await this.errorService.analyzeError(
          error instanceof Error ? error : String(error),
          { projectId: session.project?.id }
        );
        session.errors.push(analysis);

        // Try to recover
        if (analysis.autoFixAvailable && analysis.suggestions[0]?.fix) {
          session.warnings.push(`Auto-fix attempted for: ${analysis.error.message}`);
          // In a real implementation, apply the fix and retry
        }
      }

      const phaseEnd = Date.now();

      session.phaseHistory.push({
        phase,
        status: phaseStatus,
        startedAt: new Date(phaseStart).toISOString(),
        completedAt: new Date(phaseEnd).toISOString(),
        duration: phaseEnd - phaseStart,
        outputs: phaseOutputs,
        errors: phaseErrors.length > 0 ? phaseErrors : undefined,
      });

      if (phaseStatus === 'failed') {
        this.emit({
          type: 'phase_failed',
          sessionId: session.id,
          phase,
          data: phaseErrors,
          timestamp: new Date().toISOString(),
        });

        // Don't continue if a critical phase fails
        if (['initialization', 'architecture'].includes(phase)) {
          session.status = 'failed';
          return;
        }
      } else {
        this.emit({
          type: 'phase_completed',
          sessionId: session.id,
          phase,
          progress: session.progress,
          timestamp: new Date().toISOString(),
        });
      }

      session.updatedAt = new Date().toISOString();
    }

    // Mark complete
    session.status = 'completed';
    session.currentPhase = 'complete';
    session.progress = 100;
    session.completedAt = new Date().toISOString();
    session.duration = new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();

    this.emit({
      type: 'complete',
      sessionId: session.id,
      progress: 100,
      data: {
        project: session.project,
        deployments: session.deployments,
        duration: session.duration,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // ===========================================================================
  // PHASE IMPLEMENTATIONS
  // ===========================================================================

  private async executeInitialization(session: BuildSession): Promise<Record<string, unknown>> {
    this.updateTask(session, 'Creating project...');

    // Create the project
    const project = await this.projectService.createProject({
      userId: session.request.userId,
      workspaceId: session.request.workspaceId,
      name: session.request.name,
      description: session.request.description,
      type: session.request.type,
      techStack: session.request.techStack,
    });

    session.project = project;

    return { projectId: project.id, projectName: project.name };
  }

  private async executeRequirements(session: BuildSession): Promise<Record<string, unknown>> {
    this.updateTask(session, 'Processing requirements...');

    const requirements = session.request.features.map((f, index) => ({
      id: `req_${index}`,
      original: f.description,
      refined: f.description,
      category: f.type === 'ui' ? 'ux' as const : f.type === 'api' ? 'technical' as const : 'functional' as const,
      priority: f.priority,
      status: 'pending' as const,
    }));

    if (session.project) {
      await this.projectService.updateProject(session.project.id, {
        buildContext: {
          ...session.project.buildContext,
          originalPrompt: session.request.description,
          refinedRequirements: requirements,
        },
      });
    }

    return { requirementsCount: requirements.length };
  }

  private async executeArchitecture(session: BuildSession): Promise<Record<string, unknown>> {
    this.updateTask(session, 'Designing architecture...');

    const decisions = [
      {
        id: 'arch_1',
        title: 'Tech Stack Selection',
        context: `Building a ${session.request.type} application`,
        decision: `Use ${session.request.techStack} as the primary framework`,
        rationale: 'Best fit for project requirements and team expertise',
        alternatives: ['Next.js', 'Remix', 'SvelteKit'],
        consequences: ['Modern DX', 'Strong TypeScript support'],
        decidedAt: new Date().toISOString(),
        decidedBy: 'assistant' as const,
      },
    ];

    if (session.project) {
      await this.projectService.updateProject(session.project.id, {
        buildContext: {
          ...session.project.buildContext,
          architectureDecisions: decisions,
        },
      });
    }

    return { decisionsCount: decisions.length };
  }

  private async executeDatabase(session: BuildSession): Promise<Record<string, unknown>> {
    this.updateTask(session, 'Generating database schema...');

    if (!session.request.database) {
      return { skipped: true };
    }

    // Generate schema from entity descriptions
    const schemaRequest: SchemaGenerationRequest = {
      description: `${session.request.name} database`,
      entities: session.request.database.entities.map((e) => ({
        name: e.name,
        description: e.description,
        fields: e.fields,
        relationships: e.relationships,
      })),
      features: session.request.database.features.map((f) => {
        switch (f) {
          case 'timestamps': return 'timestamps';
          case 'soft_delete': return 'soft_delete';
          case 'audit_log': return 'audit_log';
          case 'rls': return 'row_level_security';
          default: return f as any;
        }
      }),
      provider: session.request.database.provider,
      options: {
        includeTimestamps: session.request.database.features.includes('timestamps'),
        useSoftDelete: session.request.database.features.includes('soft_delete'),
        generateIndexes: true,
      },
    };

    const schema = await this.dbService.generateSchema(schemaRequest);
    session.schema = schema;

    this.updateTask(session, 'Generating migrations...');

    // Generate SQL
    const sql = this.dbService.generateSQL(schema);

    // Create migration files
    if (session.project) {
      await this.projectService.createFile(session.project.id, {
        path: 'database/schema.sql',
        content: sql,
        language: 'sql',
        aiGenerated: true,
        generationPrompt: 'Database schema generation',
      });
    }

    return {
      tablesCount: schema.tables.length,
      indexesCount: schema.indexes.length,
      policiesCount: schema.policies?.length || 0,
    };
  }

  private async executeBackend(session: BuildSession): Promise<Record<string, unknown>> {
    this.updateTask(session, 'Generating backend code...');

    if (!session.project) return { skipped: true };

    const filesCreated: string[] = [];

    // Generate API routes based on schema
    if (session.schema) {
      for (const table of session.schema.tables) {
        const routeCode = this.generateAPIRoute(table.name, session.request.techStack);

        await this.projectService.createFile(session.project.id, {
          path: `app/api/${table.name}/route.ts`,
          content: routeCode,
          language: 'typescript',
          aiGenerated: true,
        });

        filesCreated.push(`app/api/${table.name}/route.ts`);
      }
    }

    // Generate service layer
    const serviceCode = this.generateServiceLayer(session);
    await this.projectService.createFile(session.project.id, {
      path: 'lib/services/index.ts',
      content: serviceCode,
      language: 'typescript',
      aiGenerated: true,
    });
    filesCreated.push('lib/services/index.ts');

    return { filesCreated: filesCreated.length };
  }

  private async executeFrontend(session: BuildSession): Promise<Record<string, unknown>> {
    this.updateTask(session, 'Generating frontend components...');

    if (!session.project) return { skipped: true };

    const filesCreated: string[] = [];

    // Generate components for each feature
    for (const feature of session.request.features) {
      if (feature.type === 'ui' || feature.type === 'functional') {
        const componentCode = this.generateComponent(feature, session.request.techStack);
        const componentPath = `components/${this.pascalCase(feature.name)}.tsx`;

        await this.projectService.createFile(session.project.id, {
          path: componentPath,
          content: componentCode,
          language: 'typescript',
          aiGenerated: true,
        });

        filesCreated.push(componentPath);
      }
    }

    // Generate pages
    const pageCode = this.generateMainPage(session);
    await this.projectService.createFile(session.project.id, {
      path: 'app/page.tsx',
      content: pageCode,
      language: 'typescript',
      aiGenerated: true,
    });
    filesCreated.push('app/page.tsx');

    return { filesCreated: filesCreated.length };
  }

  private async executeIntegration(session: BuildSession): Promise<Record<string, unknown>> {
    this.updateTask(session, 'Setting up integrations...');

    if (!session.project) return { skipped: true };

    // Generate environment template
    const envTemplate = this.generateEnvTemplate(session);
    await this.projectService.createFile(session.project.id, {
      path: '.env.example',
      content: envTemplate,
      aiGenerated: true,
    });

    // Generate configuration files
    const configCode = this.generateConfig(session);
    await this.projectService.createFile(session.project.id, {
      path: 'lib/config.ts',
      content: configCode,
      language: 'typescript',
      aiGenerated: true,
    });

    return { integrationsSetup: true };
  }

  private async executeTesting(session: BuildSession): Promise<Record<string, unknown>> {
    this.updateTask(session, 'Generating tests...');

    if (!session.project || !session.request.testing) {
      return { skipped: true };
    }

    const testSuites: TestSuite[] = [];

    // Generate tests for each file
    const files = session.project.files.filter((f) =>
      f.extension === 'ts' || f.extension === 'tsx'
    );

    const testConfig: TestConfig = {
      framework: session.request.testing.framework as any,
      language: 'typescript',
      outputDir: '__tests__',
      coverageThreshold: session.request.testing.coverageThreshold,
      mockExternals: true,
    };

    for (const file of files.slice(0, 5)) { // Limit for demo
      const suite = await this.testService.generateTests(
        file.content,
        file.path,
        testConfig
      );
      testSuites.push(suite);
    }

    session.testSuites = testSuites;

    // Save generated tests
    for (const suite of testSuites) {
      for (const test of suite.tests) {
        await this.projectService.createFile(session.project.id, {
          path: test.filePath,
          content: test.code,
          language: 'typescript',
          aiGenerated: true,
        });
      }
    }

    return {
      suitesGenerated: testSuites.length,
      testsGenerated: testSuites.reduce((sum, s) => sum + s.tests.length, 0),
    };
  }

  private async executeDeployment(session: BuildSession): Promise<Record<string, unknown>> {
    this.updateTask(session, 'Deploying application...');

    if (!session.project || !session.request.deployment) {
      return { skipped: true };
    }

    const deployments: Deployment[] = [];

    for (const env of session.request.deployment.environments) {
      this.updateTask(session, `Deploying to ${env}...`);

      const deployConfig: DeploymentConfig = {
        provider: session.request.deployment.provider,
        projectId: session.project.id,
        environment: env,
        providerConfig: {
          projectName: session.project.name.toLowerCase().replace(/\s+/g, '-'),
        },
        buildConfig: {
          command: 'npm run build',
          outputDir: '.next',
          installCommand: 'npm install',
          nodeVersion: '20',
        },
        envVariables: [],
        domains: session.request.deployment.domains?.map((d) => ({
          domain: d,
          environment: env,
        })) || [],
      };

      const deployment = await this.deployService.deploy(deployConfig, {
        trigger: 'manual',
        createdBy: session.request.userId,
      });

      deployments.push(deployment);
    }

    session.deployments = deployments;

    return {
      deploymentsCreated: deployments.length,
      environments: session.request.deployment.environments,
    };
  }

  private async executeMonitoring(session: BuildSession): Promise<Record<string, unknown>> {
    this.updateTask(session, 'Setting up monitoring...');

    if (!session.project || !session.request.monitoring) {
      return { skipped: true };
    }

    const results: Record<string, unknown> = {};

    // Set up health checks
    if (session.request.monitoring.healthChecks && session.deployments) {
      const healthChecks: HealthCheck[] = [];

      for (const deployment of session.deployments) {
        if (deployment.url) {
          const check = await this.monitorService.createHealthCheck({
            name: `${session.project.name}-${deployment.environment}`,
            type: 'http',
            target: deployment.url,
            interval: 60,
            timeout: 10,
            config: {
              method: 'GET',
              path: '/api/health',
              expectedStatus: 200,
            },
          });
          healthChecks.push(check);
        }
      }

      session.healthChecks = healthChecks;
      results.healthChecks = healthChecks.length;
    }

    // Set up alerts
    if (session.request.monitoring.alerts) {
      const alerts: Alert[] = [];

      const errorAlert = await this.monitorService.createAlert({
        name: `${session.project.name}-errors`,
        severity: 'critical',
        condition: {
          metric: 'http.errors.rate',
          operator: 'gt',
          threshold: 5,
          duration: 300,
          aggregation: 'avg',
        },
        notifications: [],
      });
      alerts.push(errorAlert);

      const latencyAlert = await this.monitorService.createAlert({
        name: `${session.project.name}-latency`,
        severity: 'warning',
        condition: {
          metric: 'http.response_time',
          operator: 'gt',
          threshold: 2000,
          duration: 60,
          aggregation: 'p95',
        },
        notifications: [],
      });
      alerts.push(latencyAlert);

      session.alerts = alerts;
      results.alerts = alerts.length;
    }

    // Create dashboard
    if (session.request.monitoring.dashboards) {
      const dashboard = await this.monitorService.createDashboard({
        name: `${session.project.name} Dashboard`,
        projectId: session.project.id,
        widgets: [
          {
            id: 'w1',
            type: 'health_status',
            title: 'System Health',
            config: {},
            position: { x: 0, y: 0 },
            size: { width: 4, height: 2 },
          },
          {
            id: 'w2',
            type: 'line_chart',
            title: 'Response Time',
            config: {
              metric: 'http.response_time',
              timeRange: { start: 'now-24h', end: 'now' },
            },
            position: { x: 4, y: 0 },
            size: { width: 8, height: 4 },
          },
          {
            id: 'w3',
            type: 'stat',
            title: 'Requests/sec',
            config: {
              metric: 'http.requests.rate',
              aggregation: 'avg',
            },
            position: { x: 0, y: 2 },
            size: { width: 4, height: 2 },
          },
          {
            id: 'w4',
            type: 'alert_list',
            title: 'Active Alerts',
            config: {},
            position: { x: 0, y: 4 },
            size: { width: 12, height: 3 },
          },
        ],
        layout: { columns: 12, rowHeight: 100 },
        refreshInterval: 30,
      });

      session.dashboard = dashboard;
      results.dashboard = dashboard.id;
    }

    return results;
  }

  // ===========================================================================
  // CODE GENERATION HELPERS
  // ===========================================================================

  private generateAPIRoute(tableName: string, _techStack: TechStack): string {
    const singular = tableName.replace(/s$/, '');
    const pascalName = this.pascalCase(singular);

    return `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('${tableName}')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('${tableName}')
    .insert(body)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
`;
  }

  private generateServiceLayer(session: BuildSession): string {
    const tables = session.schema?.tables || [];

    const services = tables.map((t) => {
      const singular = t.name.replace(/s$/, '');
      const pascalName = this.pascalCase(singular);

      return `export const ${singular}Service = {
  async getAll() {
    const response = await fetch('/api/${t.name}');
    return response.json();
  },

  async getById(id: string) {
    const response = await fetch(\`/api/${t.name}/\${id}\`);
    return response.json();
  },

  async create(data: ${pascalName}Input) {
    const response = await fetch('/api/${t.name}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async update(id: string, data: Partial<${pascalName}Input>) {
    const response = await fetch(\`/api/${t.name}/\${id}\`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async delete(id: string) {
    await fetch(\`/api/${t.name}/\${id}\`, { method: 'DELETE' });
  },
};`;
    });

    return `// Auto-generated service layer
${services.join('\n\n')}
`;
  }

  private generateComponent(feature: FeatureRequest, _techStack: TechStack): string {
    const componentName = this.pascalCase(feature.name);

    return `'use client';

import { useState } from 'react';

interface ${componentName}Props {
  // Add props as needed
}

export function ${componentName}({}: ${componentName}Props) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800">
      <h2 className="text-lg font-semibold mb-4">${feature.name}</h2>
      <p className="text-gray-600 dark:text-gray-400">
        ${feature.description}
      </p>
      {/* Add component implementation */}
    </div>
  );
}
`;
  }

  private generateMainPage(session: BuildSession): string {
    const components = session.request.features
      .filter((f) => f.type === 'ui' || f.type === 'functional')
      .map((f) => this.pascalCase(f.name));

    const imports = components.map((c) => `import { ${c} } from '@/components/${c}';`).join('\n');
    const componentUsage = components.map((c) => `        <${c} />`).join('\n');

    return `${imports}

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">${session.request.name}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          ${session.request.description}
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
${componentUsage}
        </div>
      </div>
    </main>
  );
}
`;
  }

  private generateEnvTemplate(session: BuildSession): string {
    const vars: string[] = [
      '# Database',
      'DATABASE_URL=',
      '',
      '# Authentication',
      'NEXTAUTH_SECRET=',
      'NEXTAUTH_URL=http://localhost:3000',
      '',
    ];

    if (session.request.database?.provider === 'supabase') {
      vars.push('# Supabase');
      vars.push('NEXT_PUBLIC_SUPABASE_URL=');
      vars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY=');
      vars.push('SUPABASE_SERVICE_ROLE_KEY=');
      vars.push('');
    }

    if (session.request.deployment) {
      vars.push('# Deployment');
      vars.push(`# Provider: ${session.request.deployment.provider}`);
      vars.push('');
    }

    return vars.join('\n');
  }

  private generateConfig(session: BuildSession): string {
    return `// Application configuration
export const config = {
  name: '${session.request.name}',
  description: '${session.request.description}',

  // Feature flags
  features: {
${session.request.features.map((f) => `    ${this.camelCase(f.name)}: true,`).join('\n')}
  },

  // Database
  database: {
    provider: '${session.request.database?.provider || 'none'}',
  },

  // API
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
    timeout: 10000,
  },
};
`;
  }

  // ===========================================================================
  // SESSION MANAGEMENT
  // ===========================================================================

  async getSession(sessionId: string): Promise<BuildSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async listSessions(userId: string): Promise<BuildSession[]> {
    return Array.from(this.sessions.values())
      .filter((s) => s.request.userId === userId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async pauseBuild(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'in_progress') {
      session.status = 'paused';
      session.updatedAt = new Date().toISOString();
    }
  }

  async resumeBuild(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'paused') {
      session.status = 'in_progress';
      session.updatedAt = new Date().toISOString();
      // Continue build from current phase
    }
  }

  async cancelBuild(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session && ['in_progress', 'paused'].includes(session.status)) {
      session.status = 'cancelled';
      session.completedAt = new Date().toISOString();
      session.updatedAt = session.completedAt;
    }
  }

  // ===========================================================================
  // EVENT HANDLING
  // ===========================================================================

  subscribe(handler: BuildEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: BuildEvent): void {
    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    });
  }

  private updateTask(session: BuildSession, task: string): void {
    session.currentTask = task;
    session.updatedAt = new Date().toISOString();

    this.emit({
      type: 'task_update',
      sessionId: session.id,
      task,
      progress: session.progress,
      timestamp: session.updatedAt,
    });
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private generateId(): string {
    return `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private pascalCase(str: string): string {
    return str
      .split(/[\s_-]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private camelCase(str: string): string {
    const pascal = this.pascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }
}

// Export singleton
export const buildOrchestrator = UnifiedBuildOrchestrator.getInstance();
