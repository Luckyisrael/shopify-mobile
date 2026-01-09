# Shopify Mobile Commerce Platform Documentation

Complete documentation for the Shopify Mobile Commerce Platform monorepo.

## 📚 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Package Documentation](#package-documentation)
- [Implementation Phases](#implementation-phases)
- [API Reference](#api-reference)
- [Deployment Guide](#deployment-guide)
- [Contributing](#contributing)

## Overview

The Shopify Mobile Commerce Platform is a complete solution for building mobile commerce experiences on Shopify. It consists of three main packages:

1. **Shopify App** (`packages/shopify-app`) - Backend API and admin dashboard
2. **Mobile App Template** (`packages/mobile-app-template`) - React Native template
3. **SDK** (`packages/sdk`) - TypeScript SDK for API integration

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Shopify Admin                             │
│              (Merchant installs app here)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ OAuth + Webhooks
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         packages/shopify-app (Backend)                      │
│              (React Router + Prisma)                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Admin Dashboard                                      │  │
│  │ - Setup, Customers, Automation, Billing             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Mobile API (REST)                                    │  │
│  │ - /api/mobile/auth/* (customer auth)                │  │
│  │ - /api/mobile/products (catalog)                    │  │
│  │ - /api/mobile/cart (shopping)                       │  │
│  │ - /api/mobile/push/register (notifications)         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Automation Engine                                    │  │
│  │ - Cart recovery campaigns                            │  │
│  │ - Scheduled push notifications                       │  │
│  │ - Event-driven workflows                             │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ REST API / SDK
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         packages/mobile-app-template                        │
│         (React Native + Expo)                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Customer Experience                                  │  │
│  │ - Product browsing                                   │  │
│  │ - Authentication                                     │  │
│  │ - Shopping cart                                      │  │
│  │ - Push notifications                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 20.19+
- npm 10+
- Shopify Partner Account
- Development store or Shopify Plus sandbox
- Expo CLI (for mobile development)

### Quick Setup

```bash
# Clone and install
git clone <repository-url>
cd shopify-mobile-commerce-platform
npm install

# Start Shopify app
npm run dev:shopify-app

# Start mobile app (in another terminal)
npm run dev:mobile-app
```

## Package Documentation

### 📦 Shopify App (`packages/shopify-app`)

**Purpose**: Backend Shopify app providing APIs and automation

**Key Features**:
- Customer authentication with Shopify accounts
- Push notification automation
- Cart recovery campaigns
- Admin dashboard for merchants
- Event-driven automation system

**Documentation**: [Shopify App README](../packages/shopify-app/README.md)

### 📱 Mobile App Template (`packages/mobile-app-template`)

**Purpose**: React Native template for mobile commerce apps

**Key Features**:
- Product browsing and search
- Customer authentication
- Shopping cart management
- Push notifications
- Shopify Restyle UI components

**Documentation**: [Mobile App README](../packages/mobile-app-template/README.md)

### 🛠️ SDK (`packages/sdk`)

**Purpose**: TypeScript SDK for easy API integration

**Key Features**:
- Type-safe API client
- Authentication helpers
- Error handling
- Request/response interceptors

**Documentation**: [SDK README](../packages/sdk/README.md)

## Implementation Phases

The platform was built in phases, each adding core functionality:

### ✅ Phase 3: Customer Identity & Session Layer
- **Goal**: Shopify-native customer authentication
- **Status**: Complete
- **Documentation**: [Phase 3 Completion](./PHASE3_COMPLETION.md)

**Key Achievements**:
- Customer signup/login/logout via Shopify Storefront API
- Session management with refresh tokens
- Push token linking to customer accounts
- Cart persistence across devices
- Admin UI for customer health monitoring

### ✅ Phase 6: Event-Driven Automation
- **Goal**: Customer-aware automation system
- **Status**: Complete
- **Documentation**: [Phase 6 Completion](./PHASE6_COMPLETION.md)

**Key Achievements**:
- Cart recovery automation with customer targeting
- Scheduled push campaigns with audience segmentation
- Priority job queues (Free/Pro/Enterprise)
- Shopify webhook integration
- Usage tracking and billing enforcement

## API Reference

### Mobile API Endpoints

All mobile endpoints require `X-Shop-Domain` header.

#### Authentication
```http
POST /api/mobile/auth/login
POST /api/mobile/auth/signup
POST /api/mobile/auth/logout
POST /api/mobile/auth/refresh
```

#### Products & Collections
```http
GET /api/mobile/products?cursor=<cursor>&limit=<limit>
GET /api/mobile/collections
```

#### Shopping Cart
```http
POST /api/mobile/cart
```

#### Push Notifications
```http
POST /api/mobile/push/register
```

#### Event Tracking
```http
POST /api/mobile/events
```

### Admin API Endpoints

#### Push Campaigns
```http
POST /api/admin/push
```

#### Job Processing
```http
GET /api/jobs/process
POST /api/jobs/process
```

### Webhook Endpoints

```http
POST /webhooks/carts/update
POST /webhooks/orders/create
POST /webhooks/orders/fulfilled
POST /webhooks/app/uninstalled
POST /webhooks/app/subscription_update
```

## Deployment Guide

### Shopify App Deployment

1. **Environment Setup**
   ```env
   SHOPIFY_API_KEY=your_api_key
   SHOPIFY_API_SECRET=your_api_secret
   SHOPIFY_APP_URL=https://your-app-url.com
   ```

2. **Database Migration**
   ```bash
   cd packages/shopify-app
   npx prisma migrate deploy
   ```

3. **Deploy to Cloud**
   - Google Cloud Run
   - Fly.io
   - Render
   - Railway

4. **Job Processing Setup**
   - Set up cron job to call `/api/jobs/process` every 5 minutes
   - Or use cloud scheduler (Google Cloud Scheduler, AWS EventBridge)

### Mobile App Deployment

1. **Configure EAS**
   ```bash
   cd packages/mobile-app-template
   eas login
   eas build:configure
   ```

2. **Build for Stores**
   ```bash
   # iOS
   eas build --platform ios --profile production
   eas submit --platform ios
   
   # Android
   eas build --platform android --profile production
   eas submit --platform android
   ```

3. **Push Notification Setup**
   - Configure Firebase for Android
   - Set up APNs for iOS
   - Add credentials to EAS

## Development Workflow

### Working on Shopify App

```bash
cd packages/shopify-app
npm run dev
```

### Working on Mobile App

```bash
cd packages/mobile-app-template
npm run start
```

### Working on SDK

```bash
cd packages/sdk
npm run dev
```

### Running All Tests

```bash
npm run test:all
```

### Linting All Packages

```bash
npm run lint:all
```

## Database Schema

### Core Models

- **Merchant** - Shopify store information and relationships
- **CustomerProfile** - Lightweight customer data mirror
- **CustomerSession** - Active customer authentication sessions
- **PushToken** - Device tokens for push notifications
- **AutomationRule** - Automation configurations
- **AutomationJob** - Individual automation job instances
- **EventLog** - Customer-aware event tracking
- **FeatureFlags** - Plan-based feature controls
- **UsageLog** - Billing and usage tracking

### Relationships

```
Merchant (1) → (many) CustomerProfile
Merchant (1) → (many) CustomerSession
Merchant (1) → (many) PushToken
Merchant (1) → (many) AutomationRule
Merchant (1) → (many) AutomationJob
Merchant (1) → (one) FeatureFlags
```

## Monitoring & Observability

### Logging

- Structured logging for all API requests
- Job processing logs with success/failure tracking
- Event logs for debugging automation flows

### Metrics

- Customer authentication success rates
- Push notification delivery rates
- Cart recovery conversion rates
- API response times and error rates

### Alerting

- Failed job processing
- High error rates
- Usage limit violations
- Webhook delivery failures

## Security Considerations

### Authentication

- Shopify OAuth for merchant authentication
- Customer authentication via Shopify Storefront API
- Session tokens with expiration and refresh

### API Security

- HMAC verification for webhooks
- Rate limiting on authentication endpoints
- Input validation and sanitization
- CORS configuration

### Data Protection

- No plaintext password storage
- Customer data encrypted in transit
- Minimal PII storage
- GDPR compliance considerations

## Performance Optimization

### Database

- Proper indexing on frequently queried fields
- Connection pooling for high concurrency
- Query optimization for large datasets

### API

- Response caching where appropriate
- Pagination for large result sets
- Batch processing for bulk operations

### Mobile App

- Image optimization and caching
- Lazy loading for product lists
- Offline support for critical features

## Troubleshooting

### Common Issues

1. **Webhook Delivery Failures**
   - Check HMAC signature verification
   - Verify webhook URL accessibility
   - Review Shopify webhook logs

2. **Push Notification Issues**
   - Validate Expo push tokens
   - Check Firebase/APNs configuration
   - Verify device registration

3. **Authentication Problems**
   - Check Shopify app scopes
   - Verify storefront access token
   - Review session expiration handling

4. **Job Processing Delays**
   - Monitor job queue size
   - Check for failed jobs blocking queue
   - Verify cron job scheduling

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Code Standards

- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Conventional commits for git history

### Testing

- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical user flows

## Support

- **Documentation**: This docs folder
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **API Reference**: Individual package READMEs

## License

MIT License - see [LICENSE](../LICENSE) for details.