// Core types for the SDK
export interface ShopifyMobileClientConfig {
  baseUrl: string;
  shopDomain: string;
  timeout?: number;
  retries?: number;
  onError?: (error: any) => void;
}

export interface AuthSession {
  success: boolean;
  customer: Customer;
  accessToken: string;
  expiresAt: string;
}

export interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
}

export interface Product {
  id: string;
  title: string;
  availableForSale: boolean;
  images: ProductImage[];
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
}

export interface ProductImage {
  url: string;
  altText?: string;
}

export interface Collection {
  id: string;
  title: string;
  description?: string;
  image?: string;
  previewProducts: Product[];
}

export interface Cart {
  cartId: string;
  checkoutUrl: string;
  quantity: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Request types
export interface LoginRequest {
  email: string;
  password: string;
  pushToken?: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  autoLogin?: boolean;
  pushToken?: string;
}

export interface RefreshRequest {
  accessToken: string;
}

export interface LogoutRequest {
  accessToken: string;
  pushToken?: string;
}

export interface CreateCartRequest {
  variantId: string;
  quantity: number;
  customerAccessToken?: string;
}

export interface RegisterPushRequest {
  token: string;
  platform: 'ios' | 'android';
}

export interface TrackEventRequest {
  eventType: string;
  payload: Record<string, any>;
  customerAccessToken?: string;
}

export interface ProductsListRequest {
  cursor?: string;
  limit?: number;
}