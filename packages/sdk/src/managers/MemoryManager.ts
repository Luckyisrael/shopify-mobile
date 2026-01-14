import type { CacheManager } from './CacheManager';

/**
 * LRU Cache entry with access tracking
 */
interface LRUEntry {
  key: string;
  size: number;
  lastAccessed: number;
}

/**
 * MemoryManager handles cache size limits with LRU eviction
 */
export class MemoryManager {
  private maxCacheSize: number;
  private currentSize: number = 0;
  private entries: Map<string, LRUEntry> = new Map();
  private cacheManager: CacheManager;

  constructor(cacheManager: CacheManager, maxCacheSize: number = 50 * 1024 * 1024) {
    this.cacheManager = cacheManager;
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Check if adding data would exceed size limit
   * If so, evict oldest entries until there's space
   */
  async checkAndEvict(key: string, data: any): Promise<void> {
    const size = this.estimateSize(data);

    // Evict until we have space
    while (this.currentSize + size > this.maxCacheSize && this.entries.size > 0) {
      await this.evictOldest();
    }

    // Track this entry
    this.trackEntry(key, size);
  }

  /**
   * Track cache entry for LRU
   */
  private trackEntry(key: string, size: number): void {
    // Remove old entry if exists
    if (this.entries.has(key)) {
      const oldEntry = this.entries.get(key)!;
      this.currentSize -= oldEntry.size;
    }

    // Add new entry
    this.entries.set(key, {
      key,
      size,
      lastAccessed: Date.now(),
    });

    this.currentSize += size;
  }

  /**
   * Update access time for LRU
   */
  updateAccess(key: string): void {
    const entry = this.entries.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
    }
  }

  /**
   * Remove entry from tracking
   */
  removeEntry(key: string): void {
    const entry = this.entries.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.entries.delete(key);
    }
  }

  /**
   * Evict the least recently used entry
   */
  private async evictOldest(): Promise<void> {
    if (this.entries.size === 0) return;

    // Find oldest entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.entries) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      // Invalidate from cache
      await this.cacheManager.invalidate(oldestKey);
      this.removeEntry(oldestKey);
    }
  }

  /**
   * Estimate size of data in bytes
   */
  private estimateSize(data: any): number {
    try {
      // Rough estimate: JSON string length * 2 (for UTF-16)
      return JSON.stringify(data).length * 2;
    } catch {
      // If can't stringify, use a default size
      return 1024; // 1KB default
    }
  }

  /**
   * Get current memory usage
   */
  getUsage(): {
    currentSize: number;
    maxSize: number;
    entries: number;
    utilizationPercent: number;
  } {
    return {
      currentSize: this.currentSize,
      maxSize: this.maxCacheSize,
      entries: this.entries.size,
      utilizationPercent: (this.currentSize / this.maxCacheSize) * 100,
    };
  }

  /**
   * Clear all tracking
   */
  clear(): void {
    this.entries.clear();
    this.currentSize = 0;
  }
}
