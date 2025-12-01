/**
 * Mesh Node Client for InfinityAssistant
 *
 * Tiered Mesh Architecture:
 * - Level 0 (Master): You + Dev Friends - Full control
 * - Level 1 (Service): Pro/Enterprise users - Premium features
 * - Level 2 (User): Free users - Basic features
 *
 * Connects InfinityAssistant to the UAA2 mesh network.
 * Enables communication with:
 * - uaa2-service (Railway) - Main service hub & Master Portal
 * - Tauri Desktop - Local Ollama, file access
 * - AI_Workspace - Knowledge base, research
 *
 * Features:
 * - Tiered access control
 * - Health monitoring of mesh nodes
 * - Automatic failover between nodes
 * - Capability-based routing
 * - Device mesh for IoT/EV/Home automation
 */

import logger from '@/utils/logger';
import { ollamaService, type ChatMessage, type ChatOptions } from './OllamaService';

// ============================================================================
// TYPES
// ============================================================================

export type MeshLevel = 'master' | 'service' | 'user';
export type MeshNodeType = 'uaa2-service' | 'tauri-desktop' | 'ai-workspace' | 'infinity-assistant' | 'ollama-server' | 'user-device';

export interface MeshNode {
  id: string;
  name: string;
  url: string;
  type: MeshNodeType;
  status: 'online' | 'offline' | 'degraded';
  lastCheck: Date;
  capabilities: string[];
  level: MeshLevel;
  priority: number;
  isLocal?: boolean;
}

export interface MeshStatus {
  selfNode: MeshNode;
  connectedNodes: MeshNode[];
  ollamaAvailable: boolean;
  lastUpdate: Date;
  meshLevel: MeshLevel;
}

export interface MeshChatOptions extends ChatOptions {
  preferLocal?: boolean;
  fallbackToCloud?: boolean;
}

export interface MeshNodeHealth {
  nodeId: string;
  status: 'healthy' | 'degraded' | 'offline' | 'unknown';
  latencyMs: number;
  errorCount: number;
  lastCheck: Date;
}

export interface UserDevice {
  id: string;
  userId: string;
  type: 'mobile' | 'desktop' | 'vehicle' | 'home-hub' | 'appliance' | 'robot';
  name: string;
  capabilities: string[];
  status: 'online' | 'offline';
  lastSeen: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// MESH CAPABILITIES BY LEVEL
// ============================================================================

const LEVEL_CAPABILITIES: Record<MeshLevel, string[]> = {
  master: [
    // Full access to everything
    'master-portal',
    'agent-control',
    'ceo-commands',
    'builder-deploy',
    'god-mode',
    'infrastructure',
    'developer-access',
    // Plus all service + user capabilities
  ],
  service: [
    // Premium features
    'agent-orchestration',
    'priority-llm',
    'advanced-agents',
    'fleet-management',
    'energy-optimization',
    'custom-automations',
    'api-access',
    // Plus all user capabilities
  ],
  user: [
    // Basic features
    'chat',
    'knowledge-access',
    'basic-automations',
    'vault-access',
    'device-sync',
    'ev-status',
    'home-view',
  ],
};

// ============================================================================
// MESH NODE CLIENT
// ============================================================================

class MeshNodeClient {
  private nodes: Map<string, MeshNode> = new Map();
  private userDevices: Map<string, UserDevice> = new Map();
  private selfNode: MeshNode;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private meshLevel: MeshLevel = 'user';
  private uaa2ApiKey: string | null = null;

  constructor() {
    // Initialize self as a mesh node
    this.selfNode = {
      id: process.env.MESH_NODE_ID || 'infinity-assistant',
      name: process.env.MESH_NODE_NAME || 'InfinityAssistant (Vercel)',
      url: this.getSelfUrl(),
      type: 'infinity-assistant',
      status: 'online',
      lastCheck: new Date(),
      capabilities: [
        'chat',
        'knowledge-access',
        'vault-access',
        'device-sync',
        'ev-integration',
        'home-automation',
        'user-mesh',
        'payments',
      ],
      level: 'user',
      priority: 50,
    };

    // Register known mesh nodes
    this.registerDefaultNodes();
    logger.info('[Mesh] Client initialized', { nodeId: this.selfNode.id });
  }

  private getSelfUrl(): string {
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    return process.env.INFINITY_ASSISTANT_URL || 'http://localhost:3002';
  }

