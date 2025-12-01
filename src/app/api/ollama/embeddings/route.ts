/**
 * Ollama Embeddings API Route
 *
 * Generate text embeddings via local LLM
 */

import { NextRequest, NextResponse } from 'next/server';
import { ollamaService } from '@/services/OllamaService';

/**
 * POST /api/ollama/embeddings - Generate embeddings
 */
export async function POST(request: NextRequest) {
  try {
    const { text, model } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text required' },
        { status: 400 }
      );
    }

    const embedding = await ollamaService.generateEmbeddings(text, model);

    return NextResponse.json({
      embedding,
      dimensions: embedding.length,
      model: model || 'nomic-embed-text',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Embeddings failed', message: String(error) },
      { status: 500 }
    );
  }
}
