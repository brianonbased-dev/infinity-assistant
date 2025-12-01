/**
 * Ollama Service for InfinityAssistant
 *
 * Provides local LLM capabilities via Ollama.
 * Uses mistral-nemo:12b as default model.
 *
 * Features:
 * - Chat completions with streaming support
 * - Model management (list, pull, delete)
 * - Embeddings generation
 * - Health monitoring
 * - Automatic fallback when Ollama unavailable
 */

import logger from '@/utils/logger';

export interface OllamaConfig {
  baseUrl: string;
  defaultModel: string;
  timeout: number;
  maxRetries: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
  details?: {
    format: string;
    family: string;
    parameterSize: string;
    quantizationLevel: string;
  };
}

export interface OllamaStatus {
  available: boolean;
  version?: string;
  models: OllamaModel[];
  lastCheck: Date;
  error?: string;
}

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  defaultModel: process.env.OLLAMA_MODEL || 'mistral-nemo:12b',
  timeout: 180000, // 3 minutes for generation (Nemo is larger)
  maxRetries: 3,
};

class OllamaService {
  private config: OllamaConfig;
  private status: OllamaStatus = {
    available: false,
    models: [],
    lastCheck: new Date(),
  };

  constructor(config: Partial<OllamaConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if Ollama is running and available
   */
  async checkHealth(): Promise<OllamaStatus> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.baseUrl}/api/version`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = (await response.json()) as { version?: string };
        const models = await this.listModels();

        this.status = {
          available: true,
          version: data.version || 'unknown',
          models,
          lastCheck: new Date(),
        };
        logger.info(`[Ollama] Connected (v${this.status.version}), ${models.length} models available`);
      } else {
        this.status = {
          available: false,
          models: [],
          lastCheck: new Date(),
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      this.status = {
        available: false,
        models: [],
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Connection failed',
      };
      logger.debug('[Ollama] Not available:', this.status.error);
    }

    return this.status;
  }

  /**
   * Get current status (cached)
   */
  getStatus(): OllamaStatus {
    return this.status;
  }

  /**
   * List available models
   */
  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (response.ok) {
        const data = (await response.json()) as { models?: OllamaModel[] };
        return data.models || [];
      }
    } catch {
      // Silently fail, return empty array
    }
    return [];
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(
    modelName: string,
    onProgress?: (progress: { status: string; completed?: number; total?: number }) => void
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
      });

      if (!response.ok || !response.body) {
        return false;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const progress = JSON.parse(line);
            onProgress?.(progress);
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Refresh model list
      await this.checkHealth();
      return true;
    } catch (error) {
      logger.error('[Ollama] Failed to pull model:', error);
      return false;
    }
  }

  /**
   * Delete a model
   */
  async deleteModel(modelName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (response.ok) {
        await this.checkHealth();
        return true;
      }
    } catch {
      // Silently fail
    }
    return false;
  }

  /**
   * Generate a chat completion
   */
  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const model = options.model || this.config.defaultModel;

    // Add system prompt if provided
    const allMessages = options.systemPrompt
      ? [{ role: 'system' as const, content: options.systemPrompt }, ...messages]
      : messages;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: allMessages,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens ?? 2048,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = (await response.json()) as { message?: { content: string } };
      return data.message?.content || '';
    } catch (error) {
      logger.error('[Ollama] Chat error:', error);
      throw error;
    }
  }

  /**
   * Generate a chat completion with streaming
   */
  async *chatStream(
    messages: ChatMessage[],
    options: ChatOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const model = options.model || this.config.defaultModel;

    const allMessages = options.systemPrompt
      ? [{ role: 'system' as const, content: options.systemPrompt }, ...messages]
      : messages;

    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: allMessages,
        stream: true,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama streaming error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line) as { message?: { content: string } };
          if (data.message?.content) {
            yield data.message.content;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbeddings(text: string, model?: string): Promise<number[]> {
    const embeddingModel = model || 'nomic-embed-text';

    try {
      const response = await fetch(`${this.config.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: embeddingModel,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embeddings error: ${response.status}`);
      }

      const data = (await response.json()) as { embedding?: number[] };
      return data.embedding || [];
    } catch (error) {
      logger.error('[Ollama] Embeddings error:', error);
      throw error;
    }
  }

  /**
   * Simple text completion (single prompt)
   */
  async complete(prompt: string, options: ChatOptions = {}): Promise<string> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }

  /**
   * Get recommended models for different use cases
   */
  getRecommendedModels(): { name: string; description: string; size: string }[] {
    return [
      { name: 'mistral-nemo:12b', description: 'NVIDIA Nemo - Best quality, multilingual', size: '7.5GB' },
      { name: 'deepseek-r1:latest', description: 'DeepSeek R1 - Strong reasoning', size: '5.2GB' },
      { name: 'llama3.2', description: 'General purpose, fast', size: '2GB' },
      { name: 'llama3.2:1b', description: 'Lightweight, very fast', size: '1.3GB' },
      { name: 'codellama', description: 'Code generation', size: '3.8GB' },
      { name: 'qwen2.5-coder', description: 'Code specialist', size: '4.7GB' },
      { name: 'nomic-embed-text', description: 'Text embeddings', size: '274MB' },
    ];
  }

  /**
   * Get default model name
   */
  getDefaultModel(): string {
    return this.config.defaultModel;
  }
}

// Export singleton instance
export const ollamaService = new OllamaService();

// Export class for custom instances
export { OllamaService };
