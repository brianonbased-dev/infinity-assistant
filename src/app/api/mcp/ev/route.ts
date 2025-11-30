/**
 * MCP EV Integration API
 *
 * Handles incoming tool calls from uaa2-service MCP Orchestrator.
 * POST /api/mcp/ev - Execute an EV tool
 * GET /api/mcp/ev - Get available tools
 */

import { NextRequest, NextResponse } from 'next/server';
import { mcpEVIntegration } from '@/lib/integrations';
import { withMiddleware, success, error } from '@/lib/apiMiddleware';

/**
 * POST /api/mcp/ev
 * Execute an EV tool from MCP Orchestrator
 */
export const POST = withMiddleware(
  async (req: NextRequest, ctx) => {
    const body = await req.json();

    const { toolName, arguments: args, correlationId } = body;

    if (!toolName) {
      return error('VALIDATION_FAILED', 'toolName is required', 400);
    }

    const result = await mcpEVIntegration.executeTool({
      toolName,
      arguments: args || {},
      correlationId
    });

    if (!result.success) {
      return error('TOOL_EXECUTION_FAILED', result.error || 'Unknown error', 500, {
        executionTimeMs: result.executionTimeMs
      });
    }

    return success({
      result: result.result,
      executionTimeMs: result.executionTimeMs
    }, ctx);
  },
  { logging: true }
);

/**
 * GET /api/mcp/ev
 * Get available EV tools and their schemas
 */
export const GET = withMiddleware(
  async (req: NextRequest, ctx) => {
    const tools = mcpEVIntegration.getToolDefinitions();
    const health = mcpEVIntegration.getHealth();

    return success({
      tools,
      health,
      serverId: 'infinityassistant-ev',
      serverName: 'Infinity Assistant EV Service'
    }, ctx);
  }
);
