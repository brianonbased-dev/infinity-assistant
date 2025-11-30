/**
 * Singleton Factory Utility
 *
 * Replaces 25+ duplicate singleton patterns across services.
 * Provides consistent singleton creation with lazy initialization.
 */

// ============================================================================
// Types
// ============================================================================

export interface SingletonOptions {
  /** Name for debugging/logging */
  name?: string;
  /** Enable logging of instance creation */
  logging?: boolean;
  /** Custom initialization hook */
  onInit?: () => void;
  /** Custom disposal hook */
  onDispose?: () => void | Promise<void>;
}

export interface SingletonAccessor<T> {
  /** Get the singleton instance */
  (): T;
  /** Get instance if it exists, without creating */
  getIfExists(): T | undefined;
  /** Reset the singleton (for testing) */
  reset(): void;
  /** Check if instance exists */
  isInitialized(): boolean;
  /** Get singleton name */
  getName(): string;
}

// ============================================================================
// Singleton Factory
// ============================================================================

/**
 * Create a lazy singleton accessor
 *
 * @example
 * ```typescript
 * // Before (repeated 25+ times across services):
 * class MyService {
 *   private static instance: MyService;
 *   static getInstance(): MyService {
 *     if (!MyService.instance) {
 *       MyService.instance = new MyService();
 *     }
 *     return MyService.instance;
 *   }
 * }
 *
 * // After:
 * class MyService {
 *   constructor() { ... }
 * }
 * export const getMyService = createSingleton(() => new MyService(), { name: 'MyService' });
 *
 * // Usage:
 * const service = getMyService();
 * ```
 */
export function createSingleton<T>(
  factory: () => T,
  options: SingletonOptions = {}
): SingletonAccessor<T> {
  let instance: T | undefined;
  const name = options.name ?? 'Singleton';

  const accessor = (() => {
    if (!instance) {
      if (options.logging) {
        console.log(`[Singleton] Creating instance: ${name}`);
      }
      instance = factory();
      if (options.onInit) {
        options.onInit();
      }
    }
    return instance;
  }) as SingletonAccessor<T>;

  accessor.getIfExists = () => instance;

  accessor.reset = () => {
    if (instance && options.onDispose) {
      const result = options.onDispose();
      if (result instanceof Promise) {
        result.catch(err => console.error(`[Singleton] Dispose error for ${name}:`, err));
      }
    }
    if (options.logging && instance) {
      console.log(`[Singleton] Resetting instance: ${name}`);
    }
    instance = undefined;
  };

  accessor.isInitialized = () => instance !== undefined;

  accessor.getName = () => name;

  return accessor;
}

/**
 * Create an async singleton accessor for services that need async initialization
 *
 * @example
 * ```typescript
 * class DatabaseService {
 *   private constructor(private connection: Connection) {}
 *
 *   static async create(): Promise<DatabaseService> {
 *     const connection = await createConnection();
 *     return new DatabaseService(connection);
 *   }
 * }
 *
 * export const getDatabaseService = createAsyncSingleton(
 *   () => DatabaseService.create(),
 *   { name: 'DatabaseService' }
 * );
 *
 * // Usage:
 * const db = await getDatabaseService();
 * ```
 */
export function createAsyncSingleton<T>(
  factory: () => Promise<T>,
  options: SingletonOptions = {}
): () => Promise<T> {
  let instance: T | undefined;
  let initPromise: Promise<T> | undefined;
  const name = options.name ?? 'AsyncSingleton';

  return async () => {
    if (instance) {
      return instance;
    }

    if (initPromise) {
      return initPromise;
    }

    if (options.logging) {
      console.log(`[Singleton] Creating async instance: ${name}`);
    }

    initPromise = factory().then(result => {
      instance = result;
      if (options.onInit) {
        options.onInit();
      }
      return result;
    });

    return initPromise;
  };
}

/**
 * Create a configurable singleton that accepts initial config
 *
 * @example
 * ```typescript
 * interface CacheConfig {
 *   ttl: number;
 *   maxSize: number;
 * }
 *
 * class CacheService {
 *   constructor(private config: CacheConfig) {}
 * }
 *
 * export const getCacheService = createConfigurableSingleton<CacheService, CacheConfig>(
 *   (config) => new CacheService(config),
 *   { ttl: 60000, maxSize: 1000 }, // defaults
 *   { name: 'CacheService' }
 * );
 *
 * // Usage:
 * const cache1 = getCacheService(); // uses defaults
 * const cache2 = getCacheService({ ttl: 30000 }); // merges with defaults, returns same instance
 * ```
 */
