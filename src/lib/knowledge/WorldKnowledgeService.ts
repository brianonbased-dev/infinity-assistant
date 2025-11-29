/**
 * World Knowledge Service
 *
 * Provides access to external/world knowledge beyond local user memory.
 * Implements hybrid online/offline mode:
 * - Online: Fetches from Master Portal, web search, documentation
 * - Offline: Uses cached knowledge, local embeddings, static knowledge
 *
 * Knowledge Sources:
 * 1. Master Portal Knowledge Base (wisdom, patterns, gotchas from uAA2++)
 * 2. Web Search (via search APIs when available)
 * 3. Documentation Cache (technical docs, API references)
 * 4. Domain Knowledge (industry-specific knowledge packs)
 *
 * Design: "Smarter online, still remembers offline"
 * - Caches successful retrievals for offline use
 * - Prioritizes local cache to reduce latency
 * - Falls back gracefully when offline
 */

import type { KnowledgeRetrieval } from './ThoughtKnowledgeConnector';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Network status
 */
export type NetworkStatus = 'online' | 'offline' | 'degraded';

/**
 * External knowledge source
 */
export type ExternalSource =
  | 'master-portal'     // uAA2++ knowledge base
  | 'web-search'        // Live web search
  | 'documentation'     // Cached technical docs
  | 'domain-knowledge'  // Industry/domain packs
  | 'cache';            // Offline cache

/**
 * World knowledge query
 */
export interface WorldKnowledgeQuery {
  pattern: string;
  sources?: ExternalSource[];
  maxResults?: number;
  priority?: 'speed' | 'quality' | 'balanced';
  domain?: string;
  includeCache?: boolean;
}

/**
 * World knowledge result
 */
export interface WorldKnowledgeResult {
  query: string;
  results: KnowledgeRetrieval[];
  sources: ExternalSource[];
  networkStatus: NetworkStatus;
  fromCache: boolean;
  retrievalTime: number;
}

/**
 * Cached knowledge entry
 */
interface CachedKnowledge {
  query: string;
  results: KnowledgeRetrieval[];
  timestamp: number;
  source: ExternalSource;
  ttl: number;  // Time to live in ms
}

/**
 * Domain knowledge pack
 */
