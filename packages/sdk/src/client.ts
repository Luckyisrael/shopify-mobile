import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { SDKError, NetworkError, AuthenticationError } from './errors';
import type { ShopifyMobileClientConfig } from './types';
import { AuthService } from './services/auth';
import { ProductsService } from './services/products';
import { CartService } from './services/cart';
import { PushService } from './services/push';
import { EventsService } from './services/events';
import { HighlightsService } from './services/highlights';
import { PreferencesService } from './services/preferences';
import { useAuthStore } from './stores/authStore';
import { AuthManager } from './managers/AuthManager';
import { CartManager } from './managers/CartManager';
import { OfflineQueue } from './managers/OfflineQueue';
import { CacheManager } from './managers/CacheManager';
import { RequestDeduplicator } from './managers/RequestDeduplicator';
import { EventTracker } from './managers/EventTracker';
import { PushManager } from './managers/PushManager';
import { Logger, LogLevel } from './utils/Logger';
import { MetricsTracker } from './utils/MetricsTracker';
import type { SecureStorageAdapter, StorageAdapter } from './storage/interfaces';

/**
 * Main SDK client for Shopify Mobile Platform
 * Handles HTTP communication, authentication, and service coordination
 */
export class ShopifyMobileClient {
  private httpClient: AxiosInstance;
  private config: ShopifyMobileClientConfig;
  private logger: Logger;
  private metricsTracker: MetricsTracker;

  // Manager instances
  public readonly authManager: AuthManager;
  public readonly cartManager: CartManager;
  public readonly offlineQueue: OfflineQueue;
  public readonly cacheManager: CacheManager;
  public readonly requestDeduplicator: RequestDeduplicator;
  public readonly eventTracker: EventTracker;
  public readonly pushManager: PushManager;

  // Service instances
  public readonly auth: AuthService;
  public readonly products: ProductsService;
  public readonly cart: CartService;
  public readonly push: PushService;
  public readonly events: EventsService;
  public readonly highlights: HighlightsService;
  public readonly preferences: PreferencesService;

