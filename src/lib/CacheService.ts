/**
 * Unified Cache Service
 *
 * Replaces 16+ duplicate cache implementations across services.
 * Provides consistent caching with TTL, size limits, and statistics.
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
}

export interface CacheOptions {
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Maximum number of entries (default: 1000) */
  maxSize?: number;
  /** Cache name for logging/debugging */
  name?: string;
  /** Enable statistics tracking */
  trackStats?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  size: number;
  hitRate: number;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_SIZE = 1000;

/**
 * Generic cache service with TTL and LRU eviction
 */
export class CacheService<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly ttl: number;
  private readonly maxSize: number;
  private readonly name: string;
  private readonly trackStats: boolean;

  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0
  };

  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl ?? DEFAULT_TTL;
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.name = options.name ?? 'cache';
    this.trackStats = options.trackStats ?? true;
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.trackStats) this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      if (this.trackStats) this.stats.misses++;
      return null;
    }

    // Update hit count and move to end (LRU)
    entry.hits++;
    if (this.trackStats) this.stats.hits++;

    // Refresh position in map (LRU behavior)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Set a value in cache
   */
  set(key: string, data: T, customTtl?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + (customTtl ?? this.ttl),
      hits: 0
    };

    this.cache.set(key, entry);
    if (this.trackStats) this.stats.sets++;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Get or set with async factory
   */
  async getOrSet(key: string, factory: () => Promise<T>, customTtl?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    this.set(key, data, customTtl);
    return data;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Evict oldest entry (LRU)
   */
  private evictOldest(): void {
    // Map maintains insertion order, first key is oldest
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      if (this.trackStats) this.stats.evictions++;
    }
  }
}

/**
 * Multi-key cache for complex cache scenarios
 */
export class MultiKeyCache<T> {
  private caches = new Map<string, CacheService<T>>();
  private readonly defaultOptions: CacheOptions;

  constructor(options: CacheOptions = {}) {
    this.defaultOptions = options;
  }

  /**
   * Get or create a named cache partition
   */
  partition(name: string, options?: CacheOptions): CacheService<T> {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new CacheService<T>({ ...this.defaultOptions, ...options, name });
      this.caches.set(name, cache);
    }
    return cache;
  }

  /**
   * Get from a specific partition
   */
  get(partition: string, key: string): T | null {
    return this.caches.get(partition)?.get(key) ?? null;
  }

  /**
   * Set in a specific partition
   */
  set(partition: string, key: string, data: T, ttl?: number): void {
    this.partition(partition).set(key, data, ttl);
  }

  /**
   * Clear all partitions
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Get combined stats from all partitions
   */
  getAllStats(): Record<string, CacheStats> {
    const result: Record<string, CacheStats> = {};
    for (const [name, cache] of this.caches) {
      result[name] = cache.getStats();
    }
    return result;
  }
}

/**
 * Global cache registry for singleton access
 */
class CacheRegistry {
  private static instance: CacheRegistry;
  private caches = new Map<string, CacheService<unknown>>();

  static getInstance(): CacheRegistry {
    if (!CacheRegistry.instance) {
      CacheRegistry.instance = new CacheRegistry();
    }
    return CacheRegistry.instance;
  }

  /**
   * Get or create a named global cache
   */
  getCache<T>(name: string, options?: CacheOptions): CacheService<T> {
    let cache = this.caches.get(name) as CacheService<T> | undefined;
    if (!cache) {
      cache = new CacheService<T>({ ...options, name });
      this.caches.set(name, cache as CacheService<unknown>);
    }
    return cache;
  }

  /**
   * Clear a specific cache
   */
  clearCache(name: string): void {
    this.caches.get(name)?.clear();
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Get all cache stats
   */
  getAllStats(): Record<string, CacheStats> {
    const result: Record<string, CacheStats> = {};
    for (const [name, cache] of this.caches) {
      result[name] = cache.getStats();
    }
    return result;
  }
}

// Export singleton registry
export const cacheRegistry = CacheRegistry.getInstance();

// Convenience function to get a typed cache
export function getCache<T>(name: string, options?: CacheOptions): CacheService<T> {
  return cacheRegistry.getCache<T>(name, options);
}

// Pre-configured caches for common use cases
export const vehicleCache = getCache<unknown>('vehicles', { ttl: 30 * 1000, maxSize: 100 });
export const userCache = getCache<unknown>('users', { ttl: 5 * 60 * 1000, maxSize: 500 });
export const apiCache = getCache<unknown>('api', { ttl: 60 * 1000, maxSize: 200 });
export const sessionCache = getCache<unknown>('sessions', { ttl: 30 * 60 * 1000, maxSize: 1000 });

export default CacheService;