  /**
   * Register default mesh nodes (Master level nodes)
   */
  private registerDefaultNodes(): void {
    // UAA2 Service (Railway) - Master level
    this.nodes.set('uaa2-service', {
      id: 'uaa2-service',
      name: 'UAA2 Service (Railway)',
      url: process.env.UAA2_SERVICE_URL || process.env.UAA2_MESH_URL || 'https://uaa2-service-production.up.railway.app',
      type: 'uaa2-service',
      status: 'offline',
      lastCheck: new Date(),
      capabilities: [
        'master-portal',
        'agent-orchestration',
        'ceo-commands',
        'builder-deploy',
        'knowledge-search',
        'mcp-server',
        'quantum-batch',
        'mesh-coordinator',
      ],
      level: 'master',
      priority: 100,
    });

    // Tauri Desktop - Master level (local)
    this.nodes.set('tauri-desktop', {
      id: 'tauri-desktop',
      name: 'Tauri Desktop',
      url: process.env.TAURI_URL || 'http://localhost:3000',
      type: 'tauri-desktop',
      status: 'offline',
      lastCheck: new Date(),
      capabilities: [
        'ollama-inference',
        'local-files',
        'terminal-access',
        'browser-automation',
        'screen-capture',
      ],
      level: 'master',
      priority: 90,
      isLocal: true,
    });

    // AI Workspace - Master level
    this.nodes.set('ai-workspace', {
      id: 'ai-workspace',
      name: 'AI Workspace',
      url: process.env.AI_WORKSPACE_URL || 'http://localhost:3001',
      type: 'ai-workspace',
      status: 'offline',
      lastCheck: new Date(),
      capabilities: [
        'research-kb',
        'code-context',
        'project-files',
        'knowledge-packets',
      ],
      level: 'master',
      priority: 80,
      isLocal: true,
    });

    // Ollama Server - Local LLM
    this.nodes.set('ollama-server', {
      id: 'ollama-server',
      name: 'Ollama LLM',
      url: process.env.OLLAMA_MESH_URL || process.env.OLLAMA_URL || 'http://localhost:11434',
      type: 'ollama-server',
      status: 'offline',
      lastCheck: new Date(),
      capabilities: [
        'llm-inference',
        'embeddings',
        'local-ai',
      ],
      level: 'master',
      priority: 95,
      isLocal: true,
    });
  }

  // ============================================================================
  // MESH LEVEL MANAGEMENT
  // ============================================================================

  /**
   * Set the mesh access level for this session
   */
  setMeshLevel(level: MeshLevel, apiKey?: string): void {
    this.meshLevel = level;
    if (apiKey) {
      this.uaa2ApiKey = apiKey;
    }
    logger.info('[Mesh] Level set', { level });
  }

  /**
   * Check if current level has access to a capability
   */
  hasCapability(capability: string): boolean {
    const levelCaps = LEVEL_CAPABILITIES[this.meshLevel];
    if (levelCaps.includes(capability)) return true;

    // Check inherited capabilities (user < service < master)
    if (this.meshLevel === 'service' || this.meshLevel === 'master') {
      if (LEVEL_CAPABILITIES.user.includes(capability)) return true;
    }
    if (this.meshLevel === 'master') {
      if (LEVEL_CAPABILITIES.service.includes(capability)) return true;
    }

    return false;
  }

  /**
   * Get capabilities available at current mesh level
   */
  getAvailableCapabilities(): string[] {
    const caps = [...LEVEL_CAPABILITIES[this.meshLevel]];
    if (this.meshLevel === 'service' || this.meshLevel === 'master') {
      caps.push(...LEVEL_CAPABILITIES.user);
    }
    if (this.meshLevel === 'master') {
      caps.push(...LEVEL_CAPABILITIES.service);
    }
    return [...new Set(caps)];
  }

  // ============================================================================
  // NODE HEALTH & CONNECTIVITY
  // ============================================================================

  /**
   * Check health of all mesh nodes
   */
  async checkAllNodes(): Promise<MeshStatus> {
    const checks = Array.from(this.nodes.values()).map((node) =>
      this.checkNodeHealth(node.id)
    );
    await Promise.all(checks);

    // Also check local Ollama
    const ollamaStatus = await ollamaService.checkHealth();

    return {
      selfNode: this.selfNode,
      connectedNodes: Array.from(this.nodes.values()),
      ollamaAvailable: ollamaStatus.available,
      lastUpdate: new Date(),
      meshLevel: this.meshLevel,
    };
  }

