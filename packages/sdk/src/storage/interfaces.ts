/**
 * Storage adapter interface for local data persistence
 * Provides a unified interface for different storage implementations
 */
export interface StorageAdapter {
  /**
   * Retrieve an item from storage
   * @param key - The storage key
   * @returns The stored value or null if not found
   */
  getItem(key: string): Promise<unknown>;

  /**
   * Store an item in storage
   * @param key - The storage key
   * @param value - The value to store (will be JSON serialized)
   */
  setItem(key: string, value: unknown): Promise<void>;

  /**
   * Remove an item from storage
   * @param key - The storage key
   */
  removeItem(key: string): Promise<void>;

  /**
   * Get all storage keys
   * @returns Array of all keys in storage
   */
  getAllKeys(): Promise<string[]>;

  /**
   * Clear all items from storage
   */
  clear(): Promise<void>;
}

/**
 * Secure storage adapter interface for sensitive data (tokens, credentials)
 * Uses platform-specific secure storage mechanisms
 */
export interface SecureStorageAdapter {
  /**
   * Retrieve a secure item from storage
   * @param key - The storage key
   * @returns The stored value or null if not found
   */
  getItem(key: string): Promise<string | null>;

  /**
   * Store a secure item in storage
   * @param key - The storage key
   * @param value - The value to store (string only for secure storage)
   */
  setItem(key: string, value: string): Promise<void>;

  /**
   * Remove a secure item from storage
   * @param key - The storage key
   */
  removeItem(key: string): Promise<void>;
}
