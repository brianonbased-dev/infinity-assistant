/**
 * Enterprise Tier Service
 *
 * Premium enterprise tier that extends White Glove with:
 * - Dedicated AI agent provisioning
 * - Custom agent configurations
 * - Agent team management
 * - Priority support and SLAs
 * - Advanced analytics and reporting
 * - Browser automation capabilities
 * - Multi-workspace support
 *
 * Enterprise Flow:
 * 1. White Glove setup (OAuth integrations)
 * 2. Agent team provisioning based on template needs
 * 3. Agent configuration and customization
 * 4. Browser session assignment for deep automation
 * 5. Continuous monitoring and optimization
 */

import { whiteGloveService, type WhiteGloveSession, type RequiredIntegration } from './WhiteGloveService';
import { integrationService } from './IntegrationService';
import type { IntegrationProvider, UserIntegration } from '@/types/integrations';
import type { BuilderTemplate } from '@/types/builder-templates';

// ============================================================================
// TYPES
// ============================================================================

export type EnterpriseTier = 'starter' | 'growth' | 'scale' | 'enterprise';

export interface EnterprisePlan {
  tier: EnterpriseTier;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  features: EnterpriseFeatures;
  limits: EnterpriseLimits;
}

export interface EnterpriseFeatures {
  whiteGloveSetup: boolean;
  dedicatedAgents: boolean;
  customAgentConfig: boolean;
  browserAutomation: boolean;
  prioritySupport: boolean;
  slaGuarantee: boolean;
  advancedAnalytics: boolean;
  multiWorkspace: boolean;
  apiAccess: boolean;
  customIntegrations: boolean;
  teamManagement: boolean;
  auditLogs: boolean;
}

export interface EnterpriseLimits {
  maxAgents: number;
  maxWorkspaces: number;
  maxBuildsPerMonth: number;
  maxIntegrations: number;
  maxTeamMembers: number;
  storageGb: number;
  supportResponseHours: number;
}

export interface EnterpriseSession extends WhiteGloveSession {
  enterpriseTier: EnterpriseTier;
  provisionedAgents: ProvisionedAgent[];
  agentAssignments: AgentAssignment[];
  workspaces: EnterpriseWorkspace[];
  analytics: EnterpriseAnalytics;
}

export interface ProvisionedAgent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  configuration: AgentConfiguration;
  assignedIntegrations: string[]; // integration IDs
  browserSessionId?: string;
  createdAt: Date;
  lastActiveAt?: Date;
  metrics: AgentMetrics;
}

export type AgentType =
  | 'builder'      // Builds and deploys applications
  | 'monitor'      // Monitors health and performance
  | 'support'      // Handles user support tickets
  | 'analyst'      // Analyzes data and generates reports
  | 'automation'   // Runs automated workflows
  | 'security'     // Security scanning and compliance
  | 'custom';      // Custom configured agent

export type AgentStatus =
  | 'provisioning'
  | 'configuring'
  | 'ready'
  | 'active'
  | 'paused'
  | 'error'
  | 'terminated';

export interface AgentConfiguration {
  model: 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku' | 'gpt-4' | 'gpt-4-turbo';
  systemPrompt?: string;
  tools: string[];
  permissions: AgentPermissions;
  schedule?: AgentSchedule;
  triggers?: AgentTrigger[];
  customInstructions?: string;
}

export interface AgentPermissions {
  canReadFiles: boolean;
  canWriteFiles: boolean;
  canExecuteCode: boolean;
  canAccessBrowser: boolean;
  canCallApis: boolean;
  canSendNotifications: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
}

export interface AgentSchedule {
  enabled: boolean;
  cron?: string;
  timezone: string;
  runOnWeekends: boolean;
}

export interface AgentTrigger {
  type: 'webhook' | 'schedule' | 'event' | 'manual';
  config: Record<string, unknown>;
}

export interface AgentAssignment {
  agentId: string;
  integrationId: string;
  role: 'primary' | 'backup' | 'readonly';
  assignedAt: Date;
}

export interface AgentMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageResponseTime: number;
  uptime: number;
  lastError?: string;
}

export interface EnterpriseWorkspace {
  id: string;
  name: string;
  description?: string;
  templateId: string;
  status: 'active' | 'paused' | 'archived';
  assignedAgents: string[];
  createdAt: Date;
}

export interface EnterpriseAnalytics {
  totalBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  totalAgentHours: number;
  costToDate: number;
  integrationUsage: Record<string, number>;
  agentPerformance: Record<string, AgentMetrics>;
}

// ============================================================================
// ENTERPRISE PLANS
// ============================================================================

