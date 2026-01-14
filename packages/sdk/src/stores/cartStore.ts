import { create } from 'zustand';

/**
 * Shopping cart data
 */
export interface Cart {
  cartId: string;
  checkoutUrl: string;
  quantity: number;
  items?: CartItem[];
  totalAmount?: string;
  currencyCode?: string;
}

/**
 * Cart item data
 */
export interface CartItem {
  id: string;
  variantId: string;
  productId: string;
  title: string;
  quantity: number;
  price: string;
  imageUrl?: string;
}

/**
 * Cart store state
 */
export interface CartState {
  cart: Cart | null;
  isLoading: boolean;
  error: Error | null;
  setCart: (cart: Cart | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: Error | null) => void;
}

/**
 * Zustand store for cart state
 * Manages shopping cart data, loading state, and errors
 */
export const useCartStore = create<CartState>((set) => ({
  cart: null,
  isLoading: false,
  error: null,
  setCart: (cart) => set({ cart }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
