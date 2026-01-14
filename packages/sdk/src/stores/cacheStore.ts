import { create } from 'zustand';

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Cache store state
 */
export interface CacheState {
  cache: Record<string, CacheEntry>;
  setCache: (key: string, entry: CacheEntry) => void;
  removeCache: (key: string) => void;
  clearCache: () => void;
}

/**
 * Zustand store for cache state
 * Manages cached data with TTL (time-to-live)
 */
export const useCacheStore = create<CacheState>((set) => ({
  cache: {},
  setCache: (key, entry) =>
    set((state) => ({
      cache: { ...state.cache, [key]: entry },
    })),
  removeCache: (key) =>
    set((state) => {
      const { [key]: _, ...rest } = state.cache;
      return { cache: rest };
    }),
  clearCache: () => set({ cache: {} }),
}));