  constructor(config: ShopifyMobileClientConfig) {
    this.config = {
      timeout: 10000,
      debug: false,
      ...config,
    };

    // Initialize logger
    this.logger = new Logger({
      enabled: this.config.debug || false,
      level: LogLevel.INFO,
    });

    // Initialize metrics tracker
    this.metricsTracker = new MetricsTracker();

    this.logger.info('Initializing Shopify Mobile SDK', {
      baseUrl: this.config.baseUrl,
      shopDomain: this.config.shopDomain,
    });

    // Create HTTP client with configuration
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Shop-Domain': this.config.shopDomain,
      },
    });

    // Set up interceptors
    this.setupRequestInterceptor();
    this.setupResponseInterceptor();

    // Initialize managers
    this.authManager = new AuthManager(
      this.config.secureStorage as SecureStorageAdapter,
      this.httpClient
    );
    this.eventTracker = new EventTracker(
      this.config.storage as StorageAdapter,
      this.httpClient
    );
    this.cartManager = new CartManager(
      this.config.storage as StorageAdapter,
      this.httpClient,
      this.eventTracker
    );
    this.offlineQueue = new OfflineQueue(
      this.config.storage as StorageAdapter,
      this.httpClient
    );
    this.cacheManager = new CacheManager(
      this.config.storage as StorageAdapter
    );
    this.requestDeduplicator = new RequestDeduplicator();
    this.pushManager = new PushManager(
      this.config.storage as StorageAdapter,
      this.httpClient
    );

    // Initialize services
    this.auth = new AuthService(this.httpClient);
    this.products = new ProductsService(
      this.httpClient,
      this.cacheManager,
      this.eventTracker,
      this.requestDeduplicator
    );
    this.cart = new CartService(this.httpClient);
    this.push = new PushService(this.httpClient);
    this.events = new EventsService(this.httpClient);
    this.highlights = new HighlightsService(
      this.httpClient,
      this.cacheManager,
      this.eventTracker,
      this.requestDeduplicator
    );
    this.preferences = new PreferencesService(
      this.httpClient,
      this.cacheManager,
      this.requestDeduplicator
    );

    this.logger.info('SDK initialized successfully');
  }

  /**
   * Initialize the SDK
   * Must be called before using any SDK features
   */
  async initialize(): Promise<void> {
    await this.authManager.initialize();
    await this.eventTracker.initialize();
    await this.cartManager.initialize();
    await this.offlineQueue.initialize();
    await this.cacheManager.initialize();
    await this.pushManager.initialize();

    // Track app opened event
    this.eventTracker.autoTrack('APP_OPENED', {
      timestamp: Date.now(),
    });
  }

  /**
   * Cleanup SDK resources
   */
  async cleanup(): Promise<void> {
    this.offlineQueue.cleanup();
    await this.eventTracker.cleanup();
  }

  /**
   * Set up request interceptor for authentication
   * Adds Authorization header with access token if available
   */
  private setupRequestInterceptor(): void {
    this.httpClient.interceptors.request.use(
      (config) => {
        // Get current session from auth store
        const session = useAuthStore.getState().session;

        // Add Authorization header if we have an access token
        if (session?.accessToken) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${session.accessToken}`;
        }

        // Log request
        this.logger.debug('HTTP Request', {
          method: config.method,
          url: config.url,
          headers: config.headers,
        });

        // Track request start time
        (config as any)._startTime = Date.now();

        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error', error);
        return Promise.reject(this.convertError(error));
      }
    );
  }

  /**
   * Set up response interceptor for error handling
   * Handles 401 errors with token refresh and retry logic
   */
  private setupResponseInterceptor(): void {
    this.httpClient.interceptors.response.use(
      (response) => {
        // Track successful request
        const startTime = (response.config as any)._startTime;
        if (startTime) {
          const duration = Date.now() - startTime;
          this.metricsTracker.trackRequest({
            url: response.config.url || '',
            method: response.config.method || 'GET',
            duration,
            status: response.status,
            success: true,
            timestamp: Date.now(),
          });

          this.logger.debug('HTTP Response', {
            method: response.config.method,
            url: response.config.url,
            status: response.status,
            duration: `${duration}ms`,
          });
        }

        // Success response - return as is
        return response;
      },
      async (error: AxiosError) => {
        // Track failed request
        const startTime = (error.config as any)?._startTime;
        if (startTime) {
          const duration = Date.now() - startTime;
          this.metricsTracker.trackRequest({
            url: error.config?.url || '',
            method: error.config?.method || 'GET',
            duration,
            status: error.response?.status,
            success: false,
            timestamp: Date.now(),
          });
        }

        this.logger.error('HTTP Error', {
          method: error.config?.method,
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });

        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

        // Handle 401 errors with token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            this.logger.info('Attempting token refresh');
            // Attempt to refresh token
            await this.authManager.refreshToken();

            // Retry original request with new token
            const session = useAuthStore.getState().session;
            if (session?.accessToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${session.accessToken}`;
            }

            this.logger.info('Token refreshed, retrying request');
            return this.httpClient.request(originalRequest);
          } catch (refreshError) {
            // Refresh failed - logout user
            this.logger.error('Token refresh failed, logging out');
            await this.authManager.logout();
            
            const sdkError = new AuthenticationError('Session expired. Please login again.');
            if (this.config.onError) {
              this.config.onError(sdkError);
            }
            return Promise.reject(sdkError);
          }
        }

        // Convert to SDK error
        const sdkError = this.convertError(error);

        // Handle retryable errors with exponential backoff
        if (sdkError.retryable && !originalRequest._retry) {
          const retryCount = originalRequest._retryCount || 0;
          const maxRetries = this.config.retries || 3;

          if (retryCount < maxRetries) {
            originalRequest._retryCount = retryCount + 1;

            // Calculate delay with exponential backoff and jitter
            const baseDelay = 1000; // 1 second
            const exponentialDelay = baseDelay * Math.pow(2, retryCount);
            const jitter = Math.random() * 1000; // 0-1 second jitter
            const delay = exponentialDelay + jitter;

            this.logger.info(`Retrying request (${retryCount + 1}/${maxRetries}) after ${delay}ms`);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));

            return this.httpClient.request(originalRequest);
          }
        }

        // Call error handler if provided
        if (this.config.onError) {
          this.config.onError(sdkError);
        }

        return Promise.reject(sdkError);
      }
    );
  }

  /**
   * Convert Axios error to SDK error
   */
  private convertError(error: AxiosError): SDKError {
    // Network error (no response)
    if (!error.response) {
      return new NetworkError(error.message || 'Network request failed');
    }

    // Authentication error
    if (error.response.status === 401) {
      return new AuthenticationError(
        (error.response.data as { error?: string })?.error || 'Authentication failed'
      );
    }

    // Generic SDK error
    const message =
      (error.response.data as { error?: string; message?: string })?.error ||
      (error.response.data as { error?: string; message?: string })?.message ||
      error.message ||
      'Request failed';

    return new SDKError(
      message,
      `HTTP_${error.response.status}`,
      error.response.status,
      error.response.status >= 500 // Server errors are retryable
    );
  }

  /**
   * Make a custom API request
   */
  public async request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.httpClient.request(config);
    return response.data;
  }

  /**
   * Update the shop domain for subsequent requests
   */
  public setShopDomain(shopDomain: string): void {
    this.config.shopDomain = shopDomain;
    this.httpClient.defaults.headers.common['X-Shop-Domain'] = shopDomain;
  }

  /**
   * Get current configuration
   */
  public getConfig(): Readonly<ShopifyMobileClientConfig> {
    return { ...this.config };
  }

  /**
   * Get the HTTP client instance (for advanced usage)
   */
  public getHttpClient(): AxiosInstance {
    return this.httpClient;
  }

  /**
   * Get SDK metrics
   */
  public getMetrics() {
    const cacheStats = this.cacheManager.getStats();
    const queueSize = 0; // TODO: Get from offlineQueue

    return this.metricsTracker.getMetrics(
      cacheStats.size,
      cacheStats.entries,
      queueSize,
      cacheStats.memoryUsage
    );
  }

  /**
   * Get debug logs
   */
  public getLogs() {
    return this.logger.getLogs();
  }

  /**
   * Enable/disable debug mode
   */
  public setDebugMode(enabled: boolean): void {
    this.logger.setEnabled(enabled);
    this.logger.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Export diagnostic information
   */
  public exportDiagnostics() {
    return {
      config: this.getConfig(),
      metrics: this.getMetrics(),
      logs: this.getLogs(),
      state: {
        auth: useAuthStore.getState(),
        cache: this.cacheManager.getStats(),
      },
    };
  }
}