/**
 * Mesh Network API Routes
 *
 * Provides mesh network status and routing capabilities.
 * Connects InfinityAssistant to uaa2-service and AI_Workspace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { meshNodeClient } from '@/services/MeshNodeClient';
import { ollamaService } from '@/services/OllamaService';

/**
 * GET /api/mesh - Get mesh network status
 */
export async function GET() {
  // Refresh node status
  const meshStatus = await meshNodeClient.checkAllNodes();
  const ollamaStatus = await ollamaService.checkHealth();

  return NextResponse.json({
    self: meshStatus.selfNode,
    nodes: meshStatus.connectedNodes.map((node) => ({
      id: node.id,
      name: node.name,
      url: node.url,
      type: node.type,
      status: node.status,
      capabilities: node.capabilities,
      lastCheck: node.lastCheck.toISOString(),
    })),
    ollama: {
      available: ollamaStatus.available,
      version: ollamaStatus.version,
      models: ollamaStatus.models.map((m) => m.name),
      defaultModel: ollamaService.getDefaultModel(),
    },
    lastUpdate: meshStatus.lastUpdate.toISOString(),
  });
}

/**
 * POST /api/mesh - Chat via mesh network (routes to best available LLM)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      model,
      temperature,
      maxTokens,
      systemPrompt,
      preferLocal = true,
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array required' },
        { status: 400 }
      );
    }

    try {
      const result = await meshNodeClient.chat(messages, {
        model,
        temperature,
        maxTokens,
        systemPrompt,
        preferLocal,
        fallbackToCloud: true,
      });

      return NextResponse.json({
        response: result.response,
        source: result.source,
        model: model || ollamaService.getDefaultModel(),
      });
    } catch (error) {
      // If mesh fails and fallback requested, signal to use cloud
      if (String(error).includes('FALLBACK_TO_CLOUD')) {
        return NextResponse.json(
          {
            error: 'No local LLM available',
            fallback: 'cloud',
            message: 'Use cloud APIs (Anthropic/OpenAI) instead',
          },
          { status: 503 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('[Mesh API] Chat error:', error);
    return NextResponse.json(
      { error: 'Mesh chat failed', message: String(error) },
      { status: 500 }
    );
  }
}
