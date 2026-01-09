# Shopify Mobile Commerce Platform

A complete monorepo solution for building Shopify mobile commerce experiences with customer-aware automation, push notifications, and cart recovery.

## 🏗️ Architecture

This monorepo contains three main packages:

- **`packages/shopify-app`** - Shopify App (backend API and admin dashboard)
- **`packages/mobile-app-template`** - React Native mobile app template
- **`packages/sdk`** - TypeScript SDK for consuming the Shopify app APIs

## 🚀 Quick Start

### Prerequisites

- Node.js 20.19+ 
- npm 10+
- Shopify Partner Account
- Expo CLI (for mobile development)

### Installation

```bash
# Install all dependencies
npm install

# Start the Shopify app
npm run dev:shopify-app

# Start the mobile app (in another terminal)
npm run dev:mobile-app
```

## 📦 Packages

### Shopify App (`packages/shopify-app`)

The backend Shopify app that provides:
- Customer authentication and session management
- Push notification automation
- Cart recovery campaigns  
- Admin dashboard for merchants
- REST API for mobile apps

**Tech Stack**: React Router, Prisma, SQLite/PostgreSQL, Shopify APIs

### Mobile App Template (`packages/mobile-app-template`)

A complete React Native template for Shopify mobile commerce:
- Product browsing and search
- Customer authentication
- Shopping cart management
- Push notifications
- Shopify Restyle UI components

**Tech Stack**: React Native, Expo, Zustand, Shopify Restyle

### SDK (`packages/sdk`)

TypeScript SDK for easy integration with the Shopify app APIs:
- Type-safe API client
- Authentication helpers
- Push notification utilities
- Cart management functions

## 🎯 Features Completed

### ✅ Phase 3: Customer Identity & Session Layer
- Shopify-native customer authentication
- Session management with refresh tokens
- Push token linking to customers
- Cart persistence across devices

### ✅ Phase 6: Event-Driven Automation
- Customer-aware cart recovery
- Scheduled push campaigns
- Priority job queues (Free/Pro/Enterprise)
- Usage tracking and billing integration
- Shopify webhook integration

## 📚 Documentation

- [Phase 3 Completion](./docs/PHASE3_COMPLETION.md) - Customer identity implementation
- [Phase 6 Completion](./docs/PHASE6_COMPLETION.md) - Automation system implementation
- [API Documentation](./packages/shopify-app/README.md) - Shopify app API reference
- [Mobile Template Guide](./packages/mobile-app-template/README.md) - Mobile app setup
- [SDK Documentation](./packages/sdk/README.md) - SDK usage guide

## 🛠️ Development

### Workspace Commands

```bash
# Run all linting
npm run lint:all

# Build all packages
npm run build:all

# Run all tests
npm run test:all

# Clean all node_modules
npm run clean
```

### Individual Package Development

```bash
# Work on Shopify app
cd packages/shopify-app
npm run dev

# Work on mobile app
cd packages/mobile-app-template
npm run start

# Work on SDK
cd packages/sdk
npm run build
```

## 🚀 Deployment

### Shopify App
- Deploy to Google Cloud Run, Fly.io, or Render
- Set up environment variables
- Run database migrations

### Mobile App
- Build with EAS (Expo Application Services)
- Deploy to App Store and Google Play
- Configure push notifications

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🆘 Support

- [Documentation](./docs/)
- [Issues](https://github.com/your-org/shopify-mobile-commerce-platform/issues)
- [Discussions](https://github.com/your-org/shopify-mobile-commerce-platform/discussions)