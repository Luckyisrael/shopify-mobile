import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ShopifyMobileError } from './errors';
import type { ShopifyMobileClientConfig } from './types';
import { AuthService } from './services/auth';
import { ProductsService } from './services/products';
import { CartService } from './services/cart';
import { PushService } from './services/push';
import { EventsService } from './services/events';

export class ShopifyMobileClient {
  private httpClient: AxiosInstance;
  private config: ShopifyMobileClientConfig;

  // Service instances
  public readonly auth: AuthService;
  public readonly products: ProductsService;
  public readonly cart: CartService;
  public readonly push: PushService;
  public readonly events: EventsService;

  constructor(config: ShopifyMobileClientConfig) {
    this.config = config;
    
    // Create HTTP client
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Shop-Domain': config.shopDomain,
      },
    });

    // Add request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        // Add any request modifications here
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        const shopifyError = ShopifyMobileError.fromResponse(error.response);
        
        // Call error handler if provided
        if (this.config.onError) {
          this.config.onError(shopifyError);
        }
        
        return Promise.reject(shopifyError);
      }
    );

    // Initialize services
    this.auth = new AuthService(this.httpClient);
    this.products = new ProductsService(this.httpClient);
    this.cart = new CartService(this.httpClient);
    this.push = new PushService(this.httpClient);
    this.events = new EventsService(this.httpClient);
  }

  /**
   * Make a custom API request
   */
  public async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.httpClient.request(config);
    return response.data;
  }

  /**
   * Update the shop domain for subsequent requests
   */
  public setShopDomain(shopDomain: string): void {
    this.config.shopDomain = shopDomain;
    this.httpClient.defaults.headers['X-Shop-Domain'] = shopDomain;
  }

  /**
   * Get current configuration
   */
  public getConfig(): Readonly<ShopifyMobileClientConfig> {
    return { ...this.config };
  }
}