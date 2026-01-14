import { useState, useCallback, useEffect } from 'react';
import { useShopifyClient } from './ShopifyProvider';
import type { UserPreferences } from '../types';

/**
 * Hook for loading and updating user preferences
 * Automatically loads preferences on mount
 */
export function usePreferences() {
  const client = useShopifyClient();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load preferences from API
   */
  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const prefs = await client.preferences.get();
      setPreferences(prefs);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [client]);

  /**
   * Update preferences (partial update)
   */
  const updatePreferences = useCallback(
    async (updates: Partial<UserPreferences>): Promise<UserPreferences> => {
      setLoading(true);
      setError(null);

      try {
        const prefs = await client.preferences.update(updates);
        setPreferences(prefs);
        return prefs;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  /**
   * Bulk update preferences (full replacement)
   */
  const bulkUpdate = useCallback(
    async (updates: Partial<UserPreferences>): Promise<UserPreferences> => {
      setLoading(true);
      setError(null);

      try {
        const prefs = await client.preferences.bulkUpdate(updates);
        setPreferences(prefs);
        return prefs;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  // Auto-load on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    bulkUpdate,
    refresh: loadPreferences,
  };
}
