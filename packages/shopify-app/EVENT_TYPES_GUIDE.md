# Event Types Implementation Guide

## 📊 Overview

The Shopify Mobile Connector supports comprehensive event tracking for customer behavior analytics and automation triggers. All events are logged with customer context and can trigger automated actions.

## 🎯 Supported Event Types

### 1. CART_UPDATED
**When to Use**: Customer adds or updates items in their shopping cart

**Payload Structure**:
```json
{
  "eventType": "CART_UPDATED",
  "payload": {
    "cartId": "gid://shopify/Cart/123456789",
    "itemCount": 3,
    "quantity": 3,
    "totalAmount": 99.99,
    "variantId": "gid://shopify/ProductVariant/987654321"
  },
  "customerAccessToken": "customer_token_here"
}
```

**Automated Actions**:
- ✅ Updates customer last seen timestamp
- ✅ Tracks cart metrics for analytics
- ✅ Prepares for potential cart recovery

**Mobile App Integration**:
```javascript
// When customer adds to cart
await trackEvent('CART_UPDATED', {
  cartId: cart.id,
  itemCount: cart.lines.length,
  totalAmount: cart.cost.totalAmount.amount
});
```

---

### 2. CART_ABANDONED
**When to Use**: Cart has been inactive for X minutes (typically 30 minutes)

**Payload Structure**:
```json
{
  "eventType": "CART_ABANDONED",
  "payload": {
    "cartId": "gid://shopify/Cart/123456789",
    "itemCount": 3,
    "totalAmount": 99.99,
    "abandonedAt": "2024-01-09T10:00:00Z"
  },
  "customerAccessToken": "customer_token_here"
}
```

**Automated Actions**:
- ✅ Schedules cart recovery push notification (30 min delay)
- ✅ Checks for active push token
- ✅ Respects daily cart recovery limits
- ✅ Creates automation job in queue

**Mobile App Integration**:
```javascript
// Track cart abandonment after 30 minutes of inactivity
setTimeout(() => {
  if (!orderCompleted) {
    await trackEvent('CART_ABANDONED', {
      cartId: cart.id,
      itemCount: cart.lines.length,
      totalAmount: cart.cost.totalAmount.amount,
      abandonedAt: new Date().toISOString()
    });
  }
}, 30 * 60 * 1000);
```

---

### 3. ORDER_CREATED
**When to Use**: Customer completes a purchase

**Payload Structure**:
```json
{
  "eventType": "ORDER_CREATED",
  "payload": {
    "orderId": "gid://shopify/Order/456789",
    "orderNumber": "1001",
    "totalAmount": 99.99,
    "cartId": "gid://shopify/Cart/123456789",
    "itemCount": 3
  },
  "customerAccessToken": "customer_token_here"
}
```

**Automated Actions**:
- ✅ Cancels any pending cart recovery jobs
- ✅ Sends order confirmation push notification
- ✅ Updates customer last seen timestamp
- ✅ Tracks conversion metrics

**Push Notification Sent**:
```
Title: "🎉 Order Confirmed!"
Body: "Thank you for your order #1001. We'll send you updates as it ships!"
```

**Mobile App Integration**:
```javascript
// After successful checkout
await trackEvent('ORDER_CREATED', {
  orderId: order.id,
  orderNumber: order.orderNumber,
  totalAmount: order.totalPrice.amount,
  cartId: cart.id,
  itemCount: order.lineItems.length
});
```

---

### 4. ORDER_FULFILLED
**When to Use**: Order is shipped/fulfilled

**Payload Structure**:
```json
{
  "eventType": "ORDER_FULFILLED",
  "payload": {
    "orderId": "gid://shopify/Order/456789",
    "orderNumber": "1001",
    "trackingNumber": "1Z999AA10123456784",
    "trackingUrl": "https://tracking.example.com/1Z999AA10123456784",
    "carrier": "UPS"
  },
  "customerAccessToken": "customer_token_here"
}
```

**Automated Actions**:
- ✅ Sends shipping notification push
- ✅ Includes tracking information
- ✅ Updates customer engagement metrics

**Push Notification Sent**:
```
Title: "📦 Order Shipped!"
Body: "Your order #1001 has shipped! Track it with: 1Z999AA10123456784"
```

**Mobile App Integration**:
```javascript
// When order fulfillment webhook received
await trackEvent('ORDER_FULFILLED', {
  orderId: order.id,
  orderNumber: order.orderNumber,
  trackingNumber: fulfillment.trackingNumber,
  trackingUrl: fulfillment.trackingUrl,
  carrier: fulfillment.trackingCompany
});
```

---

### 5. PUSH_REQUESTED
**When to Use**: Manual push notification is sent from admin

**Payload Structure**:
```json
{
  "eventType": "PUSH_REQUESTED",
  "payload": {
    "pushType": "manual",
    "title": "Flash Sale!",
    "body": "50% off everything!",
    "recipientCount": 150,
    "audience": "all"
  }
}
```

**Automated Actions**:
- ✅ Logs push metrics for analytics
- ✅ Tracks delivery status

**Admin Dashboard Integration**:
```javascript
// Automatically tracked when admin sends push
// No mobile app integration needed
```

---

### 6. PRODUCT_VIEWED
**When to Use**: Customer views a product detail page

**Payload Structure**:
```json
{
  "eventType": "PRODUCT_VIEWED",
  "payload": {
    "productId": "gid://shopify/Product/789",
    "productTitle": "Summer T-Shirt",
    "productHandle": "summer-t-shirt",
    "price": 29.99,
    "viewDuration": 45
  },
  "customerAccessToken": "customer_token_here"
}
```

**Automated Actions**:
- ✅ Updates customer last seen timestamp
- ✅ Tracks product popularity
- ✅ Can be used for personalized recommendations (future)

