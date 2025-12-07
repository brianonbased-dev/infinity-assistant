/**
 * Key Validation Service
 * 
 * Validates LLM provider API keys by making test API calls
 */

import logger from '@/utils/logger';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  provider?: string;
  model?: string;
}

/**
 * Validate OpenAI API key
 */
async function validateOpenAIKey(apiKey: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (response.status === 429) {
      return { valid: false, error: 'Rate limit exceeded (key may be valid)' };
    }

    if (!response.ok) {
      return { valid: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const models = data.data || [];
    const model = models[0]?.id || 'unknown';

    return {
      valid: true,
      provider: 'openai',
      model,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { valid: false, error: 'Validation timeout' };
    }
    logger.error('[KeyValidation] OpenAI validation error:', error);
    return { valid: false, error: error.message || 'Validation failed' };
  }
}

/**
 * Validate Anthropic API key
 */
async function validateAnthropicKey(apiKey: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (response.status === 429) {
      return { valid: false, error: 'Rate limit exceeded (key may be valid)' };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        valid: false,
        error: errorData.error?.message || `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const model = data.model || 'claude-3-haiku-20240307';

    return {
      valid: true,
      provider: 'anthropic',
      model,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { valid: false, error: 'Validation timeout' };
    }
    logger.error('[KeyValidation] Anthropic validation error:', error);
    return { valid: false, error: error.message || 'Validation failed' };
  }
}

/**
 * Validate Google API key (Gemini)
 */
async function validateGoogleKey(apiKey: string): Promise<ValidationResult> {
  try {
    // Test with Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'test' }] }],
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (response.status === 400) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error?.message?.includes('API key')) {
        return { valid: false, error: 'Invalid API key' };
      }
    }

    if (response.status === 429) {
      return { valid: false, error: 'Rate limit exceeded (key may be valid)' };
    }

    if (!response.ok) {
      return { valid: false, error: `API error: ${response.status}` };
    }

    return {
      valid: true,
      provider: 'google',
      model: 'gemini-pro',
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { valid: false, error: 'Validation timeout' };
    }
    logger.error('[KeyValidation] Google validation error:', error);
    return { valid: false, error: error.message || 'Validation failed' };
  }
}

/**
 * Validate Cohere API key
 */
async function validateCohereKey(apiKey: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://api.cohere.ai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (response.status === 429) {
      return { valid: false, error: 'Rate limit exceeded (key may be valid)' };
    }

    if (!response.ok) {
      return { valid: false, error: `API error: ${response.status}` };
    }

    return {
      valid: true,
      provider: 'cohere',
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { valid: false, error: 'Validation timeout' };
    }
    logger.error('[KeyValidation] Cohere validation error:', error);
    return { valid: false, error: error.message || 'Validation failed' };
  }
}

/**
 * Validate Mistral API key
 */
async function validateMistralKey(apiKey: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://api.mistral.ai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (response.status === 429) {
      return { valid: false, error: 'Rate limit exceeded (key may be valid)' };
    }

    if (!response.ok) {
      return { valid: false, error: `API error: ${response.status}` };
    }

    return {
      valid: true,
      provider: 'mistral',
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { valid: false, error: 'Validation timeout' };
    }
    logger.error('[KeyValidation] Mistral validation error:', error);
    return { valid: false, error: error.message || 'Validation failed' };
  }
}

/**
 * Validate provider API key
 */
export async function validateProviderKey(
  provider: string,
  apiKey: string
): Promise<ValidationResult> {
  switch (provider) {
    case 'openai':
      return validateOpenAIKey(apiKey);
    case 'anthropic':
      return validateAnthropicKey(apiKey);
    case 'google':
      return validateGoogleKey(apiKey);
    case 'cohere':
      return validateCohereKey(apiKey);
    case 'mistral':
      return validateMistralKey(apiKey);
    default:
      return { valid: false, error: `Unsupported provider: ${provider}` };
  }
}

