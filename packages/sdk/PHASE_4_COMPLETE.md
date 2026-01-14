# Phase 4 Complete: Event Tracking & Push Notifications

**Date**: January 14, 2026  
**Status**: ✅ Complete

---

## Summary

Phase 4 implementation is complete. We've successfully implemented event tracking with batching and offline support, push notification management with deep link handling, and integrated auto-tracking throughout the SDK for cart operations and app lifecycle events.

---

## Completed Tasks

### Task 15: EventTracker ✅

**Implementation**: `packages/sdk/src/managers/EventTracker.ts`

**Features**:
- Event batching with configurable batch size (default: 10 events)
- Automatic flush on batch size or timer (default: 30 seconds)
- Event persistence to storage for offline support
- Auto-tracking with configurable disabled events
- Batch restoration on initialization

**Configuration**:
```typescript
{
  batchSize: 10,
  flushInterval: 30000, // 30 seconds
  autoTrackEnabled: true,
  disabledEvents: []
}
```

**Auto-Tracked Events**:
- `APP_OPENED` - When SDK initializes
- `PRODUCT_VIEWED` - When product is viewed
- `CART_UPDATED` - When cart is modified
- `CART_ABANDONED` - When cart is abandoned (30 min timer)
- `CHECKOUT_STARTED` - When checkout begins
- `HIGHLIGHT_VIEWED` - When highlight is viewed
- `HIGHLIGHT_CLICKED` - When highlight is clicked

**Key Methods**:
- `initialize()` - Restores event batch from storage
- `track(eventType, payload)` - Tracks an event
- `autoTrack(eventType, payload)` - Tracks event if auto-tracking enabled
- `flush()` - Sends all batched events to API
- `getBatchSize()` - Returns current batch size
- `clearBatch()` - Clears all pending events
- `cleanup()` - Flushes remaining events before shutdown

**Batching Flow**:
1. Event is tracked
2. Added to batch
3. If batch size reached → flush immediately
4. Otherwise → schedule flush timer
5. On flush → send to API
6. On success → clear batch
7. On failure → re-add to batch and persist

**Integration**:
- Integrated into `ShopifyMobileClient` as `eventTracker` property
- Automatically initialized during SDK initialization
- Tracks `APP_OPENED` event on initialization
- Cleanup method flushes remaining events

---

### Task 16: PushManager ✅

**Implementation**: `packages/sdk/src/managers/PushManager.ts`

**Features**:
- Push token registration with change detection
- Token persistence to storage
- Notification tracking (opened, clicked)
- Deep link parsing and handling
- Rich notification support (images, buttons)
- Platform-specific handling (iOS/Android)

**Key Methods**:
- `initialize()` - Restores push token from storage
- `registerToken(token, platform)` - Registers push token with server
- `unregisterToken()` - Unregisters push token
- `trackNotificationOpened(notificationId)` - Tracks notification opened
- `trackNotificationClicked(notificationId, buttonId?)` - Tracks notification clicked
- `parseDeepLink(url)` - Parses deep link URL
- `handleNotification(notification)` - Handles incoming notification
- `handleNotificationButtonClick(notificationId, buttonId)` - Handles button click
- `getCurrentToken()` - Returns current push token
- `getCurrentPlatform()` - Returns current platform
- `isRegistered()` - Checks if token is registered

**Deep Link Parsing**:
Supports URL patterns like:
- `myapp://product/123`
- `myapp://collection/456`
- `myapp://highlight/789`
- `myapp://custom?param=value`

Returns structured data:
```typescript
{
  type: 'product' | 'collection' | 'highlight' | 'custom',
  id: '123',
  url: 'myapp://product/123',
  params: { key: 'value' }
}
```

**Rich Notifications**:
```typescript
{
  notificationId: string,
  title: string,
  body: string,
  data?: Record<string, any>,
  imageUrl?: string,
  deepLink?: string,
  buttons?: [
    { id: string, title: string, action?: string }
  ]
}
```

**Integration**:
- Integrated into `ShopifyMobileClient` as `pushManager` property
- Automatically initialized during SDK initialization
- Token stored in local storage with platform info

---

### Task 17: Auto-Tracking Integration ✅

**CartManager Integration**:
- Tracks `CART_UPDATED` on add, update, remove operations
- Tracks `CART_ABANDONED` when 30-minute timer expires
- Includes cart details (cartId, quantity, action)

**SDK Initialization**:
- Tracks `APP_OPENED` when SDK initializes
- Includes timestamp

**ProductsService** (Ready for integration):
- Can track `PRODUCT_VIEWED` when product is fetched
- Requires ProductsService enhancement in Phase 5

