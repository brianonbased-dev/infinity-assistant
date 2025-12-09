/**
 * Knowledge Promotion Service
 * 
 * Handles promotion of experimental knowledge to canonical knowledge
 * Implements quality validation and promotion criteria
 */

import logger from '@/utils/logger';
import { getSupabaseClient, TABLES } from '@/lib/supabase';

export interface PromotionCriteria {
  trustScore: number; // Minimum 0.90
  validationCount: number; // Minimum 3 validations
  hasPrinciple: boolean; // Must have principle
  hasSolution: boolean; // Must have solution
  age: number; // Days since creation (minimum 1 day)
  usageCount: number; // Times referenced (minimum 1)
}

export interface ExperimentalKnowledge {
  id: string;
  type: 'wisdom' | 'pattern' | 'gotcha';
  content: string;
  domain: string;
  confidence: number;
  source: string;
  created_at: string;
  metadata?: {
    principle?: string;
    solution?: string;
    evidence?: string;
    validation_count?: number;
    usage_count?: number;
  };
}

export interface PromotionResult {
  promoted: boolean;
  reason?: string;
  trustScore?: number;
  criteria?: Partial<PromotionCriteria>;
}

/**
 * Knowledge Promotion Service
 * Evaluates and promotes experimental knowledge to canonical
 */
export class KnowledgePromotionService {
  private readonly DEFAULT_CRITERIA: PromotionCriteria = {
    trustScore: 0.90,
    validationCount: 3,
    hasPrinciple: true,
    hasSolution: true,
    age: 1, // 1 day minimum
    usageCount: 1
  };

  /**
   * Evaluate if experimental knowledge meets promotion criteria
   */
  async evaluateForPromotion(
    knowledge: ExperimentalKnowledge,
    customCriteria?: Partial<PromotionCriteria>
  ): Promise<PromotionResult> {
    const criteria = { ...this.DEFAULT_CRITERIA, ...customCriteria };
    const reasons: string[] = [];

    // Calculate trust score
    const trustScore = this.calculateTrustScore(knowledge);

    // Check criteria
    if (trustScore < criteria.trustScore) {
      reasons.push(`Trust score ${trustScore.toFixed(2)} below threshold ${criteria.trustScore}`);
    }

    const validationCount = knowledge.metadata?.validation_count || 0;
    if (validationCount < criteria.validationCount) {
      reasons.push(`Validation count ${validationCount} below threshold ${criteria.validationCount}`);
    }

    if (criteria.hasPrinciple && !knowledge.metadata?.principle) {
      reasons.push('Missing principle');
    }

    if (criteria.hasSolution && !knowledge.metadata?.solution) {
      reasons.push('Missing solution');
    }

    const age = this.getAgeInDays(knowledge.created_at);
    if (age < criteria.age) {
      reasons.push(`Age ${age} days below threshold ${criteria.age} days`);
    }

    const usageCount = knowledge.metadata?.usage_count || 0;
    if (usageCount < criteria.usageCount) {
      reasons.push(`Usage count ${usageCount} below threshold ${criteria.usageCount}`);
    }

    const meetsCriteria = reasons.length === 0;

    return {
      promoted: meetsCriteria,
      reason: meetsCriteria ? undefined : reasons.join('; '),
      trustScore,
      criteria: meetsCriteria ? criteria : undefined
    };
  }

