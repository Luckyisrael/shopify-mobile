/**
 * In-Memory Cache Service
 * 
 * Provides a simple in-memory caching layer for analytics and metrics.
 * This implementation is database-agnostic and works with both SQLite and PostgreSQL.
 * 
 * Features:
 * - TTL-based expiration
 * - Automatic cleanup of expired entries
 * - Type-safe cache keys
 * - Cache statistics
 * - Namespace support
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class InMemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
  };

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set a value in cache with TTL in seconds
   */
  set<T>(key: string, value: T, ttlSeconds: number = 3600): void {
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      createdAt: Date.now(),
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string): number {
    let deleted = 0;
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, ttlSeconds);
    return value;
  }
}

// Singleton instance
const cache = new InMemoryCache();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cleaned = cache.cleanup();
    if (cleaned > 0) {
      console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
    }
  }, 5 * 60 * 1000);
}

// Cache key builders for type safety
export const CacheKeys = {
  // Dashboard metrics
  dashboardMetrics: (merchantId: string, startDate: string, endDate: string) =>
    `dashboard:metrics:${merchantId}:${startDate}:${endDate}`,

  // Push performance
  pushPerformance: (merchantId: string, startDate: string, endDate: string) =>
    `push:performance:${merchantId}:${startDate}:${endDate}`,

  // Highlight analytics
  highlightAnalytics: (merchantId: string, startDate: string, endDate: string) =>
    `highlight:analytics:${merchantId}:${startDate}:${endDate}`,

  // Revenue attribution
  revenueAttribution: (merchantId: string, startDate: string, endDate: string) =>
    `revenue:attribution:${merchantId}:${startDate}:${endDate}`,

  // Customer stats
  customerStats: (merchantId: string) =>
    `customer:stats:${merchantId}`,

  // Campaign metrics
  campaignMetrics: (campaignId: string) =>
    `campaign:metrics:${campaignId}`,

  // A/B test results
  abTestResults: (testId: string) =>
    `abtest:results:${testId}`,

  // Re-engagement metrics
  reengagementMetrics: (merchantId: string) =>
    `reengagement:metrics:${merchantId}`,

  // Preference stats
  preferenceStats: (merchantId: string) =>
    `preference:stats:${merchantId}`,

  // Performance comparison
  performanceComparison: (merchantId: string, startDate: string, endDate: string) =>
    `performance:comparison:${merchantId}:${startDate}:${endDate}`,
};

// Cache invalidation helpers
export const CacheInvalidation = {
  // Invalidate all merchant data
  invalidateMerchant: (merchantId: string) => {
    return cache.deletePattern(`*:${merchantId}:*`);
  },

  // Invalidate dashboard data
  invalidateDashboard: (merchantId: string) => {
    return cache.deletePattern(`dashboard:*:${merchantId}:*`);
  },

  // Invalidate push data
  invalidatePush: (merchantId: string) => {
    return cache.deletePattern(`push:*:${merchantId}:*`);
  },

  // Invalidate campaign data
  invalidateCampaign: (campaignId: string) => {
    return cache.delete(CacheKeys.campaignMetrics(campaignId));
  },

  // Invalidate A/B test data
  invalidateABTest: (testId: string) => {
    return cache.delete(CacheKeys.abTestResults(testId));
  },

  // Invalidate all analytics
  invalidateAllAnalytics: (merchantId: string) => {
    return cache.deletePattern(`*:${merchantId}:*`);
  },
};

// Default TTL values (in seconds)
export const CacheTTL = {
  SHORT: 5 * 60, // 5 minutes
  MEDIUM: 15 * 60, // 15 minutes
  LONG: 60 * 60, // 1 hour
  VERY_LONG: 4 * 60 * 60, // 4 hours
};

// Export cache instance and utilities
export { cache };

// Helper function for cache warming
export async function warmCache(merchantId: string, fetchers: Record<string, () => Promise<any>>) {
  const results = await Promise.allSettled(
    Object.entries(fetchers).map(async ([key, fetcher]) => {
      try {
        const value = await fetcher();
        cache.set(key, value, CacheTTL.LONG);
        return { key, success: true };
      } catch (error) {
        console.error(`[Cache] Failed to warm cache for ${key}:`, error);
        return { key, success: false };
      }
    })
  );

  const successful = results.filter(r => r.status === "fulfilled").length;
  console.log(`[Cache] Warmed ${successful}/${results.length} cache entries for merchant ${merchantId}`);
}
