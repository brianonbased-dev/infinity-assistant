/**
 * Job Detection Module
 * 
 * Detects user's profession/job category and tracks knowledge accumulation
 */

export {
  JobDetectionService,
  getJobDetectionService,
  type JobCategory,
  type JobDetectionResult,
  type JobContext
} from './JobDetectionService';

export {
  JobKnowledgeTracker,
  getJobKnowledgeTracker,
  type JobKnowledgeMetrics,
  type KnowledgeAccumulationStats
} from './JobKnowledgeTracker';


