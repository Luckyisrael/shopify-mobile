// Main SDK exports
export { ShopifyMobileClient } from './client';
export { ShopifyMobileError } from './errors';

// Type exports
export type * from './types';

// Service exports
export type { AuthService } from './services/auth';
export type { ProductsService } from './services/products';
export type { CartService } from './services/cart';
export type { PushService } from './services/push';
export type { EventsService } from './services/events';
export type { HighlightsService } from './services/highlights';
export type { PreferencesService } from './services/preferences';

// Hook exports
export {
  ShopifyProvider,
  useShopifyClient,
  useAuth,
  useCart,
  useProducts,
  useHighlights,
  usePreferences,
} from './hooks';
export type { UseProductsOptions } from './hooks';

// Utility exports
export { Logger, LogLevel } from './utils/Logger';
export type { LogEntry, LoggerConfig } from './utils/Logger';
export { MetricsTracker } from './utils/MetricsTracker';
export type { RequestMetrics, CacheMetrics, SDKMetrics } from './utils/MetricsTracker';