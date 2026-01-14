# Phase 3 Complete: Offline Support & Caching

**Date**: January 14, 2026  
**Status**: ✅ Complete

---

## Summary

Phase 3 implementation is complete. We've successfully implemented offline request queuing with automatic processing when connectivity is restored, TTL-based caching with persistence, and request deduplication to prevent duplicate concurrent requests.

---

## Completed Tasks

### Task 11: OfflineQueue ✅

**Implementation**: `packages/sdk/src/managers/OfflineQueue.ts`

**Features**:
- Request queuing when offline with priority system
- Automatic queue processing when connectivity is restored
- NetInfo integration for connectivity detection
- Configurable queueable endpoints whitelist
- Retry logic with max retries (default: 3)
- Queue persistence to storage
- Queue size limit (default: 100 requests)

**Priority System**:
```typescript
enum QueuePriority {
  HIGH = 3,    // Auth, critical operations
  NORMAL = 2,  // Cart, preferences
  LOW = 1,     // Events, analytics
}
```

**Queueable Endpoints** (default):
- `/api/mobile/events`
- `/api/mobile/cart`
- `/api/mobile/preferences`
- `/api/mobile/notification/opened`
- `/api/mobile/notification/clicked`

**Key Methods**:
- `initialize()` - Restores queue from storage, sets up NetInfo listener
- `enqueue(request)` - Adds request to queue with priority
- `processQueue()` - Processes all queued requests in priority order
- `isQueueable(url)` - Checks if URL should be queued
- `getQueueSize()` - Returns number of queued requests
- `clearQueue()` - Clears all queued requests
- `cleanup()` - Unsubscribes from NetInfo events

**Queue Processing**:
1. Sort by priority (HIGH → NORMAL → LOW)
2. Within same priority, sort by timestamp (oldest first)
3. Execute requests sequentially
4. Remove successful requests
5. Retry failed requests up to max retries
6. Persist queue after each operation

**Integration**:
- Integrated into `ShopifyMobileClient` as `offlineQueue` property
- Automatically initialized during SDK initialization
- NetInfo listener automatically processes queue when online
- Cleanup method called when SDK is destroyed

---

### Task 12: CacheManager ✅

**Implementation**: `packages/sdk/src/managers/CacheManager.ts`

**Features**:
- TTL-based caching with configurable timeouts
- Cache persistence to storage
- Automatic expiry checking
- Cache invalidation (single key, pattern, all)
- Cache-first fetch strategy
- Stale-while-revalidate (SWR) strategy
- Resource-specific TTL configuration
- Cache statistics

**Default TTL Configuration**:
```typescript
{
  defaultTTL: 5 * 60 * 1000,        // 5 minutes
  products: 10 * 60 * 1000,         // 10 minutes
  collections: 15 * 60 * 1000,      // 15 minutes
  highlights: 5 * 60 * 1000,        // 5 minutes
  preferences: 30 * 60 * 1000,      // 30 minutes
  config: 60 * 60 * 1000,           // 1 hour
  maxCacheSize: 50 * 1024 * 1024,   // 50MB
  persistCache: true
}
```

**Key Methods**:
- `initialize()` - Restores cache from storage, removes expired entries
- `get<T>(key)` - Gets cached data, returns null if expired
- `set<T>(key, data, ttl?)` - Sets cached data with optional TTL
- `invalidate(key)` - Removes single cache entry
- `invalidatePattern(pattern)` - Removes entries matching pattern (e.g., "user:*")
- `clear()` - Clears all cache
- `getTTL(resourceType)` - Gets TTL for resource type
- `fetchWithCache<T>(key, fetcher, ttl?)` - Cache-first fetch
- `fetchWithSWR<T>(key, fetcher, ttl?)` - Stale-while-revalidate fetch
- `getStats()` - Returns cache size and entry count

**Cache-First Strategy**:
1. Check cache
2. If cached and not expired, return immediately
3. If not cached or expired, fetch fresh data
4. Update cache with fresh data
5. Return fresh data

**Stale-While-Revalidate Strategy**:
1. Check cache (even if expired)
2. If cached, return immediately
3. Fetch fresh data in background
4. Update cache with fresh data
5. Next request gets fresh data

**Integration**:
- Integrated into `ShopifyMobileClient` as `cacheManager` property
- Uses `CacheStore` (Zustand) for reactive state management
- Automatically initialized during SDK initialization
- Cache keys prefixed with `shopify_cache:`

---

### Task 13: RequestDeduplicator ✅

**Implementation**: `packages/sdk/src/managers/RequestDeduplicator.ts`

**Features**:
- Prevents duplicate concurrent requests
- Returns same promise for identical requests
- Automatic cleanup after completion
- Key generation from request parameters
- Pending request tracking

**Key Methods**:
- `deduplicate<T>(key, request)` - Deduplicates request by key
- `generateKey(method, url, params?)` - Generates cache key (static)
- `clear()` - Clears all pending requests
- `getPendingCount()` - Returns number of pending requests

**How It Works**:
1. Generate unique key from request parameters
2. Check if request with same key is pending
3. If pending, return existing promise
4. If not pending, execute request and track promise
5. Clean up after completion or error

