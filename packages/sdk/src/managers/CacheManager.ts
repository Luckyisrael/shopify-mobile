import { useCacheStore, type CacheEntry } from '../stores/cacheStore';
import type { StorageAdapter } from '../storage/interfaces';
import { MemoryManager } from './MemoryManager';

/**
 * Cache configuration
 */
export interface CacheConfig {
  defaultTTL: number;
  ttlByResource: {
    products: number;
    collections: number;
    highlights: number;
    preferences: number;
    config: number;
  };
  maxCacheSize: number;
  persistCache: boolean;
}

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  ttlByResource: {
    products: 10 * 60 * 1000, // 10 minutes
    collections: 15 * 60 * 1000, // 15 minutes
    highlights: 5 * 60 * 1000, // 5 minutes
    preferences: 30 * 60 * 1000, // 30 minutes
    config: 60 * 60 * 1000, // 1 hour
  },
  maxCacheSize: 50 * 1024 * 1024, // 50MB
  persistCache: true,
};

/**
 * Cache key prefix
 */
const CACHE_PREFIX = 'shopify_cache:';

/**
 * CacheManager handles data caching with TTL and persistence
 */
export class CacheManager {
  private storage: StorageAdapter;
  private config: CacheConfig;
  private memoryManager: MemoryManager;

  constructor(storage: StorageAdapter, config?: Partial<CacheConfig>) {
    this.storage = storage;
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.memoryManager = new MemoryManager(this, this.config.maxCacheSize);
  }

  /**
   * Initialize cache manager and restore from storage
   */
  async initialize(): Promise<void> {
    if (!this.config.persistCache) return;

    try {
      // Restore cache from storage
      const keys = await this.storage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));

      for (const key of cacheKeys) {
        const entryJson = await this.storage.getItem(key);
        if (!entryJson) continue;

        const entry: CacheEntry<any> = JSON.parse(entryJson as string);
        const cacheKey = key.replace(CACHE_PREFIX, '');

        // Check if expired
        if (!this.isExpired(entry)) {
          useCacheStore.getState().setCache(cacheKey, entry);
        } else {
          // Remove expired entry
          await this.storage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('CacheManager: Error initializing:', error);
    }
  }

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = useCacheStore.getState().cache[key];

    if (!entry) return null;

    // Check if expired
    if (this.isExpired(entry)) {
      await this.invalidate(key);
      return null;
    }

    // Update LRU access time
    this.memoryManager.updateAccess(key);

    return entry.data as T;
  }

  /**
   * Set cached data
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    // Check memory and evict if needed
    await this.memoryManager.checkAndEvict(key, data);

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
    };

    // Update store
    useCacheStore.getState().setCache(key, entry);

    // Persist to storage if enabled
    if (this.config.persistCache) {
      try {
        await this.storage.setItem(
          `${CACHE_PREFIX}${key}`,
          JSON.stringify(entry)
        );
      } catch (error) {
        console.error('CacheManager: Error persisting cache:', error);
      }
    }
  }

  /**
   * Invalidate a single cache entry
   */
  async invalidate(key: string): Promise<void> {
    useCacheStore.getState().removeCache(key);
    this.memoryManager.removeEntry(key);

    if (this.config.persistCache) {
      try {
        await this.storage.removeItem(`${CACHE_PREFIX}${key}`);
      } catch (error) {
        console.error('CacheManager: Error removing cache:', error);
      }
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const cache = useCacheStore.getState().cache;
    const regex = new RegExp(pattern.replace('*', '.*'));

    const keysToInvalidate = Object.keys(cache).filter((key) =>
      regex.test(key)
    );

    for (const key of keysToInvalidate) {
      await this.invalidate(key);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    useCacheStore.getState().clearCache();
    this.memoryManager.clear();

    if (this.config.persistCache) {
      try {
        const keys = await this.storage.getAllKeys();
        const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
        await Promise.all(cacheKeys.map((k) => this.storage.removeItem(k)));
      } catch (error) {
        console.error('CacheManager: Error clearing cache:', error);
      }
    }
  }

  /**
   * Get TTL for a resource type
   */
  getTTL(resourceType: keyof CacheConfig['ttlByResource']): number {
    return this.config.ttlByResource[resourceType] || this.config.defaultTTL;
  }

  /**
   * Fetch with cache-first strategy
   */
  async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // 1. Check cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 2. Fetch fresh data
    const data = await fetcher();

    // 3. Update cache
    await this.set(key, data, ttl);

    return data;
  }

  /**
   * Fetch with stale-while-revalidate strategy
   */
  async fetchWithSWR<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // 1. Get cached data (even if stale)
    const entry = useCacheStore.getState().cache[key];

    // 2. If cached, return immediately and revalidate in background
    if (entry) {
      // Revalidate in background
      fetcher()
        .then((data) => this.set(key, data, ttl))
        .catch((error) =>
          console.error('CacheManager: Background revalidation failed:', error)
        );

      return entry.data as T;
    }

    // 3. No cache - fetch and cache
    const data = await fetcher();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    const now = Date.now();
    return now - entry.timestamp > entry.ttl;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: number;
    memoryUsage: {
      currentSize: number;
      maxSize: number;
      utilizationPercent: number;
    };
  } {
    const cache = useCacheStore.getState().cache;
    const memoryUsage = this.memoryManager.getUsage();

    return {
      size: JSON.stringify(cache).length,
      entries: Object.keys(cache).length,
      memoryUsage: {
        currentSize: memoryUsage.currentSize,
        maxSize: memoryUsage.maxSize,
        utilizationPercent: memoryUsage.utilizationPercent,
      },
    };
  }
}