---

## File Structure

```
packages/sdk/src/
├── managers/
│   ├── AuthManager.ts           ✅ Phase 2
│   ├── CartManager.ts           ✅ Enhanced - Auto-tracking integration
│   ├── OfflineQueue.ts          ✅ Phase 3
│   ├── CacheManager.ts          ✅ Phase 3
│   ├── RequestDeduplicator.ts   ✅ Phase 3
│   ├── EventTracker.ts          ✅ New - Event tracking with batching
│   ├── PushManager.ts           ✅ New - Push notification management
│   └── index.ts                 ✅ Enhanced - All manager exports
└── client.ts                    ✅ Enhanced - EventTracker & PushManager integration
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

// Initialize SDK (tracks APP_OPENED automatically)
await client.initialize();

// Track custom events
await client.eventTracker.track('CUSTOM_EVENT', {
  userId: '123',
  action: 'button_click',
});

// Register push token
await client.pushManager.registerToken('push-token-123', 'ios');

// Handle notification
await client.pushManager.handleNotification({
  notificationId: 'notif-123',
  title: 'New Product!',
  body: 'Check out our latest product',
  deepLink: 'myapp://product/456',
});

// Parse deep link
const deepLinkData = client.pushManager.parseDeepLink('myapp://product/456');
// { type: 'product', id: '456', url: '...', params: undefined }

// Flush events manually
await client.eventTracker.flush();

// Cleanup when done
await client.cleanup();
```

---

## Storage Strategy

### Event Batch Storage
- **Key**: `shopify_event_batch`
- **Data**: Array of TrackedEvent
- **Adapter**: AsyncStorageAdapter
- **Purpose**: Persist events for offline support

### Push Token Storage
- **Key**: `shopify_push_token`
- **Data**: { token: string, platform: 'ios' | 'android' }
- **Adapter**: AsyncStorageAdapter
- **Purpose**: Persist push token across app restarts

---

## Event Tracking Flow

### Manual Tracking
```typescript
client.eventTracker.track('CUSTOM_EVENT', { data: 'value' });
```

### Auto-Tracking
```typescript
// Automatically tracked by CartManager
await client.cartManager.addItem({ variantId: '123', quantity: 1 });
// → Tracks CART_UPDATED event

// Automatically tracked on SDK init
await client.initialize();
// → Tracks APP_OPENED event
```

### Batching & Flushing
1. Events accumulate in batch
2. Flush triggers when:
   - Batch size reaches limit (10 events)
   - Timer expires (30 seconds)
   - Manual flush called
   - SDK cleanup called
3. Events sent to `/api/mobile/events`
4. On success → batch cleared
5. On failure → batch persisted for retry

---

## Push Notification Flow

### Registration
```typescript
// Register token
await client.pushManager.registerToken('token', 'ios');
// → Calls /api/mobile/push/register
// → Stores token in storage
```

### Notification Received
```typescript
// Handle notification
await client.pushManager.handleNotification(notification);
// → Tracks notification opened
// → Parses deep link
// → Emits event for app to handle
```

### Button Click
```typescript
// Handle button click
await client.pushManager.handleNotificationButtonClick('notif-123', 'button-1');
// → Tracks notification clicked with button ID
```

---

## Performance Benefits

### Event Batching
- Reduces API calls (10 events → 1 request)
- Lower network overhead
- Better battery life
- Offline support with persistence

### Auto-Tracking
- No manual tracking code needed
- Consistent event tracking
- Reduced developer effort
- Comprehensive analytics

### Push Notifications
- Efficient token management
- Deep link support for navigation
- Rich notification support
- Platform-agnostic API

---

## Testing Status

- ✅ TypeScript compilation successful (strict mode)
- ✅ Zero diagnostics errors
- ✅ Build passing
- ⏭️ Unit tests optional (marked with * in tasks)

---

## Next Steps: Phase 5 - Enhanced Services

**Tasks**:
- Task 19: Enhance ProductsService with caching
- Task 20: Implement HighlightsService
- Task 21: Implement PreferencesService
- Task 22: Checkpoint

**Estimated Time**: Week 5

---

## Notes

- EventTracker batches events for efficiency
- PushManager handles both iOS and Android platforms
- Auto-tracking integrated into CartManager and SDK initialization
- Deep link parsing supports multiple URL patterns
- Events are persisted for offline support
- Cleanup method ensures no events are lost
- Push token is stored with platform information
- Rich notifications support images and buttons

---

**Phase 4 Status**: ✅ Complete  
**Build Status**: ✅ Passing  
**Ready for Phase 5**: ✅ Yes