**Usage Example**:
```typescript
const key = RequestDeduplicator.generateKey('GET', '/api/products', { id: '123' });
const product = await deduplicator.deduplicate(key, () => 
  httpClient.get('/api/products/123')
);
```

**Integration**:
- Integrated into `ShopifyMobileClient` as `requestDeduplicator` property
- Ready for use in ProductsService and HighlightsService
- Prevents thundering herd problem

---

## File Structure

```
packages/sdk/src/
├── managers/
│   ├── AuthManager.ts           ✅ Phase 2
│   ├── CartManager.ts           ✅ Phase 2
│   ├── OfflineQueue.ts          ✅ New - Offline request queuing
│   ├── CacheManager.ts          ✅ New - TTL-based caching
│   ├── RequestDeduplicator.ts   ✅ New - Request deduplication
│   └── index.ts                 ✅ Enhanced - All manager exports
├── client.ts                    ✅ Enhanced - Added new managers
└── stores/
    └── cacheStore.ts            ✅ Used by CacheManager
```

---

## Integration Example

```typescript
import { ShopifyMobileClient } from '@shopify-mobile-platform/sdk';
import { AsyncStorageAdapter } from '@shopify-mobile-platform/sdk/storage';
import { SecureStoreAdapter } from '@shopify-mobile-platform/sdk/storage';

// Create SDK instance
const client = new ShopifyMobileClient({
  baseUrl: 'https://api.example.com',
  shopDomain: 'myshop.myshopify.com',
  storage: new AsyncStorageAdapter(),
  secureStorage: new SecureStoreAdapter(),
});

// Initialize SDK (restores session, cart, queue, and cache)
await client.initialize();

// Use OfflineQueue
const queueSize = client.offlineQueue.getQueueSize();
console.log(`Queued requests: ${queueSize}`);

// Use CacheManager
const products = await client.cacheManager.fetchWithCache(
  'products:list',
  () => client.products.list(),
  client.cacheManager.getTTL('products')
);

// Use RequestDeduplicator
const key = RequestDeduplicator.generateKey('GET', '/api/products/123');
const product = await client.requestDeduplicator.deduplicate(key, () =>
  client.products.get('123')
);

// Cleanup when done
client.cleanup();
```

---

## Storage Strategy

### Offline Queue Storage
- **Key**: `shopify_offline_queue`
- **Data**: Array of QueuedRequest
- **Adapter**: AsyncStorageAdapter
- **Purpose**: Persist queued requests across app restarts

### Cache Storage
- **Key Pattern**: `shopify_cache:{key}`
- **Data**: CacheEntry<T> (data, timestamp, ttl)
- **Adapter**: AsyncStorageAdapter
- **Purpose**: Persist cached data across app restarts

---

## Connectivity Handling

### NetInfo Integration
- OfflineQueue listens to NetInfo connectivity changes
- Automatically processes queue when connectivity is restored
- Unsubscribes from events during cleanup

### Offline Flow
1. User makes request while offline
2. Check if endpoint is queueable
3. If queueable, add to offline queue
4. Persist queue to storage
5. When connectivity restored, process queue automatically

---

## Cache Strategies

### Cache-First (fetchWithCache)
**Best for**: Data that doesn't change frequently
- Products, collections, configuration

**Flow**:
1. Check cache → Return if valid
2. Fetch from API → Update cache → Return

### Stale-While-Revalidate (fetchWithSWR)
**Best for**: Data that changes but stale data is acceptable
- User preferences, highlights, recommendations

**Flow**:
1. Check cache → Return immediately (even if stale)
2. Fetch from API in background → Update cache
3. Next request gets fresh data

---

## Performance Benefits

### Request Deduplication
- Prevents duplicate API calls
- Reduces server load
- Improves response time
- Saves bandwidth

### Caching
- Instant data access from cache
- Reduced API calls
- Lower latency
- Offline data availability

### Offline Queue
- Seamless offline experience
- No lost operations
- Automatic synchronization
- Priority-based processing

---

## Testing Status

- ✅ TypeScript compilation successful (strict mode)
- ✅ Zero diagnostics errors
- ✅ Build passing
- ⏭️ Unit tests optional (marked with * in tasks)

---

## Next Steps: Phase 4 - Event Tracking & Push Notifications

**Tasks**:
- Task 15: Implement EventTracker
- Task 16: Implement PushManager
- Task 17: Integrate auto-tracking with services
- Task 18: Checkpoint

**Estimated Time**: Week 4

---

## Notes

- OfflineQueue uses NetInfo for connectivity detection
- CacheManager supports both cache-first and SWR strategies
- RequestDeduplicator prevents thundering herd problem
- All managers are automatically initialized during SDK initialization
- Cleanup method should be called when SDK is destroyed
- Cache keys are prefixed to avoid collisions
- Queue is sorted by priority and timestamp before processing
- Expired cache entries are automatically removed during initialization

---

**Phase 3 Status**: ✅ Complete  
**Build Status**: ✅ Passing  
**Ready for Phase 4**: ✅ Yes
