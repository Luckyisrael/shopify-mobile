import type { AxiosInstance } from 'axios';
import { useCartStore, type Cart } from '../stores/cartStore';
import type { StorageAdapter } from '../storage/interfaces';
import type { EventTracker } from './EventTracker';

/**
 * Storage key for cart data
 */
const CART_STORAGE_KEY = 'shopify_cart';

/**
 * Cart abandonment timeout (30 minutes)
 */
const ABANDONMENT_TIMEOUT = 30 * 60 * 1000;

/**
 * Cart operation for offline queue
 */
interface CartOperation {
  type: 'add' | 'remove' | 'update' | 'clear';
  variantId?: string;
  quantity?: number;
  lineId?: string;
  timestamp: number;
}

/**
 * Add item request
 */
export interface AddItemRequest {
  variantId: string;
  quantity: number;
  customerAccessToken?: string;
}

/**
 * Update item request
 */
export interface UpdateItemRequest {
  lineId: string;
  quantity: number;
  customerAccessToken?: string;
}

/**
 * Remove item request
 */
export interface RemoveItemRequest {
  lineId: string;
  customerAccessToken?: string;
}

/**
 * CartManager handles cart state, persistence, and synchronization
 * Implements optimistic updates and abandonment tracking
 */
export class CartManager {
  private storage: StorageAdapter;
  private httpClient: AxiosInstance;
  private eventTracker?: EventTracker;
  private abandonmentTimer: NodeJS.Timeout | null = null;
  private syncQueue: CartOperation[] = [];

  constructor(storage: StorageAdapter, httpClient: AxiosInstance, eventTracker?: EventTracker) {
    this.storage = storage;
    this.httpClient = httpClient;
    this.eventTracker = eventTracker;
  }

  /**
   * Initialize cart manager and restore cart from storage
   */
  async initialize(): Promise<void> {
    try {
      const cartJson = await this.storage.getItem(CART_STORAGE_KEY);
      if (!cartJson) return;

      const cart: Cart = JSON.parse(cartJson as string);
      useCartStore.getState().setCart(cart);

      // Start abandonment timer if cart has items
      if (cart.quantity > 0) {
        this.startAbandonmentTimer();
      }
    } catch (error) {
      console.error('CartManager: Error initializing:', error);
    }
  }

  /**
   * Add item to cart with optimistic update
   */
  async addItem(request: AddItemRequest): Promise<Cart> {
    const currentCart = useCartStore.getState().cart;

    // Calculate optimistic cart state
    const optimisticCart: Cart = currentCart
      ? {
          ...currentCart,
          quantity: currentCart.quantity + request.quantity,
        }
      : {
          cartId: 'temp',
          checkoutUrl: '',
          quantity: request.quantity,
        };

    // Update store immediately (optimistic)
    useCartStore.getState().setCart(optimisticCart);
    useCartStore.getState().setLoading(true);

    try {
      // Make API call
      const response = await this.httpClient.post('/api/mobile/cart', request);
      const cart: Cart = response.data;

      // Update with real data
      await this.persistCart(cart);
      useCartStore.getState().setCart(cart);
      useCartStore.getState().setError(null);

      // Reset abandonment timer
      this.startAbandonmentTimer();

      // Track cart updated event
      this.eventTracker?.autoTrack('CART_UPDATED', {
        cartId: cart.cartId,
        quantity: cart.quantity,
        action: 'add',
      });

      return cart;
    } catch (error) {
      // Revert optimistic update
      useCartStore.getState().setCart(currentCart);
      useCartStore.getState().setError(error as Error);
      throw error;
    } finally {
      useCartStore.getState().setLoading(false);
    }
  }

  /**
   * Update item quantity in cart
   */
  async updateQuantity(request: UpdateItemRequest): Promise<Cart> {
    const currentCart = useCartStore.getState().cart;
    if (!currentCart) {
      throw new Error('No cart to update');
    }

    useCartStore.getState().setLoading(true);

    try {
      const response = await this.httpClient.put('/api/mobile/cart', request);
      const cart: Cart = response.data;

      await this.persistCart(cart);
      useCartStore.getState().setCart(cart);
      useCartStore.getState().setError(null);

      // Reset abandonment timer
      this.startAbandonmentTimer();

      // Track cart updated event
      this.eventTracker?.autoTrack('CART_UPDATED', {
        cartId: cart.cartId,
        quantity: cart.quantity,
        action: 'update',
      });

      return cart;
    } catch (error) {
      useCartStore.getState().setError(error as Error);
      throw error;
    } finally {
      useCartStore.getState().setLoading(false);
    }
  }

