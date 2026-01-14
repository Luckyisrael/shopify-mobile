# Swagger API Documentation Examples

## 🎯 Access Your API Documentation

Your Swagger documentation is now available at:
- **Interactive UI**: `http://localhost:3000/api/docs`
- **JSON Spec**: `http://localhost:3000/api/docs?format=json`

## 📱 Mobile API Examples

### 1. Customer Authentication Flow

```javascript
// 1. Customer Signup
const signupResponse = await fetch('/api/mobile/auth/signup', {
  method: 'POST',
  headers: {
    'X-Shop-Domain': 'your-shop.myshopify.com',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'customer@example.com',
    password: 'password123',
    firstName: 'John',
    lastName: 'Doe',
    autoLogin: true,
    pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
  })
});

// 2. Customer Login
const loginResponse = await fetch('/api/mobile/auth/login', {
  method: 'POST',
  headers: {
    'X-Shop-Domain': 'your-shop.myshopify.com',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'customer@example.com',
    password: 'password123',
    pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
  })
});

const { customer, accessToken, expiresAt } = await loginResponse.json();

// 3. Customer Logout
const logoutResponse = await fetch('/api/mobile/auth/logout', {
  method: 'POST',
  headers: {
    'X-Shop-Domain': 'your-shop.myshopify.com',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    accessToken: accessToken,
    pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
  })
});
```

### 2. Product Highlights (Stories) Flow

```javascript
// 1. Fetch Active Highlights
const highlightsResponse = await fetch('/api/mobile/highlights', {
  headers: {
    'X-Shop-Domain': 'your-shop.myshopify.com'
  }
});

const { highlights, count } = await highlightsResponse.json();

// 2. View Specific Highlight (auto-tracks view)
const highlightResponse = await fetch(`/api/mobile/highlights?id=${highlightId}`, {
  headers: {
    'X-Shop-Domain': 'your-shop.myshopify.com'
  }
});

const { highlight } = await highlightResponse.json();

// 3. Track Highlight Click
const clickResponse = await fetch('/api/mobile/highlights', {
  method: 'POST',
  headers: {
    'X-Shop-Domain': 'your-shop.myshopify.com',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'click',
    highlightId: highlightId
  })
});
```

### 3. Products & Collections

```javascript
// 1. Fetch Products with Pagination
const productsResponse = await fetch('/api/mobile/products?first=20&sortKey=PRICE&reverse=false', {
  headers: {
    'X-Shop-Domain': 'your-shop.myshopify.com'
  }
});

const { products, pageInfo } = await productsResponse.json();

// 2. Search Products
const searchResponse = await fetch('/api/mobile/products?query=shirt&first=10', {
  headers: {
    'X-Shop-Domain': 'your-shop.myshopify.com'
  }
});

// 3. Fetch Collections
const collectionsResponse = await fetch('/api/mobile/collections?first=10', {
  headers: {
    'X-Shop-Domain': 'your-shop.myshopify.com'
  }
});

const { collections } = await collectionsResponse.json();
```

### 4. Push Notifications

```javascript
// Register Device for Push Notifications
const registerResponse = await fetch('/api/mobile/push/register', {
  method: 'POST',
  headers: {
    'X-Shop-Domain': 'your-shop.myshopify.com',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    deviceToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    platform: 'ios',
    shopifyCustomerId: 'gid://shopify/Customer/123456789' // Optional
  })
});
```

## 🔧 React Native Integration Example

```javascript
import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';

const useShopifyMobileAPI = (shopDomain) => {
  const [highlights, setHighlights] = useState([]);
  const [customer, setCustomer] = useState(null);

  const apiCall = async (endpoint, options = {}) => {
    const response = await fetch(`https://your-app-domain.com${endpoint}`, {
      ...options,
      headers: {
        'X-Shop-Domain': shopDomain,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API Error');
    }
    
    return response.json();
  };

  const login = async (email, password) => {
    // Get push token
    const pushToken = await Notifications.getExpoPushTokenAsync();
    
    const result = await apiCall('/api/mobile/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        pushToken: pushToken.data
      })
    });
    
    setCustomer(result.customer);
    return result;
  };

  const fetchHighlights = async () => {
    const result = await apiCall('/api/mobile/highlights');
    setHighlights(result.highlights);
    return result;
  };

  const trackHighlightClick = async (highlightId) => {
    return apiCall('/api/mobile/highlights', {
      method: 'POST',
      body: JSON.stringify({
        action: 'click',
        highlightId
      })
    });
  };

  return {
    login,
    fetchHighlights,
    trackHighlightClick,
    highlights,
    customer,
    apiCall
  };
};

export default useShopifyMobileAPI;
```

## 📊 Response Examples

### Product Highlight Response
```json
{
  "success": true,
  "highlights": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "shopifyProductId": "gid://shopify/Product/123456789",
      "title": "🔥 Flash Sale - 50% Off!",
      "description": "Limited time offer on our best-selling summer collection",
      "imageUrl": "https://cdn.shopify.com/s/files/1/0123/4567/products/shirt.jpg",
      "productUrl": "https://shop.myshopify.com/products/summer-shirt",
      "ctaText": "Shop Now",
      "isActive": true,
      "expiresAt": "2024-01-11T10:00:00Z",
      "viewCount": 150,
      "clickCount": 23,
      "createdAt": "2024-01-09T10:00:00Z",
      "timeRemaining": 172800000,
      "isExpired": false
    }
  ],
  "count": 1
}
```

### Customer Login Response
```json
{
  "success": true,
  "customer": {
    "id": "gid://shopify/Customer/123456789",
    "firstName": "John",
    "lastName": "Doe",
    "email": "customer@example.com",
    "phone": "+1234567890"
  },
  "accessToken": "c7a4b2e8f9d1a3b5c6e7f8g9h0i1j2k3",
  "expiresAt": "2024-01-10T10:00:00Z"
}
```

### Error Response
```json
{
  "error": "Product highlight limit reached (20 per month). Upgrade to Pro for more highlights.",
  "code": "LIMIT_EXCEEDED"
}
```

## 🎯 Testing with Swagger UI

1. **Navigate to API Docs**: Go to `http://localhost:3000/api/docs`
2. **Set Shop Domain**: The UI will auto-add `X-Shop-Domain: your-shop.myshopify.com`
3. **Try Endpoints**: Click "Try it out" on any endpoint
4. **View Responses**: See real-time responses and examples
5. **Copy cURL**: Get cURL commands for testing

## 🔐 Authentication Notes

- All mobile endpoints require the `X-Shop-Domain` header
- Customer endpoints return access tokens for Shopify Storefront API
- Push token registration links devices to specific shops
- Rate limiting is applied per shop domain

Your API is now fully documented and ready for mobile app integration!