import type { AxiosInstance } from 'axios';
import type { Product, Collection, ProductsListRequest } from '../types';

export class ProductsService {
  constructor(private httpClient: AxiosInstance) {}

  /**
   * List products with pagination
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
   * List product collections
   */
  async listCollections(): Promise<{ collections: Collection[] }> {
    const response = await this.httpClient.get<{ collections: Collection[] }>(
      '/api/mobile/collections'
    );
    return response.data;
  }
}