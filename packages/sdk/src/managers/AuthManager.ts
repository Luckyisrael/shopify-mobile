import type { AxiosInstance } from 'axios';
import { useAuthStore, type AuthSession } from '../stores/authStore';
import type { SecureStorageAdapter } from '../storage/interfaces';
import { AuthenticationError } from '../errors';

/**
 * Storage key for session data
 */
const SESSION_STORAGE_KEY = 'shopify_session';

/**
 * Login request payload
 */
export interface LoginRequest {
  email: string;
  password: string;
  pushToken?: string;
}

/**
 * Signup request payload
 */
export interface SignupRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  pushToken?: string;
}

/**
 * AuthManager handles authentication state, token refresh, and session persistence
 * Implements automatic token refresh with concurrent request handling
 */
export class AuthManager {
  private secureStorage: SecureStorageAdapter;
  private httpClient: AxiosInstance;
  private refreshPromise: Promise<void> | null = null;

  constructor(secureStorage: SecureStorageAdapter, httpClient: AxiosInstance) {
    this.secureStorage = secureStorage;
    this.httpClient = httpClient;
  }

  /**
   * Initialize auth manager and restore session from secure storage
   */
  async initialize(): Promise<void> {
    try {
      const sessionJson = await this.secureStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionJson) return;

      const session: AuthSession = JSON.parse(sessionJson);

      // Check if session is expired
      if (this.isExpired(session)) {
        // Try to refresh if we have a refresh token
        if (session.refreshToken) {
          try {
            await this.refreshToken();
          } catch (error) {
            // Refresh failed - clear session
            await this.clearSession();
          }
        } else {
          // No refresh token - clear session
          await this.clearSession();
        }
      } else {
        // Session is valid - restore it
        useAuthStore.getState().setSession(session);
      }
    } catch (error) {
      console.error('AuthManager: Error initializing:', error);
      await this.clearSession();
    }
  }

  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest): Promise<AuthSession> {
    try {
      const response = await this.httpClient.post('/api/mobile/auth/login', credentials);
      const session: AuthSession = response.data;

      // Store session in secure storage
      await this.secureStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

      // Update auth store
      useAuthStore.getState().setSession(session);

      return session;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Signup new user
   */
  async signup(data: SignupRequest): Promise<AuthSession> {
    try {
      const response = await this.httpClient.post('/api/mobile/auth/signup', data);
      const session: AuthSession = response.data;

      // Store session in secure storage
      await this.secureStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

      // Update auth store
      useAuthStore.getState().setSession(session);

      return session;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    const session = useAuthStore.getState().session;

    // Call logout API if we have a session
    if (session) {
      try {
        await this.httpClient.post('/api/mobile/auth/logout', {
          accessToken: session.accessToken,
        });
      } catch (error) {
        // Log error but continue with logout
        console.error('AuthManager: Error calling logout API:', error);
      }
    }

    // Clear session
    await this.clearSession();
  }

  /**
   * Refresh access token
   * Handles concurrent refresh requests by returning the same promise
   */
  async refreshToken(): Promise<void> {
    // If refresh is already in progress, return the existing promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start new refresh
    this.refreshPromise = this._doRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Internal method to perform token refresh
   */
  private async _doRefresh(): Promise<void> {
    const session = useAuthStore.getState().session;

    if (!session) {
      throw new AuthenticationError('No session to refresh');
    }

    // Set refreshing state
    useAuthStore.getState().setRefreshing(true);

    try {
      const response = await this.httpClient.post('/api/mobile/auth/refresh', {
        accessToken: session.accessToken,
      });

      const newSession: AuthSession = response.data;

      // Store new session
      await this.secureStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));

      // Update auth store
      useAuthStore.getState().setSession(newSession);
    } catch (error) {
      // Refresh failed - clear session
      await this.clearSession();
      throw new AuthenticationError('Token refresh failed');
    } finally {
      useAuthStore.getState().setRefreshing(false);
    }
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    return useAuthStore.getState().isAuthenticated;
  }

  /**
   * Get current session
   */
  getSession(): AuthSession | null {
    return useAuthStore.getState().session;
  }

  /**
   * Check if session is expired
   */
  private isExpired(session: AuthSession): boolean {
    if (!session.expiresAt) return false;

    const expiresAt = new Date(session.expiresAt).getTime();
    const now = Date.now();

    // Consider expired if within 5 minutes of expiry
    const buffer = 5 * 60 * 1000; // 5 minutes
    return now >= expiresAt - buffer;
  }

  /**
   * Clear session from storage and state
   */
  private async clearSession(): Promise<void> {
    await this.secureStorage.removeItem(SESSION_STORAGE_KEY);
    useAuthStore.getState().setSession(null);
  }
}
