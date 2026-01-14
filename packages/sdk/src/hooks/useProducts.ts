import { useState, useCallback, useEffect } from 'react';
import { useShopifyClient } from './ShopifyProvider';
import type { Product } from '../types';

export interface UseProductsOptions {
  limit?: number;
  autoLoad?: boolean;
}

/**
 * Hook for loading and managing products
 * Supports pagination and automatic loading
 */
export function useProducts(options: UseProductsOptions = {}) {
  const client = useShopifyClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();

  const { limit = 20, autoLoad = true } = options;

  /**
   * Load products with pagination
   */
  const loadProducts = useCallback(
    async (reset = false) => {
      if (loading) return;

      setLoading(true);
      setError(null);

      try {
        const result = await client.products.list({
          cursor: reset ? undefined : cursor,
          limit,
        });

        setProducts((prev) =>
          reset ? result.products : [...prev, ...result.products]
        );
        setCursor(result.pageInfo.endCursor);
        setHasMore(result.pageInfo.hasNextPage);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    },
    [client, cursor, loading, limit]
  );

  /**
   * Load more products (next page)
   */
  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadProducts(false);
    }
  }, [hasMore, loading, loadProducts]);

  /**
   * Refresh products (reset and reload)
   */
  const refresh = useCallback(() => {
    setCursor(undefined);
    setHasMore(true);
    loadProducts(true);
  }, [loadProducts]);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad) {
      loadProducts(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    products,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
