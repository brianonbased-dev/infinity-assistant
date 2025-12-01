/**
 * Unified LLM Client for InfinityAssistant
 *
 * Connects to uaa2-service's UnifiedLLMProvider for code generation,
 * content creation, and AI-powered features.
 *
 * Supports multiple providers: Claude, OpenAI, NVIDIA, Ollama, etc.
 */

export type LLMProvider =
  | 'nvidia'
  | 'together'
  | 'fireworks'
  | 'ollama'
  | 'lmstudio'
  | 'claude'
  | 'openai'
  | 'gemini';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMChatOptions {
  messages: LLMMessage[];
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMChatResult {
  text: string;
  provider: LLMProvider;
  model: string;
  tokensGenerated: number;
  tokensInput: number;
  totalTokens: number;
  generationTimeMs: number;
  tokensPerSecond: number;
}

export interface CodeGenerationRequest {
  intent: string;
  language: string;
  framework?: string;
  context?: string;
  existingCode?: string;
}

export interface CodeWarning {
  type: 'gotcha' | 'security' | 'performance' | 'style' | 'compatibility';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  line?: number;
  fix?: string;
}

export interface CodeSuggestion {
  type: 'improvement' | 'alternative' | 'optimization' | 'best_practice';
  title: string;
  description: string;
  code?: string;
  impact: 'low' | 'medium' | 'high';
}

export interface CodeGenerationResult {
  success: boolean;
  code: string;
  explanation: string;
  warnings: CodeWarning[];
  suggestions: CodeSuggestion[];
  metadata: {
    requestId: string;
    tokensUsed: number;
    generationTime: number;
    provider: string;
    model: string;
  };
}

class UnifiedLLMClient {
  private uaa2ServiceUrl: string;
  private defaultProvider: LLMProvider;
  private timeout: number;

  constructor() {
    // Support multiple endpoint configurations
    this.uaa2ServiceUrl =
      process.env.UAA2_SERVICE_URL ||
      process.env.UAA2_API_URL ||
      process.env.MASTER_PORTAL_URL ||
      'http://localhost:3001';
    this.defaultProvider = (process.env.DEFAULT_LLM_PROVIDER as LLMProvider) || 'claude';
    this.timeout = parseInt(process.env.LLM_TIMEOUT || '60000', 10);
  }

  /**
   * Chat completion using unified LLM API
   */
  async chat(options: LLMChatOptions): Promise<LLMChatResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.uaa2ServiceUrl}/api/llm/unified`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: options.messages,
          provider: options.provider || this.defaultProvider,
          model: options.model,
          temperature: options.temperature ?? 0.7,
          maxTokens: options.maxTokens ?? 4000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'LLM request failed');
      }

      return {
        text: result.data.message.content,
        provider: result.data.provider,
        model: result.data.model,
        tokensGenerated: result.data.tokens.generated,
        tokensInput: result.data.tokens.input,
        totalTokens: result.data.tokens.total,
        generationTimeMs: result.data.performance.generationTimeMs,
        tokensPerSecond: result.data.performance.tokensPerSecond,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('LLM request timed out');
      }
      throw error;
    }
  }

  /**
   * Generate code based on intent
   */
  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    const startTime = Date.now();
    const requestId = `codegen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const systemPrompt = this.buildCodeGenerationPrompt(request);
    const userPrompt = this.buildCodeGenerationUserPrompt(request);

    try {
      const result = await this.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        provider: 'claude', // Claude is best for code generation
        temperature: 0.3, // Lower temperature for more deterministic code
        maxTokens: 4000,
      });

      // Parse the response to extract code and explanation
      const parsed = this.parseCodeResponse(result.text);

      return {
        success: true,
        code: parsed.code,
        explanation: parsed.explanation,
        warnings: parsed.warnings,
        suggestions: parsed.suggestions,
        metadata: {
          requestId,
          tokensUsed: result.totalTokens,
          generationTime: Date.now() - startTime,
          provider: result.provider,
          model: result.model,
        },
      };
    } catch (error) {
      console.error('[UnifiedLLMClient] Code generation failed:', error);
      return {
        success: false,
        code: `// Code generation failed\n// Error: ${error instanceof Error ? error.message : 'Unknown error'}\n// TODO: Implement ${request.intent}`,
        explanation: `Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        warnings: [{
          type: 'gotcha' as const,
          severity: 'error' as const,
          message: 'Code generation failed - please try again or implement manually',
        }],
        suggestions: [],
        metadata: {
          requestId,
          tokensUsed: 0,
          generationTime: Date.now() - startTime,
          provider: 'none',
          model: 'none',
        },
      };
    }
  }

  /**
   * Generate content (documents, reports, etc.)
   */
  async generateContent(
    type: 'document' | 'report' | 'summary' | 'code' | 'data',
    prompt: string,
    options?: {
      format?: string;
      style?: string;
      length?: string;
    }
  ): Promise<{ content: string; tokensUsed: number }> {
    const systemPrompt = this.buildContentGenerationPrompt(type, options);

    const result = await this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 4000,
    });

    return {
      content: result.text,
      tokensUsed: result.totalTokens,
    };
  }

  /**
   * Get available providers
   */
  async getProviders(): Promise<Array<{
    provider: LLMProvider;
    available: boolean;
    defaultModel: string;
    models: string[];
  }>> {
    try {
      const response = await fetch(`${this.uaa2ServiceUrl}/api/llm/unified`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return [];
      }

      const result = await response.json();
      return result.success ? result.data.providers : [];
    } catch {
      return [];
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const providers = await this.getProviders();
      return providers.some(p => p.available);
    } catch {
      return false;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private buildCodeGenerationPrompt(request: CodeGenerationRequest): string {
    return `You are an expert ${request.language} developer${request.framework ? ` with deep expertise in ${request.framework}` : ''}.

Your task is to generate high-quality, production-ready code based on the user's requirements.

Guidelines:
- Write clean, well-documented code
- Follow best practices for ${request.language}${request.framework ? ` and ${request.framework}` : ''}
- Include proper error handling
- Add TypeScript types where applicable
- Consider security best practices (no hardcoded secrets, input validation)
- Make code maintainable and extensible

Response format:
1. Start with a brief explanation of your approach
2. Provide the complete code in a code block
3. List any warnings or considerations
4. Suggest improvements or next steps

${request.context ? `\nContext:\n${request.context}` : ''}
${request.existingCode ? `\nExisting code to integrate with:\n\`\`\`\n${request.existingCode}\n\`\`\`` : ''}`;
  }

  private buildCodeGenerationUserPrompt(request: CodeGenerationRequest): string {
    return `Generate ${request.language} code for: ${request.intent}`;
  }

  private buildContentGenerationPrompt(
    type: string,
    options?: { format?: string; style?: string; length?: string }
  ): string {
    const formatInstructions: Record<string, string> = {
      markdown: 'Format the response in Markdown with proper headings and structure.',
      text: 'Format the response as plain text.',
      json: 'Format the response as valid JSON.',
      html: 'Format the response as HTML.',
    };

    const styleInstructions: Record<string, string> = {
      formal: 'Use a formal, professional tone.',
      casual: 'Use a friendly, conversational tone.',
      technical: 'Use precise technical language.',
    };

    const lengthInstructions: Record<string, string> = {
      short: 'Keep the response concise (1-2 paragraphs).',
      medium: 'Provide a moderate-length response (3-5 paragraphs).',
      long: 'Provide a comprehensive, detailed response.',
    };

    let prompt = `You are a professional content generator. Generate a ${type}.`;

    if (options?.format && formatInstructions[options.format]) {
      prompt += `\n${formatInstructions[options.format]}`;
    }
    if (options?.style && styleInstructions[options.style]) {
      prompt += `\n${styleInstructions[options.style]}`;
    }
    if (options?.length && lengthInstructions[options.length]) {
      prompt += `\n${lengthInstructions[options.length]}`;
    }

    return prompt;
  }

  private parseCodeResponse(response: string): {
    code: string;
    explanation: string;
    warnings: CodeWarning[];
    suggestions: CodeSuggestion[];
  } {
    // Extract code blocks
    const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
    const code = codeBlockMatch ? codeBlockMatch[1].trim() : response;

    // Extract explanation (text before code block)
    const explanationMatch = response.match(/^([\s\S]*?)```/);
    const explanation = explanationMatch ? explanationMatch[1].trim() : 'Code generated successfully.';

    // Extract warnings and convert to CodeWarning format
    const warningsMatch = response.match(/(?:warnings?|considerations?|notes?):\s*([\s\S]*?)(?=```|suggestions?:|$)/i);
    const warnings: CodeWarning[] = warningsMatch
      ? warningsMatch[1]
          .split('\n')
          .filter(w => w.trim().startsWith('-') || w.trim().startsWith('*'))
          .map(w => ({
            type: 'style' as const,
            severity: 'info' as const,
            message: w.replace(/^[-*]\s*/, '').trim(),
          }))
      : [];

    // Extract suggestions and convert to CodeSuggestion format
    const suggestionsMatch = response.match(/(?:suggestions?|improvements?|next steps?):\s*([\s\S]*?)$/i);
    const suggestions: CodeSuggestion[] = suggestionsMatch
      ? suggestionsMatch[1]
          .split('\n')
          .filter(s => s.trim().startsWith('-') || s.trim().startsWith('*'))
          .map(s => ({
            type: 'improvement' as const,
            title: s.replace(/^[-*]\s*/, '').trim().substring(0, 50),
            description: s.replace(/^[-*]\s*/, '').trim(),
            impact: 'medium' as const,
          }))
      : [];

    return { code, explanation, warnings, suggestions };
  }
}

// Singleton instance
let unifiedLLMClientInstance: UnifiedLLMClient | null = null;

export function getUnifiedLLMClient(): UnifiedLLMClient {
  if (!unifiedLLMClientInstance) {
    unifiedLLMClientInstance = new UnifiedLLMClient();
  }
  return unifiedLLMClientInstance;
}

export default UnifiedLLMClient;