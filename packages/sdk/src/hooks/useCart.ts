import { useCallback } from 'react';
import { useCartStore } from '../stores/cartStore';
import { useShopifyClient } from './ShopifyProvider';
import type { Cart } from '../types';

/**
 * Hook for cart operations
 * Provides access to cart state and methods for managing cart items
 */
export function useCart() {
  const client = useShopifyClient();
  const { cart, isLoading, error } = useCartStore();

  /**
   * Add item to cart
   */
  const addItem = useCallback(
    async (variantId: string, quantity: number): Promise<Cart> => {
      return client.cartManager.addItem({ variantId, quantity });
    },
    [client]
  );

  /**
   * Remove item from cart
   */
  const removeItem = useCallback(
    async (lineId: string): Promise<Cart> => {
      return client.cartManager.removeItem({ lineId });
    },
    [client]
  );

  /**
   * Update item quantity in cart
   */
  const updateQuantity = useCallback(
    async (lineId: string, quantity: number): Promise<Cart> => {
      return client.cartManager.updateQuantity({ lineId, quantity });
    },
    [client]
  );

  /**
   * Clear all items from cart
   */
  const clear = useCallback(async (): Promise<void> => {
    return client.cartManager.clear();
  }, [client]);

  return {
    cart,
    isLoading,
    error,
    addItem,
    removeItem,
    updateQuantity,
    clear,
  };
}