**Mobile App Integration**:
```javascript
// On product detail page
useEffect(() => {
  const startTime = Date.now();
  
  trackEvent('PRODUCT_VIEWED', {
    productId: product.id,
    productTitle: product.title,
    productHandle: product.handle,
    price: product.priceRange.minVariantPrice.amount
  });
  
  return () => {
    const viewDuration = Math.floor((Date.now() - startTime) / 1000);
    // Track view duration on unmount
  };
}, [product]);
```

---

### 7. CUSTOMER_REGISTERED
**When to Use**: New customer completes signup

**Payload Structure**:
```json
{
  "eventType": "CUSTOMER_REGISTERED",
  "payload": {
    "customerId": "gid://shopify/Customer/123",
    "email": "customer@example.com",
    "firstName": "John",
    "registeredAt": "2024-01-09T10:00:00Z"
  },
  "customerAccessToken": "customer_token_here"
}
```

**Automated Actions**:
- ✅ Sends welcome push notification
- ✅ Creates customer profile
- ✅ Links push token to customer

**Push Notification Sent**:
```
Title: "👋 Welcome!"
Body: "Thanks for joining us! Check out our latest products and exclusive offers."
```

**Mobile App Integration**:
```javascript
// After successful signup
await trackEvent('CUSTOMER_REGISTERED', {
  customerId: customer.id,
  email: customer.email,
  firstName: customer.firstName,
  registeredAt: new Date().toISOString()
});
```

---

### 8. APP_OPENED
**When to Use**: Customer opens the mobile app

**Payload Structure**:
```json
{
  "eventType": "APP_OPENED",
  "payload": {
    "timestamp": "2024-01-09T10:00:00Z",
    "sessionId": "session_123",
    "platform": "ios",
    "appVersion": "1.0.0"
  },
  "customerAccessToken": "customer_token_here"
}
```

**Automated Actions**:
- ✅ Updates customer last seen timestamp
- ✅ Tracks app engagement metrics
- ✅ Can trigger re-engagement campaigns (future)

**Mobile App Integration**:
```javascript
// In App.tsx or root component
useEffect(() => {
  const handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      trackEvent('APP_OPENED', {
        timestamp: new Date().toISOString(),
        sessionId: generateSessionId(),
        platform: Platform.OS,
        appVersion: Constants.manifest.version
      });
    }
  };
  
  AppState.addEventListener('change', handleAppStateChange);
  return () => AppState.removeEventListener('change', handleAppStateChange);
}, []);
```

---

### 9. SEARCH_PERFORMED
**When to Use**: Customer performs a product search

**Payload Structure**:
```json
{
  "eventType": "SEARCH_PERFORMED",
  "payload": {
    "query": "summer dress",
    "resultsCount": 15,
    "timestamp": "2024-01-09T10:00:00Z",
    "filters": {
      "priceRange": "0-50",
      "category": "clothing"
    }
  },
  "customerAccessToken": "customer_token_here"
}
```

**Automated Actions**:
- ✅ Tracks popular search terms
- ✅ Identifies zero-result searches
- ✅ Can be used for product recommendations (future)

**Mobile App Integration**:
```javascript
// On search submit
const handleSearch = async (query) => {
  const results = await searchProducts(query);
  
  await trackEvent('SEARCH_PERFORMED', {
    query: query,
    resultsCount: results.length,
    timestamp: new Date().toISOString(),
    filters: activeFilters
  });
};
```

---

## 🔧 Implementation Guide

### React Native Hook
```javascript
import { useState, useCallback } from 'react';

const useEventTracking = (shopDomain, customerAccessToken) => {
  const trackEvent = useCallback(async (eventType, payload) => {
    try {
      await fetch('https://your-app.com/api/mobile/events', {
        method: 'POST',
        headers: {
          'X-Shop-Domain': shopDomain,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventType,
          payload,
          customerAccessToken
        })
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }, [shopDomain, customerAccessToken]);

  return { trackEvent };
};

export default useEventTracking;
```

### Usage Example
```javascript
function ProductScreen({ product }) {
  const { trackEvent } = useEventTracking(shopDomain, accessToken);

  useEffect(() => {
    trackEvent('PRODUCT_VIEWED', {
      productId: product.id,
      productTitle: product.title,
      price: product.price
    });
  }, [product]);

  const handleAddToCart = async () => {
    const cart = await addToCart(product.id, 1);
    
    await trackEvent('CART_UPDATED', {
      cartId: cart.id,
      itemCount: cart.lines.length,
      totalAmount: cart.cost.totalAmount.amount
    });
  };

  return (
    <View>
      <Text>{product.title}</Text>
      <Button onPress={handleAddToCart}>Add to Cart</Button>
    </View>
  );
}
```

## 📊 Analytics Dashboard

All events are logged and can be viewed in:
- `/app/analytics` - Overview metrics
- `/app/customers` - Customer-specific events
- Event logs table in database

## 🎯 Best Practices

1. **Always Include Customer Token**: For personalized experiences
2. **Track Consistently**: Use the same payload structure
3. **Don't Over-Track**: Only track meaningful events
4. **Include Context**: Add relevant metadata in payload
5. **Handle Errors**: Gracefully handle tracking failures
6. **Respect Privacy**: Don't track sensitive information

## 🚀 Future Event Types

Planned for future releases:
- `WISHLIST_ADDED` - Product added to wishlist
- `REVIEW_SUBMITTED` - Customer submits product review
- `SHARE_PERFORMED` - Customer shares product
- `NOTIFICATION_CLICKED` - Push notification clicked
- `CHECKOUT_STARTED` - Customer begins checkout
- `PAYMENT_FAILED` - Payment attempt failed

All event types are now fully implemented and ready for use!