/**
 * Master RPC Client for InfinityAssistant
 *
 * Client for accessing UAA2's Master RPC system through the mesh network.
 * This is a SLIMMED DOWN version for InfinityAssistant public service.
 *
 * Features:
 * - Level-based access (user/service levels only)
 * - Automatic routing through mesh
 * - Batching support
 * - Type-safe action wrappers
 * - Caching for common queries
 *
 * NOTE: Master-level operations are handled by UAA2's Master Portal.
 * This client only exposes service/user level methods appropriate
 * for the public InfinityAssistant service.
 *
 * @since 2025-12-01
 */

import logger from '@/utils/logger';
import { meshNodeClient, type MeshLevel } from './MeshNodeClient';

// ============================================================================
// TYPES (Kept for reference and type safety)
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

// Inner Circle Agent Types (kept for reference)
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

// Orchestration Types (kept for reference)
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

// Knowledge Packet Types (Platform Benefits)
export interface KnowledgePacket {
  id: string;
  title: string;
  domain: string;
  type: 'research' | 'protocol' | 'insight' | 'documentation' | 'pattern';
  summary: string;
  content?: string;
  metadata: {
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    version: string;
    tags: string[];
    confidence: number;
  };
  sources?: string[];
  relatedPackets?: string[];
}

export interface KnowledgeSearchResult {
  packets: KnowledgePacket[];
  total: number;
  query: string;
  relevanceScores: Record<string, number>;
}

export interface PlatformInsight {
  id: string;
  type: 'trend' | 'pattern' | 'recommendation' | 'alert';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  suggestedActions?: string[];
  relatedPackets?: string[];
  timestamp: Date;
}

export interface ProtocolTemplate {
  id: string;
  name: string;
  description: string;
  phases: string[];
  estimatedDuration: string;
  requiredAgents: string[];
  parameters: Record<string, { type: string; required: boolean; default?: unknown }>;
}

