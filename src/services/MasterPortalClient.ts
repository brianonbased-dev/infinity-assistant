/**
 * Master Portal API Client
 *
 * Client for communicating with uaa2-service Master Portal
 * All agent operations go through Master Portal for orchestration
 */

import logger from '@/utils/logger';
import { getErrorMessage } from '@/utils/errorHandling';

export interface MasterPortalRequest {
  agentId: string;
  action: string;
  params?: Record<string, any>;
  serviceName?: string; // For service execution
}

export interface MasterPortalResponse<T = any> {
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
   * Execute agent action through Master Portal
   */
  async executeAgent(request: MasterPortalRequest): Promise<MasterPortalResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/master/agents/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Service-Name': 'infinityassistant',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('[MasterPortalClient] Agent execution error:', error);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Execute service action through Master Portal
   */
  async executeService(
    serviceName: string,
    action: string,
    params?: Record<string, any>,
    agentId?: string
  ): Promise<MasterPortalResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/master/services/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Service-Name': 'infinityassistant',
        },
        body: JSON.stringify({
          agentId: agentId || 'infinityassistant',
          serviceName,
          action,
          params,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('[MasterPortalClient] Service execution error:', error);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Process customer query through Master Portal
   */
  async processCustomerQuery(
    message: string,
    options: {
      conversationId?: string;
      userId?: string;
      mode?: 'limited';
      limitedCapabilities?: string[];
    }
  ): Promise<{ response: string; tokensUsed?: number }> {
    const result = await this.executeAgent({
      agentId: 'customer-service',
      action: 'processCustomerQuery',
      params: {
        message,
        ...options,
      },
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to process query');
    }

    return result.data;
  }

  /**
   * Search knowledge base through Master Portal
   */
  async searchKnowledge(query: string, options?: {
    type?: 'all' | 'wisdom' | 'patterns' | 'gotchas';
    limit?: number;
    domain?: string;
    tags?: string[];
  }): Promise<any> {
    const result = await this.executeService(
      'UnifiedKnowledgeQuery',
      'queryUnified',
      {
        query,
        ...options,
        track_applications: false,
      },
      'infinityassistant'
    );

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to search knowledge');
    }

    return result.data;
  }
}

let masterPortalClient: MasterPortalClient | null = null;

export function getMasterPortalClient(): MasterPortalClient {
  if (!masterPortalClient) {
    masterPortalClient = new MasterPortalClient();
  }
  return masterPortalClient;
}

