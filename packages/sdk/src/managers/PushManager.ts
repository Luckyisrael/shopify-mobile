import type { AxiosInstance } from 'axios';
import type { StorageAdapter } from '../storage/interfaces';

/**
 * Storage key for push token
 */
const PUSH_TOKEN_STORAGE_KEY = 'shopify_push_token';

/**
 * Push notification platform
 */
export type PushPlatform = 'ios' | 'android';

/**
 * Push notification data
 */
export interface PushNotification {
  notificationId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  deepLink?: string;
  buttons?: PushNotificationButton[];
}

/**
 * Push notification button
 */
export interface PushNotificationButton {
  id: string;
  title: string;
  action?: string;
}

/**
 * Deep link data
 */
export interface DeepLinkData {
  type: 'product' | 'collection' | 'highlight' | 'custom';
  id?: string;
  url?: string;
  params?: Record<string, any>;
}

/**
 * PushManager handles push token registration and notification tracking
 */
export class PushManager {
  private storage: StorageAdapter;
  private httpClient: AxiosInstance;
  private currentToken: string | null = null;
  private currentPlatform: PushPlatform | null = null;

  constructor(storage: StorageAdapter, httpClient: AxiosInstance) {
    this.storage = storage;
    this.httpClient = httpClient;
  }

  /**
   * Initialize push manager and restore token from storage
   */
  async initialize(): Promise<void> {
    try {
      const tokenData = await this.storage.getItem(PUSH_TOKEN_STORAGE_KEY);
      if (tokenData) {
        const { token, platform } = JSON.parse(tokenData as string);
        this.currentToken = token;
        this.currentPlatform = platform;
      }
    } catch (error) {
      console.error('PushManager: Error initializing:', error);
    }
  }

  /**
   * Register push token with the server
   */
  async registerToken(token: string, platform: PushPlatform): Promise<void> {
    // Check if token changed
    if (this.currentToken === token && this.currentPlatform === platform) {
      return;
    }

    try {
      await this.httpClient.post('/api/mobile/push/register', {
        token,
        platform,
      });

      // Store token
      await this.storage.setItem(
        PUSH_TOKEN_STORAGE_KEY,
        JSON.stringify({ token, platform })
      );

      this.currentToken = token;
      this.currentPlatform = platform;
    } catch (error) {
      console.error('PushManager: Error registering token:', error);
      throw error;
    }
  }

  /**
   * Unregister push token
   */
  async unregisterToken(): Promise<void> {
    if (!this.currentToken) return;

    try {
      await this.httpClient.post('/api/mobile/push/unregister', {
        token: this.currentToken,
      });

      // Clear stored token
      await this.storage.removeItem(PUSH_TOKEN_STORAGE_KEY);

      this.currentToken = null;
      this.currentPlatform = null;
    } catch (error) {
      console.error('PushManager: Error unregistering token:', error);
      throw error;
    }
  }

  /**
   * Track notification opened event
   */
  async trackNotificationOpened(notificationId: string): Promise<void> {
    try {
      await this.httpClient.post('/api/mobile/notification/opened', {
        notificationId,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('PushManager: Error tracking notification opened:', error);
    }
  }

  /**
   * Track notification clicked event
   */
  async trackNotificationClicked(
    notificationId: string,
    buttonId?: string
  ): Promise<void> {
    try {
      await this.httpClient.post('/api/mobile/notification/clicked', {
        notificationId,
        buttonId,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('PushManager: Error tracking notification clicked:', error);
    }
  }

  /**
   * Parse deep link from notification
   */
  parseDeepLink(url: string): DeepLinkData | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      // Parse based on path structure
      // Example: myapp://product/123
      // Example: myapp://collection/456
      // Example: myapp://highlight/789

      if (pathParts.length === 0) return null;

      const type = pathParts[0] as DeepLinkData['type'];
      const id = pathParts[1];

      // Extract query parameters
      const params: Record<string, any> = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      return {
        type,
        id,
        url,
        params: Object.keys(params).length > 0 ? params : undefined,
      };
    } catch (error) {
      console.error('PushManager: Error parsing deep link:', error);
      return null;
    }
  }

  /**
   * Handle notification received
   */
  async handleNotification(notification: PushNotification): Promise<void> {
    // Track notification opened
    await this.trackNotificationOpened(notification.notificationId);

    // Parse deep link if present
    if (notification.deepLink) {
      const deepLinkData = this.parseDeepLink(notification.deepLink);
      if (deepLinkData) {
        // Emit event for app to handle
        console.log('PushManager: Deep link parsed:', deepLinkData);
        // TODO: Emit event through event emitter
      }
    }
  }

  /**
   * Handle notification button clicked
   */
  async handleNotificationButtonClick(
    notificationId: string,
    buttonId: string
  ): Promise<void> {
    await this.trackNotificationClicked(notificationId, buttonId);
  }

  /**
   * Get current push token
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Get current platform
   */
  getCurrentPlatform(): PushPlatform | null {
    return this.currentPlatform;
  }

  /**
   * Check if push token is registered
   */
  isRegistered(): boolean {
    return this.currentToken !== null;
  }
}
