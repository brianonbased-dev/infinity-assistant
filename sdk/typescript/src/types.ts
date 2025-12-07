/**
 * TypeScript SDK - Type Definitions
 * 
 * All types for Infinity Assistant API
 */

export interface InfinityAssistantConfig {
  /** API base URL (default: https://infinityassistant.io/api) */
  baseUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Custom fetch implementation */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
}

export interface ChatRequest {
  /** The message to send */
  message: string;
  /** Optional conversation ID for context */
  conversationId?: string;
  /** Optional user ID */
  userId?: string;
  /** Optional user tier */
  userTier?: 'free' | 'pro' | 'enterprise';
  /** Mode: 'search' | 'assist' | 'build' */
  mode?: 'search' | 'assist' | 'build';
  /** Optional user context */
  userContext?: string;
  /** User preferences */
  preferences?: {
    assistantMode?: 'professional' | 'companion';
    language?: string;
    [key: string]: any;
  };
  /** Essence configuration */
  essence?: {
    personality?: string;
    communicationStyle?: string;
    [key: string]: any;
  };
  /** Session ID */
  sessionId?: string;
  /** Driving mode */
  drivingMode?: boolean;
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  conversationId?: string;
  messageId?: string;
  metadata?: {
    phase?: string;
    tokensUsed?: number;
    model?: string;
    [key: string]: any;
  };
  error?: string;
}

export interface ChatStreamChunk {
  type: 'text' | 'metadata' | 'done' | 'error';
  content?: string;
  metadata?: Record<string, any>;
  error?: string;
}

export interface KnowledgeSearchRequest {
  query: string;
  limit?: number;
  filters?: {
    type?: 'wisdom' | 'pattern' | 'gotcha';
    domain?: string;
    tags?: string[];
  };
}

export interface KnowledgeSearchResponse {
  success: boolean;
  results?: Array<{
    id: string;
    type: 'wisdom' | 'pattern' | 'gotcha';
    title?: string;
    content: string;
    domain?: string;
    tags?: string[];
    confidence?: number;
    [key: string]: any;
  }>;
  total?: number;
  error?: string;
}

export interface MemoryStoreRequest {
  key: string;
  value: any;
  ttl?: number;
}

export interface MemoryStoreResponse {
  success: boolean;
  stored?: boolean;
  error?: string;
}

export interface MemoryRetrieveRequest {
  key: string;
}

export interface MemoryRetrieveResponse {
  success: boolean;
  value?: any;
  found?: boolean;
  error?: string;
}

export interface ResearchRequest {
  query: string;
  depth?: 'shallow' | 'medium' | 'deep';
  sources?: number;
}

export interface ResearchResponse {
  success: boolean;
  results?: Array<{
    title: string;
    url: string;
    summary: string;
    relevance: number;
  }>;
  summary?: string;
  error?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  lastTriggered?: string;
  failureCount: number;
}

export interface WebhookEvent {
  event: string;
  timestamp: string;
  data: Record<string, any>;
  signature?: string;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
  statusCode?: number;
}

export class InfinityAssistantError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'InfinityAssistantError';
    Object.setPrototypeOf(this, InfinityAssistantError.prototype);
  }
}

export class InfinityAssistantTimeoutError extends InfinityAssistantError {
  constructor(message: string = 'Request timeout') {
    super(message, 'TIMEOUT', 408);
    this.name = 'InfinityAssistantTimeoutError';
  }
}

export class InfinityAssistantRateLimitError extends InfinityAssistantError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'InfinityAssistantRateLimitError';
  }
}