// ============================================================================
// MASTER RPC CLIENT (Service/User Level Only)
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
   * Get available RPC actions for current mesh level
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
  // SYSTEM METHODS (Service Level)
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
  // MESH METHODS (Service Level)
  // ============================================================================

  async getMeshStatus(): Promise<MeshStatus | null> {
    const result = await this.execute<MeshStatus>('mesh.status');
    return result.success ? result.data! : null;
  }

  async getMeshNodes(): Promise<{ nodes: unknown[]; userNodes: unknown[] } | null> {
    const result = await this.execute<{ nodes: unknown[]; userNodes: unknown[] }>('mesh.nodes');
    return result.success ? result.data! : null;
  }

  // ============================================================================
  // LOTUS FLOWER OVERVIEW (User Level)
  // ============================================================================

  /**
   * Get the complete lotus flower organizational structure
   * Available at user level for transparency
   */
  async getLotusFlowerOverview(): Promise<LotusFlowerOverview | null> {
    const result = await this.execute<LotusFlowerOverview>('agent.lotus.overview');
    return result.success ? result.data! : null;
  }

  // ============================================================================
  // OUTER CIRCLE METHODS (Service Level - Read Only)
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

  // ============================================================================
  // RESEARCHER AGENT (Service Level - Knowledge Access)
  // ============================================================================

  /**
   * Get researcher agent status
   */
  async getResearcherStatus(): Promise<{ agentId: string; activeResearch: unknown[]; knowledgeBaseStats: unknown } | null> {
    const result = await this.execute<{ agentId: string; name: string; status: string; activeResearch: unknown[]; knowledgeBaseStats: unknown }>('agent.inner.researcher.status');
    return result.success ? result.data! : null;
  }

  /**
   * Start a research task
   */
  async startResearchTask(topic: string, depth?: 'quick' | 'standard' | 'deep'): Promise<{ researchId: string } | null> {
    const result = await this.execute<{ researchId: string; status: string }>('agent.inner.researcher.research', { topic, depth });
    return result.success ? { researchId: result.data!.researchId } : null;
  }

  /**
   * Query the knowledge base (user level)
   */
  async queryKnowledgeBase(query: string): Promise<{ results: unknown[]; sources: unknown[]; confidence: number }> {
    const result = await this.execute<{ query: string; results: unknown[]; sources: unknown[]; confidence: number }>('agent.inner.researcher.query', { query });
    return result.success ? result.data! : { results: [], sources: [], confidence: 0 };
  }

  // ============================================================================
  // MANAGER AGENT (Service Level)
  // ============================================================================

  async getManagerAgentStatus(): Promise<ManagerAgentStatus | null> {
    const result = await this.execute<ManagerAgentStatus>('agent.outer.manager.status');
    return result.success ? result.data! : null;
  }

  /**
   * Coordinate agent task
   */
  async coordinateAgentTask(task: string, agents: string[]): Promise<{ coordinationId: string } | null> {
    const result = await this.execute<{ coordinationId: string; status: string }>('agent.outer.manager.coordinate', { task, agents });
    return result.success ? { coordinationId: result.data!.coordinationId } : null;
  }

  // ============================================================================
  // BUILDER AGENT (Service Level - Status Only)
  // ============================================================================

  async getBuilderAgentStatus(): Promise<BuilderAgentStatus | null> {
    const result = await this.execute<BuilderAgentStatus>('agent.outer.builder.status');
    return result.success ? result.data! : null;
  }

  // ============================================================================
  // FUTURIST AGENT (Service Level)
  // ============================================================================

  async getFuturistAgentStatus(): Promise<{ agentId: string; activeResearch: unknown[]; innovations: unknown[] } | null> {
    const result = await this.execute<{ agentId: string; name: string; status: string; activeResearch: unknown[]; innovations: unknown[] }>('agent.outer.futurist.status');
    return result.success ? result.data! : null;
  }

  /**
   * Generate a forecast
   */
  async generateForecast(topic: string, horizon?: string): Promise<{ forecastId: string; predictions: unknown[] } | null> {
    const result = await this.execute<{ forecastId: string; topic: string; predictions: unknown[]; confidence: number }>('agent.outer.futurist.forecast', { topic, horizon });
    return result.success ? { forecastId: result.data!.forecastId, predictions: result.data!.predictions } : null;
  }

  // ============================================================================
  // INFINITY AGENT (Service Level)
  // ============================================================================

  async getInfinityAgentStatus(): Promise<InfinityAgentStatus | null> {
    const result = await this.execute<InfinityAgentStatus>('agent.outer.infinity.status');
    return result.success ? result.data! : null;
  }

  /**
   * Execute a protocol
   */
  async executeProtocol(protocol: string, params?: Record<string, unknown>): Promise<{ executionId: string } | null> {
    const result = await this.execute<{ executionId: string; status: string }>('agent.outer.infinity.execute', { protocol, params });
    return result.success ? { executionId: result.data!.executionId } : null;
  }

  // ============================================================================
  // CUSTOMER SERVICE AGENT (Service Level)
  // ============================================================================

  async getCustomerServiceStatus(): Promise<{ agentId: string; activeChats: number; queuedRequests: number; avgResponseTime: number } | null> {
    const result = await this.execute<{ agentId: string; name: string; status: string; activeChats: number; queuedRequests: number; avgResponseTime: number }>('agent.outer.customer-service.status');
    return result.success ? result.data! : null;
  }

  /**
   * Create an assistance ticket
   */
  async createAssistanceTicket(userId: string, issue: string, priority?: 'low' | 'normal' | 'high'): Promise<{ ticketId: string } | null> {
    const result = await this.execute<{ ticketId: string; status: string }>('agent.outer.customer-service.assist', { userId, issue, priority });
    return result.success ? { ticketId: result.data!.ticketId } : null;
  }

  /**
   * Escalate an issue
   */
  async escalateIssue(ticketId: string, reason: string): Promise<boolean> {
    const result = await this.execute('agent.outer.customer-service.escalate', { ticketId, reason });
    return result.success;
  }

  // ============================================================================
  // PROTOCOL STATUS (Service Level)
  // ============================================================================

  /**
   * Get protocol cycle status
   */
  async getProtocolStatus(protocolId: string): Promise<{ status: string; currentPhase: string | null; progress: number } | null> {
    const result = await this.execute<{ protocolId: string; status: string; currentPhase: string | null; progress: number; logs: unknown[] }>('agent.protocol.status', { protocolId });
    return result.success ? result.data! : null;
  }

  // ============================================================================
  // ANALYTICS (Service Level)
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
  // KNOWLEDGE PACKETS (Platform Benefits - User/Service Level)
  // ============================================================================

  /**
   * Search knowledge packets built by platform agents
   * Available at user level - cloud agents can consume platform knowledge
   */
  async searchKnowledgePackets(
    query: string,
    options?: {
      domain?: string;
      type?: KnowledgePacket['type'];
      tags?: string[];
      limit?: number;
    }
  ): Promise<KnowledgeSearchResult> {
    const result = await this.execute<KnowledgeSearchResult>('knowledge.packets.search', {
      query,
      ...options,
    });
    return result.success ? result.data! : { packets: [], total: 0, query, relevanceScores: {} };
  }

  /**
   * Get a specific knowledge packet by ID
   */
  async getKnowledgePacket(packetId: string): Promise<KnowledgePacket | null> {
    const result = await this.execute<KnowledgePacket>('knowledge.packets.get', { packetId });
    return result.success ? result.data! : null;
  }

  /**
   * List available knowledge packets by domain
   */
  async listKnowledgePackets(
    domain?: string,
    options?: { type?: KnowledgePacket['type']; limit?: number; offset?: number }
  ): Promise<{ packets: KnowledgePacket[]; total: number }> {
    const result = await this.execute<{ packets: KnowledgePacket[]; total: number }>('knowledge.packets.list', {
      domain,
      ...options,
    });
    return result.success ? result.data! : { packets: [], total: 0 };
  }

  /**
   * Get knowledge packet domains/categories
   */
  async getKnowledgeDomains(): Promise<{ domains: Array<{ name: string; count: number; description: string }> }> {
    const result = await this.execute<{ domains: Array<{ name: string; count: number; description: string }> }>('knowledge.domains');
    return result.success ? result.data! : { domains: [] };
  }

  // ============================================================================
  // PLATFORM INSIGHTS (Benefits from Platform Intelligence)
  // ============================================================================

  /**
   * Get platform insights generated by Futurist/Researcher agents
   * Cloud agents benefit from platform-level analysis
   */
  async getPlatformInsights(options?: {
    type?: PlatformInsight['type'];
    domain?: string;
    limit?: number;
  }): Promise<{ insights: PlatformInsight[]; total: number }> {
    const result = await this.execute<{ insights: PlatformInsight[]; total: number }>('knowledge.insights', options);
    return result.success ? result.data! : { insights: [], total: 0 };
  }

  /**
   * Get actionable recommendations for a specific context
   */
  async getRecommendations(context: {
    domain?: string;
    currentTask?: string;
    userGoals?: string[];
  }): Promise<{ recommendations: PlatformInsight[]; confidence: number }> {
    const result = await this.execute<{ recommendations: PlatformInsight[]; confidence: number }>('knowledge.recommendations', context);
    return result.success ? result.data! : { recommendations: [], confidence: 0 };
  }

  // ============================================================================
  // PROTOCOL TEMPLATES (Reusable Workflows Built by Platform)
  // ============================================================================

  /**
   * List available protocol templates built by platform agents
   */
  async listProtocolTemplates(domain?: string): Promise<{ templates: ProtocolTemplate[]; total: number }> {
    const result = await this.execute<{ templates: ProtocolTemplate[]; total: number }>('knowledge.protocols.list', { domain });
    return result.success ? result.data! : { templates: [], total: 0 };
  }

  /**
   * Get a specific protocol template
   */
  async getProtocolTemplate(templateId: string): Promise<ProtocolTemplate | null> {
    const result = await this.execute<ProtocolTemplate>('knowledge.protocols.get', { templateId });
    return result.success ? result.data! : null;
  }

  /**
   * Execute a protocol template with parameters
   * Cloud agents can use platform-built protocols
   */
  async executeProtocolTemplate(
    templateId: string,
    parameters: Record<string, unknown>
  ): Promise<{ executionId: string; status: string } | null> {
    const result = await this.execute<{ executionId: string; status: string; protocol: string }>('knowledge.protocols.execute', {
      templateId,
      parameters,
    });
    return result.success ? { executionId: result.data!.executionId, status: result.data!.status } : null;
  }

  // ============================================================================
  // PLATFORM CAPABILITIES (What Cloud Agents Can Leverage)
  // ============================================================================

  /**
   * Get available platform capabilities for cloud agents
   */
  async getPlatformCapabilities(): Promise<{
    knowledge: { domains: string[]; totalPackets: number };
    protocols: { available: number; categories: string[] };
    insights: { types: string[]; recentCount: number };
    agents: { available: string[]; specializations: Record<string, string> };
  } | null> {
    const result = await this.execute<{
      knowledge: { domains: string[]; totalPackets: number };
      protocols: { available: number; categories: string[] };
      insights: { types: string[]; recentCount: number };
      agents: { available: string[]; specializations: Record<string, string> };
    }>('platform.capabilities');
    return result.success ? result.data! : null;
  }

  /**
   * Subscribe to knowledge updates in a domain
   * Returns subscription ID for tracking
   */
  async subscribeToKnowledgeUpdates(
    domains: string[],
    webhookUrl?: string
  ): Promise<{ subscriptionId: string; domains: string[] } | null> {
    const result = await this.execute<{ subscriptionId: string; domains: string[]; active: boolean }>('knowledge.subscribe', {
      domains,
      webhookUrl,
    });
    return result.success ? { subscriptionId: result.data!.subscriptionId, domains: result.data!.domains } : null;
  }

  // ============================================================================
  // BATCH OPERATIONS (Service Level Only)
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
   * Get service-level agent overview
   * Only fetches outer circle status (service level accessible)
   */
  async getServiceAgentOverview(): Promise<{
    lotus: LotusFlowerOverview | null;
    outerCircle: OuterCircleStatus | null;
    customerService: { agentId: string; activeChats: number; queuedRequests: number; avgResponseTime: number } | null;
  }> {
    const result = await this.executeBatch([
      { action: 'agent.lotus.overview' },
      { action: 'agent.outer.status' },
      { action: 'agent.outer.customer-service.status' },
    ], { parallel: true });

    return {
      lotus: result.results[0]?.success ? result.results[0].data as LotusFlowerOverview : null,
      outerCircle: result.results[1]?.success ? result.results[1].data as OuterCircleStatus : null,
      customerService: result.results[2]?.success ? result.results[2].data as { agentId: string; activeChats: number; queuedRequests: number; avgResponseTime: number } : null,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const masterRpcClient = new MasterRpcClient();
export { MasterRpcClient };
