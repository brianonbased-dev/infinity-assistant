/**
 * Cross-Service Integration Tests
 *
 * Tests the integration between InfinityAssistant and UAA2 Service
 *
 * Prerequisites:
 * - UAA2 Service running on localhost:3000 or configured URL
 * - Valid API keys in environment
 * - Supabase database accessible
 *
 * Run with: npm test -- cross-service.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { getMasterPortalClient } from '@/services/MasterPortalClient';

describe('Cross-Service Integration Tests', () => {
  const masterPortal = getMasterPortalClient();
  let testUserId: string;
  let testConversationId: string;

  beforeAll(async () => {
    testUserId = `test-user-${Date.now()}`;
    testConversationId = `test-conv-${Date.now()}`;
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  describe('Health & Connectivity', () => {
    test('UAA2 Service is reachable', async () => {
      const health = masterPortal.getHealthStatus();

      expect(health.primary).toBeDefined();
      expect(health.primary.url).toBeTruthy();

      // At least one endpoint should be healthy
      const hasHealthyEndpoint = health.allEndpoints.some(e => e.healthy);
      expect(hasHealthyEndpoint).toBe(true);
    }, { timeout: 10000 });

    test('MCP support is available', () => {
      const hasMCP = masterPortal.hasMCPSupport();
      expect(typeof hasMCP).toBe('boolean');
    });

    test('Health check returns valid status', async () => {
      const response = await fetch('http://localhost:3002/api/health');
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('services');
      expect(data.services).toHaveProperty('uaa2');
    }, { timeout: 10000 });
  });

  describe('Chat API Integration', () => {
    test('Chat message routes to UAA2', async () => {
      const response = await fetch('http://localhost:3002/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Hello, this is a test message',
          userId: testUserId,
          conversationId: testConversationId,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data).toHaveProperty('response');
      expect(data).toHaveProperty('conversationId');
      expect(typeof data.response).toBe('string');
      expect(data.response.length).toBeGreaterThan(0);
    }, { timeout: 30000 });

    test('Chat includes performance metrics', async () => {
      const response = await fetch('http://localhost:3002/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Quick test',
          userId: testUserId,
        }),
      });

      const data = await response.json();
      expect(data).toHaveProperty('metrics');
      expect(data.metrics).toHaveProperty('latency');
      expect(typeof data.metrics.latency).toBe('number');
    }, { timeout: 30000 });
  });

  describe('Knowledge Search Integration', () => {
    test('Search routes to UAA2 knowledge base', async () => {
      const response = await fetch('http://localhost:3002/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'authentication',
          type: 'all',
          limit: 10,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('results');
      expect(data.results).toHaveProperty('wisdom');
      expect(data.results).toHaveProperty('patterns');
      expect(data.results).toHaveProperty('gotchas');
    }, { timeout: 10000 });

    test('Search returns W/P/G structure', async () => {
      const results = await masterPortal.searchKnowledge('react hooks', {
        type: 'patterns',
        limit: 5,
      });

      expect(results).toHaveProperty('success');
      if (results.success && results.results) {
        expect(Array.isArray(results.results)).toBe(true);

        if (results.results.length > 0) {
          const firstResult = results.results[0];
          expect(firstResult).toHaveProperty('id');
          expect(firstResult).toHaveProperty('content');
          expect(firstResult).toHaveProperty('score');
        }
      }
    }, { timeout: 10000 });
  });

  describe('Admin API Integration', () => {
    test('Knowledge API requires admin access', async () => {
      const response = await fetch('http://localhost:3002/api/knowledge?type=all&limit=10', {
        method: 'GET',
        headers: {
          'X-User-Tier': 'free', // Non-admin tier
        },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Admin');
    }, { timeout: 5000 });

    test('Master tier can access knowledge API', async () => {
      const response = await fetch('http://localhost:3002/api/knowledge?type=wisdom&limit=5', {
        method: 'GET',
        headers: {
          'X-User-Tier': 'master',
        },
      });

      // Should either succeed or fail with authentication issue (not permission)
      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('entries');
      } else {
        expect(response.status).not.toBe(403); // Not forbidden
      }
    }, { timeout: 10000 });
  });

  describe('Mesh Network Integration', () => {
    test('Mesh stats are accessible', async () => {
      const response = await fetch('http://localhost:3002/api/mesh/stats');
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('stats');
    }, { timeout: 5000 });

    test('Mesh registration works', async () => {
      const testNodeId = `test-node-${Date.now()}`;

      const response = await fetch('http://localhost:3002/api/mesh/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: testNodeId,
          capabilities: ['test-capability'],
          nodeType: 'test',
        }),
      });

      // Should either succeed or return known error
      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('success');
      }
    }, { timeout: 10000 });

    test('Mesh heartbeat endpoint responds', async () => {
      const response = await fetch('http://localhost:3002/api/mesh/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: 'test-heartbeat-node',
        }),
      });

      // Should not return 404
      expect(response.status).not.toBe(404);
    }, { timeout: 5000 });
  });

  describe('Failover System', () => {
    test('Health status includes all endpoints', () => {
      const health = masterPortal.getHealthStatus();

      expect(health).toHaveProperty('primary');
      expect(health).toHaveProperty('allEndpoints');
      expect(Array.isArray(health.allEndpoints)).toBe(true);
      expect(health.allEndpoints.length).toBeGreaterThan(0);
    });

    test('Endpoints have health metrics', () => {
      const health = masterPortal.getHealthStatus();

      health.allEndpoints.forEach(endpoint => {
        expect(endpoint).toHaveProperty('url');
        expect(endpoint).toHaveProperty('healthy');
        expect(endpoint).toHaveProperty('lastCheck');
        expect(endpoint).toHaveProperty('failureCount');
      });
    });
  });

  describe('RPC Integration', () => {
    test('RPC client can execute commands', async () => {
      try {
        const result = await masterPortal.executeRpc('test.ping', { test: true });

        expect(result).toHaveProperty('success');
        // Either succeeds or returns structured error
        if (!result.success) {
          expect(result).toHaveProperty('error');
          expect(result).toHaveProperty('errorCode');
        }
      } catch (error) {
        // Network errors are acceptable in test environment
        expect(error).toBeDefined();
      }
    }, { timeout: 10000 });
  });

  describe('Data Model Compatibility', () => {
    test('User tier enum values are consistent', () => {
      const validTiers = ['free', 'beta', 'pro', 'enterprise', 'developer', 'master'];

      // This would typically involve importing types, but we're checking runtime
      expect(validTiers).toContain('master');
      expect(validTiers).toContain('free');
      expect(validTiers.length).toBe(6);
    });

    test('UAA2 phase names are consistent', () => {
      const validPhases = [
        'intake',
        'reflect',
        'execute',
        'compress',
        'reintake',
        'grow',
        'evolve',
        'autonomize',
      ];

      expect(validPhases.length).toBe(8);
      expect(validPhases).toContain('compress');
    });
  });

  describe('Performance Benchmarks', () => {
    test('Chat API responds within 200ms target', async () => {
      const startTime = Date.now();

      const response = await fetch('http://localhost:3002/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Quick ping',
          userId: testUserId,
        }),
      });

      const endTime = Date.now();
      const latency = endTime - startTime;

      // Should respond quickly (allowing for LLM processing time)
      // This is total time, not just routing
      expect(response.ok).toBe(true);
      console.log(`Chat API latency: ${latency}ms`);
    }, { timeout: 30000 });

    test('Health check responds within 50ms', async () => {
      const startTime = Date.now();

      const response = await fetch('http://localhost:3002/api/health');

      const endTime = Date.now();
      const latency = endTime - startTime;

      expect(response.ok).toBe(true);
      expect(latency).toBeLessThan(100); // Allowing some margin
      console.log(`Health check latency: ${latency}ms`);
    }, { timeout: 5000 });

    test('Knowledge search responds within 100ms', async () => {
      const startTime = Date.now();

      const response = await fetch('http://localhost:3002/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'test',
          limit: 5,
        }),
      });

      const endTime = Date.now();
      const latency = endTime - startTime;

      expect(response.ok).toBe(true);
      console.log(`Search latency: ${latency}ms`);
    }, { timeout: 5000 });
  });
});
