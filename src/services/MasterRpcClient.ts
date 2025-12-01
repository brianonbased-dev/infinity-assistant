/**
 * Master RPC Client for InfinityAssistant
 *
 * Client for accessing UAA2's Master RPC system through the mesh network.
 * Provides type-safe access to master-level operations based on mesh level.
 *
 * Features:
 * - Level-based access (user/service/master)
 * - Automatic routing through mesh
 * - Batching support
 * - Type-safe action wrappers
 * - Caching for common queries
 */

import logger from '@/utils/logger';
import { meshNodeClient, type MeshLevel } from './MeshNodeClient';

// ============================================================================
// TYPES
// ============================================================================

export interface RpcRequest {
  id?: string;
  action: string;
  params?: Record<string, unknown>;
}

export interface RpcResponse<T = unknown> {
  success: boolean;
  requestId: string;
  action: string;
  data?: T;
  error?: string;
  errorCode?: string;
  duration?: number;
  timestamp: Date;
}

export interface BatchRpcRequest {
  batch: RpcRequest[];
  parallel?: boolean;
  stopOnError?: boolean;
}

export interface BatchRpcResponse {
  success: boolean;
  total: number;
  succeeded: number;
  failed: number;
  results: RpcResponse[];
  duration: number;
}

export interface RpcActionInfo {
  action: string;
  domain: string;
  requiredLevel: MeshLevel;
  description?: string;
  requiredParams?: string[];
}

// Response types for common actions
export interface SystemHealth {
  status: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  timestamp: Date;
}

export interface SystemInfo {
  version: string;
  nodeVersion: string;
  platform: string;
  environment: string;
  railway: boolean;
}

export interface MeshStatus {
  currentNode: string;
  nodes: Array<{
    nodeId: string;
    status: string;
    latencyMs: number;
  }>;
  connectedNodes: string[];
  isRunning: boolean;
  userNodeStats: {
    total: number;
    byLevel: Record<MeshLevel, number>;
    online: number;
  };
}

export interface AgentInfo {
  id: string;
  name: string;
  status: string;
  type: string;
  role?: string;
}

export interface TaskResult {
  taskId: string;
  agentId: string;
  status: string;
  queuedAt: Date;
}

// Inner Circle Agent Types
export interface InnerCircleAgent {
  id: string;
  name: string;
  role: string;
  status: string;
}

export interface InnerCircleStatus {
  circle: 'inner';
  overallStatus: string;
  agents: Record<string, { status: string; lastActivity: Date; currentTask: string | null }>;
  coordination: {
    lastSync: Date;
    pendingDecisions: number;
  };
}

export interface VisionStatus {
  agentId: string;
  name: string;
  status: string;
  role: string;
  currentVision: {
    horizon: string;
    priorities: string[];
    lastUpdated: Date;
  };
}

export interface ArchitectStatus {
  agentId: string;
  name: string;
  status: string;
  role: string;
  pendingDecisions: unknown[];
  recentDecisions: unknown[];
}

// Outer Circle Agent Types
export interface OuterCircleAgent {
  id: string;
  name: string;
  role: string;
  status: string;
}

export interface OuterCircleStatus {
  circle: 'outer';
  overallStatus: string;
  agents: Record<string, { status: string; lastActivity: Date; currentTask: string | null; queueLength: number }>;
  workload: {
    totalQueued: number;
    activeExecutions: number;
  };
}

export interface CeoAgentStatus {
  agentId: string;
  name: string;
  status: string;
  role: string;
  currentFocus: string | null;
  priorityQueue: unknown[];
}

export interface ManagerAgentStatus {
  agentId: string;
  name: string;
  status: string;
  role: string;
  activeProjects: number;
  pendingAudits: unknown[];
}

export interface BuilderAgentStatus {
  agentId: string;
  name: string;
  status: string;
  role: string;
  activeBuilds: unknown[];
  queuedBuilds: number;
}

export interface InfinityAgentStatus {
  agentId: string;
  name: string;
  status: string;
  role: string;
  activeProtocols: unknown[];
  autonomousMode: boolean;
}

