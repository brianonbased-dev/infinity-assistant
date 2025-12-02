/**
 * Fallback LLM Service
 *
 * Provides direct LLM access when uaa2-service is unavailable.
 * Supports multiple providers with automatic fallback chain:
 * 1. Claude (Anthropic) - Primary
 * 2. OpenAI - Secondary
 * 3. Ollama - Local fallback
 *
 * Environment Variables:
 * - FALLBACK_LLM_PROVIDER: Primary fallback provider (claude, openai, ollama)
 * - ANTHROPIC_API_KEY: Claude API key
 * - OPENAI_API_KEY: OpenAI API key
 * - OLLAMA_URL: Ollama server URL (default: http://localhost:11434)
 * - FALLBACK_LLM_MODEL: Override default model for fallback
 */

import logger from '@/utils/logger';

export type FallbackProvider = 'claude' | 'openai' | 'ollama';

export interface FallbackLLMConfig {
  provider: FallbackProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface FallbackChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface FallbackChatOptions {
  messages: FallbackChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface FallbackChatResult {
  response: string;
  provider: FallbackProvider;
  model: string;
  tokensUsed?: number;
}

// Provider-specific default models
const DEFAULT_MODELS: Record<FallbackProvider, string> = {
  claude: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
  ollama: 'llama3.2',
};

class FallbackLLMService {
  private providers: FallbackLLMConfig[] = [];
  private timeout: number;

  constructor() {
    this.timeout = parseInt(process.env.LLM_TIMEOUT || '60000', 10);
    this.initializeProviders();
  }

  /**
   * Initialize available providers based on environment variables
   */
  private initializeProviders(): void {
    const primaryProvider = (process.env.FALLBACK_LLM_PROVIDER as FallbackProvider) || 'claude';
    const providerOrder: FallbackProvider[] = [];

    // Build provider order starting with primary
    if (primaryProvider === 'claude') {
      providerOrder.push('claude', 'openai', 'ollama');
    } else if (primaryProvider === 'openai') {
      providerOrder.push('openai', 'claude', 'ollama');
    } else {
      providerOrder.push('ollama', 'claude', 'openai');
    }

    // Add available providers
    for (const provider of providerOrder) {
      const config = this.getProviderConfig(provider);
      if (config) {
        this.providers.push(config);
        logger.debug(`[FallbackLLM] Provider available: ${provider}`);
      }
    }

    if (this.providers.length === 0) {
      logger.warn('[FallbackLLM] No fallback providers configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OLLAMA_URL.');
    } else {
      logger.info(`[FallbackLLM] Initialized with ${this.providers.length} providers:`,
        this.providers.map(p => p.provider));
    }
  }

  /**
   * Get provider configuration if available
   */
  private getProviderConfig(provider: FallbackProvider): FallbackLLMConfig | null {
    const modelOverride = process.env.FALLBACK_LLM_MODEL;

    switch (provider) {
      case 'claude': {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return null;
        return {
          provider: 'claude',
          apiKey,
          baseUrl: 'https://api.anthropic.com',
          model: modelOverride || DEFAULT_MODELS.claude,
        };
      }

      case 'openai': {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return null;
        return {
          provider: 'openai',
          apiKey,
          baseUrl: 'https://api.openai.com',
          model: modelOverride || DEFAULT_MODELS.openai,
        };
      }

      case 'ollama': {
        const baseUrl = process.env.OLLAMA_URL || process.env.OLLAMA_MESH_URL;
        // Ollama doesn't require API key, just needs to be reachable
        return {
          provider: 'ollama',
          baseUrl: baseUrl || 'http://localhost:11434',
          model: modelOverride || DEFAULT_MODELS.ollama,
        };
      }

      default:
        return null;
    }
  }

  /**
   * Check if any fallback providers are available
   */
  isAvailable(): boolean {
    return this.providers.length > 0;
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): FallbackProvider[] {
    return this.providers.map(p => p.provider);
  }

  /**
   * Chat completion with automatic fallback
   */
  async chat(options: FallbackChatOptions): Promise<FallbackChatResult> {
    if (this.providers.length === 0) {
      throw new Error('No fallback LLM providers configured');
    }

    let lastError: Error | null = null;

    for (const config of this.providers) {
      try {
        logger.debug(`[FallbackLLM] Trying provider: ${config.provider}`);
        const result = await this.callProvider(config, options);
        logger.info(`[FallbackLLM] Success with provider: ${config.provider}`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`[FallbackLLM] Provider ${config.provider} failed:`, lastError.message);
      }
    }

    throw lastError || new Error('All fallback providers failed');
  }

  /**
   * Call a specific provider
   */
  private async callProvider(
    config: FallbackLLMConfig,
    options: FallbackChatOptions
  ): Promise<FallbackChatResult> {
    switch (config.provider) {
      case 'claude':
        return this.callClaude(config, options);
      case 'openai':
        return this.callOpenAI(config, options);
      case 'ollama':
        return this.callOllama(config, options);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  /**
   * Call Claude (Anthropic) API
   */
  private async callClaude(
    config: FallbackLLMConfig,
    options: FallbackChatOptions
  ): Promise<FallbackChatResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Extract system message and convert to Anthropic format
      const systemMessage = options.messages.find(m => m.role === 'system');
      const userMessages = options.messages.filter(m => m.role !== 'system');

      const response = await fetch(`${config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
          system: systemMessage?.content || '',
          messages: userMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        response: data.content?.[0]?.text || '',
        provider: 'claude',
        model: config.model!,
        tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    config: FallbackLLMConfig,
    options: FallbackChatOptions
  ): Promise<FallbackChatResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
          messages: options.messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        response: data.choices?.[0]?.message?.content || '',
        provider: 'openai',
        model: config.model!,
        tokensUsed: data.usage?.total_tokens,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Call Ollama API
   */
  private async callOllama(
    config: FallbackLLMConfig,
    options: FallbackChatOptions
  ): Promise<FallbackChatResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: options.messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          stream: false,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens || 4096,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        response: data.message?.content || '',
        provider: 'ollama',
        model: config.model!,
        tokensUsed: data.eval_count,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Simple chat for basic queries (without full context)
   */
  async simpleChat(message: string, systemPrompt?: string): Promise<string> {
    const messages: FallbackChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: message });

    const result = await this.chat({ messages });
    return result.response;
  }

  /**
   * Health check - test if any provider is reachable
   */
  async healthCheck(): Promise<{ available: boolean; providers: string[] }> {
    const availableProviders: string[] = [];

    for (const config of this.providers) {
      try {
        if (config.provider === 'ollama') {
          // Ollama health check
          const response = await fetch(`${config.baseUrl}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok) {
            availableProviders.push('ollama');
          }
        } else {
          // For Claude/OpenAI, we trust the API key exists
          availableProviders.push(config.provider);
        }
      } catch {
        // Provider not available
      }
    }

    return {
      available: availableProviders.length > 0,
      providers: availableProviders,
    };
  }
}

// Singleton instance
let fallbackLLMService: FallbackLLMService | null = null;

export function getFallbackLLMService(): FallbackLLMService {
  if (!fallbackLLMService) {
    fallbackLLMService = new FallbackLLMService();
  }
  return fallbackLLMService;
}

export default FallbackLLMService;