export function createConfigurableSingleton<T, C extends Record<string, unknown>>(
  factory: (config: C) => T,
  defaultConfig: C,
  options: SingletonOptions = {}
): (config?: Partial<C>) => T {
  let instance: T | undefined;
  let appliedConfig: C | undefined;
  const name = options.name ?? 'ConfigurableSingleton';

  return (config?: Partial<C>) => {
    if (!instance) {
      appliedConfig = { ...defaultConfig, ...config };
      if (options.logging) {
        console.log(`[Singleton] Creating configurable instance: ${name}`, appliedConfig);
      }
      instance = factory(appliedConfig);
      if (options.onInit) {
        options.onInit();
      }
    } else if (config && options.logging) {
      console.warn(`[Singleton] ${name} already initialized, ignoring new config`);
    }
    return instance;
  };
}

// ============================================================================
// Singleton Registry
// ============================================================================

/**
 * Global registry for tracking all singletons
 * Useful for testing and cleanup
 */
class SingletonRegistry {
  private static instance: SingletonRegistry;
  private singletons = new Map<string, SingletonAccessor<unknown>>();

  static getInstance(): SingletonRegistry {
    if (!SingletonRegistry.instance) {
      SingletonRegistry.instance = new SingletonRegistry();
    }
    return SingletonRegistry.instance;
  }

  /**
   * Register a singleton accessor
   */
  register<T>(accessor: SingletonAccessor<T>): void {
    this.singletons.set(accessor.getName(), accessor as SingletonAccessor<unknown>);
  }

  /**
   * Get a registered singleton by name
   */
  get<T>(name: string): SingletonAccessor<T> | undefined {
    return this.singletons.get(name) as SingletonAccessor<T> | undefined;
  }

  /**
   * Reset all registered singletons
   */
  resetAll(): void {
    for (const accessor of this.singletons.values()) {
      accessor.reset();
    }
  }

  /**
   * Get all registered singleton names
   */
  getNames(): string[] {
    return Array.from(this.singletons.keys());
  }

  /**
   * Get initialization status of all singletons
   */
  getStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const [name, accessor] of this.singletons) {
      status[name] = accessor.isInitialized();
    }
    return status;
  }
}

export const singletonRegistry = SingletonRegistry.getInstance();

/**
 * Create and register a singleton
 */
export function createRegisteredSingleton<T>(
  factory: () => T,
  options: SingletonOptions = {}
): SingletonAccessor<T> {
  const accessor = createSingleton(factory, options);
  singletonRegistry.register(accessor);
  return accessor;
}

// ============================================================================
// Service Container (Advanced DI)
// ============================================================================

type ServiceFactory<T> = () => T;
type ServiceToken<T> = string & { __type?: T };

/**
 * Simple dependency injection container
 *
 * @example
 * ```typescript
 * const container = new ServiceContainer();
 *
 * // Register services
 * container.register('logger', () => new Logger());
 * container.register('cache', () => new CacheService());
 * container.register('api', () => new ApiService(container.get('cache')));
 *
 * // Resolve services
 * const api = container.get<ApiService>('api');
 * ```
 */
export class ServiceContainer {
  private factories = new Map<string, ServiceFactory<unknown>>();
  private instances = new Map<string, unknown>();

  /**
   * Register a service factory
   */
  register<T>(token: ServiceToken<T> | string, factory: ServiceFactory<T>): this {
    this.factories.set(token, factory);
    return this;
  }

  /**
   * Get or create a service instance
   */
  get<T>(token: ServiceToken<T> | string): T {
    // Return existing instance
    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    // Create new instance
    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`Service not registered: ${token}`);
    }

    const instance = factory() as T;
    this.instances.set(token, instance);
    return instance;
  }

  /**
   * Check if service is registered
   */
  has(token: string): boolean {
    return this.factories.has(token);
  }

  /**
   * Clear all instances (not factories)
   */
  clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Clear everything
   */
  clear(): void {
    this.factories.clear();
    this.instances.clear();
  }
}

// Global container instance
export const serviceContainer = new ServiceContainer();

export default createSingleton;
