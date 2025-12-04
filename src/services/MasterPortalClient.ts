/**
 * UAA2 Service API Client with Failover Support
 *
 * Client for communicating with uaa2-service public APIs
 * Uses the public /api/assistant/* endpoints for knowledge search and chat
 *
 * FAILOVER ARCHITECTURE:
 * - Primary: uaa2-service on Railway (UAA2_SERVICE_URL)
 * - Secondary: AI_Workspace on Railway (AI_WORKSPACE_URL) - also supports MCP
 * - Backup: Custom backup URL (UAA2_BACKUP_URL)
 * - Final Fallback: Direct LLM providers (Claude, OpenAI, Ollama)
 *
 * If primary fails, automatically tries AI_Workspace, then backup.
 * If all service endpoints fail, falls back to direct LLM providers.
 */

import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error-handling';
import { getFallbackLLMService } from './FallbackLLMService';

export interface UAA2Response<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface EndpointHealth {
  url: string;
  name: string;
  healthy: boolean;
  lastCheck: Date;
  failureCount: number;
  supportsMCP?: boolean;
}

const HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds
const MAX_FAILURES_BEFORE_UNHEALTHY = 3;

export class MasterPortalClient {
  private primaryUrl: string;
  private aiWorkspaceUrl: string | null;
  private backupUrl: string | null;
  private apiKey: string;
  private endpointHealth: Map<string, EndpointHealth> = new Map();

  constructor() {
    this.primaryUrl = process.env.UAA2_SERVICE_URL || 'http://localhost:3000';
    this.aiWorkspaceUrl = process.env.AI_WORKSPACE_URL || process.env.AI_WORKSPACE_RAILWAY_URL || null;
    this.backupUrl = process.env.UAA2_BACKUP_URL || null;
    this.apiKey = process.env.UAA2_SERVICE_API_KEY || '';

    // Initialize health tracking for primary
    this.endpointHealth.set(this.primaryUrl, {
      url: this.primaryUrl,
      name: 'uaa2-service',
      healthy: true,
      lastCheck: new Date(),
      failureCount: 0,
      supportsMCP: true,
    });

    // Initialize AI_Workspace as secondary fallback with MCP support
    if (this.aiWorkspaceUrl) {
      this.endpointHealth.set(this.aiWorkspaceUrl, {
        url: this.aiWorkspaceUrl,
        name: 'ai-workspace',
        healthy: true,
        lastCheck: new Date(),
        failureCount: 0,
        supportsMCP: true, // AI_Workspace supports MCP
      });
      logger.info('[MasterPortalClient] AI_Workspace failover enabled', {
        url: this.aiWorkspaceUrl,
      });
    }

    // Initialize backup if configured
    if (this.backupUrl && this.backupUrl !== this.aiWorkspaceUrl) {
      this.endpointHealth.set(this.backupUrl, {
        url: this.backupUrl,
        name: 'backup',
        healthy: true,
        lastCheck: new Date(),
        failureCount: 0,
      });
    }

    const endpoints = this.getOrderedEndpoints();
    if (endpoints.length > 1) {
      logger.info('[MasterPortalClient] Failover chain configured', {
        endpoints: endpoints.map(e => ({ name: e.name, url: e.url })),
      });
    }
  }

  /**
   * Get all endpoints in priority order
   */
  private getOrderedEndpoints(): EndpointHealth[] {
    const endpoints: EndpointHealth[] = [];

    // Primary first
    const primary = this.endpointHealth.get(this.primaryUrl);
    if (primary) endpoints.push(primary);

    // AI_Workspace second (has MCP support)
    if (this.aiWorkspaceUrl) {
      const aiWorkspace = this.endpointHealth.get(this.aiWorkspaceUrl);
      if (aiWorkspace) endpoints.push(aiWorkspace);
    }

    // Backup third
    if (this.backupUrl && this.backupUrl !== this.aiWorkspaceUrl) {
      const backup = this.endpointHealth.get(this.backupUrl);
      if (backup) endpoints.push(backup);
    }

    return endpoints;
  }

  /**
   * Get the best available endpoint (prefers healthy endpoints in priority order)
   */
  private getBestEndpoint(): EndpointHealth {
    const orderedEndpoints = this.getOrderedEndpoints();

    for (const endpoint of orderedEndpoints) {
      if (endpoint.healthy) {
        return endpoint;
      }

      // Check if we should retry unhealthy endpoints
      const timeSinceLastCheck = Date.now() - endpoint.lastCheck.getTime();
      if (timeSinceLastCheck > HEALTH_CHECK_INTERVAL_MS) {
        // Reset for retry
        endpoint.healthy = true;
        endpoint.failureCount = 0;
        return endpoint;
      }
    }

    // All unhealthy, return primary to try anyway
    return orderedEndpoints[0];
  }

