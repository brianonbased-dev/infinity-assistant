/**
 * Knowledge Base Types
 *
 * Type definitions for knowledge base items returned from uaa2-service
 */

/**
 * Base knowledge item from the knowledge base
 */
export interface KnowledgeItem {
  id: string;
  content: string;
  score: number;
  source: string;
  metadata?: KnowledgeItemMetadata;
}

/**
 * Metadata attached to knowledge items
 */
export interface KnowledgeItemMetadata {
  title?: string;
  wisdom_id?: string;
  pattern_id?: string;
  gotcha_id?: string;
  domain?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Grouped knowledge results from search
 */
export interface GroupedKnowledgeResults {
  wisdom?: KnowledgeItem[];
  patterns?: KnowledgeItem[];
  gotchas?: KnowledgeItem[];
}

/**
 * Knowledge search result counts
 */
export interface KnowledgeCounts {
  total: number;
  wisdom: number;
  patterns: number;
  gotchas: number;
}

/**
 * Full knowledge search response from MasterPortalClient
 */
export interface KnowledgeSearchResult {
  grouped?: GroupedKnowledgeResults;
  counts?: KnowledgeCounts;
}

/**
 * Formatted wisdom item for API response
 */
export interface FormattedWisdomItem {
  id: string;
  title: string;
  content: string;
  score: number;
  source: string;
}

/**
 * Formatted pattern item for API response
 */
export interface FormattedPatternItem {
  id: string;
  name: string;
  description: string;
  score: number;
  domain: string;
}

/**
 * Formatted gotcha item for API response
 */
export interface FormattedGotchaItem {
  id: string;
  title: string;
  content: string;
  score: number;
  source: string;
}

/**
 * Search suggestion item
 */
export interface SearchSuggestion {
  text: string;
  type: 'pattern' | 'wisdom' | 'gotcha' | 'query';
  score?: number;
  metadata?: Record<string, string | undefined>;
}
