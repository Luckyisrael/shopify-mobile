# Shopify Mobile Commerce App

Backend Shopify app that provides customer-aware automation, push notifications, and cart recovery for mobile commerce experiences.

## Features

- ✅ **Customer Authentication** - Shopify-native login/signup with session management
- ✅ **Push Notifications** - Expo-powered notifications with customer targeting
- ✅ **Cart Recovery** - Automated abandoned cart recovery campaigns
- ✅ **Event-Driven Automation** - Customer-aware automation triggered by Shopify webhooks
- ✅ **Admin Dashboard** - Merchant interface for managing campaigns and settings
- ✅ **Billing Integration** - Three-tier pricing with usage limits (Free/Pro/Enterprise)
- ✅ **Priority Queues** - Pro/Enterprise merchants get priority job processing

## Tech Stack

- **Framework**: React Router 7.9.3 (Node.js backend)
- **Database**: Prisma ORM with SQLite (configurable to PostgreSQL/MySQL)
- **Shopify Integration**: Shopify App React Router, Storefront API
- **Push Notifications**: Expo Server SDK
- **Authentication**: Shopify OAuth with session storage
- **Job Queue**: Custom automation engine with priority queues

## Quick Start

### Prerequisites

- Node.js 20.19+
- Shopify Partner Account
- Development store or Shopify Plus sandbox

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Shopify app credentials

# Set up database
npm run setup

# Start development server
npm run dev
```

### Environment Variables

```env
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-app-url.com
SCOPES=read_products,read_customers,read_orders,write_checkouts
```

## API Endpoints

### Mobile API

All mobile endpoints require `X-Shop-Domain` header for merchant identification.

#### Authentication
- `POST /api/mobile/auth/login` - Customer login
- `POST /api/mobile/auth/signup` - Customer signup
- `POST /api/mobile/auth/logout` - Customer logout
- `POST /api/mobile/auth/refresh` - Refresh session token

#### Products & Cart
- `GET /api/mobile/products` - List products with pagination
- `GET /api/mobile/collections` - List product collections
- `POST /api/mobile/cart` - Create shopping cart

#### Push Notifications
- `POST /api/mobile/push/register` - Register device for push notifications

#### Events
- `POST /api/mobile/events` - Track customer events for automation

### Admin API

#### Push Campaigns
- `POST /api/admin/push` - Send manual push notifications

#### Job Processing
- `GET/POST /api/jobs/process` - Process automation jobs

### Webhooks

- `POST /webhooks/carts/update` - Cart abandonment detection
- `POST /webhooks/orders/create` - Order completion handling
- `POST /webhooks/orders/fulfilled` - Fulfillment tracking
- `POST /webhooks/app/uninstalled` - App uninstall cleanup
- `POST /webhooks/app/subscription_update` - Billing updates

## Database Schema

### Core Models

- **Merchant** - Shopify store information
- **CustomerProfile** - Customer information mirror
- **CustomerSession** - Active customer sessions
- **PushToken** - Device tokens for notifications
- **AutomationRule** - Automation configurations
- **AutomationJob** - Individual automation jobs
- **EventLog** - Customer-aware event tracking
- **FeatureFlags** - Plan-based feature controls
- **UsageLog** - Billing usage tracking

## Automation System

### Cart Recovery
- Triggered by cart abandonment (30+ minutes inactive)
- Requires customer session for personalization
- Respects daily limits per plan
- Cancels automatically on order completion

### Scheduled Campaigns
- Admin-created push campaigns
- Audience targeting (all/logged-in/cart owners)
- Monthly limits based on plan
- Customer-aware delivery

### Priority Queues
- **Standard Queue**: Free tier merchants
- **Priority Queue**: Pro/Enterprise merchants processed first
- Batch processing with retry logic

## Admin Dashboard

Access at `/app` after installation:

- **Home** - Store overview and mobile app status
- **Setup** - Storefront token configuration
- **Customers** - Customer health statistics
- **Automation** - Campaign management and job monitoring
- **Billing** - Plan management and usage tracking

## Deployment

### Development
```bash
npm run dev
```

### Production
```bash
# Build the app
npm run build

# Start production server
npm run start

# Or use Docker
docker build -t shopify-mobile-app .
docker run -p 3000:3000 shopify-mobile-app
```

### Environment Setup

1. **Database Migration**
   ```bash
   npx prisma migrate deploy
   ```

2. **Webhook Registration**
   - Deploy app to production URL
   - Webhooks auto-register on first install

3. **Job Processing**
   - Set up cron job or cloud scheduler to call `/api/jobs/process`
   - Recommended: Every 5 minutes

## Monitoring

- Job processing logs in console
- Failed jobs stored with error details
- Usage tracking for billing
- Event logs for debugging

## Contributing

See the main repository [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](../../LICENSE) for details.