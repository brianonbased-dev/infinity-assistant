/**
 * Life Context Detection Module
 * 
 * Detects user's life context, interests, and personal situation
 * Tracks knowledge accumulation for companion mode
 */

export {
  LifeContextDetectionService,
  getLifeContextDetectionService,
  type LifeStage,
  type InterestCategory,
  type LifeContextResult,
  type LifeContextQuery
} from './LifeContextDetectionService';

export {
  InterestKnowledgeTracker,
  getInterestKnowledgeTracker,
  type InterestKnowledgeMetrics,
  type InterestAccumulationStats
} from './InterestKnowledgeTracker';

