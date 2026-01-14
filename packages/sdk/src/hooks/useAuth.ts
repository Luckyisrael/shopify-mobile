import { useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import type { AuthSession } from '../stores/authStore';
import { useShopifyClient } from './ShopifyProvider';
import type { LoginRequest, SignupRequest } from '../types';

/**
 * Hook for authentication operations
 * Provides access to auth state and methods for login/logout
 */
export function useAuth() {
  const client = useShopifyClient();
  const { session, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Login with email and password
   */
  const login = useCallback(
    async (credentials: LoginRequest): Promise<AuthSession> => {
      setLoading(true);
      setError(null);

      try {
        const session = await client.authManager.login(credentials);
        return session;
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
   * Sign up a new user
   */
  const signup = useCallback(
    async (credentials: SignupRequest): Promise<AuthSession> => {
      setLoading(true);
      setError(null);

      try {
        const session = await client.authManager.signup(credentials);
        return session;
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
   * Logout current user
   */
  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await client.authManager.logout();
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client]);

  return {
    session,
    isAuthenticated,
    loading,
    error,
    login,
    signup,
    logout,
  };
}
