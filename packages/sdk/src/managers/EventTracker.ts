import type { AxiosInstance } from 'axios';
import type { StorageAdapter } from '../storage/interfaces';
import { useAuthStore } from '../stores/authStore';

/**
 * Storage key for event batch
 */
const EVENT_BATCH_STORAGE_KEY = 'shopify_event_batch';

/**
 * Tracked event interface
 */
export interface TrackedEvent {
  eventType: string;
  payload: Record<string, any>;
  timestamp: number;
}

/**
 * Event tracker configuration
 */
export interface EventTrackerConfig {
  batchSize: number;
  flushInterval: number;
  autoTrackEnabled: boolean;
  disabledEvents?: string[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: EventTrackerConfig = {
  batchSize: 10,
  flushInterval: 30000, // 30 seconds
  autoTrackEnabled: true,
  disabledEvents: [],
};

/**
 * Auto-tracked event types
 */
export const AUTO_TRACKED_EVENTS = {
  APP_OPENED: 'APP_OPENED',
  PRODUCT_VIEWED: 'PRODUCT_VIEWED',
  CART_UPDATED: 'CART_UPDATED',
  CART_ABANDONED: 'CART_ABANDONED',
  CHECKOUT_STARTED: 'CHECKOUT_STARTED',
  HIGHLIGHT_VIEWED: 'HIGHLIGHT_VIEWED',
  HIGHLIGHT_CLICKED: 'HIGHLIGHT_CLICKED',
};

/**
 * EventTracker manages event tracking with batching and offline support
 */
export class EventTracker {
  private eventBatch: TrackedEvent[] = [];
  private storage: StorageAdapter;
  private httpClient: AxiosInstance;
  private config: EventTrackerConfig;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    storage: StorageAdapter,
    httpClient: AxiosInstance,
    config?: Partial<EventTrackerConfig>
  ) {
    this.storage = storage;
    this.httpClient = httpClient;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize event tracker and restore batch from storage
   */
  async initialize(): Promise<void> {
    try {
      // Restore event batch from storage
      const batchJson = await this.storage.getItem(EVENT_BATCH_STORAGE_KEY);
      if (batchJson) {
        this.eventBatch = JSON.parse(batchJson as string);
      }

      // Flush any pending events
      if (this.eventBatch.length > 0) {
        await this.flush();
      }
    } catch (error) {
      console.error('EventTracker: Error initializing:', error);
    }
  }

  /**
   * Track an event
   */
  async track(eventType: string, payload: Record<string, any> = {}): Promise<void> {
    const event: TrackedEvent = {
      eventType,
      payload,
      timestamp: Date.now(),
    };

    this.eventBatch.push(event);

    // Auto-flush if batch size reached
    if (this.eventBatch.length >= this.config.batchSize) {
      await this.flush();
    } else {
      // Schedule flush
      this.scheduleFlush();
    }
  }

  /**
   * Auto-track an event (respects configuration)
   */
  autoTrack(eventType: string, payload: Record<string, any> = {}): void {
    if (!this.config.autoTrackEnabled) return;
    if (this.config.disabledEvents?.includes(eventType)) return;

    this.track(eventType, payload);
  }

  /**
   * Flush all pending events to the server
   */
  async flush(): Promise<void> {
    // Cancel scheduled flush
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.eventBatch.length === 0) return;

    const events = [...this.eventBatch];
    this.eventBatch = [];

    try {
      // Get access token if available
      const session = useAuthStore.getState().session;
      const customerAccessToken = session?.accessToken;

      await this.httpClient.post('/api/mobile/events', {
        events,
        customerAccessToken,
      });

      // Clear persisted batch on success
      await this.storage.removeItem(EVENT_BATCH_STORAGE_KEY);
    } catch (error) {
      console.error('EventTracker: Error flushing events:', error);

      // Re-add to batch for retry
      this.eventBatch.unshift(...events);

      // Persist batch for later retry
      await this.persistBatch();
    }
  }

  /**
   * Schedule a flush
   */
  private scheduleFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flush();
      this.flushTimer = null;
    }, this.config.flushInterval);
  }

  /**
   * Persist event batch to storage
   */
  private async persistBatch(): Promise<void> {
    try {
      await this.storage.setItem(
        EVENT_BATCH_STORAGE_KEY,
        JSON.stringify(this.eventBatch)
      );
    } catch (error) {
      console.error('EventTracker: Error persisting batch:', error);
    }
  }

  /**
   * Get current batch size
   */
  getBatchSize(): number {
    return this.eventBatch.length;
  }

  /**
   * Clear all pending events
   */
  async clearBatch(): Promise<void> {
    this.eventBatch = [];
    await this.storage.removeItem(EVENT_BATCH_STORAGE_KEY);
  }

  /**
   * Cleanup and flush remaining events
   */
  async cleanup(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush any remaining events
    if (this.eventBatch.length > 0) {
      await this.flush();
    }
  }
}
