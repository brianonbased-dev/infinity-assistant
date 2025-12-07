/**
 * TypeScript SDK - Core Client
 * 
 * Main client class for Infinity Assistant API
 */

import type {
  InfinityAssistantConfig,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  KnowledgeSearchRequest,
  KnowledgeSearchResponse,
  MemoryStoreRequest,
  MemoryStoreResponse,
  MemoryRetrieveRequest,
  MemoryRetrieveResponse,
  ResearchRequest,
  ResearchResponse,
  ApiKey,
  Webhook,
  ErrorResponse,
} from './types';
import {
  InfinityAssistantError,
  InfinityAssistantTimeoutError,
  InfinityAssistantRateLimitError,
} from './types';

export class InfinityAssistantClient {
  private config: Required<Pick<InfinityAssistantConfig, 'baseUrl' | 'timeout' | 'maxRetries' | 'retryDelay'>> & {
    apiKey?: string;
    fetch: typeof fetch;
  };

  constructor(config: InfinityAssistantConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'https://infinityassistant.io/api',
      apiKey: config.apiKey,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay || 1000,
      fetch: config.fetch || (typeof window !== 'undefined' ? window.fetch : require('isomorphic-fetch')),
    };
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  /**
   * Get API key
   */
  getApiKey(): string | undefined {
    return this.config.apiKey;
  }

  /**
   * Make HTTP request with retry logic
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    // Add authentication header
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await this.config.fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.config.retryDelay;
        
        if (retryCount < this.config.maxRetries) {
          await this.sleep(delay);
          return this.request<T>(endpoint, options, retryCount + 1);
        }
        
        throw new InfinityAssistantRateLimitError(
          'Rate limit exceeded. Please try again later.'
        );
      }

      // Handle other errors
      if (!response.ok) {
        const errorData: ErrorResponse = await response.json().catch(() => ({
          error: 'Unknown error',
          statusCode: response.status,
        }));

        throw new InfinityAssistantError(
          errorData.message || errorData.error || 'Request failed',
          errorData.code,
          errorData.statusCode || response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new InfinityAssistantTimeoutError('Request timeout');
      }

      if (error instanceof InfinityAssistantError) {
        throw error;
      }

      // Retry on network errors
      if (retryCount < this.config.maxRetries && !error.statusCode) {
        await this.sleep(this.config.retryDelay * (retryCount + 1));
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      throw new InfinityAssistantError(
        error.message || 'Network error',
        'NETWORK_ERROR',
        0,
        error
      );
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Chat - Send a message and get a response
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Chat Stream - Send a message and get streaming response
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const url = `${this.config.baseUrl}/chat`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await this.config.fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...request, stream: true }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json().catch(() => ({
          error: 'Unknown error',
        }));
        throw new InfinityAssistantError(
          errorData.message || errorData.error || 'Request failed',
          errorData.code,
          response.status,
          errorData
        );
      }

      if (!response.body) {
        throw new InfinityAssistantError('No response body', 'NO_BODY', response.status);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            yield { type: 'done' };
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                yield { type: 'done' };
                return;
              }

              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'error') {
                  yield { type: 'error', error: parsed.error || 'Unknown error' };
                  return;
                }

                if (parsed.content) {
                  yield { type: 'text', content: parsed.content };
                }

                if (parsed.metadata) {
                  yield { type: 'metadata', metadata: parsed.metadata };
                }
              } catch (e) {
                // Invalid JSON, skip
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new InfinityAssistantTimeoutError('Request timeout');
      }

      if (error instanceof InfinityAssistantError) {
        throw error;
      }

      throw new InfinityAssistantError(
        error.message || 'Stream error',
        'STREAM_ERROR',
        0,
        error
      );
    }
  }

  /**
   * Search Knowledge Base
   */
  async searchKnowledge(request: KnowledgeSearchRequest): Promise<KnowledgeSearchResponse> {
    return this.request<KnowledgeSearchResponse>('/knowledge/search', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Store Memory
   */
  async storeMemory(request: MemoryStoreRequest): Promise<MemoryStoreResponse> {
    return this.request<MemoryStoreResponse>('/memory/store', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Retrieve Memory
   */
  async retrieveMemory(request: MemoryRetrieveRequest): Promise<MemoryRetrieveResponse> {
    return this.request<MemoryRetrieveResponse>(`/memory/retrieve?key=${encodeURIComponent(request.key)}`, {
      method: 'GET',
    });
  }

  /**
   * Research - Perform web research
   */
  async research(request: ResearchRequest): Promise<ResearchResponse> {
    return this.request<ResearchResponse>('/research', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * List API Keys
   */
  async listApiKeys(): Promise<{ success: boolean; apiKeys: ApiKey[] }> {
    return this.request<{ success: boolean; apiKeys: ApiKey[] }>('/api-keys', {
      method: 'GET',
    });
  }

  /**
   * Create API Key
   */
  async createApiKey(name: string): Promise<{ success: boolean; apiKey: ApiKey & { key: string } }> {
    return this.request<{ success: boolean; apiKey: ApiKey & { key: string } }>('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  /**
   * Delete API Key
   */
  async deleteApiKey(keyId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api-keys?id=${encodeURIComponent(keyId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * List Webhooks
   */
  async listWebhooks(): Promise<{ success: boolean; webhooks: Webhook[] }> {
    return this.request<{ success: boolean; webhooks: Webhook[] }>('/webhooks', {
      method: 'GET',
    });
  }

  /**
   * Create Webhook
   */
  async createWebhook(url: string, events: string[]): Promise<{ success: boolean; webhook: Webhook & { secret: string } }> {
    return this.request<{ success: boolean; webhook: Webhook & { secret: string } }>('/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url, events }),
    });
  }

  /**
   * Delete Webhook
   */
  async deleteWebhook(webhookId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/webhooks?id=${encodeURIComponent(webhookId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Health Check
   */
  async health(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health', {
      method: 'GET',
    });
  }
}

