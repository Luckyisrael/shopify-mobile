import type { AxiosInstance } from 'axios';
import type { StorageAdapter } from '../storage/interfaces';
import NetInfo from '@react-native-community/netinfo';

/**
 * Storage key for offline queue
 */
const QUEUE_STORAGE_KEY = 'shopify_offline_queue';

/**
 * Queue priority levels
 */
export enum QueuePriority {
  HIGH = 3,    // Auth, critical operations
  NORMAL = 2,  // Cart, preferences
  LOW = 1,     // Events, analytics
}

/**
 * Queued request interface
 */
export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  data: any;
  headers?: Record<string, string>;
  timestamp: number;
  retries: number;
  priority: QueuePriority;
}

/**
 * Offline queue configuration
 */
export interface OfflineQueueConfig {
  maxQueueSize: number;
  maxRetries: number;
  retryDelay: number;
  queueableEndpoints: string[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: OfflineQueueConfig = {
  maxQueueSize: 100,
  maxRetries: 3,
  retryDelay: 1000,
  queueableEndpoints: [
    '/api/mobile/events',
    '/api/mobile/cart',
    '/api/mobile/preferences',
    '/api/mobile/notification/opened',
    '/api/mobile/notification/clicked',
  ],
};

/**
 * OfflineQueue manages request queuing when offline
 * Automatically processes queue when connectivity is restored
 */
export class OfflineQueue {
  private queue: QueuedRequest[] = [];
  private storage: StorageAdapter;
  private httpClient: AxiosInstance;
  private config: OfflineQueueConfig;
  private isProcessing = false;
  private unsubscribeNetInfo?: () => void;

  constructor(
    storage: StorageAdapter,
    httpClient: AxiosInstance,
    config?: Partial<OfflineQueueConfig>
  ) {
    this.storage = storage;
    this.httpClient = httpClient;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize offline queue and restore from storage
   */
  async initialize(): Promise<void> {
    try {
      // Restore queue from storage
      const queueJson = await this.storage.getItem(QUEUE_STORAGE_KEY);
      if (queueJson) {
        this.queue = JSON.parse(queueJson as string);
      }

      // Listen for connectivity changes
      this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
        if (state.isConnected) {
          this.processQueue();
        }
      });

      // Process queue if online
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        this.processQueue();
      }
    } catch (error) {
      console.error('OfflineQueue: Error initializing:', error);
    }
  }

  /**
   * Cleanup and unsubscribe from network events
   */
  cleanup(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
  }

  /**
   * Enqueue a request for later processing
   */
  async enqueue(
    request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retries'>
  ): Promise<void> {
    // Check queue size limit
    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn('OfflineQueue: Queue is full, removing oldest request');
      this.queue.shift();
    }

    const queuedRequest: QueuedRequest = {
      ...request,
      id: this.generateId(),
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(queuedRequest);
    await this.persistQueue();
  }

  /**
   * Process all queued requests
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    try {
      // Sort by priority (high to low) and timestamp (old to new)
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      // Process requests one by one
      while (this.queue.length > 0) {
        const request = this.queue[0];

        try {
          // Execute request
          await this.httpClient.request({
            url: request.url,
            method: request.method,
            data: request.data,
            headers: request.headers,
          });

          // Success - remove from queue
          this.queue.shift();
          await this.persistQueue();
        } catch (error) {
          // Increment retry count
          request.retries++;

          if (request.retries >= this.config.maxRetries) {
            // Max retries reached - remove from queue
            console.error(
              `OfflineQueue: Max retries reached for request ${request.id}`,
              error
            );
            this.queue.shift();
            await this.persistQueue();
          } else {
            // Keep in queue for retry
            console.warn(
              `OfflineQueue: Request ${request.id} failed, will retry (${request.retries}/${this.config.maxRetries})`
            );
            await this.persistQueue();
            break; // Stop processing, will retry later
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check if a URL is queueable
   */
  isQueueable(url: string): boolean {
    return this.config.queueableEndpoints.some((endpoint) =>
      url.includes(endpoint)
    );
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get all queued requests
   */
  getQueue(): QueuedRequest[] {
    return [...this.queue];
  }

  /**
   * Clear the queue
   */
  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.persistQueue();
  }

  /**
   * Persist queue to storage
   */
  private async persistQueue(): Promise<void> {
    try {
      await this.storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('OfflineQueue: Error persisting queue:', error);
    }
  }

  /**
   * Generate unique ID for request
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
