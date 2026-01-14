import type { AxiosInstance } from 'axios';
import type { Highlight } from '../types';
import type { CacheManager } from '../managers/CacheManager';
import type { EventTracker } from '../managers/EventTracker';
import { RequestDeduplicator } from '../managers/RequestDeduplicator';

export class HighlightsService {
  private cacheManager?: CacheManager;
  private eventTracker?: EventTracker;
  private deduplicator?: RequestDeduplicator;

  constructor(
    private httpClient: AxiosInstance,
    cacheManager?: CacheManager,
    eventTracker?: EventTracker,
    deduplicator?: RequestDeduplicator
  ) {
    this.cacheManager = cacheManager;
    this.eventTracker = eventTracker;
    this.deduplicator = deduplicator;
  }

  /**
   * List highlights with caching
   */
  async list(): Promise<{ highlights: Highlight[] }> {
    const cacheKey = 'highlights:list';

    // Deduplicate concurrent requests
    const deduplicateKey = this.deduplicator
      ? RequestDeduplicator.generateKey('GET', '/api/mobile/highlights')
      : null;

    const fetchHighlights = async () => {
      // Use cache-first strategy
      if (this.cacheManager) {
        const ttl = this.cacheManager.getTTL('highlights');
        return this.cacheManager.fetchWithCache(
          cacheKey,
          async () => {
            const response = await this.httpClient.get<{ highlights: Highlight[] }>(
              '/api/mobile/highlights'
            );
            return response.data;
          },
          ttl
        );
      }

      // Fallback without cache
      const response = await this.httpClient.get<{ highlights: Highlight[] }>(
        '/api/mobile/highlights'
      );
      return response.data;
    };

    // Use deduplication if available
    if (this.deduplicator && deduplicateKey) {
      return this.deduplicator.deduplicate(deduplicateKey, fetchHighlights);
    }

    return fetchHighlights();
  }

  /**
   * Track highlight view
   */
  async trackView(highlightId: string): Promise<void> {
    // Track event
    this.eventTracker?.autoTrack('HIGHLIGHT_VIEWED', {
      highlightId,
      timestamp: Date.now(),
    });

    // Send to API
    try {
      await this.httpClient.post('/api/mobile/highlights/track/view', {
        highlightId,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('HighlightsService: Error tracking view:', error);
    }
  }

  /**
   * Track highlight click
   */
  async trackClick(highlightId: string, deepLink?: string): Promise<void> {
    // Track event
    this.eventTracker?.autoTrack('HIGHLIGHT_CLICKED', {
      highlightId,
      deepLink,
      timestamp: Date.now(),
    });

    // Send to API
    try {
      await this.httpClient.post('/api/mobile/highlights/track/click', {
        highlightId,
        deepLink,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('HighlightsService: Error tracking click:', error);
    }
  }

  /**
   * Track highlight conversion
   */
  async trackConversion(highlightId: string, conversionData?: Record<string, any>): Promise<void> {
    try {
      await this.httpClient.post('/api/mobile/highlights/track/conversion', {
        highlightId,
        conversionData,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('HighlightsService: Error tracking conversion:', error);
    }
  }

  /**
   * Preload highlight images
   */
  async preloadImages(highlights: Highlight[]): Promise<void> {
    // In a real implementation, this would preload images
    // For now, we'll just log
    console.log(`HighlightsService: Preloading ${highlights.length} images`);
    
    // TODO: Implement actual image preloading
    // This would typically use Image.prefetch() in React Native
  }
}
