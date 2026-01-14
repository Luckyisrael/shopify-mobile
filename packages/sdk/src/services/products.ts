import type { AxiosInstance } from 'axios';
import type { Product, Collection, ProductsListRequest } from '../types';
import type { CacheManager } from '../managers/CacheManager';
import type { EventTracker } from '../managers/EventTracker';
import { RequestDeduplicator } from '../managers/RequestDeduplicator';

export class ProductsService {
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
   * List products with pagination and caching
   */
  async list(request?: ProductsListRequest): Promise<{
    products: Product[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor?: string;
    };
  }> {
    const params = new URLSearchParams();
    if (request?.cursor) params.append('cursor', request.cursor);
    if (request?.limit) params.append('limit', request.limit.toString());

    const cacheKey = `products:list:${params.toString()}`;

    // Use cache-first strategy
    if (this.cacheManager) {
      const ttl = this.cacheManager.getTTL('products');
      return this.cacheManager.fetchWithCache(
        cacheKey,
        async () => {
          const response = await this.httpClient.get<{
            products: Product[];
            pageInfo: {
              hasNextPage: boolean;
              endCursor?: string;
            };
          }>(`/api/mobile/products?${params.toString()}`);
          return response.data;
        },
        ttl
      );
    }

    // Fallback without cache
    const response = await this.httpClient.get<{
      products: Product[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor?: string;
      };
    }>(`/api/mobile/products?${params.toString()}`);

    return response.data;
  }

  /**
   * Get a single product by ID with caching and event tracking
   */
  async get(productId: string): Promise<Product> {
    const cacheKey = `products:${productId}`;

    // Deduplicate concurrent requests
    const deduplicateKey = this.deduplicator
      ? RequestDeduplicator.generateKey('GET', `/api/mobile/products/${productId}`)
      : null;

    const fetchProduct = async () => {
      // Use cache-first strategy
      if (this.cacheManager) {
        const ttl = this.cacheManager.getTTL('products');
        const product = await this.cacheManager.fetchWithCache(
          cacheKey,
          async () => {
            const response = await this.httpClient.get<Product>(
              `/api/mobile/products/${productId}`
            );
            return response.data;
          },
          ttl
        );

        // Track product viewed event
        this.eventTracker?.autoTrack('PRODUCT_VIEWED', {
          productId,
          timestamp: Date.now(),
        });

        return product;
      }

      // Fallback without cache
      const response = await this.httpClient.get<Product>(
        `/api/mobile/products/${productId}`
      );

      // Track product viewed event
      this.eventTracker?.autoTrack('PRODUCT_VIEWED', {
        productId,
        timestamp: Date.now(),
      });

      return response.data;
    };

    // Use deduplication if available
    if (this.deduplicator && deduplicateKey) {
      return this.deduplicator.deduplicate(deduplicateKey, fetchProduct);
    }

    return fetchProduct();
  }

  /**
   * Search products with caching
   */
  async search(query: string, limit?: number): Promise<{
    products: Product[];
  }> {
    const params = new URLSearchParams();
    params.append('q', query);
    if (limit) params.append('limit', limit.toString());

    const cacheKey = `products:search:${params.toString()}`;

    // Use cache-first strategy
    if (this.cacheManager) {
      const ttl = this.cacheManager.getTTL('products');
      return this.cacheManager.fetchWithCache(
        cacheKey,
        async () => {
          const response = await this.httpClient.get<{
            products: Product[];
          }>(`/api/mobile/products/search?${params.toString()}`);
          return response.data;
        },
        ttl
      );
    }

    // Fallback without cache
    const response = await this.httpClient.get<{
      products: Product[];
    }>(`/api/mobile/products/search?${params.toString()}`);

    return response.data;
  }

  /**
   * List product collections with caching
   */
  async listCollections(): Promise<{ collections: Collection[] }> {
    const cacheKey = 'collections:list';

    // Use cache-first strategy
    if (this.cacheManager) {
      const ttl = this.cacheManager.getTTL('collections');
      return this.cacheManager.fetchWithCache(
        cacheKey,
        async () => {
          const response = await this.httpClient.get<{ collections: Collection[] }>(
            '/api/mobile/collections'
          );
          return response.data;
        },
        ttl
      );
    }

    // Fallback without cache
    const response = await this.httpClient.get<{ collections: Collection[] }>(
      '/api/mobile/collections'
    );
    return response.data;
  }

  /**
   * Get a single collection by ID with caching
   */
  async getCollection(collectionId: string): Promise<Collection> {
    const cacheKey = `collections:${collectionId}`;

    // Use cache-first strategy
    if (this.cacheManager) {
      const ttl = this.cacheManager.getTTL('collections');
      return this.cacheManager.fetchWithCache(
        cacheKey,
        async () => {
          const response = await this.httpClient.get<Collection>(
            `/api/mobile/collections/${collectionId}`
          );
          return response.data;
        },
        ttl
      );
    }

    // Fallback without cache
    const response = await this.httpClient.get<Collection>(
      `/api/mobile/collections/${collectionId}`
    );
    return response.data;
  }
}
