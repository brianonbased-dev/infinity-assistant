/**
 * Knowledge Promotion Package
 * 
 * Handles promotion of experimental knowledge to canonical knowledge
 */

export {
  KnowledgePromotionService,
  getKnowledgePromotionService
} from './KnowledgePromotionService';

export type {
  PromotionCriteria,
  ExperimentalKnowledge,
  PromotionResult
} from './KnowledgePromotionService';