export const ENTERPRISE_PLANS: Record<EnterpriseTier, EnterprisePlan> = {
  starter: {
    tier: 'starter',
    name: 'Starter',
    monthlyPrice: 99,
    annualPrice: 990,
    features: {
      whiteGloveSetup: true,
      dedicatedAgents: true,
      customAgentConfig: false,
      browserAutomation: false,
      prioritySupport: false,
      slaGuarantee: false,
      advancedAnalytics: false,
      multiWorkspace: false,
      apiAccess: true,
      customIntegrations: false,
      teamManagement: false,
      auditLogs: false,
    },
    limits: {
      maxAgents: 2,
      maxWorkspaces: 1,
      maxBuildsPerMonth: 10,
      maxIntegrations: 5,
      maxTeamMembers: 1,
      storageGb: 5,
      supportResponseHours: 48,
    },
  },
  growth: {
    tier: 'growth',
    name: 'Growth',
    monthlyPrice: 299,
    annualPrice: 2990,
    features: {
      whiteGloveSetup: true,
      dedicatedAgents: true,
      customAgentConfig: true,
      browserAutomation: true,
      prioritySupport: true,
      slaGuarantee: false,
      advancedAnalytics: true,
      multiWorkspace: true,
      apiAccess: true,
      customIntegrations: false,
      teamManagement: true,
      auditLogs: true,
    },
    limits: {
      maxAgents: 5,
      maxWorkspaces: 3,
      maxBuildsPerMonth: 50,
      maxIntegrations: 15,
      maxTeamMembers: 5,
      storageGb: 25,
      supportResponseHours: 24,
    },
  },
  scale: {
    tier: 'scale',
    name: 'Scale',
    monthlyPrice: 799,
    annualPrice: 7990,
    features: {
      whiteGloveSetup: true,
      dedicatedAgents: true,
      customAgentConfig: true,
      browserAutomation: true,
      prioritySupport: true,
      slaGuarantee: true,
      advancedAnalytics: true,
      multiWorkspace: true,
      apiAccess: true,
      customIntegrations: true,
      teamManagement: true,
      auditLogs: true,
    },
    limits: {
      maxAgents: 15,
      maxWorkspaces: 10,
      maxBuildsPerMonth: 200,
      maxIntegrations: 50,
      maxTeamMembers: 20,
      storageGb: 100,
      supportResponseHours: 4,
    },
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 0, // Custom pricing
    annualPrice: 0,
    features: {
      whiteGloveSetup: true,
      dedicatedAgents: true,
      customAgentConfig: true,
      browserAutomation: true,
      prioritySupport: true,
      slaGuarantee: true,
      advancedAnalytics: true,
      multiWorkspace: true,
      apiAccess: true,
      customIntegrations: true,
      teamManagement: true,
      auditLogs: true,
    },
    limits: {
      maxAgents: -1, // Unlimited
      maxWorkspaces: -1,
      maxBuildsPerMonth: -1,
      maxIntegrations: -1,
      maxTeamMembers: -1,
      storageGb: -1,
      supportResponseHours: 1,
    },
  },
};

// ============================================================================
// AGENT TEMPLATES
// ============================================================================

export interface AgentTemplate {
  type: AgentType;
  name: string;
  description: string;
  defaultConfig: Partial<AgentConfiguration>;
  requiredIntegrations: IntegrationProvider[];
  optionalIntegrations: IntegrationProvider[];
}

