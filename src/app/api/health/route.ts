/**
 * Health Check API
 *
 * Returns service health status for monitoring
 * Includes mesh network, Ollama LLM, and fallback LLM status
 */

import { NextResponse } from 'next/server';
import { getSupabaseClient, TABLES } from '@/lib/supabase';
import { ollamaService } from '@/services/OllamaService';
import { meshNodeClient } from '@/services/MeshNodeClient';
import { getMasterPortalClient } from '@/services/MasterPortalClient';
import { getFallbackLLMService } from '@/services/FallbackLLMService';

export async function GET() {
  const checks: Record<string, { status: string; latency?: number; details?: any }> = {};
  let overallStatus = 'healthy';

  // Check Supabase connection
  try {
    const start = Date.now();
    const supabase = getSupabaseClient();
    await supabase.from(TABLES.USER_PREFERENCES).select('user_id').limit(1);
    checks.supabase = { status: 'healthy', latency: Date.now() - start };
  } catch {
    checks.supabase = { status: 'unhealthy' };
    overallStatus = 'degraded';
  }

  // Check Stripe configuration
  checks.stripe = {
    status: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured',
  };

  // Check AI providers
  checks.anthropic = {
    status: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured',
  };
  checks.openai = {
    status: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
  };

  // Check Ollama (local LLM)
  try {
    const start = Date.now();
    const ollamaStatus = await ollamaService.checkHealth();
    checks.ollama = {
      status: ollamaStatus.available ? 'healthy' : 'offline',
      latency: Date.now() - start,
      details: {
        version: ollamaStatus.version,
        models: ollamaStatus.models.map((m) => m.name),
        defaultModel: ollamaService.getDefaultModel(),
      },
    };
  } catch {
    checks.ollama = { status: 'offline' };
  }

  // Check mesh network nodes
  try {
    const meshStatus = meshNodeClient.getStatus();
    const onlineNodes = meshStatus.connectedNodes.filter((n) => n.status === 'online');
    checks.mesh = {
      status: onlineNodes.length > 0 ? 'connected' : 'disconnected',
      details: {
        self: meshStatus.selfNode.id,
        nodes: meshStatus.connectedNodes.map((n) => ({
          id: n.id,
          status: n.status,
        })),
      },
    };
  } catch {
    checks.mesh = { status: 'error' };
  }

  // Check UAA2 service (Master Portal) with all failover endpoints
  try {
    const masterPortal = getMasterPortalClient();
    const healthStatus = masterPortal.getHealthStatus();

    // Check if any endpoint is healthy
    const anyHealthy = healthStatus.allEndpoints.some(e => e.healthy);
    const hasMCP = masterPortal.hasMCPSupport();

    checks.uaa2_service = {
      status: anyHealthy ? 'healthy' : 'unhealthy',
      details: {
        hasMCPSupport: hasMCP,
        endpoints: healthStatus.allEndpoints.map(e => ({
          name: e.name,
          url: e.url,
          healthy: e.healthy,
          failureCount: e.failureCount,
          supportsMCP: e.supportsMCP,
        })),
        primary: {
          url: healthStatus.primary.url,
          healthy: healthStatus.primary.healthy,
          failureCount: healthStatus.primary.failureCount,
        },
        aiWorkspace: healthStatus.aiWorkspace ? {
          url: healthStatus.aiWorkspace.url,
          healthy: healthStatus.aiWorkspace.healthy,
          failureCount: healthStatus.aiWorkspace.failureCount,
          supportsMCP: healthStatus.aiWorkspace.supportsMCP,
        } : null,
        backup: healthStatus.backup ? {
          url: healthStatus.backup.url,
          healthy: healthStatus.backup.healthy,
          failureCount: healthStatus.backup.failureCount,
        } : null,
      },
    };

    if (!anyHealthy) {
      overallStatus = 'degraded';
    }
  } catch {
    checks.uaa2_service = { status: 'error' };
    overallStatus = 'degraded';
  }

  // Check Fallback LLM Service
  try {
    const fallbackService = getFallbackLLMService();
    const fallbackHealth = await fallbackService.healthCheck();
    checks.fallback_llm = {
      status: fallbackHealth.available ? 'available' : 'unavailable',
      details: {
        providers: fallbackHealth.providers,
        configuredProviders: fallbackService.getAvailableProviders(),
      },
    };
  } catch {
    checks.fallback_llm = { status: 'error' };
  }

  // Determine if we have any LLM capability
  const hasLLMCapability =
    checks.uaa2_service?.status === 'healthy' ||
    checks.fallback_llm?.status === 'available' ||
    checks.ollama?.status === 'healthy';

  if (!hasLLMCapability) {
    overallStatus = 'critical';
  }

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    service: 'infinityassistant',
    checks,
  });
}