  /**
   * Promote experimental knowledge to canonical
   */
  async promoteToCanonical(knowledge: ExperimentalKnowledge): Promise<boolean> {
    try {
      const evaluation = await this.evaluateForPromotion(knowledge);
      
      if (!evaluation.promoted) {
        logger.warn('[Knowledge Promotion] Criteria not met', {
          id: knowledge.id,
          reason: evaluation.reason
        });
        return false;
      }

      const supabase = getSupabaseClient();

      // Create canonical entry
      const canonicalId = knowledge.id.replace('exp-', 'canon-');
      const { error: insertError } = await supabase
        .from((TABLES as any).KNOWLEDGE_BASE || 'knowledge_base')
        .insert({
          id: canonicalId,
          type: knowledge.type,
          content: knowledge.content,
          domain: knowledge.domain,
          confidence: evaluation.trustScore || knowledge.confidence,
          source: `promoted:${knowledge.source}`,
          promoted_from: knowledge.id,
          promoted_at: new Date().toISOString(),
          ...knowledge.metadata
        });

      if (insertError) {
        logger.error('[Knowledge Promotion] Failed to create canonical', {
          id: knowledge.id,
          error: insertError
        });
        return false;
      }

      // Archive experimental entry
      const { error: archiveError } = await supabase
        .from((TABLES as any).KNOWLEDGE_BASE || 'knowledge_base')
        .update({
          status: 'promoted',
          promoted_to: canonicalId,
          promoted_at: new Date().toISOString()
        })
        .eq('id', knowledge.id);

      if (archiveError) {
        logger.warn('[Knowledge Promotion] Failed to archive experimental', {
          id: knowledge.id,
          error: archiveError
        });
        // Don't fail - canonical was created
      }

      logger.info('[Knowledge Promotion] Successfully promoted', {
        experimentalId: knowledge.id,
        canonicalId,
        trustScore: evaluation.trustScore
      });

      // Log promotion for monitoring
      try {
        const { getPromotionMonitoringService } = await import('@/lib/monitoring/PromotionMonitoringService');
        const monitoring = getPromotionMonitoringService();
        await monitoring.logPromotion({
          experimental_id: knowledge.id,
          canonical_id: canonicalId,
          trust_score: evaluation.trustScore || knowledge.confidence,
          validation_count: knowledge.metadata?.validation_count || 0,
          age_days: this.getAgeInDays(knowledge.created_at),
          usage_count: knowledge.metadata?.usage_count || 0,
          type: knowledge.type,
          domain: knowledge.domain,
          source: knowledge.source,
          metadata: knowledge.metadata
        });
      } catch (monitoringError) {
        logger.warn('[Knowledge Promotion] Failed to log promotion:', monitoringError);
        // Don't fail promotion if monitoring fails
      }

      return true;
    } catch (error) {
      logger.error('[Knowledge Promotion] Error promoting', {
        id: knowledge.id,
        error
      });
      return false;
    }
  }

  /**
   * Batch evaluate and promote experimental knowledge
   */
  async batchPromote(limit: number = 10): Promise<{
    evaluated: number;
    promoted: number;
    failed: number;
    results: Array<{ id: string; promoted: boolean; reason?: string }>;
  }> {
    try {
      const supabase = getSupabaseClient();

      // Get experimental knowledge items
      const { data: experimental, error } = await supabase
        .from((TABLES as any).KNOWLEDGE_BASE || 'knowledge_base')
        .select('*')
        .eq('status', 'experimental')
        .or('status.is.null')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      const results: Array<{ id: string; promoted: boolean; reason?: string }> = [];
      let promoted = 0;
      let failed = 0;

      for (const item of experimental || []) {
        const knowledge: ExperimentalKnowledge = {
          id: item.id,
          type: item.type,
          content: item.content,
          domain: item.domain,
          confidence: item.confidence,
          source: item.source,
          created_at: item.created_at,
          metadata: item.metadata
        };

        const evaluation = await this.evaluateForPromotion(knowledge);
        
        if (evaluation.promoted) {
          const success = await this.promoteToCanonical(knowledge);
          if (success) {
            promoted++;
            results.push({ id: knowledge.id, promoted: true });
          } else {
            failed++;
            results.push({ id: knowledge.id, promoted: false, reason: 'Promotion failed' });
          }
        } else {
          results.push({ id: knowledge.id, promoted: false, reason: evaluation.reason });
        }
      }

      return {
        evaluated: experimental?.length || 0,
        promoted,
        failed,
        results
      };
    } catch (error) {
      logger.error('[Knowledge Promotion] Batch promotion error', error);
      throw error;
    }
  }

  /**
   * Calculate trust score for knowledge item
   */
  private calculateTrustScore(knowledge: ExperimentalKnowledge): number {
    let score = knowledge.confidence || 0.5;

    // Boost for having principle
    if (knowledge.metadata?.principle) {
      score += 0.15;
    }

    // Boost for having solution
    if (knowledge.metadata?.solution) {
      score += 0.15;
    }

    // Boost for evidence
    if (knowledge.metadata?.evidence) {
      score += 0.10;
    }

    // Boost for validations
    const validationCount = knowledge.metadata?.validation_count || 0;
    score += Math.min(validationCount * 0.05, 0.20); // Max 0.20 from validations

    // Boost for usage
    const usageCount = knowledge.metadata?.usage_count || 0;
    score += Math.min(usageCount * 0.02, 0.10); // Max 0.10 from usage

    // Age bonus (older = more trusted, up to 0.10)
    const age = this.getAgeInDays(knowledge.created_at);
    score += Math.min(age * 0.01, 0.10);

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Get age in days
   */
  private getAgeInDays(createdAt: string): number {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }
}

// Singleton instance
let promotionServiceInstance: KnowledgePromotionService | null = null;

export function getKnowledgePromotionService(): KnowledgePromotionService {
  if (!promotionServiceInstance) {
    promotionServiceInstance = new KnowledgePromotionService();
  }
  return promotionServiceInstance;
}
