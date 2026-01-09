# Shopify Mobile App Template

A complete React Native template for building Shopify mobile commerce experiences with customer authentication, push notifications, and cart management.

## Features

- ✅ **Product Browsing** - Browse products with pagination and search
- ✅ **Customer Authentication** - Login/signup with Shopify accounts
- ✅ **Shopping Cart** - Add products and manage cart items
- ✅ **Push Notifications** - Receive promotional and cart recovery notifications
- ✅ **Collection Browsing** - Browse product collections
- ✅ **Shopify Restyle UI** - Consistent design system
- ✅ **Cross-Platform** - iOS and Android support via Expo

## Tech Stack

- **Framework**: React Native 0.81.5 with Expo 54.0.0
- **Navigation**: Expo Router 6.0.10 (file-based routing)
- **State Management**: Zustand 4.5.1
- **UI Components**: Shopify Restyle 2.4.5
- **Push Notifications**: Expo Notifications
- **Build System**: EAS (Expo Application Services)

## Quick Start

### Prerequisites

- Node.js 20.19+
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)
- EAS CLI (for building)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

### Configuration

1. **Update app.json**
   ```json
   {
     "expo": {
       "name": "Your Store Name",
       "slug": "your-store-app",
       "android": {
         "package": "com.yourcompany.yourstore"
       }
     }
   }
   ```

2. **Configure API Endpoint**
   Update the API base URL in your app configuration to point to your Shopify app backend.

3. **Firebase Setup** (for push notifications)
   - Add your `google-services.json` for Android
   - Configure push notification credentials in EAS

## Project Structure

```
src/
├── app/                    # Expo Router pages
│   ├── index.tsx          # Home screen
│   ├── details.tsx        # Product details
│   ├── _layout.tsx        # Root layout
│   └── +not-found.tsx     # 404 page
├── components/            # Reusable components
│   ├── Button.tsx         # Custom button
│   ├── Container.tsx      # Layout container
│   └── ScreenContent.tsx  # Screen wrapper
├── store/                 # Zustand state management
│   └── store.ts           # Global store
├── utils/                 # Utilities
│   └── theme.ts           # Shopify Restyle theme
└── assets/               # Images and fonts
```

## Key Components

### Authentication Flow

```typescript
// Login example
const login = async (email: string, password: string) => {
  const response = await fetch(`${API_BASE_URL}/api/mobile/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shop-Domain': 'your-shop.myshopify.com'
    },
    body: JSON.stringify({ email, password })
  });
  
  const session = await response.json();
  // Store session for future requests
};
```

### Product Browsing

```typescript
// Fetch products
const fetchProducts = async (cursor?: string) => {
  const response = await fetch(`${API_BASE_URL}/api/mobile/products?cursor=${cursor}`, {
    headers: {
      'X-Shop-Domain': 'your-shop.myshopify.com'
    }
  });
  
  return await response.json();
};
```

### Push Notifications

```typescript
// Register for push notifications
const registerForPushNotifications = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  
  if (status === 'granted') {
    const token = await Notifications.getExpoPushTokenAsync();
    
    // Register with backend
    await fetch(`${API_BASE_URL}/api/mobile/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shop-Domain': 'your-shop.myshopify.com'
      },
      body: JSON.stringify({
        token: token.data,
        platform: Platform.OS
      })
    });
  }
};
```

## Customization

### Theming

The app uses Shopify Restyle for consistent theming. Customize in `src/utils/theme.ts`:

```typescript
export const theme = createTheme({
  colors: {
    primary: '#007C89',
    secondary: '#F0F0F0',
    // Add your brand colors
  },
  spacing: {
    s: 8,
    m: 16,
    l: 24,
    // Customize spacing
  }
});
```

### Adding Screens

Create new screens in the `src/app/` directory. Expo Router automatically creates routes based on file structure:

```typescript
// src/app/profile.tsx
export default function ProfileScreen() {
  return (
    <Container>
      <Text>Profile Screen</Text>
    </Container>
  );
}
```

## Building & Deployment

### Development Build

```bash
# Build for development
npm run build:dev

# Install on device
eas build --profile development --platform ios
```

### Production Build

```bash
# Build for production
npm run build:prod

# Submit to app stores
eas submit --platform ios
eas submit --platform android
```

### EAS Configuration

The app includes EAS configuration in `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

## Integration with Shopify App

This template is designed to work with the Shopify Mobile Commerce App backend. Ensure your backend is deployed and configured with:

1. **Storefront API Token** - For product and cart operations
2. **Push Notification Setup** - Expo server SDK configured
3. **Customer Authentication** - Shopify customer accounts enabled
4. **Webhook Configuration** - For cart recovery and automation

## Testing

```bash
# Run linting
npm run lint

# Format code
npm run format

# Type checking
npx tsc --noEmit
```

## Troubleshooting

### Common Issues

1. **Push Notifications Not Working**
   - Ensure Firebase is configured correctly
   - Check that push tokens are being registered with the backend
   - Verify Expo push notification credentials

2. **API Connection Issues**
   - Verify the API base URL is correct
   - Check that the Shopify app is deployed and accessible
   - Ensure the `X-Shop-Domain` header is being sent

3. **Build Failures**
   - Clear Expo cache: `expo r -c`
   - Ensure all dependencies are compatible
   - Check EAS build logs for specific errors

## Contributing

See the main repository [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](../../LICENSE) for details.