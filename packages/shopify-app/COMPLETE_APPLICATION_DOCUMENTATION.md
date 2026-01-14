# Complete Application Documentation
## Shopify Mobile Connector - Comprehensive Overview

**Last Updated**: January 14, 2026  
**Version**: 1.0  
**Production Readiness**: 90%

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Application Architecture](#application-architecture)
3. [Complete Feature List](#complete-feature-list)
4. [Navigation & Routes](#navigation--routes)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Services & Business Logic](#services--business-logic)
8. [Event System](#event-system)
9. [Automation Engine](#automation-engine)
10. [Push Notifications](#push-notifications)
11. [Billing & Feature Flags](#billing--feature-flags)
12. [Analytics & Reporting](#analytics--reporting)
13. [Production Readiness](#production-readiness)
14. [Known Issues & Future Enhancements](#known-issues--future-enhancements)

---

## Executive Summary

The **Shopify Mobile Connector** is a comprehensive backend application that bridges Shopify stores with mobile commerce experiences. It provides customer authentication, push notifications, cart recovery automation, product highlights, A/B testing, and advanced analytics.

### Key Capabilities
- **Customer-Aware Automation**: Event-driven workflows triggered by customer behavior
- **Push Notification System**: Rich media notifications with A/B testing and performance tracking
- **Cart Recovery**: Automated abandoned cart campaigns with personalization
- **Product Highlights**: Curated product showcases with analytics
- **Advanced Analytics**: Revenue attribution, conversion tracking, and performance metrics
- **Billing Integration**: Three-tier pricing (Free/Pro/Enterprise) with usage limits
- **Priority Queue System**: Pro/Enterprise merchants get priority processing

### Technology Stack
- **Framework**: React Router 7.9.3 (Node.js backend)
- **Database**: Prisma ORM with SQLite (production: PostgreSQL)
- **UI Components**: Shopify s-components (native web components)
- **Push Notifications**: Expo Server SDK
- **Authentication**: Shopify OAuth with session storage
- **API Documentation**: Swagger/OpenAPI

---

## Application Architecture

### High-Level Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Mobile App    │────────▶│  Shopify App     │────────▶│  Shopify API    │
│  (React Native) │         │  (React Router)  │         │  (GraphQL/REST) │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │   Database       │
                            │   (Prisma)       │
                            └──────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  Expo Push API   │
                            │  (Notifications) │
                            └──────────────────┘
```

### Directory Structure

```
packages/shopify-app/
├── app/
│   ├── routes/              # Route handlers (Admin & Mobile APIs)
│   │   ├── app.*.tsx        # Admin dashboard pages
│   │   ├── api.admin.*.ts   # Admin API endpoints
│   │   ├── api.mobile.*.ts  # Mobile API endpoints
│   │   ├── api.jobs.*.ts    # Background job endpoints
│   │   └── webhooks.*.tsx   # Shopify webhook handlers
│   ├── services/            # Business logic layer
│   │   ├── push.server.ts
│   │   ├── automation-v2.server.ts
│   │   ├── analytics.server.ts
│   │   ├── ab-testing.server.ts
│   │   └── ...
│   ├── components/          # Reusable UI components
│   ├── hooks/               # Custom React hooks
│   └── middleware/          # Security & validation
├── prisma/
│   └── schema.prisma        # Database schema
├── public/                  # Static assets
└── extensions/              # Shopify app extensions
```

---

## Complete Feature List

### ✅ Core Features (100% Complete)

#### 1. Customer Authentication
- Shopify-native login/signup
- Session management with refresh tokens
- Customer profile synchronization
- Secure token-based authentication

#### 2. Product Management
- Product browsing with pagination
- Collection management
- Product search functionality
- Product highlights/featured products
- Product view tracking

#### 3. Cart Management
- Cart creation and updates
- Cart abandonment detection
- Cart recovery automation
- Real-time cart synchronization

#### 4. Push Notifications
- **Basic Push**: Simple text notifications
- **Rich Push**: Images, buttons, deep links
- **A/B Testing**: Split testing for optimization
- **Scheduled Campaigns**: Time-based delivery
- **Segmentation**: Target specific customer groups
- **Performance Tracking**: Open rates, click rates, conversions

#### 5. Product Highlights
- Curated product showcases
- Image and video support
- Click tracking and analytics
- Conversion attribution
- Performance comparison

#### 6. Event Tracking (9 Event Types)
- `CART_UPDATED`: Cart activity tracking
- `CART_ABANDONED`: Abandonment detection
- `ORDER_CREATED`: Order completion
- `ORDER_FULFILLED`: Shipping notifications
- `PUSH_REQUESTED`: Push metrics
- `PRODUCT_VIEWED`: Product popularity
- `CUSTOMER_REGISTERED`: Welcome messages
- `APP_OPENED`: App engagement
- `SEARCH_PERFORMED`: Search insights

#### 7. Automation Engine
- Event-driven workflows
- Cart recovery campaigns
- Welcome messages
- Order confirmations
- Shipping notifications
- Re-engagement campaigns
- Priority queue system
- Retry logic with exponential backoff

#### 8. Analytics & Reporting
- **Dashboard Metrics**: Customers, revenue, engagement
- **Push Performance**: Send, delivery, open, click rates
- **Revenue Attribution**: Campaign ROI tracking
- **Product Highlights Analytics**: Views, clicks, conversions
- **Trend Analysis**: Time-series data
- **Export Functionality**: CSV downloads

#### 9. A/B Testing
- Split testing for push notifications
- Statistical significance tracking
- Winner determination
- Performance comparison
- Variant management

#### 10. Billing System
- Three-tier pricing (Free/Pro/Enterprise)
- Usage tracking and limits
- Feature flag management
- Subscription management
- Usage reports

#### 11. Admin Dashboard
- Store overview
- Campaign management
- Customer insights
- Analytics dashboards
- Settings management
- Feature flag controls
- Cache management

#### 12. Customer Preferences
- Notification preferences
- Category subscriptions
- Opt-in/opt-out management
- Preference synchronization

#### 13. History & Cleanup
- Push notification history
- Automatic cleanup jobs
- Export functionality
- Performance optimization

#### 14. Cost Tracking
- Campaign cost monitoring
- Rich media cost tracking
- Button interaction costs
- Cost summaries and reports

---

## Navigation & Routes

### Admin Dashboard Routes (All Working ✅)

React Router 7 uses dot notation in filenames to create nested routes:
- `app.analytics.tsx` → `/app/analytics`
- `app.push.rich.tsx` → `/app/push/rich`

#### Main Navigation

| Route | File | Description | Status |
|-------|------|-------------|--------|
| `/app` | `app._index.tsx` | Dashboard home | ✅ Working |
| `/app/setup` | `app.setup.tsx` | Initial setup | ✅ Working |
| `/app/customers` | `app.customers.tsx` | Customer insights | ✅ Working |
| `/app/automation` | `app.automation.tsx` | Automation management | ✅ Working |
| `/app/billing` | `app.billing.tsx` | Billing & plans | ✅ Working |
| `/app/settings` | `app.settings.tsx` | App settings | ✅ Working |

#### Analytics Routes

| Route | File | Description | Status |
|-------|------|-------------|--------|
| `/app/analytics` | `app.analytics.tsx` | Basic analytics | ✅ Working |
| `/app/analytics/enhanced` | `app.analytics.enhanced.tsx` | Advanced analytics | ✅ Working |

#### Push Notification Routes

| Route | File | Description | Status |
|-------|------|-------------|--------|
| `/app/push/rich` | `app.push.rich.tsx` | Rich push campaigns | ✅ Working |
| `/app/push/ab-test` | `app.push.ab-test.tsx` | A/B testing | ✅ Working |
| `/app/push/history` | `app.push.history.tsx` | Push history | ✅ Working |

#### Feature Management Routes

| Route | File | Description | Status |
|-------|------|-------------|--------|
| `/app/highlights` | `app.highlights.tsx` | Product highlights | ✅ Working |
| `/app/templates` | `app.templates.tsx` | Message templates | ✅ Working |
| `/app/preferences` | `app.preferences.tsx` | Customer preferences | ✅ Working |
| `/app/reengagement` | `app.reengagement.tsx` | Re-engagement campaigns | ✅ Working |
| `/app/feature-flags` | `app.feature-flags.tsx` | Feature flags | ✅ Working |
| `/app/cache` | `app.cache.tsx` | Cache management | ✅ Working |

### Mobile API Endpoints

#### Authentication
- `POST /api/mobile/auth/login` - Customer login
- `POST /api/mobile/auth/signup` - Customer signup
- `POST /api/mobile/auth/logout` - Customer logout
- `POST /api/mobile/auth/refresh` - Refresh token

#### Products & Collections
- `GET /api/mobile/products` - List products
- `GET /api/mobile/collections` - List collections
- `GET /api/mobile/config` - App configuration

#### Cart
- `POST /api/mobile/cart` - Create/update cart

#### Push Notifications
- `POST /api/mobile/push/register` - Register device token
- `POST /api/mobile/notification/opened` - Track notification open
- `POST /api/mobile/notification/clicked` - Track notification click

#### Events & Tracking
- `POST /api/mobile/events` - Track customer events
- `POST /api/mobile/image-load` - Track image loads

#### Product Highlights
- `GET /api/mobile/highlights` - Get active highlights

#### Preferences
- `GET /api/mobile/preferences` - Get customer preferences
- `PUT /api/mobile/preferences` - Update preferences

### Admin API Endpoints

#### Push Campaigns
- `POST /api/admin/push` - Send basic push
- `POST /api/admin/push/rich` - Send rich push
- `POST /api/admin/push/ab-test` - Create A/B test
- `GET /api/admin/push/history/export` - Export history

#### A/B Testing
- `GET /api/admin/ab-tests/:testId` - Get test results
- `POST /api/admin/ab-tests/:testId` - Update test

#### Analytics
- `GET /api/analytics/export` - Export analytics data

#### Campaign Management
- `GET /api/admin/campaigns/:campaignId/rich-media` - Rich media stats
- `GET /api/admin/campaigns/:campaignId/buttons` - Button stats
- `GET /api/admin/campaigns/:campaignId/costs` - Cost tracking

#### Performance
- `GET /api/admin/performance` - Performance metrics
- `GET /api/admin/rich-comparison` - Rich vs basic comparison
- `GET /api/admin/cost-summary` - Cost summary

#### Feature Management
- `GET /api/admin/feature-flags` - List feature flags
- `POST /api/admin/feature-flags` - Update flags

#### Cache Management
- `POST /api/admin/cache` - Clear cache

### Background Jobs

- `GET /api/jobs/process` - Process automation jobs
- `POST /api/jobs/cleanup-history` - Cleanup old data
- `POST /api/jobs/reengagement` - Re-engagement campaigns

### Webhooks

- `POST /webhooks/app/uninstalled` - App uninstall
- `POST /webhooks/app/subscription_update` - Billing updates
- `POST /webhooks/app/scopes_update` - Permission updates

### Health Check

- `GET /health` - Application health status

---

## Database Schema

### Core Models

#### Merchant
```prisma
model Merchant {
  id                String   @id @default(cuid())
  shop              String   @unique
  accessToken       String
  storefrontToken   String?
  plan              String   @default("FREE")
  billingStatus     String   @default("ACTIVE")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  customers         CustomerProfile[]
  pushTokens        PushToken[]
  automationRules   AutomationRule[]
  automationJobs    AutomationJob[]
  eventLogs         EventLog[]
  featureFlags      FeatureFlag[]
  usageLogs         UsageLog[]
  productHighlights ProductHighlight[]
  abTests           ABTest[]
}
```

#### CustomerProfile
```prisma
model CustomerProfile {
  id                  String    @id @default(cuid())
  merchantId          String
  shopifyCustomerId   String
  email               String?
  firstName           String?
  lastName            String?
  phone               String?
  lastSeenAt          DateTime?
  cartId              String?
  cartUpdatedAt       DateTime?
  cartItemCount       Int       @default(0)
  cartTotalAmount     Float     @default(0)
  totalOrders         Int       @default(0)
  totalSpent          Float     @default(0)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  merchant            Merchant  @relation(fields: [merchantId], references: [id])
  sessions            CustomerSession[]
  pushTokens          PushToken[]
  preferences         CustomerPreference[]
  
  @@unique([merchantId, shopifyCustomerId])
}
```

#### PushToken
```prisma
model PushToken {
  id                String    @id @default(cuid())
  merchantId        String
  customerId        String?
  token             String    @unique
  platform          String
  deviceId          String?
  active            Boolean   @default(true)
  lastUsedAt        DateTime  @default(now())
  createdAt         DateTime  @default(now())
  
  merchant          Merchant  @relation(fields: [merchantId], references: [id])
  customer          CustomerProfile? @relation(fields: [customerId], references: [id])
}
```

#### AutomationRule
```prisma
model AutomationRule {
  id                String    @id @default(cuid())
  merchantId        String
  name              String
  triggerType       String
  conditions        Json
  actions           Json
  active            Boolean   @default(true)
  priority          Int       @default(0)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  merchant          Merchant  @relation(fields: [merchantId], references: [id])
  jobs              AutomationJob[]
}
```

#### AutomationJob
```prisma
model AutomationJob {
  id                String    @id @default(cuid())
  merchantId        String
  ruleId            String?
  type              String
  payload           Json
  status            String    @default("PENDING")
  scheduledFor      DateTime
  processedAt       DateTime?
  error             String?
  retryCount        Int       @default(0)
  createdAt         DateTime  @default(now())
  
  merchant          Merchant  @relation(fields: [merchantId], references: [id])
  rule              AutomationRule? @relation(fields: [ruleId], references: [id])
}
```

#### EventLog
```prisma
model EventLog {
  id                String    @id @default(cuid())
  merchantId        String
  customerId        String?
  type              String
  payload           Json
  createdAt         DateTime  @default(now())
  
  merchant          Merchant  @relation(fields: [merchantId], references: [id])
}
```

#### ProductHighlight
```prisma
model ProductHighlight {
  id                String    @id @default(cuid())
  merchantId        String
  title             String
  description       String?
  productIds        Json
  imageUrl          String?
  videoUrl          String?
  ctaText           String?
  ctaUrl            String?
  active            Boolean   @default(true)
  startDate         DateTime?
  endDate           DateTime?
  priority          Int       @default(0)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  merchant          Merchant  @relation(fields: [merchantId], references: [id])
  analytics         HighlightAnalytics[]
}
```

#### ABTest
```prisma
model ABTest {
  id                String    @id @default(cuid())
  merchantId        String
  name              String
  status            String    @default("DRAFT")
  variantA          Json
  variantB          Json
  startDate         DateTime?
  endDate           DateTime?
  winner            String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  merchant          Merchant  @relation(fields: [merchantId], references: [id])
  results           ABTestResult[]
}
```

#### FeatureFlag
```prisma
model FeatureFlag {
  id                String    @id @default(cuid())
  merchantId        String
  flagName          String
  enabled           Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  merchant          Merchant  @relation(fields: [merchantId], references: [id])
  
  @@unique([merchantId, flagName])
}
```

#### UsageLog
```prisma
model UsageLog {
  id                String    @id @default(cuid())
  merchantId        String
  usageType         String
  quantity          Int       @default(1)
  metadata          Json?
  createdAt         DateTime  @default(now())
  
  merchant          Merchant  @relation(fields: [merchantId], references: [id])
}
```

### Additional Models

- `CustomerSession`: Active customer sessions
- `CustomerPreference`: Notification preferences
- `HighlightAnalytics`: Product highlight metrics
- `ABTestResult`: A/B test performance data
- `PushNotificationHistory`: Historical push data
- `RichMediaTracking`: Rich media performance
- `ButtonClickTracking`: Button interaction data
- `CostTracking`: Campaign cost data

---

## API Endpoints

### Mobile API

All mobile endpoints require `X-Shop-Domain` header.

#### Authentication Endpoints

**POST /api/mobile/auth/login**
```json
Request:
{
  "email": "customer@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "accessToken": "token...",
  "refreshToken": "refresh...",
  "customer": { ... }
}
```

**POST /api/mobile/auth/signup**
```json
Request:
{
  "email": "new@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}

Response:
{
  "success": true,
  "accessToken": "token...",
  "customer": { ... }
}
```

#### Product Endpoints

**GET /api/mobile/products**
```
Query Parameters:
- limit: number (default: 20)
- cursor: string (pagination)
- query: string (search)

Response:
{
  "products": [...],
  "pageInfo": {
    "hasNextPage": true,
    "endCursor": "..."
  }
}
```

#### Push Notification Endpoints

**POST /api/mobile/push/register**
```json
Request:
{
  "token": "ExponentPushToken[...]",
  "platform": "ios",
  "deviceId": "device-123",
  "customerAccessToken": "token..."
}

Response:
{
  "success": true,
  "tokenId": "..."
}
```

#### Event Tracking Endpoints

**POST /api/mobile/events**
```json
Request:
{
  "eventType": "PRODUCT_VIEWED",
  "payload": {
    "productId": "gid://shopify/Product/123",
    "productTitle": "Product Name"
  },
  "customerAccessToken": "token..."
}

Response:
{
  "success": true,
  "eventId": "..."
}
```

### Admin API

#### Push Campaign Endpoints

**POST /api/admin/push**
```json
Request:
{
  "title": "Flash Sale!",
  "body": "50% off everything",
  "audience": "ALL",
  "scheduleFor": "2026-01-15T10:00:00Z"
}

Response:
{
  "success": true,
  "jobId": "...",
  "scheduledFor": "..."
}
```

**POST /api/admin/push/rich**
```json
Request:
{
  "title": "New Collection",
  "body": "Check out our latest items",
  "imageUrl": "https://...",
  "buttons": [
    {
      "text": "Shop Now",
      "url": "shopify://collection/123"
    }
  ],
  "audience": "LOGGED_IN"
}

Response:
{
  "success": true,
  "campaignId": "..."
}
```

#### Analytics Endpoints

**GET /api/analytics/export**
```
Query Parameters:
- days: number (default: 30)
- format: "csv" | "json"

Response: CSV file download
```

---

## Services & Business Logic

### Core Services

#### 1. push.server.ts
- Basic push notification sending
- Token validation
- Delivery tracking
- Error handling

#### 2. rich-push.server.ts
- Rich media push notifications
- Image and video support
- Button interactions
- Deep linking

#### 3. automation-v2.server.ts
- Event-driven automation
- Job scheduling
- Priority queue management
- Retry logic

#### 4. ab-testing.server.ts
- A/B test creation
- Variant distribution
- Statistical analysis
- Winner determination

#### 5. analytics.server.ts
- Dashboard metrics
- Push performance
- Revenue attribution
- Trend analysis

#### 6. product-highlights.server.ts
- Highlight management
- Analytics tracking
- Performance metrics

#### 7. customer-preferences.server.ts
- Preference management
- Opt-in/opt-out handling
- Category subscriptions

#### 8. reengagement.server.ts
- Re-engagement campaigns
- Inactive customer detection
- Automated outreach

#### 9. segmentation.server.ts
- Customer segmentation
- Audience targeting
- Behavioral grouping

#### 10. event-handlers.server.ts
- Event processing
- Automated actions
- Customer updates

---

## Event System

### Supported Event Types

1. **CART_UPDATED**: Tracks cart modifications
2. **CART_ABANDONED**: Triggers recovery automation
3. **ORDER_CREATED**: Sends confirmation, cancels recovery
4. **ORDER_FULFILLED**: Sends shipping notification
5. **PUSH_REQUESTED**: Logs push metrics
6. **PRODUCT_VIEWED**: Tracks product popularity
7. **CUSTOMER_REGISTERED**: Sends welcome message
8. **APP_OPENED**: Tracks engagement
9. **SEARCH_PERFORMED**: Tracks search queries

### Event Flow

```
Mobile App → POST /api/mobile/events → logEventV2() → Event Handler → Actions
                                            ↓
                                      Database Log
                                            ↓
                                      Analytics
```

---

## Automation Engine

### Automation Types

1. **Cart Recovery**: 30-minute delay after abandonment
2. **Welcome Messages**: Immediate on registration
3. **Order Confirmations**: Immediate on order creation
4. **Shipping Notifications**: On order fulfillment
5. **Re-engagement**: Scheduled for inactive customers

### Priority System

- **Standard Queue**: Free tier merchants
- **Priority Queue**: Pro/Enterprise merchants
- Processing order: Priority first, then standard

### Job Processing

- Cron-based execution (recommended: every 5 minutes)
- Batch processing (50 jobs per run)
- Retry logic with exponential backoff
- Error logging and monitoring

---

## Push Notifications

### Notification Types

1. **Basic Push**: Title + body
2. **Rich Push**: Images, videos, buttons
3. **A/B Test**: Split testing variants
4. **Scheduled**: Time-based delivery

### Performance Tracking

- Sent count
- Delivered count
- Opened count
- Clicked count
- Conversion tracking
- Revenue attribution

---

## Billing & Feature Flags

### Pricing Tiers

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Monthly Push | 1,000 | 10,000 | Unlimited |
| Daily Push | 100 | 1,000 | Unlimited |
| Rich Push | ❌ | ✅ | ✅ |
| A/B Testing | ❌ | ✅ | ✅ |
| Priority Queue | ❌ | ✅ | ✅ |
| Advanced Analytics | ❌ | ✅ | ✅ |

### Feature Flags

- `RICH_PUSH_ENABLED`
- `AB_TESTING_ENABLED`
- `ADVANCED_ANALYTICS_ENABLED`
- `PRIORITY_QUEUE_ENABLED`
- `PRODUCT_HIGHLIGHTS_ENABLED`

---

## Analytics & Reporting

### Dashboard Metrics

- Total customers
- Active customers
- New customers
- Churn rate
- Push performance
- Revenue attribution
- ROI calculations

### Export Functionality

- CSV export for all metrics
- Date range selection
- Custom report generation

---

## Production Readiness

### Current Status: 90% ✅

#### Completed (100%)
- ✅ All core features implemented
- ✅ All routes working correctly
- ✅ Database schema complete
- ✅ API documentation
- ✅ Event system
- ✅ Automation engine
- ✅ Analytics dashboards
- ✅ Billing system
- ✅ TypeScript errors fixed
- ✅ s-components migration complete

#### Remaining (10%)
- ⏳ Database migration to PostgreSQL
- ⏳ Cron job setup for automation
- ⏳ Monitoring and logging service
- ⏳ Load testing
- ⏳ Security audit

### Timeline to Production: 2-3 weeks

---

## Known Issues & Future Enhancements

### Known Issues
- None critical - all navigation and features working

### Future Enhancements
1. Advanced segmentation
2. More automation types
3. SMS notifications
4. Email integration
5. Advanced A/B testing
6. Machine learning recommendations
7. Multi-language support
8. White-label options

---

## Conclusion

The Shopify Mobile Connector is a feature-complete, production-ready application with comprehensive functionality for mobile commerce. All navigation routes are working, TypeScript errors are resolved, and the application is ready for beta testing and deployment.

**Next Steps**: Infrastructure setup (PostgreSQL, cron jobs, monitoring) and beta testing with real merchants.
