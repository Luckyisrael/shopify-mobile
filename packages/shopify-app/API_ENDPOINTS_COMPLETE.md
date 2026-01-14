# Complete API Endpoints Documentation

## 🔗 Base URL
```
http://localhost:3000  (Development)
https://your-app-url.com  (Production)
```

## 📱 Mobile API Endpoints
*All mobile endpoints require `X-Shop-Domain` header*

### Authentication Endpoints

#### 1. Customer Login
```http
POST /api/mobile/auth/login
Content-Type: application/json
X-Shop-Domain: your-shop.myshopify.com

{
  "email": "customer@example.com",
  "password": "password123",
  "pushToken": "ExponentPushToken[xxx]"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "customer": {
    "id": "gid://shopify/Customer/123",
    "firstName": "John",
    "lastName": "Doe",
    "email": "customer@example.com"
  },
  "accessToken": "customer_access_token",
  "expiresAt": "2024-01-10T10:00:00Z"
}
```

#### 2. Customer Signup
```http
POST /api/mobile/auth/signup
Content-Type: application/json
X-Shop-Domain: your-shop.myshopify.com

{
  "email": "newcustomer@example.com",
  "password": "password123",
  "firstName": "Jane",
  "lastName": "Smith",
  "pushToken": "ExponentPushToken[xxx]",  // Optional
  "autoLogin": true  // Optional, default false
}
```

#### 3. Customer Logout
```http
POST /api/mobile/auth/logout
Content-Type: application/json
X-Shop-Domain: your-shop.myshopify.com

{
  "customerAccessToken": "customer_access_token",
  "pushToken": "ExponentPushToken[xxx]"  // Optional
}
```

#### 4. Refresh Token
```http
POST /api/mobile/auth/refresh
Content-Type: application/json
X-Shop-Domain: your-shop.myshopify.com

{
  "customerAccessToken": "expired_token"
}
```

### Product & Shopping Endpoints

#### 5. Get Products
```http
GET /api/mobile/products?first=10&after=cursor
X-Shop-Domain: your-shop.myshopify.com
```

**Response:**
```json
{
  "success": true,
  "products": [
    {
      "id": "gid://shopify/Product/123",
      "title": "Product Name",
      "handle": "product-handle",
      "description": "Product description",
      "featuredImage": {
        "url": "https://cdn.shopify.com/image.jpg"
      },
      "priceRange": {
        "minVariantPrice": {
          "amount": "29.99",
          "currencyCode": "USD"
        }
      },
      "variants": [...]
    }
  ],
  "pageInfo": {
    "hasNextPage": true,
    "endCursor": "cursor_string"
  }
}
```

#### 6. Get Collections
```http
GET /api/mobile/collections?first=10
X-Shop-Domain: your-shop.myshopify.com
```

#### 7. Create Cart
```http
POST /api/mobile/cart
Content-Type: application/json
X-Shop-Domain: your-shop.myshopify.com

{
  "variantId": "gid://shopify/ProductVariant/123",
  "quantity": 2,
  "customerAccessToken": "customer_token"  // Optional
}
```

### Push Notification Endpoints

#### 8. Register Push Token
```http
POST /api/mobile/push/register
Content-Type: application/json
X-Shop-Domain: your-shop.myshopify.com

{
  "token": "ExponentPushToken[xxx]",
  "platform": "ios",  // or "android"
  "customerAccessToken": "customer_token"  // Optional
}
```

### Event Tracking Endpoints

#### 9. Track Events
```http
POST /api/mobile/events
Content-Type: application/json
X-Shop-Domain: your-shop.myshopify.com

{
  "type": "CART_ABANDONED",  // CART_UPDATED, ORDER_CREATED, etc.
  "payload": {
    "cartId": "cart_123",
    "totalAmount": "99.99"
  },
  "customerAccessToken": "customer_token"  // Optional
}
```

### Product Highlights Endpoints (NEW!)

#### 10. Get Active Highlights
```http
GET /api/mobile/highlights
X-Shop-Domain: your-shop.myshopify.com
```

