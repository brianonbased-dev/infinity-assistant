/**
 * Mesh Node Client for InfinityAssistant
 *
 * Connects InfinityAssistant to the UAA2 mesh network.
 * Enables communication with:
 * - uaa2-service (Railway) - Main service hub
 * - AI_Workspace (Railway) - Mobile/local node with Ollama
 *
 * Features:
 * - Health monitoring of mesh nodes
 * - Automatic failover between nodes
 * - Knowledge search via mesh
 * - LLM routing (local Ollama vs cloud)
 */

import logger from '@/utils/logger';
import { ollamaService, type ChatMessage, type ChatOptions } from './OllamaService';

export interface MeshNode {
  id: string;
  name: string;
  url: string;
  type: 'uaa2-service' | 'ai-workspace' | 'infinity-assistant';
  status: 'online' | 'offline' | 'degraded';
  lastCheck: Date;
  capabilities: string[];
}

export interface MeshStatus {
  selfNode: MeshNode;
  connectedNodes: MeshNode[];
  ollamaAvailable: boolean;
  lastUpdate: Date;
}

export interface MeshChatOptions extends ChatOptions {
  preferLocal?: boolean; // Prefer local Ollama over cloud
  fallbackToCloud?: boolean; // Use cloud if local unavailable
}

class MeshNodeClient {
  private nodes: Map<string, MeshNode> = new Map();
  private selfNode: MeshNode;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize self as a mesh node
    this.selfNode = {
      id: 'infinity-assistant',
      name: 'Infinity Assistant',
      url: process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.INFINITY_ASSISTANT_URL || 'http://localhost:3002',
      type: 'infinity-assistant',
      status: 'online',
      lastCheck: new Date(),
      capabilities: [
        'chat',
        'ev-optimization',
        'research',
        'white-glove',
        'payments',
        'tesla-integration',
      ],
    };

    // Register known mesh nodes
    this.registerDefaultNodes();
  }

  /**
   * Register default mesh nodes
   */
  private registerDefaultNodes(): void {
    // UAA2 Service (Railway)
    this.nodes.set('uaa2-service', {
      id: 'uaa2-service',
      name: 'UAA2 Service',
      url: process.env.UAA2_SERVICE_URL || 'https://uaa2-service-production.up.railway.app',
      type: 'uaa2-service',
      status: 'offline',
      lastCheck: new Date(),
      capabilities: [
        'knowledge-search',
        'agent-orchestration',
        'master-portal',
        'mcp-server',
        'quantum-integration',
      ],
    });

    // AI Workspace (Railway or local)
    this.nodes.set('ai-workspace', {
      id: 'ai-workspace',
      name: 'AI Workspace',
      url: process.env.AI_WORKSPACE_URL || 'http://localhost:3001',
      type: 'ai-workspace',
      status: 'offline',
      lastCheck: new Date(),
      capabilities: [
        'ollama-llm',
        'mesh-proxy',
        'health-monitoring',
        'contract-validation',
      ],
    });
  }

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

      const response = await fetch(`${node.url}/api/health`, {
        method: 'GET',
        headers: {
          'X-Mesh-Node': this.selfNode.id,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        node.status = data.status === 'healthy' ? 'online' : 'degraded';
        node.lastCheck = new Date();
        logger.debug(`[Mesh] Node ${nodeId} is ${node.status}`);
      } else {
        node.status = 'offline';
        node.lastCheck = new Date();
      }
    } catch (error) {
      node.status = 'offline';
      node.lastCheck = new Date();
      logger.debug(`[Mesh] Node ${nodeId} is offline:`, error);
    }

    this.nodes.set(nodeId, node);
    return node;
  }

  /**
   * Get a specific mesh node
   */
  getNode(nodeId: string): MeshNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all connected nodes
   */
  getConnectedNodes(): MeshNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.status === 'online');
  }

  /**
   * Chat via mesh - routes to best available LLM
   */
  async chat(
    messages: ChatMessage[],
    options: MeshChatOptions = {}
  ): Promise<{ response: string; source: 'ollama' | 'ai-workspace' | 'uaa2-service' | 'cloud' }> {
    const { preferLocal = true, fallbackToCloud = true, ...chatOptions } = options;

    // 1. Try local Ollama first if preferred
    if (preferLocal) {
      const ollamaStatus = ollamaService.getStatus();
      if (ollamaStatus.available) {
        try {
          const response = await ollamaService.chat(messages, chatOptions);
          return { response, source: 'ollama' };
        } catch (error) {
          logger.warn('[Mesh] Local Ollama failed, trying mesh nodes:', error);
        }
      }
    }

    // 2. Try AI Workspace (has Ollama integration)
    const aiWorkspace = this.nodes.get('ai-workspace');
    if (aiWorkspace?.status === 'online') {
      try {
        const response = await this.chatViaNode('ai-workspace', messages, chatOptions);
        return { response, source: 'ai-workspace' };
      } catch (error) {
        logger.warn('[Mesh] AI Workspace chat failed:', error);
      }
    }

    // 3. Try UAA2 Service
    const uaa2 = this.nodes.get('uaa2-service');
    if (uaa2?.status === 'online') {
      try {
        const response = await this.chatViaNode('uaa2-service', messages, chatOptions);
        return { response, source: 'uaa2-service' };
      } catch (error) {
        logger.warn('[Mesh] UAA2 Service chat failed:', error);
      }
    }

    // 4. Fallback to cloud APIs (handled by caller)
    if (fallbackToCloud) {
      throw new Error('FALLBACK_TO_CLOUD');
    }

    throw new Error('No LLM available in mesh network');
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

    const endpoint =
      node.type === 'ai-workspace'
        ? `${node.url}/api/ollama/chat`
        : `${node.url}/api/assistant/chat`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mesh-Node': this.selfNode.id,
      },
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

  /**
   * Search knowledge via UAA2 mesh
   */
  async searchKnowledge(
    query: string,
    options?: { type?: string; limit?: number }
  ): Promise<any> {
    const uaa2 = this.nodes.get('uaa2-service');
    if (uaa2?.status !== 'online') {
      throw new Error('UAA2 Service not available');
    }

    const response = await fetch(`${uaa2.url}/api/assistant/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mesh-Node': this.selfNode.id,
      },
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

  /**
   * Register this node with the mesh
   */
  async registerWithMesh(): Promise<void> {
    const uaa2 = this.nodes.get('uaa2-service');
    if (!uaa2) return;

    try {
      await fetch(`${uaa2.url}/api/mesh/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.selfNode),
      });
      logger.info('[Mesh] Registered with UAA2 Service');
    } catch (error) {
      logger.debug('[Mesh] Failed to register with mesh:', error);
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

  /**
   * Get mesh status summary
   */
  getStatus(): MeshStatus {
    return {
      selfNode: this.selfNode,
      connectedNodes: Array.from(this.nodes.values()),
      ollamaAvailable: ollamaService.getStatus().available,
      lastUpdate: new Date(),
    };
  }
}

// Export singleton instance
export const meshNodeClient = new MeshNodeClient();

// Export class for testing
export { MeshNodeClient };
