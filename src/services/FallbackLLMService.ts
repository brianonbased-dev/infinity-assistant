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

export type FallbackProvider = 'claude' | 'openai' | 'ollama' | 'google' | 'cohere' | 'mistral';

export interface FallbackLLMConfig {
  provider: FallbackProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  userId?: string; // For user-provided keys
}

export interface FallbackChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface FallbackChatOptions {
  messages: FallbackChatMessage[];
  maxTokens?: number;
  temperature?: number;
  userId?: string; // For BYOK - user-provided keys
  userProviderKeys?: { provider: FallbackProvider; apiKey: string }[]; // User keys to use
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
  google: 'gemini-pro',
  cohere: 'command-r-plus',
  mistral: 'mistral-large-latest',
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
   * Can be called with userId to check for user-provided keys
   */
  private initializeProviders(userId?: string): void {
    this.providers = []; // Clear existing providers
    
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

    // Add available providers (checking user keys first if userId provided)
    for (const provider of providerOrder) {
      const config = this.getProviderConfig(provider, userId);
      if (config) {
        this.providers.push(config);
        logger.debug(`[FallbackLLM] Provider available: ${provider}${config.userId ? ' (user key)' : ' (system key)'}`);
      }
    }

    if (this.providers.length === 0) {
      logger.warn('[FallbackLLM] No fallback providers configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OLLAMA_URL.');
    } else {
      logger.info(`[FallbackLLM] Initialized with ${this.providers.length} providers:`,
        this.providers.map(p => `${p.provider}${p.userId ? ' (BYOK)' : ''}`));
    }
  }

  /**
   * Reinitialize providers with user keys
   */
  initializeWithUserKeys(userId: string, userKeys: { provider: FallbackProvider; apiKey: string }[]): void {
    this.setUserProviderKeys(userId, userKeys);
    this.initializeProviders(userId);
  }

  /**
   * Get provider configuration if available
   * Checks for user-provided keys first, then falls back to system keys
   */
  private getProviderConfig(provider: FallbackProvider, userId?: string, userApiKey?: string): FallbackLLMConfig | null {
    const modelOverride = process.env.FALLBACK_LLM_MODEL;

    // Use provided user API key if available (BYOK)
    if (userApiKey) {
      logger.debug(`[FallbackLLM] Using provided user key for ${provider}`);
      switch (provider) {
        case 'claude':
          return {
            provider: 'claude',
            apiKey: userApiKey,
            baseUrl: 'https://api.anthropic.com',
            model: modelOverride || DEFAULT_MODELS.claude,
            userId,
          };
        case 'openai':
          return {
            provider: 'openai',
            apiKey: userApiKey,
            baseUrl: 'https://api.openai.com',
            model: modelOverride || DEFAULT_MODELS.openai,
            userId,
          };
        case 'google':
          return {
            provider: 'google',
            apiKey: userApiKey,
            baseUrl: 'https://generativelanguage.googleapis.com',
            model: modelOverride || DEFAULT_MODELS.google,
            userId,
          };
        case 'cohere':
          return {
            provider: 'cohere',
            apiKey: userApiKey,
            baseUrl: 'https://api.cohere.ai',
            model: modelOverride || DEFAULT_MODELS.cohere,
            userId,
          };
        case 'mistral':
          return {
            provider: 'mistral',
            apiKey: userApiKey,
            baseUrl: 'https://api.mistral.ai',
            model: modelOverride || DEFAULT_MODELS.mistral,
            userId,
          };
      }
    }

    // Check for user-provided key from stored keys (legacy support)
    if (userId) {
      const userKey = this.userProviderKeys.get(`${userId}:${provider}`);
      if (userKey) {
        logger.debug(`[FallbackLLM] Using stored user-provided key for ${provider}`);
        switch (provider) {
          case 'claude':
            return {
              provider: 'claude',
              apiKey: userKey.apiKey,
              baseUrl: 'https://api.anthropic.com',
              model: modelOverride || DEFAULT_MODELS.claude,
              userId,
            };
          case 'openai':
            return {
              provider: 'openai',
              apiKey: userKey.apiKey,
              baseUrl: 'https://api.openai.com',
              model: modelOverride || DEFAULT_MODELS.openai,
              userId,
            };
          case 'google':
            return {
              provider: 'google',
              apiKey: userKey.apiKey,
              baseUrl: 'https://generativelanguage.googleapis.com',
              model: modelOverride || DEFAULT_MODELS.google,
              userId,
            };
          case 'cohere':
            return {
              provider: 'cohere',
              apiKey: userKey.apiKey,
              baseUrl: 'https://api.cohere.ai',
              model: modelOverride || DEFAULT_MODELS.cohere,
              userId,
            };
          case 'mistral':
            return {
              provider: 'mistral',
              apiKey: userKey.apiKey,
              baseUrl: 'https://api.mistral.ai',
              model: modelOverride || DEFAULT_MODELS.mistral,
              userId,
            };
        }
      }
    }

    // Fall back to system keys
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

      case 'google': {
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) return null;
        return {
          provider: 'google',
          apiKey,
          baseUrl: 'https://generativelanguage.googleapis.com',
          model: modelOverride || DEFAULT_MODELS.google,
        };
      }