**Response:**
```json
{
  "success": true,
  "highlights": [
    {
      "id": "highlight-uuid",
      "shopifyProductId": "gid://shopify/Product/123",
      "title": "🔥 Flash Sale - 50% Off!",
      "description": "Limited time offer on our best-selling item...",
      "imageUrl": "https://cdn.shopify.com/image.jpg",
      "productUrl": "https://shop.com/products/item",
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

#### 11. Get Specific Highlight (Auto-tracks view)
```http
GET /api/mobile/highlights?id=highlight-uuid
X-Shop-Domain: your-shop.myshopify.com
```

#### 12. Track Highlight Click
```http
POST /api/mobile/highlights
Content-Type: application/json
X-Shop-Domain: your-shop.myshopify.com

{
  "action": "click",
  "highlightId": "highlight-uuid"
}
```

### App Configuration

#### 13. Get Mobile App Config
```http
GET /api/mobile/config
X-Shop-Domain: your-shop.myshopify.com
```

**Response:**
```json
{
  "success": true,
  "config": {
    "appName": "My Store",
    "primaryColor": "#000000",
    "logoUrl": "https://cdn.shopify.com/logo.png",
    "isActive": true
  }
}
```

## 🔧 Admin/Internal Endpoints

### Job Processing

#### 14. Process Automation Jobs
```http
GET /api/jobs/process
Authorization: Bearer your_job_processing_token

POST /api/jobs/process
Authorization: Bearer your_job_processing_token
```

### Health Check

#### 15. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-09T10:00:00Z",
  "database": "connected",
  "merchants": 5,
  "version": "1.0.0"
}
```

### Admin Push Notifications

#### 16. Send Admin Push
```http
POST /api/admin/push
Content-Type: application/json
Authorization: Shopify Admin Session

{
  "title": "New Sale Alert!",
  "body": "Check out our latest deals",
  "audience": "all"  // "all", "logged_in", "cart_owners"
}
```

## 🧪 Testing with cURL

### Test Product Highlights Flow
```bash
# 1. Get active highlights
curl -H "X-Shop-Domain: your-shop.myshopify.com" \
     http://localhost:3000/api/mobile/highlights

# 2. Track a view (get specific highlight)
curl -H "X-Shop-Domain: your-shop.myshopify.com" \
     "http://localhost:3000/api/mobile/highlights?id=highlight-uuid"

# 3. Track a click
curl -X POST \
     -H "X-Shop-Domain: your-shop.myshopify.com" \
     -H "Content-Type: application/json" \
     -d '{"action": "click", "highlightId": "highlight-uuid"}' \
     http://localhost:3000/api/mobile/highlights
```

### Test Authentication Flow
```bash
# 1. Register push token
curl -X POST \
     -H "X-Shop-Domain: your-shop.myshopify.com" \
     -H "Content-Type: application/json" \
     -d '{"token": "ExponentPushToken[test]", "platform": "ios"}' \
     http://localhost:3000/api/mobile/push/register

# 2. Customer login
curl -X POST \
     -H "X-Shop-Domain: your-shop.myshopify.com" \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123"}' \
     http://localhost:3000/api/mobile/auth/login
```

## 📊 Response Codes

- `200` - Success
- `400` - Bad Request (missing parameters)
- `401` - Unauthorized (missing/invalid X-Shop-Domain or auth)
- `404` - Not Found (resource doesn't exist)
- `429` - Rate Limited
- `500` - Server Error

## 🔒 Authentication Requirements

### Mobile API
- **Required**: `X-Shop-Domain` header for all endpoints
- **Optional**: Customer access token for personalized features

### Admin API
- **Required**: Shopify admin session authentication
- **Optional**: Job processing token for internal endpoints

## 🚀 Rate Limits

- Mobile API: 100 requests per 15 minutes per IP
- Job Processing: 10 requests per minute per IP
- Admin Push: 5 requests per minute per merchant

All endpoints return consistent error responses with helpful messages for debugging.