interface DomainKnowledgePack {
  domain: string;
  entries: Array<{
    id: string;
    content: string;
    keywords: string[];
    relevance: number;
  }>;
  lastUpdated: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default TTL for cached knowledge (1 hour)
 */
const DEFAULT_CACHE_TTL = 60 * 60 * 1000;

/**
 * Short TTL for web search results (10 minutes)
 */
const WEB_SEARCH_CACHE_TTL = 10 * 60 * 1000;

/**
 * Max cache size (entries)
 */
const MAX_CACHE_SIZE = 1000;

/**
 * Network check timeout (ms)
 */
const NETWORK_CHECK_TIMEOUT = 2000;

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class WorldKnowledgeService {
  private static instance: WorldKnowledgeService;

  // Knowledge cache for offline use
  private cache = new Map<string, CachedKnowledge>();

  // Domain knowledge packs (loaded on demand)
  private domainPacks = new Map<string, DomainKnowledgePack>();

  // Network status
  private networkStatus: NetworkStatus = 'online';
  private lastNetworkCheck = 0;
  private networkCheckInterval = 30000; // 30 seconds

  // API endpoints (configured at runtime)
  private masterPortalUrl: string;
  private searchApiUrl: string;

  private constructor() {
    // Get API URLs from environment or defaults
    this.masterPortalUrl = typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_UAA2_SERVICE_URL || 'https://uaa2-service.up.railway.app'
      : '';
    this.searchApiUrl = '/api/search';

    // Initialize network status check
    this.checkNetworkStatus();

    // Periodic cache cleanup
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanCache(), 5 * 60 * 1000); // Every 5 minutes
    }
  }

  static getInstance(): WorldKnowledgeService {
    if (!WorldKnowledgeService.instance) {
      WorldKnowledgeService.instance = new WorldKnowledgeService();
    }
    return WorldKnowledgeService.instance;
  }

  // ==========================================================================
  // MAIN QUERY METHODS
  // ==========================================================================

  /**
   * Query world knowledge
   * Automatically handles online/offline mode
   */
  async query(queryParams: WorldKnowledgeQuery): Promise<WorldKnowledgeResult> {
    const startTime = Date.now();
    const {
      pattern,
      sources = ['master-portal', 'documentation', 'domain-knowledge'],
      maxResults = 5,
      priority = 'balanced',
      domain,
      includeCache = true,
    } = queryParams;

    // Check network status
    await this.updateNetworkStatus();

    const results: KnowledgeRetrieval[] = [];
    const usedSources: ExternalSource[] = [];
    let fromCache = false;

    // Try cache first if enabled (fast path)
    if (includeCache) {
      const cached = this.getFromCache(pattern);
      if (cached) {
        results.push(...cached.results);
        usedSources.push('cache');
        fromCache = true;

        // If cache is fresh and priority is speed, return immediately
        if (priority === 'speed' && results.length >= maxResults) {
          return {
            query: pattern,
            results: results.slice(0, maxResults),
            sources: usedSources,
            networkStatus: this.networkStatus,
            fromCache: true,
            retrievalTime: Date.now() - startTime,
          };
        }
      }
    }

    // Query external sources based on network status
    if (this.networkStatus !== 'offline') {
      const externalResults = await this.queryExternalSources(
        pattern,
        sources.filter(s => s !== 'cache'),
        maxResults,
        domain
      );

      for (const result of externalResults) {
        // Avoid duplicates
        if (!results.some(r => r.id === result.id)) {
          results.push(result);
          if (!usedSources.includes(result.source as ExternalSource)) {
            usedSources.push(result.source as ExternalSource);
          }
        }
      }

      // Cache successful results
      if (externalResults.length > 0) {
        this.addToCache(pattern, externalResults, 'master-portal');
      }
    } else {
      // Offline mode - use domain knowledge and cache only
      const offlineResults = await this.queryOfflineSources(pattern, domain, maxResults);
      results.push(...offlineResults);
      usedSources.push('domain-knowledge');
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    return {
      query: pattern,
      results: results.slice(0, maxResults),
      sources: usedSources,
      networkStatus: this.networkStatus,
      fromCache,
      retrievalTime: Date.now() - startTime,
    };
  }

  /**
   * Quick lookup - prioritizes speed over completeness
   */
  async quickLookup(pattern: string, domain?: string): Promise<KnowledgeRetrieval[]> {
    const result = await this.query({
      pattern,
      priority: 'speed',
      maxResults: 3,
      domain,
      sources: ['cache', 'domain-knowledge'],
    });
    return result.results;
  }

  /**
   * Deep search - prioritizes quality over speed
   */
  async deepSearch(pattern: string, domain?: string): Promise<WorldKnowledgeResult> {
    return this.query({
      pattern,
      priority: 'quality',
      maxResults: 10,
      domain,
      sources: ['master-portal', 'web-search', 'documentation', 'domain-knowledge'],
    });
  }

  // ==========================================================================
  // EXTERNAL SOURCE QUERIES
  // ==========================================================================

  /**
   * Query external online sources
   */
  private async queryExternalSources(
    pattern: string,
    sources: ExternalSource[],
    maxResults: number,
    domain?: string
  ): Promise<KnowledgeRetrieval[]> {
    const results: KnowledgeRetrieval[] = [];
    const startTime = Date.now();

    // Query sources in parallel
    const promises: Promise<KnowledgeRetrieval[]>[] = [];

    for (const source of sources) {
      switch (source) {
        case 'master-portal':
          promises.push(this.queryMasterPortal(pattern, maxResults, domain));
          break;
        case 'web-search':
          promises.push(this.queryWebSearch(pattern, maxResults));
          break;
        case 'documentation':
          promises.push(this.queryDocumentation(pattern, maxResults, domain));
          break;
        case 'domain-knowledge':
          promises.push(this.queryDomainKnowledge(pattern, maxResults, domain));
          break;
      }
    }

    // Wait for all with timeout
    try {
      const allResults = await Promise.race([
        Promise.all(promises),
        new Promise<KnowledgeRetrieval[][]>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        ),
      ]);

      for (const sourceResults of allResults) {
        results.push(...sourceResults);
      }
    } catch (error) {
      console.warn('[WorldKnowledge] External query timeout/error:', error);
      // Partial results are still useful
    }

    // Add timing info
    const retrievalTime = Date.now() - startTime;
    results.forEach(r => {
      r.retrievalTime = retrievalTime;
    });

    return results;
  }

  /**
   * Query Master Portal knowledge base
   */
  private async queryMasterPortal(
    pattern: string,
    maxResults: number,
    domain?: string
  ): Promise<KnowledgeRetrieval[]> {
    const startTime = Date.now();
    const results: KnowledgeRetrieval[] = [];

    try {
      // Use internal search API which proxies to Master Portal
      const response = await fetch(this.searchApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: pattern,
          type: 'all',
          limit: maxResults,
          domain,
        }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.results) {
        // Convert wisdom results
        for (const w of data.results.wisdom || []) {
          results.push({
            id: `mp-w-${w.id}`,
            source: 'external',
            content: w.content,
            relevance: w.score || 0.7,
            retrievalTime: Date.now() - startTime,
            triggered: pattern,
          });
        }

        // Convert pattern results
        for (const p of data.results.patterns || []) {
          results.push({
            id: `mp-p-${p.id}`,
            source: 'external',
            content: `${p.name}: ${p.description}`,
            relevance: p.score || 0.7,
            retrievalTime: Date.now() - startTime,
            triggered: pattern,
          });
        }

        // Convert gotcha results
        for (const g of data.results.gotchas || []) {
          results.push({
            id: `mp-g-${g.id}`,
            source: 'external',
            content: g.content,
            relevance: g.score || 0.7,
            retrievalTime: Date.now() - startTime,
            triggered: pattern,
          });
        }
      }
    } catch (error) {
      console.warn('[WorldKnowledge] Master Portal query failed:', error);
      // Mark network as degraded
      this.networkStatus = 'degraded';
    }

    return results;
  }

  /**
   * Query web search (when available)
   */
  private async queryWebSearch(
    pattern: string,
    maxResults: number
  ): Promise<KnowledgeRetrieval[]> {
    // Web search integration - placeholder for future implementation
    // Could integrate with:
    // - Brave Search API
    // - Bing Search API
    // - DuckDuckGo
    // - Custom search endpoints

    // For now, return empty - local knowledge is primary
    return [];
  }

  /**
   * Query cached documentation
   */
  private async queryDocumentation(
    pattern: string,
    maxResults: number,
    domain?: string
  ): Promise<KnowledgeRetrieval[]> {
    const results: KnowledgeRetrieval[] = [];
    const startTime = Date.now();

    // Built-in documentation knowledge for common domains
    const docKnowledge = this.getBuiltInDocumentation(pattern, domain);

    for (const doc of docKnowledge.slice(0, maxResults)) {
      results.push({
        id: `doc-${doc.id}`,
        source: 'external',
        content: doc.content,
        relevance: doc.relevance,
        retrievalTime: Date.now() - startTime,
        triggered: pattern,
      });
    }

    return results;
  }

  /**
   * Query domain-specific knowledge packs
   */
  private async queryDomainKnowledge(
    pattern: string,
    maxResults: number,
    domain?: string
  ): Promise<KnowledgeRetrieval[]> {
    const results: KnowledgeRetrieval[] = [];
    const startTime = Date.now();
    const patternLower = pattern.toLowerCase();

    // Get domain pack if specified
    const packs = domain
      ? [this.getDomainPack(domain)]
      : Array.from(this.domainPacks.values());

    for (const pack of packs) {
      if (!pack) continue;

      for (const entry of pack.entries) {
        // Check keyword match
        const keywordMatch = entry.keywords.some(kw =>
          patternLower.includes(kw) || kw.includes(patternLower)
        );

        if (keywordMatch || entry.content.toLowerCase().includes(patternLower)) {
          results.push({
            id: `dk-${pack.domain}-${entry.id}`,
            source: 'external',
            content: entry.content,
            relevance: keywordMatch ? entry.relevance : entry.relevance * 0.7,
            retrievalTime: Date.now() - startTime,
            triggered: pattern,
          });
        }
      }
    }

    return results.slice(0, maxResults);
  }

  // ==========================================================================
  // OFFLINE SOURCES
  // ==========================================================================

  /**
   * Query offline-only sources
   */
  private async queryOfflineSources(
    pattern: string,
    domain?: string,
    maxResults = 5
  ): Promise<KnowledgeRetrieval[]> {
    const results: KnowledgeRetrieval[] = [];

    // 1. Check cache
    const cached = this.getFromCache(pattern);
    if (cached) {
      results.push(...cached.results);
    }

    // 2. Domain knowledge (always available offline)
    const domainResults = await this.queryDomainKnowledge(pattern, maxResults, domain);
    results.push(...domainResults);

    // 3. Built-in documentation
    const docResults = await this.queryDocumentation(pattern, maxResults, domain);
    results.push(...docResults);

    return results.slice(0, maxResults);
  }

  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================

  /**
   * Get from cache
   */
  private getFromCache(pattern: string): CachedKnowledge | null {
    const key = this.getCacheKey(pattern);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached;
    }

    // Expired - remove
    if (cached) {
      this.cache.delete(key);
    }

    return null;
  }

  /**
   * Add to cache
   */
  private addToCache(
    pattern: string,
    results: KnowledgeRetrieval[],
    source: ExternalSource
  ): void {
    // Enforce cache size limit
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictOldestCache();
    }

    const key = this.getCacheKey(pattern);
    const ttl = source === 'web-search' ? WEB_SEARCH_CACHE_TTL : DEFAULT_CACHE_TTL;

    this.cache.set(key, {
      query: pattern,
      results,
      timestamp: Date.now(),
      source,
      ttl,
    });
  }

  /**
   * Get cache key
   */
  private getCacheKey(pattern: string): string {
    return pattern.toLowerCase().trim().replace(/\s+/g, '-');
  }

  /**
   * Evict oldest cache entries
   */
  private evictOldestCache(): void {
    // Remove 20% of oldest entries
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Clean expired cache
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // ==========================================================================
  // NETWORK STATUS
  // ==========================================================================

  /**
   * Check network status
   */
  private async checkNetworkStatus(): Promise<void> {
    // Browser environment
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      this.networkStatus = navigator.onLine ? 'online' : 'offline';
      return;
    }

    // Server environment - try a quick fetch
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), NETWORK_CHECK_TIMEOUT);

      await fetch(this.masterPortalUrl + '/health', {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      this.networkStatus = 'online';
    } catch {
      this.networkStatus = 'offline';
    }
  }

  /**
   * Update network status (with throttling)
   */
  private async updateNetworkStatus(): Promise<void> {
    const now = Date.now();
    if (now - this.lastNetworkCheck < this.networkCheckInterval) {
      return;
    }

    this.lastNetworkCheck = now;
    await this.checkNetworkStatus();
  }

  /**
   * Get current network status
   */
  getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }

  /**
   * Force set network status (for testing)
   */
  setNetworkStatus(status: NetworkStatus): void {
    this.networkStatus = status;
  }

  // ==========================================================================
  // DOMAIN KNOWLEDGE PACKS
  // ==========================================================================

  /**
   * Get domain knowledge pack
   */
  private getDomainPack(domain: string): DomainKnowledgePack | undefined {
    // Load default packs if not loaded
    if (this.domainPacks.size === 0) {
      this.loadDefaultDomainPacks();
    }

    return this.domainPacks.get(domain);
  }

  /**
   * Load default domain knowledge packs
   */
  private loadDefaultDomainPacks(): void {
    // React/Frontend pack
    this.domainPacks.set('react', {
      domain: 'react',
      entries: [
        {
          id: 'hooks-rules',
          content: 'React hooks must be called at the top level, not inside loops, conditions, or nested functions.',
          keywords: ['hook', 'useState', 'useEffect', 'rules'],
          relevance: 0.9,
        },
        {
          id: 'key-prop',
          content: 'Always use unique, stable keys when rendering lists. Avoid using array index as key for dynamic lists.',
          keywords: ['key', 'list', 'map', 'render'],
          relevance: 0.85,
        },
        {
          id: 'memo-usage',
          content: 'Use React.memo for expensive child components. Use useMemo for expensive calculations, useCallback for callback stability.',
          keywords: ['memo', 'useMemo', 'useCallback', 'performance', 'optimization'],
          relevance: 0.8,
        },
      ],
      lastUpdated: Date.now(),
    });

    // TypeScript pack
    this.domainPacks.set('typescript', {
      domain: 'typescript',
      entries: [
        {
          id: 'strict-mode',
          content: 'Enable strict mode in tsconfig.json for better type safety: strictNullChecks, noImplicitAny, strictFunctionTypes.',
          keywords: ['strict', 'config', 'tsconfig', 'null'],
          relevance: 0.9,
        },
        {
          id: 'type-guards',
          content: 'Use type guards (typeof, instanceof, in, custom predicates) to narrow union types safely.',
          keywords: ['guard', 'narrow', 'typeof', 'instanceof', 'union'],
          relevance: 0.85,
        },
      ],
      lastUpdated: Date.now(),
    });

    // API/Backend pack
    this.domainPacks.set('api', {
      domain: 'api',
      entries: [
        {
          id: 'error-handling',
          content: 'Always return consistent error responses with status code, error code, and message. Use try-catch with proper error propagation.',
          keywords: ['error', 'catch', 'status', 'response'],
          relevance: 0.9,
        },
        {
          id: 'rate-limiting',
          content: 'Implement rate limiting for public APIs. Use sliding window or token bucket algorithms. Return 429 Too Many Requests.',
          keywords: ['rate', 'limit', 'throttle', '429'],
          relevance: 0.85,
        },
      ],
      lastUpdated: Date.now(),
    });

    // Database pack
    this.domainPacks.set('database', {
      domain: 'database',
      entries: [
        {
          id: 'index-usage',
          content: 'Create indexes on columns used in WHERE, JOIN, and ORDER BY clauses. Avoid over-indexing - each index slows writes.',
          keywords: ['index', 'query', 'performance', 'where', 'join'],
          relevance: 0.9,
        },
        {
          id: 'n-plus-one',
          content: 'N+1 query problem: Use eager loading (JOIN) instead of lazy loading when fetching related data in loops.',
          keywords: ['n+1', 'query', 'join', 'eager', 'lazy', 'loop'],
          relevance: 0.9,
        },
      ],
      lastUpdated: Date.now(),
    });
  }

  /**
   * Register custom domain pack
   */
  registerDomainPack(pack: DomainKnowledgePack): void {
    this.domainPacks.set(pack.domain, pack);
  }

  // ==========================================================================
  // BUILT-IN DOCUMENTATION
  // ==========================================================================

  /**
   * Get built-in documentation knowledge
   */
  private getBuiltInDocumentation(
    pattern: string,
    domain?: string
  ): Array<{ id: string; content: string; relevance: number }> {
    const results: Array<{ id: string; content: string; relevance: number }> = [];
    const patternLower = pattern.toLowerCase();

    // Common programming concepts
    const docs = [
      {
        id: 'async-await',
        keywords: ['async', 'await', 'promise', 'asynchronous'],
        content: 'async/await provides cleaner syntax for Promises. async functions always return a Promise. Use try/catch for error handling.',
        relevance: 0.8,
      },
      {
        id: 'error-boundaries',
        keywords: ['error', 'boundary', 'catch', 'react'],
        content: 'Error boundaries catch JavaScript errors in child components. Implement getDerivedStateFromError and componentDidCatch.',
        relevance: 0.8,
      },
      {
        id: 'debounce-throttle',
        keywords: ['debounce', 'throttle', 'performance', 'input'],
        content: 'Debounce delays execution until pause in calls. Throttle limits execution rate. Use for search inputs, scroll handlers.',
        relevance: 0.75,
      },
    ];

    for (const doc of docs) {
      if (doc.keywords.some(kw => patternLower.includes(kw))) {
        results.push({
          id: doc.id,
          content: doc.content,
          relevance: doc.relevance,
        });
      }
    }

    return results;
  }

  // ==========================================================================
  // STATS & EXPORT
  // ==========================================================================

  /**
   * Get service statistics
   */
  getStats(): {
    cacheSize: number;
    cacheHitRate: number;
    networkStatus: NetworkStatus;
    domainPacksLoaded: number;
  } {
    return {
      cacheSize: this.cache.size,
      cacheHitRate: 0, // Would track hits/misses in production
      networkStatus: this.networkStatus,
      domainPacksLoaded: this.domainPacks.size,
    };
  }

  /**
   * Export cache for persistence
   */
  exportCache(): CachedKnowledge[] {
    return Array.from(this.cache.values());
  }

  /**
   * Import cache (for persistence restore)
   */
  importCache(cached: CachedKnowledge[]): void {
    const now = Date.now();
    for (const entry of cached) {
      // Only import non-expired entries
      if (now - entry.timestamp < entry.ttl) {
        this.cache.set(this.getCacheKey(entry.query), entry);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getWorldKnowledgeService = (): WorldKnowledgeService => {
  return WorldKnowledgeService.getInstance();
};
