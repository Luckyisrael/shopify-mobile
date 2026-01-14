import type * as SecureStore from 'expo-secure-store';
import type { SecureStorageAdapter } from './interfaces';

/**
 * Secure storage adapter implementation using Expo SecureStore
 * Uses platform-specific secure storage (Keychain on iOS, EncryptedSharedPreferences on Android)
 */
export class SecureStoreAdapter implements SecureStorageAdapter {
  constructor(private secureStore: typeof SecureStore) {}

  async getItem(key: string): Promise<string | null> {
    try {
      return await this.secureStore.getItemAsync(key);
    } catch (error) {
      console.error(`SecureStoreAdapter: Error getting item "${key}":`, error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await this.secureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`SecureStoreAdapter: Error setting item "${key}":`, error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await this.secureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`SecureStoreAdapter: Error removing item "${key}":`, error);
      throw error;
    }
  }
}