      case 'cohere': {
        const apiKey = process.env.COHERE_API_KEY;
        if (!apiKey) return null;
        return {
          provider: 'cohere',
          apiKey,
          baseUrl: 'https://api.cohere.ai',
          model: modelOverride || DEFAULT_MODELS.cohere,
        };
      }

      case 'mistral': {
        const apiKey = process.env.MISTRAL_API_KEY;
        if (!apiKey) return null;
        return {
          provider: 'mistral',
          apiKey,
          baseUrl: 'https://api.mistral.ai',
          model: modelOverride || DEFAULT_MODELS.mistral,
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
      case 'google':
        return this.callGoogle(config, options);
      case 'cohere':
        return this.callCohere(config, options);
      case 'mistral':
        return this.callMistral(config, options);
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
   * Call Google Gemini API
   */
  private async callGoogle(
    config: FallbackLLMConfig,
    options: FallbackChatOptions
  ): Promise<FallbackChatResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Extract system message and user messages
      const systemMessage = options.messages.find(m => m.role === 'system');
      const userMessages = options.messages.filter(m => m.role !== 'system');

      // Convert messages to Gemini format
      const contents = userMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const response = await fetch(
        `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            systemInstruction: systemMessage?.content ? {
              parts: [{ text: systemMessage.content }],
            } : undefined,
            generationConfig: {
              maxOutputTokens: options.maxTokens || 4096,
              temperature: options.temperature ?? 0.7,
            },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        response: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        provider: 'google',
        model: config.model!,
        tokensUsed: data.usageMetadata?.totalTokenCount,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Call Cohere API
   */
  private async callCohere(
    config: FallbackLLMConfig,
    options: FallbackChatOptions
  ): Promise<FallbackChatResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Extract system message and convert messages to Cohere format
      const systemMessage = options.messages.find(m => m.role === 'system');
      const conversationMessages = options.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
          message: m.content,
        }));

      const response = await fetch(`${config.baseUrl}/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: conversationMessages,
          preamble: systemMessage?.content,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cohere API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        response: data.text || '',
        provider: 'cohere',
        model: config.model!,
        tokensUsed: data.meta?.tokens?.input_tokens && data.meta?.tokens?.output_tokens
          ? data.meta.tokens.input_tokens + data.meta.tokens.output_tokens
          : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Call Mistral API
   */
  private async callMistral(
    config: FallbackLLMConfig,
    options: FallbackChatOptions
  ): Promise<FallbackChatResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Extract system message and convert to Mistral format
      const systemMessage = options.messages.find(m => m.role === 'system');
      const messages = options.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: systemMessage
            ? [{ role: 'system', content: systemMessage.content }, ...messages]
            : messages,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        response: data.choices?.[0]?.message?.content || '',
        provider: 'mistral',
        model: config.model!,
        tokensUsed: data.usage?.total_tokens,
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
