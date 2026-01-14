# Shopify Mobile Platform SDK

> Production-ready TypeScript SDK for building mobile commerce experiences with Shopify

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React%20Native-0.70+-green.svg)](https://reactnative.dev/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Features

- 🔐 **Authentication** - Secure customer authentication with automatic token refresh
- 🛒 **Cart Management** - Optimistic updates with offline support
- 📦 **Product Catalog** - Caching, pagination, and search
- 🎨 **Highlights** - Featured content with tracking
- ⚙️ **User Preferences** - Persistent user settings
- 📱 **Push Notifications** - Rich notifications with deep linking
- 📊 **Event Tracking** - Automatic event batching and offline persistence
- 💾 **Offline Support** - Request queueing with automatic retry
- 🚀 **Performance** - Memory management, caching, and request deduplication
- 🐛 **Debug Mode** - Comprehensive logging and metrics
- ⚛️ **React Hooks** - Idiomatic React Native integration
- 📘 **TypeScript** - Full type safety and IntelliSense support

## Installation

```bash
npm install @shopify-mobile-platform/sdk
```

### Peer Dependencies

```bash
npm install react react-native
npm install @react-native-async-storage/async-storage
npm install @react-native-community/netinfo
npm install expo-secure-store
```

## Quick Start

### 1. Initialize the SDK

```typescript
import { ShopifyMobileClient } from '@shopify-mobile-platform/sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Create storage adapters
const asyncStorageAdapter = {
  async getItem(key: string) {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  async setItem(key: string, value: any) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },
  async getAllKeys() {
    return AsyncStorage.getAllKeys();
  },
  async clear() {
    await AsyncStorage.clear();
  },
};

const secureStoreAdapter = {
  async getItem(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    await SecureStore.deleteItemAsync(key);
  },
};

// Initialize SDK
const client = new ShopifyMobileClient({
  baseUrl: 'https://your-api.example.com',
  shopDomain: 'your-shop.myshopify.com',
  storage: asyncStorageAdapter,
  secureStorage: secureStoreAdapter,
  debug: __DEV__, // Enable debug mode in development
});

// Initialize SDK (call once on app start)
await client.initialize();
```

### 2. Wrap Your App with Provider

```typescript
import { ShopifyProvider } from '@shopify-mobile-platform/sdk';

function App() {
  return (
    <ShopifyProvider client={client}>
      <Navigation />
    </ShopifyProvider>
  );
}
```

### 3. Use React Hooks

```typescript
import { useAuth, useCart, useProducts } from '@shopify-mobile-platform/sdk';

function LoginScreen() {
  const { login, isAuthenticated, loading, error } = useAuth();

  const handleLogin = async () => {
    try {
      await login({
        email: 'customer@example.com',
        password: 'password123',
      });
      // Navigate to home
    } catch (err) {
      // Handle error
    }
  };

  return (
    <View>
      {loading && <ActivityIndicator />}
      {error && <Text>{error.message}</Text>}
      <Button onPress={handleLogin}>Login</Button>
    </View>
  );
}

function ProductsScreen() {
  const { products, loading, hasMore, loadMore, refresh } = useProducts({
    limit: 20,
    autoLoad: true,
  });

  return (
    <FlatList
      data={products}
      onEndReached={loadMore}
      onRefresh={refresh}
      refreshing={loading}
      ListFooterComponent={hasMore && <ActivityIndicator />}
    />
  );
}

function CartScreen() {
  const { cart, addItem, removeItem, updateQuantity, clear } = useCart();

  return (
    <View>
      <Text>Items: {cart?.quantity || 0}</Text>
      <Button onPress={() => addItem('variant-123', 1)}>
        Add to Cart
      </Button>
      <Button onPress={clear}>Clear Cart</Button>
    </View>
  );
}
```

## Configuration Options

```typescript
interface ShopifyMobileClientConfig {
  // Required
  baseUrl: string;              // Your API base URL
  shopDomain: string;           // Shopify shop domain
  storage: StorageAdapter;      // AsyncStorage adapter
  secureStorage: SecureStorageAdapter; // SecureStore adapter

  // Optional
  timeout?: number;             // Request timeout (default: 10000ms)
  retries?: number;             // Max retry attempts (default: 3)
  debug?: boolean;              // Enable debug logging (default: false)
  onError?: (error: any) => void; // Global error handler
}
```

## React Hooks API

### useAuth

Manage authentication state and operations.

```typescript
const {
  session,          // Current auth session
  isAuthenticated,  // Authentication status
  loading,          // Loading state
  error,            // Error state
  login,            // Login method
  signup,           // Signup method
  logout,           // Logout method
} = useAuth();

// Login
await login({ email, password });

// Signup
await signup({ email, password, firstName, lastName });

// Logout
await logout();
```

### useCart

Manage shopping cart operations.

```typescript
const {
  cart,             // Current cart
  isLoading,        // Loading state
  error,            // Error state
  addItem,          // Add item to cart
  removeItem,       // Remove item from cart
  updateQuantity,   // Update item quantity
  clear,            // Clear cart
} = useCart();

// Add item
await addItem('variant-id', 2);

// Remove item
await removeItem('line-id');

// Update quantity
await updateQuantity('line-id', 3);

// Clear cart
await clear();
```

### useProducts

Load and paginate products.

```typescript
const {
  products,         // Product array
  loading,          // Loading state
  error,            // Error state
  hasMore,          // More products available
  loadMore,         // Load next page
  refresh,          // Refresh from start
} = useProducts({
  limit: 20,        // Page size (default: 20)
  autoLoad: true,   // Auto-load on mount (default: true)
});

// Infinite scroll
<FlatList
  data={products}
  onEndReached={loadMore}
  onRefresh={refresh}
/>
```

### useHighlights

Load and track featured content.

```typescript
const {
  highlights,       // Highlights array
  loading,          // Loading state
  error,            // Error state
  trackView,        // Track view event
  trackClick,       // Track click event
  trackConversion,  // Track conversion event
  refresh,          // Refresh highlights
} = useHighlights();

// Track view
trackView('highlight-id');

// Track click
trackClick('highlight-id', '/products/123');

// Track conversion
trackConversion('highlight-id', { orderId: 'order-123' });
```

### usePreferences

Manage user preferences.

```typescript
const {
  preferences,      // User preferences
  loading,          // Loading state
  error,            // Error state
  updatePreferences, // Partial update
  bulkUpdate,       // Full update
  refresh,          // Refresh preferences
} = usePreferences();

// Partial update
await updatePreferences({
  notifications: { push: true }
});

// Full update
await bulkUpdate({
  notifications: { push: true, email: false, sms: false },
  marketing: { emailMarketing: true, smsMarketing: false },
  privacy: { dataCollection: true, personalization: true }
});
```

## Direct SDK API

If you prefer not to use hooks, you can use the SDK directly:

### Authentication

```typescript
// Login
const session = await client.authManager.login({
  email: 'customer@example.com',
  password: 'password123',
});

// Signup
const session = await client.authManager.signup({
  email: 'customer@example.com',
  password: 'password123',
  firstName: 'John',
  lastName: 'Doe',
});

// Logout
await client.authManager.logout();

// Check authentication
const isAuthenticated = client.authManager.isAuthenticated();
```

### Products

```typescript
// List products with pagination
const { products, pageInfo } = await client.products.list({
  cursor: 'cursor-string',
  limit: 20,
});

// Get single product
const product = await client.products.get('product-id');

// Search products
const { products } = await client.products.search('shoes', 10);

// List collections
const { collections } = await client.products.listCollections();

// Get collection
const collection = await client.products.getCollection('collection-id');
```

### Cart

```typescript
// Add item
const cart = await client.cartManager.addItem({
  variantId: 'variant-id',
  quantity: 2,
});

// Remove item
const cart = await client.cartManager.removeItem({
  lineId: 'line-id',
});

// Update quantity
const cart = await client.cartManager.updateQuantity({
  lineId: 'line-id',
  quantity: 3,
});

// Clear cart
await client.cartManager.clear();
```

### Highlights

```typescript
// List highlights
const { highlights } = await client.highlights.list();

// Track view
await client.highlights.trackView('highlight-id');

// Track click
await client.highlights.trackClick('highlight-id', '/products/123');

// Track conversion
await client.highlights.trackConversion('highlight-id', {
  orderId: 'order-123',
});
```

### Preferences

```typescript
// Get preferences
const preferences = await client.preferences.get();

// Update preferences (partial)
const updated = await client.preferences.update({
  notifications: { push: true },
});

// Bulk update (full replacement)
const replaced = await client.preferences.bulkUpdate({
  notifications: { push: true, email: false, sms: false },
  marketing: { emailMarketing: true, smsMarketing: false },
  privacy: { dataCollection: true, personalization: true },
});
```

### Push Notifications

```typescript
// Register push token
await client.pushManager.registerToken('push-token', 'ios');

// Track notification opened
await client.pushManager.trackNotificationOpened('notification-id');

// Track notification clicked
await client.pushManager.trackNotificationClicked('notification-id', 'button-id');
```

### Event Tracking

```typescript
// Track custom event
await client.eventTracker.track('CUSTOM_EVENT', {
  customData: 'value',
});

// Flush events immediately
await client.eventTracker.flush();
```

## Advanced Features

### Offline Support

The SDK automatically queues requests when offline and processes them when connectivity is restored.

```typescript
// Requests are automatically queued when offline
await client.cartManager.addItem({ variantId: 'id', quantity: 1 });
// ↑ Queued if offline, processed when online

// Manual queue processing
await client.offlineQueue.processQueue();

// Check queue size
const queueSize = client.offlineQueue.getQueueSize();
```

### Caching

Automatic caching with configurable TTL per resource type.

```typescript
// Cache is automatic, but you can control it
await client.cacheManager.invalidate('cache-key');
await client.cacheManager.invalidatePattern('products:*');
await client.cacheManager.clear();

// Get cache stats
const stats = client.cacheManager.getStats();
console.log(`Cache entries: ${stats.entries}`);
console.log(`Memory usage: ${stats.memoryUsage.utilizationPercent}%`);
```

### Debug Mode

Enable comprehensive logging and metrics tracking.

```typescript
// Enable debug mode
client.setDebugMode(true);

// Get logs
const logs = client.getLogs();
logs.forEach(log => {
  console.log(`[${log.level}] ${log.message}`, log.data);
});

// Get metrics
const metrics = client.getMetrics();
console.log(`Cache hit rate: ${metrics.cache.hitRate * 100}%`);
console.log(`Average request time: ${metrics.requests.averageDuration}ms`);
console.log(`Memory usage: ${metrics.memory.utilizationPercent}%`);
```

### Diagnostic Export

Export complete SDK state for debugging.

```typescript
const diagnostics = client.exportDiagnostics();

// Send to support or save to file
console.log(JSON.stringify(diagnostics, null, 2));

// Diagnostic data includes:
// - Configuration
// - Performance metrics
// - Debug logs
// - Current state (auth, cache)
```

## Error Handling

The SDK provides structured error types:

```typescript
import {
  SDKError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  OfflineError,
} from '@shopify-mobile-platform/sdk';

try {
  await client.authManager.login({ email, password });
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Handle auth errors
    console.error('Authentication failed:', error.message);
  } else if (error instanceof NetworkError) {
    // Handle network errors
    console.error('Network error:', error.message);
  } else if (error instanceof OfflineError) {
    // Handle offline errors
    console.error('Request queued for later');
  } else if (error instanceof SDKError) {
    // Handle generic SDK errors
    console.error('SDK error:', error.message);
    console.error('Code:', error.code);
    console.error('Status:', error.statusCode);
    console.error('Retryable:', error.retryable);
  }
}
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  // Core types
  ShopifyMobileClientConfig,
  AuthSession,
  Customer,
  Product,
  Collection,
  Cart,
  Highlight,
  UserPreferences,

  // Request types
  LoginRequest,
  SignupRequest,
  ProductsListRequest,

  // Hook types
  UseProductsOptions,

  // Utility types
  LogEntry,
  SDKMetrics,
  RequestMetrics,
  CacheMetrics,
} from '@shopify-mobile-platform/sdk';
```

## Performance

### Memory Management
- Automatic LRU cache eviction
- Configurable 50MB cache limit
- Real-time memory tracking

### Request Optimization
- Request deduplication
- Automatic retry with exponential backoff
- Concurrent request handling

### Caching Strategy
- Cache-first for reads
- Stale-while-revalidate support
- Resource-specific TTLs

### Event Batching
- Automatic event batching (10 events or 30 seconds)
- Offline persistence
- Background flush

## Troubleshooting

### Common Issues

**Issue**: "useShopifyClient must be used within a ShopifyProvider"
```typescript
// Solution: Wrap your app with ShopifyProvider
<ShopifyProvider client={client}>
  <App />
</ShopifyProvider>
```

**Issue**: Session expires frequently
```typescript
// Solution: Token refresh is automatic, but check your token expiry times
// The SDK automatically refreshes tokens on 401 responses
```

**Issue**: Offline requests not processing
```typescript
// Solution: Ensure NetInfo is properly configured
import NetInfo from '@react-native-community/netinfo';

// The SDK automatically listens to NetInfo events
// But you can manually trigger queue processing:
await client.offlineQueue.processQueue();
```

**Issue**: Cache not working
```typescript
// Solution: Ensure storage adapter is properly configured
// Check cache stats:
const stats = client.cacheManager.getStats();
console.log('Cache entries:', stats.entries);
```

### Debug Mode

Enable debug mode to see detailed logs:

```typescript
const client = new ShopifyMobileClient({
  // ... other config
  debug: true, // Enable debug logging
});

// Or toggle at runtime
client.setDebugMode(true);

// View logs
const logs = client.getLogs();
```

## Migration Guide

### From Basic SDK

If you're migrating from the basic SDK:

1. **Add storage adapters**:
```typescript
// Before
const client = new ShopifyMobileClient({
  baseUrl: 'https://api.example.com',
  shopDomain: 'shop.myshopify.com',
});

// After
const client = new ShopifyMobileClient({
  baseUrl: 'https://api.example.com',
  shopDomain: 'shop.myshopify.com',
  storage: asyncStorageAdapter,        // NEW
  secureStorage: secureStoreAdapter,   // NEW
});
```

2. **Initialize SDK**:
```typescript
// NEW: Call initialize() on app start
await client.initialize();
```

3. **Use React Hooks** (optional but recommended):
```typescript
// Before
const products = await client.products.list();

// After (with hooks)
const { products, loading, error } = useProducts();
```

4. **Update authentication**:
```typescript
// Before
const session = await client.auth.login({ email, password });

// After
const session = await client.authManager.login({ email, password });
// Or with hooks
const { login } = useAuth();
await login({ email, password });
```

## Examples

See the [examples](../../examples) directory for complete example apps:

- **Basic Example** - Simple product listing and cart
- **Advanced Example** - Full-featured e-commerce app
- **Offline Example** - Offline-first implementation

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## License

MIT - see [LICENSE](../../LICENSE) for details.

## Support

- 📖 [Documentation](https://docs.example.com)
- 💬 [Discord Community](https://discord.gg/example)
- 🐛 [Issue Tracker](https://github.com/example/issues)
- 📧 [Email Support](mailto:support@example.com)
