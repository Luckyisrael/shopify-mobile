import type AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorageAdapter } from './interfaces';

/**
 * Storage adapter implementation using React Native AsyncStorage
 * Handles JSON serialization/deserialization automatically
 */
export class AsyncStorageAdapter implements StorageAdapter {
  constructor(private storage: typeof AsyncStorage) {}

  async getItem(key: string): Promise<unknown> {
    try {
      const value = await this.storage.getItem(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value);
    } catch (error) {
      console.error(`AsyncStorageAdapter: Error getting item "${key}":`, error);
      return null;
    }
  }

  async setItem(key: string, value: unknown): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.storage.setItem(key, serialized);
    } catch (error) {
      console.error(`AsyncStorageAdapter: Error setting item "${key}":`, error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await this.storage.removeItem(key);
    } catch (error) {
      console.error(`AsyncStorageAdapter: Error removing item "${key}":`, error);
      throw error;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      return await this.storage.getAllKeys();
    } catch (error) {
      console.error('AsyncStorageAdapter: Error getting all keys:', error);
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      await this.storage.clear();
    } catch (error) {
      console.error('AsyncStorageAdapter: Error clearing storage:', error);
      throw error;
    }
  }
}
