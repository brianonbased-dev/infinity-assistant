/**
 * UAA2 Service API Client with Failover Support
 *
 * Client for communicating with uaa2-service public APIs
 * Uses the public /api/assistant/* endpoints for knowledge search and chat
 *
 * FAILOVER ARCHITECTURE:
 * - Primary: uaa2-service on Railway (UAA2_SERVICE_URL)
 * - Backup: AI_Workspace on Railway (UAA2_BACKUP_URL)
 *
 * If primary fails, automatically tries backup. Caches health status to avoid
 * repeated failed requests.
 */

import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error-handling';

export interface UAA2Response<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface EndpointHealth {
  url: string;
  healthy: boolean;
  lastCheck: Date;
  failureCount: number;
}

const HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds
const MAX_FAILURES_BEFORE_UNHEALTHY = 3;

export class MasterPortalClient {
  private primaryUrl: string;
  private backupUrl: string | null;
  private apiKey: string;
  private endpointHealth: Map<string, EndpointHealth> = new Map();

  constructor() {
    this.primaryUrl = process.env.UAA2_SERVICE_URL || 'http://localhost:3000';
    this.backupUrl = process.env.UAA2_BACKUP_URL || null;
    this.apiKey = process.env.UAA2_SERVICE_API_KEY || '';

    // Initialize health tracking
    this.endpointHealth.set(this.primaryUrl, {
      url: this.primaryUrl,
      healthy: true,
      lastCheck: new Date(),
      failureCount: 0,
    });

    if (this.backupUrl) {
      this.endpointHealth.set(this.backupUrl, {
        url: this.backupUrl,
        healthy: true,
        lastCheck: new Date(),
        failureCount: 0,
      });
      logger.info('[MasterPortalClient] Failover enabled', {
        primary: this.primaryUrl,
        backup: this.backupUrl,
      });
    }
  }

  /**
   * Get the best available endpoint (prefers healthy primary)
   */
  private getBestEndpoint(): string {
    const primaryHealth = this.endpointHealth.get(this.primaryUrl);

    // If primary is healthy or we have no backup, use primary
    if (!this.backupUrl || primaryHealth?.healthy) {
      return this.primaryUrl;
    }

    // Primary unhealthy, check if we should retry
    const timeSinceLastCheck = Date.now() - (primaryHealth?.lastCheck.getTime() || 0);
    if (timeSinceLastCheck > HEALTH_CHECK_INTERVAL_MS) {
      // Try primary again
      return this.primaryUrl;
    }

    // Use backup
    logger.debug('[MasterPortalClient] Using backup endpoint', { backup: this.backupUrl });
    return this.backupUrl;
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
          url,
          failures: health.failureCount,
        });
      }
    }
    health.lastCheck = new Date();
  }

  /**
   * Make request with failover support
   */
  private async fetchWithFailover(
    path: string,
    options: RequestInit
  ): Promise<Response> {
    const primaryEndpoint = this.getBestEndpoint();
    const endpoints = [primaryEndpoint];

    // Add backup to try list if it exists and isn't already primary
    if (this.backupUrl && primaryEndpoint !== this.backupUrl) {
      endpoints.push(this.backupUrl);
    }

    let lastError: Error | null = null;

    for (const baseUrl of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          ...options,
          headers: {
            ...options.headers,
            'X-Service-Name': 'infinityassistant',
            ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
          },
        });

        if (response.ok) {
          this.markEndpointHealth(baseUrl, true);
          return response;
        }

        // Non-ok response but server responded - might be app error, not infra
        if (response.status < 500) {
          return response; // Return client errors as-is
        }

        // Server error - mark unhealthy and try backup
        this.markEndpointHealth(baseUrl, false);
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        this.markEndpointHealth(baseUrl, false);
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.debug('[MasterPortalClient] Endpoint failed, trying next', {
          url: baseUrl,
          error: getErrorMessage(error),
        });
      }
    }

    throw lastError || new Error('All endpoints failed');
  }

  /**
   * Process customer query through public assistant chat API
   * Automatically fails over to backup if primary is down
   */
  async processCustomerQuery(
    message: string,
    options: {
      conversationId?: string;
      userId?: string;
      mode?: 'limited' | 'search' | 'assist' | 'build';
      limitedCapabilities?: string[];
    }
  ): Promise<{ response: string; tokensUsed?: number; conversationId?: string }> {
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
      };
    } catch (error) {
      logger.error('[MasterPortalClient] Chat error:', getErrorMessage(error));
      throw error;
    }
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
   * Get current endpoint health status
   */
  getHealthStatus(): { primary: EndpointHealth; backup: EndpointHealth | null } {
    return {
      primary: this.endpointHealth.get(this.primaryUrl)!,
      backup: this.backupUrl ? this.endpointHealth.get(this.backupUrl) || null : null,
    };
  }
}

let masterPortalClient: MasterPortalClient | null = null;

export function getMasterPortalClient(): MasterPortalClient {
  if (!masterPortalClient) {
    masterPortalClient = new MasterPortalClient();
  }
  return masterPortalClient;
}