  /**
   * Mark endpoint as healthy or unhealthy
   */
  private markEndpointHealth(url: string, success: boolean): void {
    const health = this.endpointHealth.get(url);
    if (!health) return;

    if (success) {
      health.healthy = true;
      health.failureCount = 0;
    } else {
      health.failureCount++;
      if (health.failureCount >= MAX_FAILURES_BEFORE_UNHEALTHY) {
        health.healthy = false;
        logger.warn('[MasterPortalClient] Endpoint marked unhealthy', {
          name: health.name,
          url,
          failures: health.failureCount,
        });
      }
    }
    health.lastCheck = new Date();
  }

  /**
   * Make request with failover support across all configured endpoints
   */
  private async fetchWithFailover(
    path: string,
    options: RequestInit
  ): Promise<Response> {
    const orderedEndpoints = this.getOrderedEndpoints();
    const bestEndpoint = this.getBestEndpoint();

    // Build list of endpoints to try, starting with best
    const endpointsToTry = [bestEndpoint];
    for (const endpoint of orderedEndpoints) {
      if (endpoint.url !== bestEndpoint.url) {
        endpointsToTry.push(endpoint);
      }
    }

    let lastError: Error | null = null;

    for (const endpoint of endpointsToTry) {
      try {
        logger.debug('[MasterPortalClient] Trying endpoint', {
          name: endpoint.name,
          url: endpoint.url,
        });

        const response = await fetch(`${endpoint.url}${path}`, {
          ...options,
          headers: {
            ...options.headers,
            'X-Service-Name': 'infinityassistant',
            'X-Fallback-Source': endpoint.name,
            ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
          },
        });

        if (response.ok) {
          this.markEndpointHealth(endpoint.url, true);
          logger.debug('[MasterPortalClient] Request succeeded', {
            name: endpoint.name,
            url: endpoint.url,
          });
          return response;
        }

        // Non-ok response but server responded - might be app error, not infra
        if (response.status < 500) {
          return response; // Return client errors as-is
        }

        // Server error - mark unhealthy and try next
        this.markEndpointHealth(endpoint.url, false);
        lastError = new Error(`HTTP ${response.status} from ${endpoint.name}`);
      } catch (error) {
        this.markEndpointHealth(endpoint.url, false);
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.debug('[MasterPortalClient] Endpoint failed, trying next', {
          name: endpoint.name,
          url: endpoint.url,
          error: getErrorMessage(error),
        });
      }
    }

    throw lastError || new Error('All endpoints failed');
  }

  /**
   * Process customer query through public assistant chat API
   * Automatically fails over to backup if primary is down
   * Falls back to direct LLM providers if all uaa2-service endpoints fail
   */
  async processCustomerQuery(
    message: string,
    options: {
      conversationId?: string;
      userId?: string;
      mode?: 'limited' | 'search' | 'assist' | 'build';
      limitedCapabilities?: string[];
    }
  ): Promise<{ response: string; tokensUsed?: number; conversationId?: string; usedFallback?: boolean }> {
    try {
      const response = await this.fetchWithFailover('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationId: options.conversationId,
          userId: options.userId,
          mode: options.mode && options.mode !== 'limited' ? options.mode : 'assist',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        response: data.response,
        tokensUsed: data.metadata?.tokensUsed,
        conversationId: data.conversationId,
        usedFallback: false,
      };
    } catch (error) {
      logger.warn('[MasterPortalClient] UAA2 service unavailable, trying fallback LLM:', getErrorMessage(error));

      // Try fallback LLM providers
      try {
        const fallbackService = getFallbackLLMService();

        if (!fallbackService.isAvailable()) {
          logger.error('[MasterPortalClient] No fallback LLM providers configured');
          throw error; // Re-throw original error
        }

        // Generate a simplified system prompt for fallback mode
        const fallbackSystemPrompt = this.generateFallbackSystemPrompt(options.mode);

        const fallbackResult = await fallbackService.chat({
          messages: [
            { role: 'system', content: fallbackSystemPrompt },
            { role: 'user', content: message },
          ],
          maxTokens: 4096,
          temperature: 0.7,
        });

        logger.info('[MasterPortalClient] Fallback LLM success:', {
          provider: fallbackResult.provider,
          model: fallbackResult.model,
        });

        return {
          response: fallbackResult.response,
          tokensUsed: fallbackResult.tokensUsed,
          conversationId: options.conversationId,
          usedFallback: true,
        };
      } catch (fallbackError) {
        logger.error('[MasterPortalClient] Fallback LLM also failed:', getErrorMessage(fallbackError));
        throw error; // Re-throw original error
      }
    }
  }