  /**
   * Check health of a specific node
   */
  async checkNodeHealth(nodeId: string): Promise<MeshNode | null> {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const startTime = Date.now();

      // Use appropriate health endpoint based on node type
      const healthUrl = node.type === 'ollama-server'
        ? `${node.url}/api/tags`  // Ollama health check
        : `${node.url}/api/health`;

      const headers: Record<string, string> = {
        'X-Mesh-Node': this.selfNode.id,
        'X-Mesh-Level': this.meshLevel,
      };

      if (this.uaa2ApiKey && node.type === 'uaa2-service') {
        headers['Authorization'] = `Bearer ${this.uaa2ApiKey}`;
      }

      const response = await fetch(healthUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latency = Date.now() - startTime;

      if (response.ok) {
        node.status = latency < 1000 ? 'online' : 'degraded';
        node.lastCheck = new Date();
        logger.debug(`[Mesh] Node ${nodeId} is ${node.status} (${latency}ms)`);
      } else {
        node.status = 'offline';
        node.lastCheck = new Date();
      }
    } catch (error) {
      node.status = 'offline';
      node.lastCheck = new Date();
      logger.debug(`[Mesh] Node ${nodeId} is offline`);
    }

    this.nodes.set(nodeId, node);
    return node;
  }

  /**
   * Get UAA2 mesh node status
   */
  async getUAA2MeshStatus(): Promise<{
    success: boolean;
    nodes?: MeshNode[];
    capabilities?: Record<string, string[]>;
  }> {
    const uaa2 = this.nodes.get('uaa2-service');
    if (!uaa2) {
      return { success: false };
    }

    try {
      const headers: Record<string, string> = {
        'X-Mesh-Node': this.selfNode.id,
      };

      if (this.uaa2ApiKey) {
        headers['Authorization'] = `Bearer ${this.uaa2ApiKey}`;
      }

      const response = await fetch(`${uaa2.url}/api/mesh/nodes`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        return { success: false };
      }

      const data = await response.json();
      return {
        success: true,
        nodes: data.data?.nodes,
        capabilities: data.data?.capabilityMap,
      };
    } catch (error) {
      logger.warn('[Mesh] Failed to get UAA2 mesh status:', error);
      return { success: false };
    }
  }

  // ============================================================================
  // CHAT & LLM ROUTING
  // ============================================================================

  /**
   * Chat via mesh - routes to best available LLM based on level
   */
  async chat(
    messages: ChatMessage[],
    options: MeshChatOptions = {}
  ): Promise<{ response: string; source: string }> {
    const { preferLocal = true, fallbackToCloud = true, ...chatOptions } = options;

    // 1. Try local Ollama first if preferred and available
    if (preferLocal) {
      const ollamaStatus = ollamaService.getStatus();
      if (ollamaStatus.available) {
        try {
          const response = await ollamaService.chat(messages, chatOptions);
          return { response, source: 'ollama-local' };
        } catch (error) {
          logger.warn('[Mesh] Local Ollama failed, trying mesh nodes:', error);
        }
      }
    }

    // 2. Try Tauri Desktop (has Ollama) - Master level only
    if (this.meshLevel === 'master') {
      const tauri = this.nodes.get('tauri-desktop');
      if (tauri?.status === 'online') {
        try {
          const response = await this.chatViaNode('tauri-desktop', messages, chatOptions);
          return { response, source: 'tauri-desktop' };
        } catch (error) {
          logger.warn('[Mesh] Tauri chat failed:', error);
        }
      }
    }

    // 3. Try UAA2 Service - Service level and above
    if (this.meshLevel === 'master' || this.meshLevel === 'service') {
      const uaa2 = this.nodes.get('uaa2-service');
      if (uaa2?.status === 'online') {
        try {
          const response = await this.chatViaNode('uaa2-service', messages, chatOptions);
          return { response, source: 'uaa2-service' };
        } catch (error) {
          logger.warn('[Mesh] UAA2 Service chat failed:', error);
        }
      }
    }

    // 4. Fallback to cloud APIs (handled by caller)
    if (fallbackToCloud) {
      throw new Error('FALLBACK_TO_CLOUD');
    }

    throw new Error('No LLM available in mesh network at your access level');
  }

