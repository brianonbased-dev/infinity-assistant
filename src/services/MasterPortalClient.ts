/**
 * UAA2 Service API Client
 *
 * Client for communicating with uaa2-service public APIs
 * Uses the public /api/assistant/* endpoints for knowledge search and chat
 *
 * Note: Does NOT use Master Portal endpoints (those require admin access)
 */

import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/error-handling';

export interface UAA2Response<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class MasterPortalClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.UAA2_SERVICE_URL || 'http://localhost:3000';
    this.apiKey = process.env.UAA2_SERVICE_API_KEY || '';
  }

  /**
   * Process customer query through public assistant chat API
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
      const response = await fetch(`${this.baseUrl}/api/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'infinityassistant',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify({
          message,
          conversationId: options.conversationId,
          userId: options.userId,
          // Pass through the actual mode (search/assist/build) - don't downgrade
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
      logger.error('[UAA2Client] Chat error:', error);
      throw error;
    }
  }

  /**
   * Search knowledge base through public assistant search API
   * Searches graduated knowledge (wisdom, patterns, gotchas)
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
      const response = await fetch(`${this.baseUrl}/api/assistant/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'infinityassistant',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
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

      // Transform response to expected format
      return {
        grouped: {
          wisdom: data.results?.wisdom || [],
          patterns: data.results?.patterns || [],
          gotchas: data.results?.gotchas || [],
        },
        counts: data.counts || { total: 0, wisdom: 0, patterns: 0, gotchas: 0 },
      };
    } catch (error) {
      logger.error('[UAA2Client] Search error:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions (autocomplete)
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

      const response = await fetch(`${this.baseUrl}/api/assistant/search?${params}`, {
        method: 'GET',
        headers: {
          'X-Service-Name': 'infinityassistant',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
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
      logger.error('[UAA2Client] Suggestions error:', error);
      return { suggestions: [] };
    }
  }
}

let masterPortalClient: MasterPortalClient | null = null;

export function getMasterPortalClient(): MasterPortalClient {
  if (!masterPortalClient) {
    masterPortalClient = new MasterPortalClient();
  }
  return masterPortalClient;
}

