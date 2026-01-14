import type { AxiosInstance } from 'axios';
import type { UserPreferences } from '../types';
import type { CacheManager } from '../managers/CacheManager';
import { RequestDeduplicator } from '../managers/RequestDeduplicator';

export class PreferencesService {
  private cacheManager?: CacheManager;
  private deduplicator?: RequestDeduplicator;

  constructor(
    private httpClient: AxiosInstance,
    cacheManager?: CacheManager,
    deduplicator?: RequestDeduplicator
  ) {
    this.cacheManager = cacheManager;
    this.deduplicator = deduplicator;
  }

  /**
   * Get user preferences with caching
   */
  async get(): Promise<UserPreferences> {
    const cacheKey = 'preferences:user';

    // Deduplicate concurrent requests
    const deduplicateKey = this.deduplicator
      ? RequestDeduplicator.generateKey('GET', '/api/mobile/preferences')
      : null;

    const fetchPreferences = async () => {
      // Use cache-first strategy
      if (this.cacheManager) {
        const ttl = this.cacheManager.getTTL('preferences');
        return this.cacheManager.fetchWithCache(
          cacheKey,
          async () => {
            const response = await this.httpClient.get<UserPreferences>(
              '/api/mobile/preferences'
            );
            return response.data;
          },
          ttl
        );
      }

      // Fallback without cache
      const response = await this.httpClient.get<UserPreferences>(
        '/api/mobile/preferences'
      );
      return response.data;
    };

    // Use deduplication if available
    if (this.deduplicator && deduplicateKey) {
      return this.deduplicator.deduplicate(deduplicateKey, fetchPreferences);
    }

    return fetchPreferences();
  }

  /**
   * Update user preferences with cache invalidation
   */
  async update(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const response = await this.httpClient.patch<UserPreferences>(
      '/api/mobile/preferences',
      updates
    );

    // Invalidate cache
    if (this.cacheManager) {
      await this.cacheManager.invalidate('preferences:user');
    }

    return response.data;
  }

  /**
   * Bulk update preferences with conflict handling (last-write-wins)
   */
  async bulkUpdate(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const response = await this.httpClient.put<UserPreferences>(
      '/api/mobile/preferences',
      updates
    );

    // Invalidate cache
    if (this.cacheManager) {
      await this.cacheManager.invalidate('preferences:user');
    }

    return response.data;
  }
}