  /**
   * Chat via a specific mesh node
   */
  private async chatViaNode(
    nodeId: string,
    messages: ChatMessage[],
    options: ChatOptions
  ): Promise<string> {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Unknown node: ${nodeId}`);

    // Check if we have access to this node's level
    if (node.level === 'master' && this.meshLevel !== 'master') {
      throw new Error(`Access denied: ${nodeId} requires master level access`);
    }

    let endpoint: string;
    switch (node.type) {
      case 'tauri-desktop':
        endpoint = `${node.url}/api/ollama/chat`;
        break;
      case 'uaa2-service':
        endpoint = `${node.url}/api/assistant/chat`;
        break;
      default:
        endpoint = `${node.url}/api/chat`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Mesh-Node': this.selfNode.id,
      'X-Mesh-Level': this.meshLevel,
    };

    if (this.uaa2ApiKey) {
      headers['Authorization'] = `Bearer ${this.uaa2ApiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        systemPrompt: options.systemPrompt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Node ${nodeId} returned ${response.status}`);
    }

    const data = await response.json();
    return data.response || data.message?.content || '';
  }

  // ============================================================================
  // CAPABILITY-BASED ROUTING
  // ============================================================================

  /**
   * Route request to a node with specific capability
   */
  async routeByCapability(
    capability: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    // Check if we have access to this capability
    if (!this.hasCapability(capability)) {
      throw new Error(`Access denied: ${capability} requires higher mesh level`);
    }

    // Find online node with this capability
    const candidates = Array.from(this.nodes.values())
      .filter(n => n.status === 'online' && n.capabilities.includes(capability))
      .sort((a, b) => b.priority - a.priority);

    if (candidates.length === 0) {
      throw new Error(`No online node found with capability: ${capability}`);
    }

    const node = candidates[0];

    // Route to UAA2 mesh router
    const uaa2 = this.nodes.get('uaa2-service');
    if (uaa2?.status === 'online') {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Mesh-Node': this.selfNode.id,
        'X-Mesh-Level': this.meshLevel,
      };

      if (this.uaa2ApiKey) {
        headers['Authorization'] = `Bearer ${this.uaa2ApiKey}`;
      }

      const response = await fetch(`${uaa2.url}/api/mesh/nodes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'route',
          capability,
          payload,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.data;
      }
    }

    throw new Error('Failed to route by capability');
  }

  /**
   * Send message to specific node
   */
  async sendToNode(
    nodeId: string,
    payload: Record<string, unknown>
  ): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Check level access
    if (node.level === 'master' && this.meshLevel !== 'master') {
      logger.warn(`[Mesh] Access denied: ${nodeId} requires master level`);
      return false;
    }

