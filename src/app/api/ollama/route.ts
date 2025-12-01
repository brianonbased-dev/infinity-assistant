/**
 * Ollama API Routes
 *
 * Provides local LLM capabilities via Ollama integration.
 * Default model: mistral-nemo:12b
 */

import { NextRequest, NextResponse } from 'next/server';
import { ollamaService } from '@/services/OllamaService';

/**
 * GET /api/ollama - Get Ollama status and models
 */
export async function GET() {
  const status = await ollamaService.checkHealth();

  return NextResponse.json({
    available: status.available,
    version: status.version,
    models: status.models,
    defaultModel: ollamaService.getDefaultModel(),
    recommended: ollamaService.getRecommendedModels(),
    lastCheck: status.lastCheck.toISOString(),
    error: status.error,
  });
}

/**
 * POST /api/ollama - Chat with local LLM
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, model, temperature, maxTokens, systemPrompt, stream } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array required' },
        { status: 400 }
      );
    }

    // Check if Ollama is available
    const status = ollamaService.getStatus();
    if (!status.available) {
      await ollamaService.checkHealth();
      if (!ollamaService.getStatus().available) {
        return NextResponse.json(
          { error: 'Ollama not available', fallback: 'cloud' },
          { status: 503 }
        );
      }
    }

    if (stream) {
      // Streaming response
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of ollamaService.chatStream(messages, {
              model,
              temperature,
              maxTokens,
              systemPrompt,
            })) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
              );
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
            );
            controller.close();
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: String(error) })}\n\n`
              )
            );
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } else {
      // Non-streaming response
      const response = await ollamaService.chat(messages, {
        model,
        temperature,
        maxTokens,
        systemPrompt,
      });

      return NextResponse.json({
        response,
        model: model || ollamaService.getDefaultModel(),
        source: 'ollama',
      });
    }
  } catch (error) {
    console.error('[Ollama API] Error:', error);
    return NextResponse.json(
      { error: 'Chat failed', message: String(error) },
      { status: 500 }
    );
  }
}