// Lotus Flower Overview
export interface LotusFlowerOverview {
  structure: string;
  innerCircle: {
    description: string;
    agents: Array<{ id: string; name: string; role: string }>;
    count: number;
  };
  outerCircle: {
    description: string;
    agents: Array<{ id: string; name: string; role: string }>;
    count: number;
  };
  totalAgents: number;
  timestamp: Date;
}

// Orchestration Types
export interface OrchestrationResult {
  orchestrationId: string;
  objective: string;
  agents: string[];
  strategy: string;
  status: string;
  phases: string[];
  timestamp: Date;
}

export interface ProtocolResult {
  protocolId: string;
  protocol: string;
  phases: string[];
  currentPhase: string;
  status: string;
  timestamp: Date;
}

// ============================================================================
// MASTER RPC CLIENT
// ============================================================================

class MasterRpcClient {
  private uaa2Url: string;
  private apiKey: string | null = null;
  private sessionId: string | null = null;
  private actionsCache: RpcActionInfo[] | null = null;
  private actionsCacheTime: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.uaa2Url = process.env.UAA2_SERVICE_URL ||
                   process.env.UAA2_MESH_URL ||
                   'https://uaa2-service-production.up.railway.app';
  }

  /**
   * Set API key for authentication
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Set session ID for tracking
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  // ============================================================================
  // CORE RPC METHODS
  // ============================================================================

  /**
   * Execute a single RPC action
   */
  async execute<T = unknown>(
    action: string,
    params?: Record<string, unknown>
  ): Promise<RpcResponse<T>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Mesh-Level': meshNodeClient.getMeshLevel(),
        'X-Mesh-Node': 'infinity-assistant',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      if (this.sessionId) {
        headers['X-Session-Id'] = this.sessionId;
      }

      const response = await fetch(`${this.uaa2Url}/api/master/rpc`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, params }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          requestId: data.requestId || 'unknown',
          action,
          error: data.error || `HTTP ${response.status}`,
          errorCode: data.errorCode || 'HTTP_ERROR',
          timestamp: new Date(),
        };
      }

      return {
        success: data.success,
        requestId: data.requestId,
        action: data.action,
        data: data.data as T,
        error: data.error,
        errorCode: data.errorCode,
        duration: data.duration,
        timestamp: new Date(data.timestamp),
      };
    } catch (error) {
      logger.error('[MasterRPC] Execute error', { action, error });
      return {
        success: false,
        requestId: 'error',
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'NETWORK_ERROR',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Execute multiple RPC actions in batch
   */
  async executeBatch(
    requests: RpcRequest[],
    options?: { parallel?: boolean; stopOnError?: boolean }
  ): Promise<BatchRpcResponse> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Mesh-Level': meshNodeClient.getMeshLevel(),
        'X-Mesh-Node': 'infinity-assistant',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.uaa2Url}/api/master/rpc`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          batch: requests,
          parallel: options?.parallel ?? true,
          stopOnError: options?.stopOnError ?? false,
        }),
      });

      const data = await response.json();

      return {
        success: data.success,
        total: data.data?.total ?? requests.length,
        succeeded: data.data?.succeeded ?? 0,
        failed: data.data?.failed ?? requests.length,
        results: data.data?.results ?? [],
        duration: data.data?.duration ?? 0,
      };
    } catch (error) {
      logger.error('[MasterRPC] Batch execute error', { error });
      return {
        success: false,
        total: requests.length,
        succeeded: 0,
        failed: requests.length,
        results: [],
        duration: 0,
      };
    }
  }

  /**
   * Get available RPC actions
   */
  async getActions(domain?: string): Promise<RpcActionInfo[]> {
    // Check cache
    const now = Date.now();
    if (this.actionsCache && now - this.actionsCacheTime < this.CACHE_TTL) {
      const cached = domain
        ? this.actionsCache.filter(a => a.domain === domain)
        : this.actionsCache;
      return cached;
    }

    try {
      const url = new URL(`${this.uaa2Url}/api/master/rpc`);
      if (domain) {
        url.searchParams.set('domain', domain);
      }
      url.searchParams.set('level', meshNodeClient.getMeshLevel());

      const response = await fetch(url.toString(), {
        headers: {
          'X-Mesh-Level': meshNodeClient.getMeshLevel(),
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      // Flatten actions from domains
      const actions: RpcActionInfo[] = [];
      const actionsData = data.data?.actions || {};
      for (const domainActions of Object.values(actionsData)) {
        actions.push(...(domainActions as RpcActionInfo[]));
      }

      // Update cache
      if (!domain) {
        this.actionsCache = actions;
        this.actionsCacheTime = now;
      }

      return domain ? actions.filter(a => a.domain === domain) : actions;
    } catch (error) {
      logger.error('[MasterRPC] Get actions error', { error });
      return [];
    }
  }

  // ============================================================================
  // CONVENIENCE METHODS - SYSTEM
  // ============================================================================

  async getSystemHealth(): Promise<SystemHealth | null> {
    const result = await this.execute<SystemHealth>('system.health');
    return result.success ? result.data! : null;
  }

  async getSystemInfo(): Promise<SystemInfo | null> {
    const result = await this.execute<SystemInfo>('system.info');
    return result.success ? result.data! : null;
  }

  async getCapabilities(): Promise<{ level: string; capabilities: string[] } | null> {
    const result = await this.execute<{ level: string; capabilities: string[] }>('system.capabilities');
    return result.success ? result.data! : null;
  }

  // ============================================================================
  // CONVENIENCE METHODS - MESH
  // ============================================================================

  async getMeshStatus(): Promise<MeshStatus | null> {
    const result = await this.execute<MeshStatus>('mesh.status');
    return result.success ? result.data! : null;
  }

  async getMeshNodes(): Promise<{ nodes: unknown[]; userNodes: unknown[] } | null> {
    const result = await this.execute<{ nodes: unknown[]; userNodes: unknown[] }>('mesh.nodes');
    return result.success ? result.data! : null;
  }

  async broadcastMessage(payload: unknown, eventType?: string): Promise<boolean> {
    const result = await this.execute('mesh.broadcast', { payload, eventType });
    return result.success;
  }

  async routeByCapability(capability: string, payload?: unknown): Promise<unknown> {
    const result = await this.execute('mesh.route', { capability, payload });
    return result.success ? result.data : null;
  }

  // ============================================================================
  // CONVENIENCE METHODS - AGENTS (Legacy)
  // ============================================================================

  async listAgents(): Promise<AgentInfo[]> {
    const result = await this.execute<{ agents: AgentInfo[] }>('agent.list');
    return result.success ? result.data!.agents : [];
  }

  async executeAgent(agentId: string, task: string, params?: Record<string, unknown>): Promise<TaskResult | null> {
    const result = await this.execute<TaskResult>('agent.execute', {
      agentId,
      task,
      ...params,
    });
    return result.success ? result.data! : null;
  }

  async getAgentStatus(agentId: string): Promise<{ status: string; currentTask: unknown } | null> {
    const result = await this.execute<{ agentId: string; status: string; currentTask: unknown }>('agent.status', { agentId });
    return result.success ? result.data! : null;
  }

  // ============================================================================
  // CONVENIENCE METHODS - LOTUS FLOWER OVERVIEW
  // ============================================================================

  /**
   * Get the complete lotus flower organizational structure
   */
  async getLotusFlowerOverview(): Promise<LotusFlowerOverview | null> {
    const result = await this.execute<LotusFlowerOverview>('agent.lotus.overview');
    return result.success ? result.data! : null;
  }

  // ============================================================================
  // CONVENIENCE METHODS - INNER CIRCLE (Strategic Core)
  // ============================================================================

  /**
   * List all inner circle agents
   */
  async listInnerCircleAgents(): Promise<{ agents: InnerCircleAgent[]; total: number } | null> {
    const result = await this.execute<{ circle: string; agents: InnerCircleAgent[]; total: number }>('agent.inner.list');
    return result.success ? { agents: result.data!.agents, total: result.data!.total } : null;
  }

  /**
   * Get inner circle status overview
   */
  async getInnerCircleStatus(): Promise<InnerCircleStatus | null> {
    const result = await this.execute<InnerCircleStatus>('agent.inner.status');
    return result.success ? result.data! : null;
  }

  // Vision Agent
  async getVisionAgentStatus(): Promise<VisionStatus | null> {
    const result = await this.execute<VisionStatus>('agent.inner.vision.status');
    return result.success ? result.data! : null;
  }

  async setVisionDirection(direction: string, horizon?: string): Promise<boolean> {
    const result = await this.execute('agent.inner.vision.setDirection', { direction, horizon });
    return result.success;
  }

  async analyzeStrategicAlignment(topic: string): Promise<{ analysis: unknown } | null> {
    const result = await this.execute<{ analysis: unknown }>('agent.inner.vision.analyze', { topic });
    return result.success ? result.data! : null;
  }

  // Strategic Coordinator Agent
  async getCoordinatorStatus(): Promise<{ agentId: string; activeCoordinations: number; pendingAlignments: unknown[] } | null> {
    const result = await this.execute<{ agentId: string; name: string; status: string; activeCoordinations: number; pendingAlignments: unknown[] }>('agent.inner.coordinator.status');
    return result.success ? result.data! : null;
  }

  async initiateAgentAlignment(agents: string[], objective: string): Promise<{ alignmentId: string } | null> {
    const result = await this.execute<{ alignmentId: string; status: string }>('agent.inner.coordinator.align', { agents, objective });
    return result.success ? { alignmentId: result.data!.alignmentId } : null;
  }

  async broadcastStrategicMessage(message: string, circle?: 'inner' | 'outer' | 'all'): Promise<boolean> {
    const result = await this.execute('agent.inner.coordinator.broadcast', { message, circle });
    return result.success;
  }

  // System Architect Agent
  async getArchitectStatus(): Promise<ArchitectStatus | null> {
    const result = await this.execute<ArchitectStatus>('agent.inner.architect.status');
    return result.success ? result.data! : null;
  }

  async requestArchitectureReview(component: string): Promise<{ reviewId: string } | null> {
    const result = await this.execute<{ reviewId: string; status: string }>('agent.inner.architect.review', { component });
    return result.success ? { reviewId: result.data!.reviewId } : null;
  }

  async recordArchitectureDecision(decision: string, rationale: string): Promise<{ decisionId: string } | null> {
    const result = await this.execute<{ decisionId: string }>('agent.inner.architect.decide', { decision, rationale });
    return result.success ? { decisionId: result.data!.decisionId } : null;
  }

  // Researcher Agent (Inner Circle - Knowledge Hub)
  async getResearcherStatus(): Promise<{ agentId: string; activeResearch: unknown[]; knowledgeBaseStats: unknown } | null> {
    const result = await this.execute<{ agentId: string; name: string; status: string; activeResearch: unknown[]; knowledgeBaseStats: unknown }>('agent.inner.researcher.status');
    return result.success ? result.data! : null;
  }

  async startResearchTask(topic: string, depth?: 'quick' | 'standard' | 'deep'): Promise<{ researchId: string } | null> {
    const result = await this.execute<{ researchId: string; status: string }>('agent.inner.researcher.research', { topic, depth });
    return result.success ? { researchId: result.data!.researchId } : null;
  }

  async queryKnowledgeBase(query: string): Promise<{ results: unknown[]; sources: unknown[]; confidence: number }> {
    const result = await this.execute<{ query: string; results: unknown[]; sources: unknown[]; confidence: number }>('agent.inner.researcher.query', { query });
    return result.success ? result.data! : { results: [], sources: [], confidence: 0 };
  }

  // ============================================================================
  // CONVENIENCE METHODS - OUTER CIRCLE (Main Petals - Execution Layer)
  // ============================================================================

  /**
   * List all outer circle (main petals) agents
   */
  async listOuterCircleAgents(): Promise<{ agents: OuterCircleAgent[]; total: number } | null> {
    const result = await this.execute<{ circle: string; agents: OuterCircleAgent[]; total: number }>('agent.outer.list');
    return result.success ? { agents: result.data!.agents, total: result.data!.total } : null;
  }

  /**
   * Get outer circle status overview
   */
  async getOuterCircleStatus(): Promise<OuterCircleStatus | null> {
    const result = await this.execute<OuterCircleStatus>('agent.outer.status');
    return result.success ? result.data! : null;
  }

  // CEO Agent
  async getCeoAgentStatus(): Promise<CeoAgentStatus | null> {
    const result = await this.execute<CeoAgentStatus>('agent.outer.ceo.status');
    return result.success ? result.data! : null;
  }

  async issueCeoDirective(directive: string, priority?: 'low' | 'normal' | 'high' | 'critical'): Promise<{ directiveId: string } | null> {
    const result = await this.execute<{ directiveId: string; status: string }>('agent.outer.ceo.directive', { directive, priority });
    return result.success ? { directiveId: result.data!.directiveId } : null;
  }

  async requestStrategicPlan(goal: string, timeframe?: string): Promise<{ planId: string } | null> {
    const result = await this.execute<{ planId: string; status: string }>('agent.outer.ceo.strategize', { goal, timeframe });
    return result.success ? { planId: result.data!.planId } : null;
  }

  // Manager Agent
  async getManagerAgentStatus(): Promise<ManagerAgentStatus | null> {
    const result = await this.execute<ManagerAgentStatus>('agent.outer.manager.status');
    return result.success ? result.data! : null;
  }

  async requestAudit(target: string, type?: string): Promise<{ auditId: string } | null> {
    const result = await this.execute<{ auditId: string; status: string }>('agent.outer.manager.audit', { target, type });
    return result.success ? { auditId: result.data!.auditId } : null;
  }

  async coordinateAgentTask(task: string, agents: string[]): Promise<{ coordinationId: string } | null> {
    const result = await this.execute<{ coordinationId: string; status: string }>('agent.outer.manager.coordinate', { task, agents });
    return result.success ? { coordinationId: result.data!.coordinationId } : null;
  }

  // Builder Agent
  async getBuilderAgentStatus(): Promise<BuilderAgentStatus | null> {
    const result = await this.execute<BuilderAgentStatus>('agent.outer.builder.status');
    return result.success ? result.data! : null;
  }

  async createBuildTask(feature: string, spec?: Record<string, unknown>): Promise<{ buildId: string } | null> {
    const result = await this.execute<{ buildId: string; status: string }>('agent.outer.builder.build', { feature, spec });
    return result.success ? { buildId: result.data!.buildId } : null;
  }

  async deployBuild(buildId: string, environment?: 'staging' | 'production'): Promise<{ deploymentId: string } | null> {
    const result = await this.execute<{ deploymentId: string; status: string }>('agent.outer.builder.deploy', { buildId, environment });
    return result.success ? { deploymentId: result.data!.deploymentId } : null;
  }

  // Futurist Agent
  async getFuturistAgentStatus(): Promise<{ agentId: string; activeResearch: unknown[]; innovations: unknown[] } | null> {
    const result = await this.execute<{ agentId: string; name: string; status: string; activeResearch: unknown[]; innovations: unknown[] }>('agent.outer.futurist.status');
    return result.success ? result.data! : null;
  }

  async startInnovationResearch(domain: string, objective?: string): Promise<{ innovationId: string } | null> {
    const result = await this.execute<{ innovationId: string; status: string }>('agent.outer.futurist.innovate', { domain, objective });
    return result.success ? { innovationId: result.data!.innovationId } : null;
  }

  async generateForecast(topic: string, horizon?: string): Promise<{ forecastId: string; predictions: unknown[] } | null> {
    const result = await this.execute<{ forecastId: string; topic: string; predictions: unknown[]; confidence: number }>('agent.outer.futurist.forecast', { topic, horizon });
    return result.success ? { forecastId: result.data!.forecastId, predictions: result.data!.predictions } : null;
  }

  // Infinity Agent
  async getInfinityAgentStatus(): Promise<InfinityAgentStatus | null> {
    const result = await this.execute<InfinityAgentStatus>('agent.outer.infinity.status');
    return result.success ? result.data! : null;
  }

  async executeProtocol(protocol: string, params?: Record<string, unknown>, autonomous?: boolean): Promise<{ executionId: string } | null> {
    const result = await this.execute<{ executionId: string; status: string }>('agent.outer.infinity.execute', { protocol, params, autonomous });
    return result.success ? { executionId: result.data!.executionId } : null;
  }

  async configureAutomation(trigger: string, action: string): Promise<{ automationId: string } | null> {
    const result = await this.execute<{ automationId: string; enabled: boolean }>('agent.outer.infinity.automate', { trigger, action });
    return result.success ? { automationId: result.data!.automationId } : null;
  }

  // Customer Service Agent
  async getCustomerServiceStatus(): Promise<{ agentId: string; activeChats: number; queuedRequests: number; avgResponseTime: number } | null> {
    const result = await this.execute<{ agentId: string; name: string; status: string; activeChats: number; queuedRequests: number; avgResponseTime: number }>('agent.outer.customer-service.status');
    return result.success ? result.data! : null;
  }

  async createAssistanceTicket(userId: string, issue: string, priority?: 'low' | 'normal' | 'high'): Promise<{ ticketId: string } | null> {
    const result = await this.execute<{ ticketId: string; status: string }>('agent.outer.customer-service.assist', { userId, issue, priority });
    return result.success ? { ticketId: result.data!.ticketId } : null;
  }

  async escalateIssue(ticketId: string, reason: string): Promise<boolean> {
    const result = await this.execute('agent.outer.customer-service.escalate', { ticketId, reason });
    return result.success;
  }

  // ============================================================================
  // CONVENIENCE METHODS - AGENT ORCHESTRATION
  // ============================================================================

  /**
   * Start multi-agent orchestration
   */
  async orchestrateAgents(objective: string, agents?: string[], strategy?: 'collaborative' | 'sequential' | 'parallel'): Promise<OrchestrationResult | null> {
    const result = await this.execute<OrchestrationResult>('agent.orchestrate', { objective, agents, strategy });
    return result.success ? result.data! : null;
  }

  /**
   * Start a protocol cycle
   */
  async startProtocolCycle(protocol: string): Promise<ProtocolResult | null> {
    const result = await this.execute<ProtocolResult>('agent.protocol.start', { protocol });
    return result.success ? result.data! : null;
  }

  /**
   * Get protocol cycle status
   */
  async getProtocolStatus(protocolId: string): Promise<{ status: string; currentPhase: string | null; progress: number } | null> {
    const result = await this.execute<{ protocolId: string; status: string; currentPhase: string | null; progress: number; logs: unknown[] }>('agent.protocol.status', { protocolId });
    return result.success ? result.data! : null;
  }

  /**
   * Broadcast message to agents
   */
  async broadcastToAgents(message: string, circle?: 'inner' | 'outer' | 'all'): Promise<{ broadcastId: string; count: number } | null> {
    const result = await this.execute<{ broadcastId: string; message: string; sentTo: string[]; count: number }>('agent.broadcast', { message, circle });
    return result.success ? { broadcastId: result.data!.broadcastId, count: result.data!.count } : null;
  }

  // ============================================================================
  // CONVENIENCE METHODS - KNOWLEDGE
  // ============================================================================

  async searchKnowledge(query: string, options?: { type?: string; limit?: number }): Promise<{ results: unknown[]; total: number }> {
    const result = await this.execute<{ query: string; results: unknown[]; total: number }>('knowledge.search', {
      query,
      ...options,
    });
    return result.success ? result.data! : { results: [], total: 0 };
  }

  async startResearch(topic: string): Promise<{ researchId: string } | null> {
    const result = await this.execute<{ researchId: string; topic: string; status: string }>('knowledge.research', { topic });
    return result.success ? { researchId: result.data!.researchId } : null;
  }

  // ============================================================================
  // CONVENIENCE METHODS - CEO (Master Level Only)
  // ============================================================================

  async executeCeoCommand(command: string, params?: Record<string, unknown>): Promise<boolean> {
    const result = await this.execute('ceo.execute', { command, ...params });
    return result.success;
  }

  async getCeoStatus(): Promise<{ mode: string; priorityQueue: unknown[] } | null> {
    const result = await this.execute<{ mode: string; priorityQueue: unknown[]; lastCommand: unknown }>('ceo.status');
    return result.success ? result.data! : null;
  }

  // ============================================================================
  // CONVENIENCE METHODS - BUILDER (Master Level Only)
  // ============================================================================

  async deployProject(project: string, options?: Record<string, unknown>): Promise<{ deploymentId: string } | null> {
    const result = await this.execute<{ deploymentId: string; project: string; status: string }>('builder.deploy', {
      project,
      ...options,
    });
    return result.success ? { deploymentId: result.data!.deploymentId } : null;
  }

  async getDeploymentStatus(deploymentId: string): Promise<{ status: string; logs: string[] } | null> {
    const result = await this.execute<{ deploymentId: string; status: string; logs: string[] }>('builder.status', { deploymentId });
    return result.success ? result.data! : null;
  }

  // ============================================================================
  // CONVENIENCE METHODS - SECURITY (Master Level Only)
  // ============================================================================

  async listSecrets(): Promise<{ secrets: unknown[]; total: number }> {
    const result = await this.execute<{ secrets: unknown[]; total: number }>('security.secrets.list');
    return result.success ? result.data! : { secrets: [], total: 0 };
  }

  async getPendingApprovals(): Promise<{ approvals: unknown[]; total: number }> {
    const result = await this.execute<{ approvals: unknown[]; total: number }>('security.approvals.pending');
    return result.success ? result.data! : { approvals: [], total: 0 };
  }

  async approveRequest(approvalId: string): Promise<boolean> {
    const result = await this.execute('security.approvals.approve', { approvalId });
    return result.success;
  }

  // ============================================================================
  // CONVENIENCE METHODS - DOCKER (Master Level Only)
  // ============================================================================

  async listContainers(): Promise<{ containers: unknown[]; total: number }> {
    const result = await this.execute<{ containers: unknown[]; total: number }>('docker.containers');
    return result.success ? result.data! : { containers: [], total: 0 };
  }

  async startContainer(containerId: string): Promise<boolean> {
    const result = await this.execute('docker.start', { containerId });
    return result.success;
  }

  async stopContainer(containerId: string): Promise<boolean> {
    const result = await this.execute('docker.stop', { containerId });
    return result.success;
  }

  async dockerComposeUp(file?: string): Promise<boolean> {
    const result = await this.execute('docker.compose.up', { file });
    return result.success;
  }

  // ============================================================================
  // CONVENIENCE METHODS - ANALYTICS
  // ============================================================================

  async getAnalyticsStats(): Promise<{ conversations: number; messages: number; activeUsers: number } | null> {
    const result = await this.execute<{ conversations: number; messages: number; activeUsers: number; period: string }>('analytics.stats');
    return result.success ? result.data! : null;
  }

  async getUserUsage(userId: string): Promise<{ usage: { daily: number; monthly: number }; limits: { daily: number; monthly: number } } | null> {
    const result = await this.execute<{ userId: string; usage: { daily: number; monthly: number }; limits: { daily: number; monthly: number } }>('analytics.usage', { userId });
    return result.success ? result.data! : null;
  }

  // ============================================================================
  // QUICK BATCH OPERATIONS
  // ============================================================================

  /**
   * Get system overview (health + info + mesh status)
   */
  async getSystemOverview(): Promise<{
    health: SystemHealth | null;
    info: SystemInfo | null;
    mesh: MeshStatus | null;
  }> {
    const result = await this.executeBatch([
      { action: 'system.health' },
      { action: 'system.info' },
      { action: 'mesh.status' },
    ], { parallel: true });

    return {
      health: result.results[0]?.success ? result.results[0].data as SystemHealth : null,
      info: result.results[1]?.success ? result.results[1].data as SystemInfo : null,
      mesh: result.results[2]?.success ? result.results[2].data as MeshStatus : null,
    };
  }

  /**
   * Get master dashboard data (requires master level)
   */
  async getMasterDashboard(): Promise<{
    health: SystemHealth | null;
    mesh: MeshStatus | null;
    agents: AgentInfo[];
    containers: unknown[];
    pendingApprovals: number;
  }> {
    const result = await this.executeBatch([
      { action: 'system.health' },
      { action: 'mesh.status' },
      { action: 'agent.list' },
      { action: 'docker.containers' },
      { action: 'security.approvals.pending' },
    ], { parallel: true });

    return {
      health: result.results[0]?.success ? result.results[0].data as SystemHealth : null,
      mesh: result.results[1]?.success ? result.results[1].data as MeshStatus : null,
      agents: result.results[2]?.success ? (result.results[2].data as { agents: AgentInfo[] }).agents : [],
      containers: result.results[3]?.success ? (result.results[3].data as { containers: unknown[] }).containers : [],
      pendingApprovals: result.results[4]?.success ? (result.results[4].data as { total: number }).total : 0,
    };
  }

  /**
   * Get complete lotus flower agent dashboard (requires master level)
   */
  async getLotusFlowerDashboard(): Promise<{
    overview: LotusFlowerOverview | null;
    innerCircleStatus: InnerCircleStatus | null;
    outerCircleStatus: OuterCircleStatus | null;
    visionStatus: VisionStatus | null;
    ceoStatus: CeoAgentStatus | null;
  }> {
    const result = await this.executeBatch([
      { action: 'agent.lotus.overview' },
      { action: 'agent.inner.status' },
      { action: 'agent.outer.status' },
      { action: 'agent.inner.vision.status' },
      { action: 'agent.outer.ceo.status' },
    ], { parallel: true });

    return {
      overview: result.results[0]?.success ? result.results[0].data as LotusFlowerOverview : null,
      innerCircleStatus: result.results[1]?.success ? result.results[1].data as InnerCircleStatus : null,
      outerCircleStatus: result.results[2]?.success ? result.results[2].data as OuterCircleStatus : null,
      visionStatus: result.results[3]?.success ? result.results[3].data as VisionStatus : null,
      ceoStatus: result.results[4]?.success ? result.results[4].data as CeoAgentStatus : null,
    };
  }

  /**
   * Get all agent statuses in one batch call
   */
  async getAllAgentStatuses(): Promise<{
    innerCircle: {
      vision: VisionStatus | null;
      coordinator: unknown;
      architect: ArchitectStatus | null;
      researcher: unknown;
    };
    outerCircle: {
      ceo: CeoAgentStatus | null;
      manager: ManagerAgentStatus | null;
      builder: BuilderAgentStatus | null;
      futurist: unknown;
      infinity: InfinityAgentStatus | null;
      customerService: unknown;
    };
  }> {
    const result = await this.executeBatch([
      // Inner Circle
      { action: 'agent.inner.vision.status' },
      { action: 'agent.inner.coordinator.status' },
      { action: 'agent.inner.architect.status' },
      { action: 'agent.inner.researcher.status' },
      // Outer Circle
      { action: 'agent.outer.ceo.status' },
      { action: 'agent.outer.manager.status' },
      { action: 'agent.outer.builder.status' },
      { action: 'agent.outer.futurist.status' },
      { action: 'agent.outer.infinity.status' },
      { action: 'agent.outer.customer-service.status' },
    ], { parallel: true });

    return {
      innerCircle: {
        vision: result.results[0]?.success ? result.results[0].data as VisionStatus : null,
        coordinator: result.results[1]?.success ? result.results[1].data : null,
        architect: result.results[2]?.success ? result.results[2].data as ArchitectStatus : null,
        researcher: result.results[3]?.success ? result.results[3].data : null,
      },
      outerCircle: {
        ceo: result.results[4]?.success ? result.results[4].data as CeoAgentStatus : null,
        manager: result.results[5]?.success ? result.results[5].data as ManagerAgentStatus : null,
        builder: result.results[6]?.success ? result.results[6].data as BuilderAgentStatus : null,
        futurist: result.results[7]?.success ? result.results[7].data : null,
        infinity: result.results[8]?.success ? result.results[8].data as InfinityAgentStatus : null,
        customerService: result.results[9]?.success ? result.results[9].data : null,
      },
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const masterRpcClient = new MasterRpcClient();
export { MasterRpcClient };