const AGENT_TEMPLATES: Record<AgentType, AgentTemplate> = {
  builder: {
    type: 'builder',
    name: 'Builder Agent',
    description: 'Builds, tests, and deploys applications autonomously',
    defaultConfig: {
      model: 'claude-3-sonnet',
      tools: ['code_generation', 'file_operations', 'git', 'deployment'],
      permissions: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCode: true,
        canAccessBrowser: false,
        canCallApis: true,
        canSendNotifications: true,
      },
    },
    requiredIntegrations: ['github', 'vercel'],
    optionalIntegrations: ['supabase', 'stripe', 'resend'],
  },
  monitor: {
    type: 'monitor',
    name: 'Monitor Agent',
    description: 'Monitors application health, performance, and uptime',
    defaultConfig: {
      model: 'claude-3-haiku',
      tools: ['http_requests', 'metrics_collection', 'alerting'],
      permissions: {
        canReadFiles: true,
        canWriteFiles: false,
        canExecuteCode: false,
        canAccessBrowser: false,
        canCallApis: true,
        canSendNotifications: true,
      },
    },
    requiredIntegrations: [],
    optionalIntegrations: ['slack', 'discord', 'telegram'],
  },
  support: {
    type: 'support',
    name: 'Support Agent',
    description: 'Handles customer support tickets and inquiries',
    defaultConfig: {
      model: 'claude-3-sonnet',
      tools: ['ticket_management', 'knowledge_base', 'email'],
      permissions: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCode: false,
        canAccessBrowser: true,
        canCallApis: true,
        canSendNotifications: true,
      },
    },
    requiredIntegrations: [],
    optionalIntegrations: ['slack', 'discord', 'notion', 'linear'],
  },
  analyst: {
    type: 'analyst',
    name: 'Analyst Agent',
    description: 'Analyzes data and generates insights and reports',
    defaultConfig: {
      model: 'claude-3-opus',
      tools: ['data_analysis', 'visualization', 'report_generation'],
      permissions: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCode: true,
        canAccessBrowser: false,
        canCallApis: true,
        canSendNotifications: false,
      },
    },
    requiredIntegrations: [],
    optionalIntegrations: ['supabase', 'notion', 'google'],
  },
  automation: {
    type: 'automation',
    name: 'Automation Agent',
    description: 'Runs automated workflows and scheduled tasks',
    defaultConfig: {
      model: 'claude-3-haiku',
      tools: ['workflow_execution', 'scheduling', 'api_calls'],
      permissions: {
        canReadFiles: true,
        canWriteFiles: true,
        canExecuteCode: true,
        canAccessBrowser: true,
        canCallApis: true,
        canSendNotifications: true,
      },
    },
    requiredIntegrations: [],
    optionalIntegrations: ['github', 'slack', 'notion'],
  },
  security: {
    type: 'security',
    name: 'Security Agent',
    description: 'Scans for vulnerabilities and ensures compliance',
    defaultConfig: {
      model: 'claude-3-sonnet',
      tools: ['vulnerability_scanning', 'compliance_checking', 'audit_logging'],
      permissions: {
        canReadFiles: true,
        canWriteFiles: false,
        canExecuteCode: false,
        canAccessBrowser: false,
        canCallApis: true,
        canSendNotifications: true,
      },
    },
    requiredIntegrations: ['github'],
    optionalIntegrations: ['slack', 'linear'],
  },
  custom: {
    type: 'custom',
    name: 'Custom Agent',
    description: 'Fully customizable agent for specific use cases',
    defaultConfig: {
      model: 'claude-3-sonnet',
      tools: [],
      permissions: {
        canReadFiles: false,
        canWriteFiles: false,
        canExecuteCode: false,
        canAccessBrowser: false,
        canCallApis: false,
        canSendNotifications: false,
      },
    },
    requiredIntegrations: [],
    optionalIntegrations: [],
  },
};

// ============================================================================
// ENTERPRISE TIER SERVICE
// ============================================================================

class EnterpriseTierServiceImpl {
  private sessions: Map<string, EnterpriseSession> = new Map();
  private agents: Map<string, ProvisionedAgent> = new Map();

  /**
   * Start an enterprise session
   */
  async startEnterpriseSession(
    userId: string,
    template: BuilderTemplate,
    tier: EnterpriseTier
  ): Promise<EnterpriseSession> {
    const plan = ENTERPRISE_PLANS[tier];

    // Start with white glove setup
    const whiteGloveSession = await whiteGloveService.startSession(userId, template);

    const enterpriseSession: EnterpriseSession = {
      ...whiteGloveSession,
      enterpriseTier: tier,
      provisionedAgents: [],
      agentAssignments: [],
      workspaces: [],
      analytics: {
        totalBuilds: 0,
        successfulBuilds: 0,
        failedBuilds: 0,
        totalAgentHours: 0,
        costToDate: 0,
        integrationUsage: {},
        agentPerformance: {},
      },
    };

    this.sessions.set(enterpriseSession.id, enterpriseSession);

    return enterpriseSession;
  }

  /**
   * Provision agents based on template needs
   */
  async provisionAgents(
    sessionId: string,
    agentTypes?: AgentType[]
  ): Promise<ProvisionedAgent[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const plan = ENTERPRISE_PLANS[session.enterpriseTier];

    // Determine which agents to provision
    const typesToProvision = agentTypes || this.recommendAgentsForTemplate(session);

    // Check limits
    const currentAgentCount = session.provisionedAgents.length;
    const maxAgents = plan.limits.maxAgents;
    if (maxAgents !== -1 && currentAgentCount + typesToProvision.length > maxAgents) {
      throw new Error(`Agent limit exceeded. Max: ${maxAgents}, Current: ${currentAgentCount}, Requested: ${typesToProvision.length}`);
    }

    const provisionedAgents: ProvisionedAgent[] = [];

    for (const agentType of typesToProvision) {
      const template = AGENT_TEMPLATES[agentType];
      const agent = await this.createAgent(session.userId, agentType, template);

      provisionedAgents.push(agent);
      session.provisionedAgents.push(agent);
      this.agents.set(agent.id, agent);
    }

    return provisionedAgents;
  }

