import React, { createContext, useContext, ReactNode } from 'react';
import type { ShopifyMobileClient } from '../client';

interface ShopifyProviderProps {
  client: ShopifyMobileClient;
  children: ReactNode;
}

const ShopifyContext = createContext<ShopifyMobileClient | null>(null);

/**
 * Provider component that makes the SDK client available to all hooks
 */
export function ShopifyProvider({ client, children }: ShopifyProviderProps) {
  return (
    <ShopifyContext.Provider value={client}>
      {children}
    </ShopifyContext.Provider>
  );
}

/**
 * Hook to access the SDK client instance
 * @throws Error if used outside of ShopifyProvider
 */
export function useShopifyClient(): ShopifyMobileClient {
  const client = useContext(ShopifyContext);
  
  if (!client) {
    throw new Error(
      'useShopifyClient must be used within a ShopifyProvider. ' +
      'Wrap your app with <ShopifyProvider client={client}>'
    );
  }
  
  return client;
}
