/**
 * Unit Tests for Knowledge Promotion Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  KnowledgePromotionService,
  getKnowledgePromotionService,
  type ExperimentalKnowledge,
  type PromotionCriteria
} from '../KnowledgePromotionService';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          or: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        })),
        insert: vi.fn(() => Promise.resolve({ error: null })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null }))
        }))
      }))
    }))
  })),
  TABLES: {
    KNOWLEDGE_BASE: 'knowledge_base'
  }
}));

describe('KnowledgePromotionService', () => {
  let service: KnowledgePromotionService;

  beforeEach(() => {
    service = new KnowledgePromotionService();
    vi.clearAllMocks();
  });

  describe('evaluateForPromotion', () => {
    it('should promote knowledge that meets all criteria', async () => {
      const knowledge: ExperimentalKnowledge = {
        id: 'exp-TEST-001',
        type: 'wisdom',
        content: 'Test wisdom content',
        domain: 'test',
        confidence: 0.95,
        source: 'test-source',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        metadata: {
          principle: 'Test principle',
          solution: 'Test solution',
          evidence: 'Test evidence',
          validation_count: 5,
          usage_count: 10
        }
      };

      const result = await service.evaluateForPromotion(knowledge);

      expect(result.promoted).toBe(true);
      expect(result.trustScore).toBeGreaterThanOrEqual(0.90);
      expect(result.reason).toBeUndefined();
    });

    it('should not promote knowledge with low trust score', async () => {
      const knowledge: ExperimentalKnowledge = {
        id: 'exp-TEST-002',
        type: 'wisdom',
        content: 'Test content',
        domain: 'test',
        confidence: 0.50, // Low confidence
        source: 'test-source',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          principle: 'Test principle',
          solution: 'Test solution',
          validation_count: 5,
          usage_count: 10
        }
      };

      const result = await service.evaluateForPromotion(knowledge);

      expect(result.promoted).toBe(false);
      expect(result.reason).toContain('Trust score');
    });

    it('should not promote knowledge with insufficient validations', async () => {
      const knowledge: ExperimentalKnowledge = {
        id: 'exp-TEST-003',
        type: 'wisdom',
        content: 'Test content',
        domain: 'test',
        confidence: 0.95,
        source: 'test-source',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          principle: 'Test principle',
          solution: 'Test solution',
          validation_count: 1, // Below threshold
          usage_count: 10
        }
      };

      const result = await service.evaluateForPromotion(knowledge);

      expect(result.promoted).toBe(false);
      expect(result.reason).toContain('Validation count');
    });

    it('should not promote knowledge without principle', async () => {
      const knowledge: ExperimentalKnowledge = {
        id: 'exp-TEST-004',
        type: 'wisdom',
        content: 'Test content',
        domain: 'test',
        confidence: 0.95,
        source: 'test-source',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          solution: 'Test solution',
          validation_count: 5,
          usage_count: 10
          // Missing principle
        }
      };

      const result = await service.evaluateForPromotion(knowledge);

      expect(result.promoted).toBe(false);
      expect(result.reason).toContain('Missing principle');
    });

    it('should not promote knowledge without solution', async () => {
      const knowledge: ExperimentalKnowledge = {
        id: 'exp-TEST-005',
        type: 'wisdom',
        content: 'Test content',
        domain: 'test',
        confidence: 0.95,
        source: 'test-source',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          principle: 'Test principle',
          validation_count: 5,
          usage_count: 10
          // Missing solution
        }
      };

      const result = await service.evaluateForPromotion(knowledge);

      expect(result.promoted).toBe(false);
      expect(result.reason).toContain('Missing solution');
    });

    it('should not promote knowledge that is too new', async () => {
      const knowledge: ExperimentalKnowledge = {
        id: 'exp-TEST-006',
        type: 'wisdom',
        content: 'Test content',
        domain: 'test',
        confidence: 0.95,
        source: 'test-source',
        created_at: new Date().toISOString(), // Created today
        metadata: {
          principle: 'Test principle',
          solution: 'Test solution',
          validation_count: 5,
          usage_count: 10
        }
      };

      const result = await service.evaluateForPromotion(knowledge);

      expect(result.promoted).toBe(false);
      expect(result.reason).toContain('Age');
    });

    it('should accept custom promotion criteria', async () => {
      const knowledge: ExperimentalKnowledge = {
        id: 'exp-TEST-007',
        type: 'wisdom',
        content: 'Test content',
        domain: 'test',
        confidence: 0.85,
        source: 'test-source',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          principle: 'Test principle',
          solution: 'Test solution',
          validation_count: 2,
          usage_count: 1
        }
      };

      const customCriteria: Partial<PromotionCriteria> = {
        trustScore: 0.80, // Lower threshold
        validationCount: 2, // Lower threshold
        age: 1 // Lower threshold
      };

      const result = await service.evaluateForPromotion(knowledge, customCriteria);

      expect(result.promoted).toBe(true);
    });
  });

  describe('calculateTrustScore', () => {
    it('should calculate trust score correctly', async () => {
      const knowledge: ExperimentalKnowledge = {
        id: 'exp-TEST-008',
        type: 'wisdom',
        content: 'Test content',
        domain: 'test',
        confidence: 0.70,
        source: 'test-source',
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days old
        metadata: {
          principle: 'Test principle',
          solution: 'Test solution',
          evidence: 'Test evidence',
          validation_count: 5,
          usage_count: 10
        }
      };

      const result = await service.evaluateForPromotion(knowledge);

      // Trust score should be boosted by:
      // - Base confidence: 0.70
      // - Principle: +0.15
      // - Solution: +0.15
      // - Evidence: +0.10
      // - Validations (5 * 0.05 = 0.25, capped at 0.20): +0.20
      // - Usage (10 * 0.02 = 0.20, capped at 0.10): +0.10
      // - Age (10 * 0.01 = 0.10, capped at 0.10): +0.10
      // Total: ~1.50, capped at 1.0
      expect(result.trustScore).toBeGreaterThanOrEqual(0.90);
    });
  });

  describe('getKnowledgePromotionService', () => {
    it('should return singleton instance', () => {
      const instance1 = getKnowledgePromotionService();
      const instance2 = getKnowledgePromotionService();

      expect(instance1).toBe(instance2);
    });
  });
});