  /**
   * Create a single agent
   */
  private async createAgent(
    userId: string,
    type: AgentType,
    template: AgentTemplate
  ): Promise<ProvisionedAgent> {
    const agent: ProvisionedAgent = {
      id: crypto.randomUUID(),
      name: `${template.name} - ${new Date().toISOString().split('T')[0]}`,
      type,
      status: 'provisioning',
      configuration: {
        model: template.defaultConfig.model || 'claude-3-sonnet',
        tools: template.defaultConfig.tools || [],
        permissions: template.defaultConfig.permissions || {
          canReadFiles: false,
          canWriteFiles: false,
          canExecuteCode: false,
          canAccessBrowser: false,
          canCallApis: false,
          canSendNotifications: false,
        },
      },
      assignedIntegrations: [],
      createdAt: new Date(),
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageResponseTime: 0,
        uptime: 100,
      },
    };

    // Simulate provisioning delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    agent.status = 'configuring';

    // Simulate configuration
    await new Promise((resolve) => setTimeout(resolve, 500));
    agent.status = 'ready';

    return agent;
  }

  /**
   * Recommend agents based on template requirements
   */
  private recommendAgentsForTemplate(session: EnterpriseSession): AgentType[] {
    const recommendations: AgentType[] = ['builder']; // Always need a builder

    // Check integrations to determine additional agents
    const integrations = session.requiredIntegrations.map((i) => i.provider);

    if (integrations.includes('slack') || integrations.includes('discord')) {
      recommendations.push('support');
    }

    if (integrations.includes('supabase') || integrations.includes('mongodb')) {
      recommendations.push('analyst');
    }

    if (integrations.includes('github')) {
      recommendations.push('security');
    }

    // Add monitor for production setups
    if (integrations.includes('vercel') || integrations.includes('railway')) {
      recommendations.push('monitor');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Assign integration to an agent
   */
  async assignIntegrationToAgent(
    sessionId: string,
    agentId: string,
    integrationId: string,
    role: 'primary' | 'backup' | 'readonly' = 'primary'
  ): Promise<AgentAssignment> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    const assignment: AgentAssignment = {
      agentId,
      integrationId,
      role,
      assignedAt: new Date(),
    };

    agent.assignedIntegrations.push(integrationId);
    session.agentAssignments.push(assignment);

    return assignment;
  }

  /**
   * Auto-assign integrations to agents based on their type
   */
  async autoAssignIntegrations(sessionId: string): Promise<AgentAssignment[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const assignments: AgentAssignment[] = [];
    const userIntegrations = await integrationService.getUserIntegrations(session.userId);

    for (const agent of session.provisionedAgents) {
      const template = AGENT_TEMPLATES[agent.type];

      // Find matching integrations
      for (const integration of userIntegrations) {
        const isRequired = template.requiredIntegrations.includes(integration.provider);
        const isOptional = template.optionalIntegrations.includes(integration.provider);

        if ((isRequired || isOptional) && integration.status === 'connected') {
          // Check if not already assigned
          const alreadyAssigned = session.agentAssignments.some(
            (a) => a.agentId === agent.id && a.integrationId === integration.id
          );

          if (!alreadyAssigned) {
            const assignment = await this.assignIntegrationToAgent(
              sessionId,
              agent.id,
              integration.id,
              isRequired ? 'primary' : 'readonly'
            );
            assignments.push(assignment);
          }
        }
      }
    }

    return assignments;
  }

  /**
   * Enable browser automation for an agent
   */
  async enableBrowserAutomation(
    sessionId: string,
    agentId: string,
    integrationId: string
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const plan = ENTERPRISE_PLANS[session.enterpriseTier];
    if (!plan.features.browserAutomation) {
      throw new Error('Browser automation not available on this tier');
    }

    const agent = this.agents.get(agentId);
    if (!agent) return false;

    const integration = await integrationService.getIntegrationById(integrationId);
    if (!integration?.browserSession) {
      throw new Error('No browser session captured for this integration');
    }

    agent.browserSessionId = integration.browserSession.iv; // Reference to browser session
    agent.configuration.permissions.canAccessBrowser = true;

    return true;
  }

  /**
   * Configure agent
   */
  async configureAgent(
    agentId: string,
    config: Partial<AgentConfiguration>
  ): Promise<ProvisionedAgent> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // Merge configurations
    agent.configuration = {
      ...agent.configuration,
      ...config,
      permissions: {
        ...agent.configuration.permissions,
        ...config.permissions,
      },
    };

    return agent;
  }

  /**
   * Start an agent
   */
  async startAgent(agentId: string): Promise<ProvisionedAgent> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    if (agent.status !== 'ready' && agent.status !== 'paused') {
      throw new Error(`Cannot start agent in ${agent.status} status`);
    }

    agent.status = 'active';
    agent.lastActiveAt = new Date();

    return agent;
  }

  /**
   * Pause an agent
   */
  async pauseAgent(agentId: string): Promise<ProvisionedAgent> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    agent.status = 'paused';

    return agent;
  }

  /**
   * Terminate an agent
   */
  async terminateAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.status = 'terminated';

    // Remove from sessions
    for (const session of this.sessions.values()) {
      session.provisionedAgents = session.provisionedAgents.filter((a) => a.id !== agentId);
      session.agentAssignments = session.agentAssignments.filter((a) => a.agentId !== agentId);
    }

    this.agents.delete(agentId);
  }

  /**
   * Create a workspace
   */
  async createWorkspace(
    sessionId: string,
    name: string,
    templateId: string,
    description?: string
  ): Promise<EnterpriseWorkspace> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const plan = ENTERPRISE_PLANS[session.enterpriseTier];

    if (!plan.features.multiWorkspace && session.workspaces.length > 0) {
      throw new Error('Multi-workspace not available on this tier');
    }

    const maxWorkspaces = plan.limits.maxWorkspaces;
    if (maxWorkspaces !== -1 && session.workspaces.length >= maxWorkspaces) {
      throw new Error(`Workspace limit exceeded. Max: ${maxWorkspaces}`);
    }

    const workspace: EnterpriseWorkspace = {
      id: crypto.randomUUID(),
      name,
      description,
      templateId,
      status: 'active',
      assignedAgents: [],
      createdAt: new Date(),
    };

    session.workspaces.push(workspace);

    return workspace;
  }

  /**
   * Assign agent to workspace
   */
  async assignAgentToWorkspace(
    sessionId: string,
    workspaceId: string,
    agentId: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const workspace = session.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (!workspace.assignedAgents.includes(agentId)) {
      workspace.assignedAgents.push(agentId);
    }
  }

  /**
   * Get session
   */
  getSession(sessionId: string): EnterpriseSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get agent
   */
  getAgent(agentId: string): ProvisionedAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents for a session
   */
  getSessionAgents(sessionId: string): ProvisionedAgent[] {
    const session = this.sessions.get(sessionId);
    return session?.provisionedAgents || [];
  }

  /**
   * Get analytics for a session
   */
  getAnalytics(sessionId: string): EnterpriseAnalytics | null {
    const session = this.sessions.get(sessionId);
    return session?.analytics || null;
  }

  /**
   * Update analytics
   */
  updateAnalytics(
    sessionId: string,
    updates: Partial<EnterpriseAnalytics>
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.analytics = {
        ...session.analytics,
        ...updates,
      };
    }
  }

  /**
   * Get available plans
   */
  getPlans(): EnterprisePlan[] {
    return Object.values(ENTERPRISE_PLANS);
  }

  /**
   * Get plan by tier
   */
  getPlan(tier: EnterpriseTier): EnterprisePlan {
    return ENTERPRISE_PLANS[tier];
  }

  /**
   * Get agent templates
   */
  getAgentTemplates(): AgentTemplate[] {
    return Object.values(AGENT_TEMPLATES);
  }

  /**
   * Get agent template by type
   */
  getAgentTemplate(type: AgentType): AgentTemplate {
    return AGENT_TEMPLATES[type];
  }

  /**
   * Check if feature is available for tier
   */
  isFeatureAvailable(tier: EnterpriseTier, feature: keyof EnterpriseFeatures): boolean {
    return ENTERPRISE_PLANS[tier].features[feature];
  }

  /**
   * Check if limit is exceeded
   */
  isLimitExceeded(
    sessionId: string,
    limitType: keyof EnterpriseLimits,
    currentValue: number
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return true;

    const limit = ENTERPRISE_PLANS[session.enterpriseTier].limits[limitType];
    return limit !== -1 && currentValue >= limit;
  }
}

// Export singleton
export const enterpriseTierService = new EnterpriseTierServiceImpl();

// Export class for testing
export { EnterpriseTierServiceImpl };
