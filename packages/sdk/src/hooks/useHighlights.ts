import { useState, useCallback, useEffect } from 'react';
import { useShopifyClient } from './ShopifyProvider';
import type { Highlight } from '../types';

/**
 * Hook for loading and tracking highlights
 * Automatically loads highlights on mount
 */
export function useHighlights() {
  const client = useShopifyClient();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load highlights from API
   */
  const loadHighlights = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await client.highlights.list();
      setHighlights(result.highlights);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [client]);

  /**
   * Track highlight view
   */
  const trackView = useCallback(
    (highlightId: string) => {
      client.highlights.trackView(highlightId);
    },
    [client]
  );

  /**
   * Track highlight click
   */
  const trackClick = useCallback(
    (highlightId: string, deepLink?: string) => {
      client.highlights.trackClick(highlightId, deepLink);
    },
    [client]
  );

  /**
   * Track highlight conversion
   */
  const trackConversion = useCallback(
    (highlightId: string, conversionData?: Record<string, any>) => {
      client.highlights.trackConversion(highlightId, conversionData);
    },
    [client]
  );

  // Auto-load on mount
  useEffect(() => {
    loadHighlights();
  }, [loadHighlights]);

  return {
    highlights,
    loading,
    error,
    trackView,
    trackClick,
    trackConversion,
    refresh: loadHighlights,
  };
}