    try {
      const uaa2 = this.nodes.get('uaa2-service');
      if (uaa2?.status === 'online') {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Mesh-Node': this.selfNode.id,
        };

        if (this.uaa2ApiKey) {
          headers['Authorization'] = `Bearer ${this.uaa2ApiKey}`;
        }

        const response = await fetch(`${uaa2.url}/api/mesh/nodes`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'send',
            nodeId,
            payload,
          }),
        });

        return response.ok;
      }
      return false;
    } catch (error) {
      logger.warn(`[Mesh] Failed to send to ${nodeId}:`, error);
      return false;
    }
  }

  // ============================================================================
  // USER DEVICE MESH
  // ============================================================================

  /**
   * Register a user device (mobile, vehicle, home hub, etc.)
   */
  registerUserDevice(device: UserDevice): void {
    this.userDevices.set(device.id, device);
    logger.debug('[Mesh] User device registered', { deviceId: device.id, type: device.type });
  }

  /**
   * Get user devices by type
   */
  getUserDevices(type?: UserDevice['type']): UserDevice[] {
    const devices = Array.from(this.userDevices.values());
    if (type) {
      return devices.filter(d => d.type === type);
    }
    return devices;
  }

  /**
   * Send command to user device
   */
  async sendToDevice(deviceId: string, command: Record<string, unknown>): Promise<boolean> {
    const device = this.userDevices.get(deviceId);
    if (!device || device.status !== 'online') {
      return false;
    }

    // Route through mesh to device
    logger.debug('[Mesh] Sending to device', { deviceId, command: command.action });

    // Implementation would depend on device type
    // - Mobile: Push notification / WebSocket
    // - Vehicle: Vehicle API
    // - Home Hub: Local network or cloud API

    return true;
  }

  // ============================================================================
  // KNOWLEDGE & SEARCH
  // ============================================================================

  /**
   * Search knowledge via UAA2 mesh
   */
  async searchKnowledge(
    query: string,
    options?: { type?: string; limit?: number }
  ): Promise<unknown> {
    if (!this.hasCapability('knowledge-access')) {
      throw new Error('Knowledge access not available at your mesh level');
    }

    const uaa2 = this.nodes.get('uaa2-service');
    if (uaa2?.status !== 'online') {
      throw new Error('UAA2 Service not available');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Mesh-Node': this.selfNode.id,
    };

    if (this.uaa2ApiKey) {
      headers['Authorization'] = `Bearer ${this.uaa2ApiKey}`;
    }

    const response = await fetch(`${uaa2.url}/api/assistant/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        type: options?.type || 'all',
        limit: options?.limit || 20,
      }),
    });

    if (!response.ok) {
      throw new Error(`Knowledge search failed: ${response.status}`);
    }

    return response.json();
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Register this node with the UAA2 mesh
   * @param userId - Optional user ID (for user-level registration)
   */
  async registerWithMesh(userId?: string): Promise<boolean> {
    const uaa2 = this.nodes.get('uaa2-service');
    if (!uaa2) return false;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Service-Name': 'infinityassistant',
      };

      if (this.uaa2ApiKey) {
        headers['Authorization'] = `Bearer ${this.uaa2ApiKey}`;
      }

      const response = await fetch(`${uaa2.url}/api/mesh/nodes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'register-user-node',
          payload: {
            nodeId: this.selfNode.id,
            nodeName: this.selfNode.name,
            type: 'service', // InfinityAssistant itself is a service node
            capabilities: this.selfNode.capabilities,
            level: this.meshLevel,
            url: this.selfNode.url,
            userId: userId || 'system', // 'system' for service-level registration
            serviceId: 'infinityassistant',
          },
        }),
      });

      if (response.ok) {
        logger.info('[Mesh] Registered with UAA2 mesh');
        return true;
      }
      return false;
    } catch (error) {
      logger.debug('[Mesh] Failed to register with mesh:', error);
      return false;
    }
  }

  /**
   * Register a user's device with the UAA2 mesh
   */
  async registerUserDeviceWithMesh(device: UserDevice): Promise<boolean> {
    const uaa2 = this.nodes.get('uaa2-service');
    if (!uaa2) return false;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Service-Name': 'infinityassistant',
      };

      if (this.uaa2ApiKey) {
        headers['Authorization'] = `Bearer ${this.uaa2ApiKey}`;
      }

      const response = await fetch(`${uaa2.url}/api/mesh/nodes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'register-user-node',
          payload: {
            nodeId: device.id,
            nodeName: device.name,
            type: device.type,
            capabilities: device.capabilities,
            level: 'user', // User devices are always user level
            userId: device.userId,
            serviceId: 'infinityassistant',
            metadata: device.metadata,
          },
        }),
      });

      if (response.ok) {
        // Also store locally
        this.userDevices.set(device.id, device);
        logger.info('[Mesh] User device registered with UAA2 mesh', { deviceId: device.id });
        return true;
      }
      return false;
    } catch (error) {
      logger.debug('[Mesh] Failed to register user device:', error);
      return false;
    }
  }

  /**
   * Send heartbeat for user device
   */
  async sendUserDeviceHeartbeat(deviceId: string): Promise<boolean> {
    const uaa2 = this.nodes.get('uaa2-service');
    if (!uaa2) return false;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.uaa2ApiKey) {
        headers['Authorization'] = `Bearer ${this.uaa2ApiKey}`;
      }

      const response = await fetch(`${uaa2.url}/api/mesh/nodes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'user-node-heartbeat',
          payload: { nodeId: deviceId },
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Initial check
    this.checkAllNodes();

    // Periodic checks
    this.healthCheckInterval = setInterval(() => {
      this.checkAllNodes();
    }, intervalMs);

    logger.info(`[Mesh] Started health checks every ${intervalMs / 1000}s`);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  getNode(nodeId: string): MeshNode | undefined {
    return this.nodes.get(nodeId);
  }

  getConnectedNodes(): MeshNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.status === 'online');
  }

  getNodesByLevel(level: MeshLevel): MeshNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.level === level);
  }

  getStatus(): MeshStatus {
    return {
      selfNode: this.selfNode,
      connectedNodes: Array.from(this.nodes.values()),
      ollamaAvailable: ollamaService.getStatus().available,
      lastUpdate: new Date(),
      meshLevel: this.meshLevel,
    };
  }

  getMeshLevel(): MeshLevel {
    return this.meshLevel;
  }
}

// Export singleton instance
export const meshNodeClient = new MeshNodeClient();

// Export class for testing
export { MeshNodeClient };
