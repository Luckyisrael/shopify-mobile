import { create } from 'zustand';

/**
 * Authentication session data
 */
export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  customer: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Authentication store state
 */
export interface AuthState {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isRefreshing: boolean;
  setSession: (session: AuthSession | null) => void;
  setRefreshing: (isRefreshing: boolean) => void;
}

/**
 * Zustand store for authentication state
 * Manages user session, authentication status, and token refresh state
 */
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isAuthenticated: false,
  isRefreshing: false,
  setSession: (session) =>
    set({
      session,
      isAuthenticated: !!session,
    }),
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
}));
