# API Reference

Complete API reference for the Shopify Mobile Platform SDK.

## Table of Contents

- [ShopifyMobileClient](#shopifymobileclient)
- [React Hooks](#react-hooks)
- [Managers](#managers)
- [Services](#services)
- [Types](#types)
- [Errors](#errors)

---

## ShopifyMobileClient

Main SDK client class.

### Constructor

```typescript
new ShopifyMobileClient(config: ShopifyMobileClientConfig)
```

**Parameters:**
- `config.baseUrl` (string, required) - API base URL
- `config.shopDomain` (string, required) - Shopify shop domain
- `config.storage` (StorageAdapter, required) - AsyncStorage adapter
- `config.secureStorage` (SecureStorageAdapter, required) - SecureStore adapter
- `config.timeout` (number, optional) - Request timeout in ms (default: 10000)
- `config.retries` (number, optional) - Max retry attempts (default: 3)
- `config.debug` (boolean, optional) - Enable debug logging (default: false)
- `config.onError` (function, optional) - Global error handler

**Example:**
```typescript
const client = new ShopifyMobileClient({
  baseUrl: 'https://api.example.com',
  shopDomain: 'shop.myshopify.com',
  storage: asyncStorageAdapter,
  secureStorage: secureStoreAdapter,
  debug: true,
});
```

### Methods

#### initialize()

Initialize the SDK. Must be called before using SDK features.

```typescript
await client.initialize(): Promise<void>
```

#### cleanup()

Cleanup SDK resources.

```typescript
await client.cleanup(): Promise<void>
```

#### setDebugMode(enabled)

Enable or disable debug logging at runtime.

```typescript
client.setDebugMode(enabled: boolean): void
```

#### getLogs()

Get all debug logs.

```typescript
client.getLogs(): LogEntry[]
```

**Returns:** Array of log entries with level, message, data, and timestamp.

#### getMetrics()

Get SDK performance metrics.

```typescript
client.getMetrics(): SDKMetrics
```

**Returns:** Object containing request, cache, offline, and memory metrics.

#### exportDiagnostics()

Export complete SDK state for debugging.

```typescript
client.exportDiagnostics(): DiagnosticData
```

**Returns:** Object containing config, metrics, logs, and state.

#### setShopDomain(shopDomain)

Update shop domain for subsequent requests.

```typescript
client.setShopDomain(shopDomain: string): void
```

#### getConfig()

Get current SDK configuration.

```typescript
client.getConfig(): Readonly<ShopifyMobileClientConfig>
```

### Properties

#### authManager

Authentication manager instance.

```typescript
client.authManager: AuthManager
```

#### cartManager

Cart manager instance.

```typescript
client.cartManager: CartManager
```

#### cacheManager

Cache manager instance.

```typescript
client.cacheManager: CacheManager
```

#### offlineQueue

Offline queue manager instance.

```typescript
client.offlineQueue: OfflineQueue
```

#### eventTracker

Event tracker instance.

```typescript
client.eventTracker: EventTracker
```

#### pushManager

Push notification manager instance.

```typescript
client.pushManager: PushManager
```

#### products

Products service instance.

```typescript
client.products: ProductsService
```

#### highlights

Highlights service instance.

```typescript
client.highlights: HighlightsService
```

#### preferences

Preferences service instance.

```typescript
client.preferences: PreferencesService
```

---

## React Hooks

### ShopifyProvider

Context provider component.

```typescript
<ShopifyProvider client={client}>
  {children}
</ShopifyProvider>
```

**Props:**
- `client` (ShopifyMobileClient, required) - SDK client instance
- `children` (ReactNode, required) - Child components

### useShopifyClient()

Access SDK client from context.

```typescript
const client = useShopifyClient(): ShopifyMobileClient
```

**Returns:** SDK client instance

**Throws:** Error if used outside ShopifyProvider

### useAuth()

Authentication hook.

```typescript
const {
  session,
  isAuthenticated,
  loading,
  error,
  login,
  signup,
  logout,
} = useAuth()
```

**Returns:**
- `session` (AuthSession | null) - Current session
- `isAuthenticated` (boolean) - Authentication status
- `loading` (boolean) - Loading state
- `error` (Error | null) - Error state
- `login` (function) - Login method
- `signup` (function) - Signup method
- `logout` (function) - Logout method

**Methods:**

##### login(credentials)

```typescript
await login(credentials: LoginRequest): Promise<AuthSession>
```

##### signup(credentials)

```typescript
await signup(credentials: SignupRequest): Promise<AuthSession>
```

##### logout()

```typescript
await logout(): Promise<void>
```

### useCart()

Cart management hook.

```typescript
const {
  cart,
  isLoading,
  error,
  addItem,
  removeItem,
  updateQuantity,
  clear,
} = useCart()
```

**Returns:**
- `cart` (Cart | null) - Current cart
- `isLoading` (boolean) - Loading state
- `error` (Error | null) - Error state
- `addItem` (function) - Add item method
- `removeItem` (function) - Remove item method
- `updateQuantity` (function) - Update quantity method
- `clear` (function) - Clear cart method

**Methods:**

##### addItem(variantId, quantity)

```typescript
await addItem(variantId: string, quantity: number): Promise<Cart>
```

##### removeItem(lineId)

```typescript
await removeItem(lineId: string): Promise<Cart>
```

##### updateQuantity(lineId, quantity)

```typescript
await updateQuantity(lineId: string, quantity: number): Promise<Cart>
```

##### clear()

```typescript
await clear(): Promise<void>
```

### useProducts(options?)

Products listing hook.

```typescript
const {
  products,
  loading,
  error,
  hasMore,
  loadMore,
  refresh,
} = useProducts(options?: UseProductsOptions)
```

**Parameters:**
- `options.limit` (number, optional) - Page size (default: 20)
- `options.autoLoad` (boolean, optional) - Auto-load on mount (default: true)

**Returns:**
- `products` (Product[]) - Product array
- `loading` (boolean) - Loading state
- `error` (Error | null) - Error state
- `hasMore` (boolean) - More products available
- `loadMore` (function) - Load next page
- `refresh` (function) - Refresh from start

**Methods:**

##### loadMore()

```typescript
loadMore(): void
```

##### refresh()

```typescript
refresh(): void
```

### useHighlights()

Highlights hook.

```typescript
const {
  highlights,
  loading,
  error,
  trackView,
  trackClick,
  trackConversion,
  refresh,
} = useHighlights()
```

**Returns:**
- `highlights` (Highlight[]) - Highlights array
- `loading` (boolean) - Loading state
- `error` (Error | null) - Error state
- `trackView` (function) - Track view method
- `trackClick` (function) - Track click method
- `trackConversion` (function) - Track conversion method
- `refresh` (function) - Refresh method

**Methods:**

##### trackView(highlightId)

```typescript
trackView(highlightId: string): void
```

##### trackClick(highlightId, deepLink?)

```typescript
trackClick(highlightId: string, deepLink?: string): void
```

##### trackConversion(highlightId, conversionData?)

```typescript
trackConversion(highlightId: string, conversionData?: Record<string, any>): void
```

##### refresh()

```typescript
await refresh(): Promise<void>
```

### usePreferences()

User preferences hook.

```typescript
const {
  preferences,
  loading,
  error,
  updatePreferences,
  bulkUpdate,
  refresh,
} = usePreferences()
```

**Returns:**
- `preferences` (UserPreferences | null) - User preferences
- `loading` (boolean) - Loading state
- `error` (Error | null) - Error state
- `updatePreferences` (function) - Partial update method
- `bulkUpdate` (function) - Full update method
- `refresh` (function) - Refresh method

**Methods:**

##### updatePreferences(updates)

```typescript
await updatePreferences(updates: Partial<UserPreferences>): Promise<UserPreferences>
```

##### bulkUpdate(updates)

```typescript
await bulkUpdate(updates: Partial<UserPreferences>): Promise<UserPreferences>
```

##### refresh()

```typescript
await refresh(): Promise<void>
```

---

## Managers

### AuthManager

Manages authentication state and token refresh.

#### Methods

##### initialize()

```typescript
await authManager.initialize(): Promise<void>
```

##### login(credentials)

```typescript
await authManager.login(credentials: LoginRequest): Promise<AuthSession>
```

##### signup(data)

```typescript
await authManager.signup(data: SignupRequest): Promise<AuthSession>
```

##### logout()

```typescript
await authManager.logout(): Promise<void>
```

##### refreshToken()

```typescript
await authManager.refreshToken(): Promise<void>
```

##### isAuthenticated()

```typescript
authManager.isAuthenticated(): boolean
```

### CartManager

Manages cart state with optimistic updates.

#### Methods

##### initialize()

```typescript
await cartManager.initialize(): Promise<void>
```

##### addItem(request)

```typescript
await cartManager.addItem(request: AddItemRequest): Promise<Cart>
```

##### removeItem(request)

```typescript
await cartManager.removeItem(request: RemoveItemRequest): Promise<Cart>
```

##### updateQuantity(request)

```typescript
await cartManager.updateQuantity(request: UpdateItemRequest): Promise<Cart>
```

##### clear()

```typescript
await cartManager.clear(): Promise<void>
```

### CacheManager

Manages data caching with TTL and LRU eviction.

#### Methods

##### initialize()

```typescript
await cacheManager.initialize(): Promise<void>
```

##### get(key)

```typescript
await cacheManager.get<T>(key: string): Promise<T | null>
```

##### set(key, data, ttl?)

```typescript
await cacheManager.set<T>(key: string, data: T, ttl?: number): Promise<void>
```

##### invalidate(key)

```typescript
await cacheManager.invalidate(key: string): Promise<void>
```

##### invalidatePattern(pattern)

```typescript
await cacheManager.invalidatePattern(pattern: string): Promise<void>
```

##### clear()

```typescript
await cacheManager.clear(): Promise<void>
```

##### getStats()

```typescript
cacheManager.getStats(): CacheStats
```

### OfflineQueue

Manages offline request queueing.

#### Methods

##### initialize()

```typescript
await offlineQueue.initialize(): Promise<void>
```

##### enqueue(request)

```typescript
await offlineQueue.enqueue(request: QueuedRequest): Promise<void>
```

##### processQueue()

```typescript
await offlineQueue.processQueue(): Promise<void>
```

##### cleanup()

```typescript
offlineQueue.cleanup(): void
```

### EventTracker

Manages event tracking with batching.

#### Methods

##### initialize()

```typescript
await eventTracker.initialize(): Promise<void>
```

##### track(eventType, payload)

```typescript
await eventTracker.track(eventType: string, payload: Record<string, any>): Promise<void>
```

##### autoTrack(eventType, data)

```typescript
eventTracker.autoTrack(eventType: string, data: any): void
```

##### flush()

```typescript
await eventTracker.flush(): Promise<void>
```

##### cleanup()

```typescript
await eventTracker.cleanup(): Promise<void>
```

### PushManager

Manages push notifications.

#### Methods

##### initialize()

```typescript
await pushManager.initialize(): Promise<void>
```

##### registerToken(token, platform)

```typescript
await pushManager.registerToken(token: string, platform: 'ios' | 'android'): Promise<void>
```

##### trackNotificationOpened(notificationId)

```typescript
await pushManager.trackNotificationOpened(notificationId: string): Promise<void>
```

##### trackNotificationClicked(notificationId, buttonId?)

```typescript
await pushManager.trackNotificationClicked(notificationId: string, buttonId?: string): Promise<void>
```

---

## Services

### ProductsService

Product catalog operations.

#### Methods

##### list(request?)

```typescript
await products.list(request?: ProductsListRequest): Promise<{
  products: Product[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
}>
```

##### get(productId)

```typescript
await products.get(productId: string): Promise<Product>
```

##### search(query, limit?)

```typescript
await products.search(query: string, limit?: number): Promise<{
  products: Product[];
}>
```

##### listCollections()

```typescript
await products.listCollections(): Promise<{
  collections: Collection[];
}>
```

##### getCollection(collectionId)

```typescript
await products.getCollection(collectionId: string): Promise<Collection>
```

### HighlightsService

Featured content operations.

#### Methods

##### list()

```typescript
await highlights.list(): Promise<{
  highlights: Highlight[];
}>
```

##### trackView(highlightId)

```typescript
await highlights.trackView(highlightId: string): Promise<void>
```

##### trackClick(highlightId, deepLink?)

```typescript
await highlights.trackClick(highlightId: string, deepLink?: string): Promise<void>
```

##### trackConversion(highlightId, conversionData?)

```typescript
await highlights.trackConversion(highlightId: string, conversionData?: Record<string, any>): Promise<void>
```

### PreferencesService

User preferences operations.

#### Methods

##### get()

```typescript
await preferences.get(): Promise<UserPreferences>
```

##### update(updates)

```typescript
await preferences.update(updates: Partial<UserPreferences>): Promise<UserPreferences>
```

##### bulkUpdate(updates)

```typescript
await preferences.bulkUpdate(updates: Partial<UserPreferences>): Promise<UserPreferences>
```

---

## Types

### Core Types

```typescript
interface ShopifyMobileClientConfig {
  baseUrl: string;
  shopDomain: string;
  storage: StorageAdapter;
  secureStorage: SecureStorageAdapter;
  timeout?: number;
  retries?: number;
  debug?: boolean;
  onError?: (error: any) => void;
}

interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  customer: Customer;
}

interface Customer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface Product {
  id: string;
  title: string;
  availableForSale: boolean;
  images: ProductImage[];
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
}

interface Collection {
  id: string;
  title: string;
  description?: string;
  image?: string;
  previewProducts: Product[];
}

interface Cart {
  cartId: string;
  checkoutUrl: string;
  quantity: number;
}

interface Highlight {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  deepLink?: string;
  priority: number;
  startDate: string;
  endDate?: string;
}

interface UserPreferences {
  notifications: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  marketing: {
    emailMarketing: boolean;
    smsMarketing: boolean;
  };
  privacy: {
    dataCollection: boolean;
    personalization: boolean;
  };
  [key: string]: any;
}
```

### Request Types

```typescript
interface LoginRequest {
  email: string;
  password: string;
  pushToken?: string;
}

interface SignupRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  autoLogin?: boolean;
  pushToken?: string;
}

interface ProductsListRequest {
  cursor?: string;
  limit?: number;
}
```

### Utility Types

```typescript
interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: number;
}

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

interface SDKMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
    recent: RequestMetrics[];
  };
  cache: CacheMetrics;
  offline: {
    queueSize: number;
    processedRequests: number;
  };
  memory: {
    currentSize: number;
    maxSize: number;
    utilizationPercent: number;
  };
}
```

---

## Errors

### SDKError

Base error class for all SDK errors.

```typescript
class SDKError extends Error {
  code: string;
  statusCode?: number;
  retryable: boolean;
}
```

### NetworkError

Network-related errors (retryable).

```typescript
class NetworkError extends SDKError {
  constructor(message: string)
}
```

### AuthenticationError

Authentication failures (non-retryable).

```typescript
class AuthenticationError extends SDKError {
  constructor(message: string)
}
```

### ValidationError

Validation errors (non-retryable).

```typescript
class ValidationError extends SDKError {
  fields?: Record<string, string>;
  constructor(message: string, fields?: Record<string, string>)
}
```

### OfflineError

Offline errors (retryable).

```typescript
class OfflineError extends SDKError {
  constructor(message: string)
}
```

---

## Storage Adapters

### StorageAdapter

Interface for AsyncStorage adapter.

```typescript
interface StorageAdapter {
  getItem(key: string): Promise<any>;
  setItem(key: string, value: any): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<string[]>;
  clear(): Promise<void>;
}
```

### SecureStorageAdapter

Interface for SecureStore adapter.

```typescript
interface SecureStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
```