  /**
   * Remove item from cart
   */
  async removeItem(request: RemoveItemRequest): Promise<Cart> {
    const currentCart = useCartStore.getState().cart;
    if (!currentCart) {
      throw new Error('No cart to remove from');
    }

    useCartStore.getState().setLoading(true);

    try {
      const response = await this.httpClient.delete('/api/mobile/cart', {
        data: request,
      });
      const cart: Cart = response.data;

      await this.persistCart(cart);
      useCartStore.getState().setCart(cart);
      useCartStore.getState().setError(null);

      // Reset or cancel abandonment timer
      if (cart.quantity > 0) {
        this.startAbandonmentTimer();
      } else {
        this.cancelAbandonmentTimer();
      }

      // Track cart updated event
      this.eventTracker?.autoTrack('CART_UPDATED', {
        cartId: cart.cartId,
        quantity: cart.quantity,
        action: 'remove',
      });

      return cart;
    } catch (error) {
      useCartStore.getState().setError(error as Error);
      throw error;
    } finally {
      useCartStore.getState().setLoading(false);
    }
  }

  /**
   * Clear cart
   */
  async clear(): Promise<void> {
    useCartStore.getState().setLoading(true);

    try {
      const cart = useCartStore.getState().cart;
      if (cart) {
        await this.httpClient.delete(`/api/mobile/cart/${cart.cartId}`);
      }

      await this.storage.removeItem(CART_STORAGE_KEY);
      useCartStore.getState().setCart(null);
      useCartStore.getState().setError(null);

      this.cancelAbandonmentTimer();
    } catch (error) {
      useCartStore.getState().setError(error as Error);
      throw error;
    } finally {
      useCartStore.getState().setLoading(false);
    }
  }

  /**
   * Get current cart
   */
  getCart(): Cart | null {
    return useCartStore.getState().cart;
  }

  /**
   * Synchronize queued operations (for offline support)
   */
  async sync(): Promise<void> {
    if (this.syncQueue.length === 0) return;

    // Process queue in order
    while (this.syncQueue.length > 0) {
      const operation = this.syncQueue.shift();
      if (!operation) continue;

      try {
        await this.executeOperation(operation);
      } catch (error) {
        console.error('CartManager: Error syncing operation:', error);
        // Re-queue on failure
        this.syncQueue.unshift(operation);
        break;
      }
    }
  }

  /**
   * Queue operation for offline processing
   */
  queueOperation(operation: Omit<CartOperation, 'timestamp'>): void {
    this.syncQueue.push({
      ...operation,
      timestamp: Date.now(),
    });
  }

  /**
   * Execute a queued operation
   */
  private async executeOperation(operation: CartOperation): Promise<void> {
    switch (operation.type) {
      case 'add':
        if (operation.variantId && operation.quantity) {
          await this.addItem({
            variantId: operation.variantId,
            quantity: operation.quantity,
          });
        }
        break;
      case 'update':
        if (operation.lineId && operation.quantity !== undefined) {
          await this.updateQuantity({
            lineId: operation.lineId,
            quantity: operation.quantity,
          });
        }
        break;
      case 'remove':
        if (operation.lineId) {
          await this.removeItem({
            lineId: operation.lineId,
          });
        }
        break;
      case 'clear':
        await this.clear();
        break;
    }
  }

  /**
   * Persist cart to storage
   */
  private async persistCart(cart: Cart): Promise<void> {
    await this.storage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }

  /**
   * Start abandonment timer
   */
  private startAbandonmentTimer(): void {
    // Cancel existing timer
    this.cancelAbandonmentTimer();

    // Start new timer
    this.abandonmentTimer = setTimeout(() => {
      this.handleCartAbandonment();
    }, ABANDONMENT_TIMEOUT);
  }

  /**
   * Cancel abandonment timer
   */
  private cancelAbandonmentTimer(): void {
    if (this.abandonmentTimer) {
      clearTimeout(this.abandonmentTimer);
      this.abandonmentTimer = null;
    }
  }

  /**
   * Handle cart abandonment event
   */
  private handleCartAbandonment(): void {
    const cart = useCartStore.getState().cart;
    if (!cart || cart.quantity === 0) return;

    // Track cart abandoned event
    this.eventTracker?.autoTrack('CART_ABANDONED', {
      cartId: cart.cartId,
      quantity: cart.quantity,
    });
  }
}
