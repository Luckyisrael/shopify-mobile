# Shopify Mobile Platform SDK

TypeScript SDK for easy integration with the Shopify Mobile Commerce Platform APIs.

## Installation

```bash
npm install @shopify-mobile-platform/sdk
```

## Quick Start

```typescript
import { ShopifyMobileClient } from '@shopify-mobile-platform/sdk';

const client = new ShopifyMobileClient({
  baseUrl: 'https://your-shopify-app.com',
  shopDomain: 'your-shop.myshopify.com'
});

// Authenticate customer
const session = await client.auth.login({
  email: 'customer@example.com',
  password: 'password123'
});

// Get products
const products = await client.products.list();

// Create cart
const cart = await client.cart.create({
  variantId: 'gid://shopify/ProductVariant/123',
  quantity: 1,
  customerAccessToken: session.accessToken
});
```

## Features

- ✅ Type-safe API client
- ✅ Customer authentication
- ✅ Product management
- ✅ Cart operations
- ✅ Push notifications
- ✅ Event tracking
- ✅ Error handling
- ✅ Request/response interceptors

## API Reference

### Authentication

```typescript
// Login
const session = await client.auth.login({
  email: string,
  password: string,
  pushToken?: string
});

// Signup
const result = await client.auth.signup({
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  autoLogin?: boolean,
  pushToken?: string
});

// Refresh token
const newSession = await client.auth.refresh({
  accessToken: string
});

// Logout
await client.auth.logout({
  accessToken: string,
  pushToken?: string
});
```

### Products

```typescript
// List products
const products = await client.products.list({
  cursor?: string,
  limit?: number
});

// List collections
const collections = await client.collections.list();
```

### Cart

```typescript
// Create cart
const cart = await client.cart.create({
  variantId: string,
  quantity: number,
  customerAccessToken?: string
});
```

### Push Notifications

```typescript
// Register device
await client.push.register({
  token: string,
  platform: 'ios' | 'android'
});
```

### Events

```typescript
// Track event
await client.events.track({
  eventType: string,
  payload: object,
  customerAccessToken?: string
});
```

## Configuration

```typescript
const client = new ShopifyMobileClient({
  baseUrl: 'https://your-shopify-app.com',
  shopDomain: 'your-shop.myshopify.com',
  timeout: 10000, // Request timeout in ms
  retries: 3, // Number of retries for failed requests
  onError: (error) => {
    // Custom error handling
    console.error('SDK Error:', error);
  }
});
```

## Error Handling

The SDK provides structured error handling:

```typescript
import { ShopifyMobileError } from '@shopify-mobile-platform/sdk';

try {
  await client.auth.login({ email, password });
} catch (error) {
  if (error instanceof ShopifyMobileError) {
    console.error('API Error:', error.message);
    console.error('Status Code:', error.statusCode);
    console.error('Error Code:', error.code);
  }
}
```

## TypeScript Support

The SDK is built with TypeScript and provides full type safety:

```typescript
import type { 
  Customer, 
  Product, 
  Cart, 
  AuthSession 
} from '@shopify-mobile-platform/sdk';

const session: AuthSession = await client.auth.login({
  email: 'customer@example.com',
  password: 'password123'
});

const products: Product[] = await client.products.list();
```

## Contributing

See the main repository [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](../../LICENSE) for details.