/**
 * Request metrics
 */
export interface RequestMetrics {
  url: string;
  method: string;
  duration: number;
  status?: number;
  success: boolean;
  timestamp: number;
}

/**
 * Cache metrics
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  entries: number;
}

/**
 * SDK metrics
 */
export interface SDKMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
    recent: RequestMetrics[];
  };
  cache: CacheMetrics;
  offline: {
    queueSize: number;
    processedRequests: number;
  };
  memory: {
    currentSize: number;
    maxSize: number;
    utilizationPercent: number;
  };
}

/**
 * MetricsTracker collects performance metrics
 */
export class MetricsTracker {
  private requestMetrics: RequestMetrics[] = [];
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private maxRequestHistory: number = 100;

  /**
   * Track a request
   */
  trackRequest(metrics: RequestMetrics): void {
    this.requestMetrics.push(metrics);

    // Keep only recent requests
    if (this.requestMetrics.length > this.maxRequestHistory) {
      this.requestMetrics.shift();
    }
  }

  /**
   * Track cache hit
   */
  trackCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Track cache miss
   */
  trackCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Get all metrics
   */
  getMetrics(
    cacheSize: number,
    cacheEntries: number,
    queueSize: number,
    memoryUsage: { currentSize: number; maxSize: number }
  ): SDKMetrics {
    const successful = this.requestMetrics.filter((r) => r.success).length;
    const failed = this.requestMetrics.filter((r) => !r.success).length;
    const totalDuration = this.requestMetrics.reduce(
      (sum, r) => sum + r.duration,
      0
    );
    const averageDuration =
      this.requestMetrics.length > 0
        ? totalDuration / this.requestMetrics.length
        : 0;

    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    const hitRate =
      totalCacheRequests > 0 ? this.cacheHits / totalCacheRequests : 0;

    return {
      requests: {
        total: this.requestMetrics.length,
        successful,
        failed,
        averageDuration,
        recent: this.requestMetrics.slice(-10), // Last 10 requests
      },
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate,
        size: cacheSize,
        entries: cacheEntries,
      },
      offline: {
        queueSize,
        processedRequests: 0, // TODO: Track this
      },
      memory: {
        currentSize: memoryUsage.currentSize,
        maxSize: memoryUsage.maxSize,
        utilizationPercent:
          (memoryUsage.currentSize / memoryUsage.maxSize) * 100,
      },
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.requestMetrics = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get request metrics
   */
  getRequestMetrics(): RequestMetrics[] {
    return [...this.requestMetrics];
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? this.cacheHits / total : 0;
  }
}
