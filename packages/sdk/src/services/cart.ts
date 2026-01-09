import type { AxiosInstance } from 'axios';
import type { CreateCartRequest, Cart } from '../types';

export class CartService {
  constructor(private httpClient: AxiosInstance) {}

  /**
   * Create a new shopping cart
   */
  async create(request: CreateCartRequest): Promise<Cart> {
    const response = await this.httpClient.post<Cart>(
      '/api/mobile/cart',
      request
    );
    return response.data;
  }
}