  /**
   * Generate a simplified system prompt for fallback mode
   * Used when uaa2-service is unavailable
   */
  private generateFallbackSystemPrompt(mode?: string): string {
    const basePrompt = `You are Infinity Assistant, an AI assistant focused on helping users with software development, research, and general questions.

You are currently running in fallback mode due to temporary service connectivity issues. Some advanced features may be limited.

Core Guidelines:
- Be helpful, accurate, and concise
- Provide practical solutions and code examples when relevant
- Acknowledge limitations honestly
- Maintain professional and friendly communication`;

    const modePrompts: Record<string, string> = {
      search: `

[SEARCH MODE]
Focus on providing information, explanations, and research assistance.
- Answer questions thoroughly but concisely
- Cite general best practices when applicable
- Suggest further research directions when appropriate`,

      assist: `

[ASSIST MODE]
Help users with coding, problem-solving, and general assistance.
- Provide working code examples when relevant
- Explain your reasoning
- Offer alternatives when multiple approaches exist`,

      build: `

[BUILD MODE]
Guide users on architecture, design, and implementation.
- Focus on architectural patterns and best practices
- Provide scaffolding and structure recommendations
- Consider scalability and maintainability`,
    };

    return basePrompt + (modePrompts[mode || 'assist'] || modePrompts.assist);
  }

  /**
   * Search knowledge base through public assistant search API
   * Searches graduated knowledge (wisdom, patterns, gotchas)
   * Automatically fails over to backup if primary is down
   */
  async searchKnowledge(query: string, options?: {
    type?: 'all' | 'wisdom' | 'patterns' | 'gotchas';
    limit?: number;
    domain?: string;
    tags?: string[];
  }): Promise<{
    grouped: {
      wisdom: any[];
      patterns: any[];
      gotchas: any[];
    };
    counts: {
      total: number;
      wisdom: number;
      patterns: number;
      gotchas: number;
    };
  }> {
    try {
      const response = await this.fetchWithFailover('/api/assistant/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          type: options?.type || 'all',
          limit: options?.limit || 20,
          domain: options?.domain,
          tags: options?.tags,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        grouped: {
          wisdom: data.results?.wisdom || [],
          patterns: data.results?.patterns || [],
          gotchas: data.results?.gotchas || [],
        },
        counts: data.counts || { total: 0, wisdom: 0, patterns: 0, gotchas: 0 },
      };
    } catch (error) {
      logger.error('[MasterPortalClient] Search error:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Get search suggestions (autocomplete)
   * Automatically fails over to backup if primary is down
   */
  async getSearchSuggestions(query: string, limit: number = 10): Promise<{
    suggestions: Array<{
      text: string;
      type: 'pattern' | 'wisdom' | 'gotcha' | 'query';
      metadata?: Record<string, any>;
    }>;
  }> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
      });

      const response = await this.fetchWithFailover(`/api/assistant/search?${params}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        suggestions: data.suggestions || [],
      };
    } catch (error) {
      logger.error('[MasterPortalClient] Suggestions error:', getErrorMessage(error));
      return { suggestions: [] };
    }
  }

  /**
   * Execute RPC call to UAA2 Master Portal
   * Supports both single and batch RPC operations
   */
  async executeRpc<T = any>(
    action: string,
    params?: Record<string, any>
  ): Promise<{ success: boolean; data?: T; error?: string; errorCode?: string }> {
    try {
      const response = await this.fetchWithFailover('/api/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          params,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: error.error || error.message || `HTTP ${response.status}`,
          errorCode: error.errorCode || 'RPC_ERROR',
        };
      }

      const data = await response.json();
      return {
        success: data.success ?? true,
        data: data.data,
        error: data.error,
        errorCode: data.errorCode,
      };
    } catch (error) {
      logger.error('[MasterPortalClient] RPC error:', getErrorMessage(error));
      return {
        success: false,
        error: getErrorMessage(error),
        errorCode: 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Get current endpoint health status
   */
  getHealthStatus(): {
    primary: EndpointHealth;
    aiWorkspace: EndpointHealth | null;
    backup: EndpointHealth | null;
    allEndpoints: EndpointHealth[];
  } {
    return {
      primary: this.endpointHealth.get(this.primaryUrl)!,
      aiWorkspace: this.aiWorkspaceUrl ? this.endpointHealth.get(this.aiWorkspaceUrl) || null : null,
      backup: this.backupUrl && this.backupUrl !== this.aiWorkspaceUrl
        ? this.endpointHealth.get(this.backupUrl) || null
        : null,
      allEndpoints: this.getOrderedEndpoints(),
    };
  }

  /**
   * Check if any endpoint with MCP support is available
   */
  hasMCPSupport(): boolean {
    const orderedEndpoints = this.getOrderedEndpoints();
    return orderedEndpoints.some(e => e.healthy && e.supportsMCP);
  }
}

let masterPortalClient: MasterPortalClient | null = null;

export function getMasterPortalClient(): MasterPortalClient {
  if (!masterPortalClient) {
    masterPortalClient = new MasterPortalClient();
  }
  return masterPortalClient;
}

