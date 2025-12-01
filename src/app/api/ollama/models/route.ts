/**
 * Ollama Models API Routes
 *
 * Manage local LLM models
 */

import { NextRequest, NextResponse } from 'next/server';
import { ollamaService } from '@/services/OllamaService';

/**
 * GET /api/ollama/models - List available models
 */
export async function GET() {
  try {
    const models = await ollamaService.listModels();
    const recommended = ollamaService.getRecommendedModels();

    return NextResponse.json({
      models,
      recommended,
      defaultModel: ollamaService.getDefaultModel(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list models', message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ollama/models - Pull a model
 */
export async function POST(request: NextRequest) {
  try {
    const { model } = await request.json();

    if (!model) {
      return NextResponse.json(
        { error: 'Model name required' },
        { status: 400 }
      );
    }

    // For SSE streaming of progress
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const success = await ollamaService.pullModel(model, (progress) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(progress)}\n\n`)
            );
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, success })}\n\n`)
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
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to pull model', message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ollama/models - Delete a model
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model');

    if (!model) {
      return NextResponse.json(
        { error: 'Model name required' },
        { status: 400 }
      );
    }

    const success = await ollamaService.deleteModel(model);
    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete model', message: String(error) },
      { status: 500 }
    );
  }
}
