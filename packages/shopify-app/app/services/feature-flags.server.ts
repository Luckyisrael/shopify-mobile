/**
 * Feature Flags Service
 * 
 * Provides a simple feature flag system for gradual rollout of new features.
 * Flags can be enabled/disabled per merchant or globally.
 * 
 * Features:
 * - Per-merchant flag overrides
 * - Global default flags
 * - Percentage-based rollouts
 * - Easy flag checking
 */

import db from "../db.server";

// Define all available feature flags
export enum FeatureFlag {
  // Phase 2: Enhanced Analytics
  ENHANCED_ANALYTICS = "enhanced_analytics",
  REVENUE_ATTRIBUTION = "revenue_attribution",
  
  // Phase 3: A/B Testing
  AB_TESTING = "ab_testing",
  
  // Phase 4: Rich Push
  RICH_PUSH = "rich_push",
  RICH_PUSH_IMAGES = "rich_push_images",
  RICH_PUSH_BUTTONS = "rich_push_buttons",
  
  // Phase 5: Send Time Optimization
  SEND_TIME_OPTIMIZATION = "send_time_optimization",
  
  // Phase 6: Re-engagement
  REENGAGEMENT_CAMPAIGNS = "reengagement_campaigns",
  
  // Phase 7: Customer Preferences
  CUSTOMER_PREFERENCES = "customer_preferences",
  QUIET_HOURS = "quiet_hours",
  
  // Phase 8: Push History
  PUSH_HISTORY = "push_history",
  HISTORY_EXPORT = "history_export",
  
  // Phase 9: Performance Tracking
  PERFORMANCE_TRACKING = "performance_tracking",
  COST_TRACKING = "cost_tracking",
  
  // Experimental Features
  CACHE_MANAGEMENT = "cache_management",
}

// Default flag states (global defaults)
const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  // All Phase 2-9 features enabled by default (already implemented)
  [FeatureFlag.ENHANCED_ANALYTICS]: true,
  [FeatureFlag.REVENUE_ATTRIBUTION]: true,
  [FeatureFlag.AB_TESTING]: true,
  [FeatureFlag.RICH_PUSH]: true,
  [FeatureFlag.RICH_PUSH_IMAGES]: true,
  [FeatureFlag.RICH_PUSH_BUTTONS]: true,
  [FeatureFlag.SEND_TIME_OPTIMIZATION]: true,
  [FeatureFlag.REENGAGEMENT_CAMPAIGNS]: true,
  [FeatureFlag.CUSTOMER_PREFERENCES]: true,
  [FeatureFlag.QUIET_HOURS]: true,
  [FeatureFlag.PUSH_HISTORY]: true,
  [FeatureFlag.HISTORY_EXPORT]: true,
  [FeatureFlag.PERFORMANCE_TRACKING]: true,
  [FeatureFlag.COST_TRACKING]: true,
  
  // Experimental features disabled by default
  [FeatureFlag.CACHE_MANAGEMENT]: false,
};

// Feature flag metadata
export interface FeatureFlagMetadata {
  name: string;
  description: string;
  phase: string;
  experimental?: boolean;
}

export const FEATURE_FLAG_METADATA: Record<FeatureFlag, FeatureFlagMetadata> = {
  [FeatureFlag.ENHANCED_ANALYTICS]: {
    name: "Enhanced Analytics",
    description: "Advanced analytics dashboard with trends and comparisons",
    phase: "Phase 2",
  },
  [FeatureFlag.REVENUE_ATTRIBUTION]: {
    name: "Revenue Attribution",
    description: "Track revenue attribution for push campaigns",
    phase: "Phase 2",
  },
  [FeatureFlag.AB_TESTING]: {
    name: "A/B Testing",
    description: "Create and manage A/B tests for push notifications",
    phase: "Phase 3",
  },
  [FeatureFlag.RICH_PUSH]: {
    name: "Rich Push Notifications",
    description: "Send push notifications with images and action buttons",
    phase: "Phase 4",
  },
  [FeatureFlag.RICH_PUSH_IMAGES]: {
    name: "Rich Push Images",
    description: "Include images in push notifications",
    phase: "Phase 4",
  },
  [FeatureFlag.RICH_PUSH_BUTTONS]: {
    name: "Rich Push Action Buttons",
    description: "Add action buttons to push notifications",
    phase: "Phase 4",
  },
  [FeatureFlag.SEND_TIME_OPTIMIZATION]: {
    name: "Send Time Optimization",
    description: "Automatically optimize notification send times",
    phase: "Phase 5",
  },
  [FeatureFlag.REENGAGEMENT_CAMPAIGNS]: {
    name: "Re-engagement Campaigns",
    description: "Automated campaigns for inactive customers",
    phase: "Phase 6",
  },
  [FeatureFlag.CUSTOMER_PREFERENCES]: {
    name: "Customer Preferences",
    description: "Allow customers to manage notification preferences",
    phase: "Phase 7",
  },
  [FeatureFlag.QUIET_HOURS]: {
    name: "Quiet Hours",
    description: "Respect customer quiet hours preferences",
    phase: "Phase 7",
  },
  [FeatureFlag.PUSH_HISTORY]: {
    name: "Push Notification History",
    description: "View history of all push campaigns",
    phase: "Phase 8",
  },
  [FeatureFlag.HISTORY_EXPORT]: {
    name: "History Export",
    description: "Export push notification history to CSV",
    phase: "Phase 8",
  },
  [FeatureFlag.PERFORMANCE_TRACKING]: {
    name: "Performance Tracking",
    description: "Detailed performance metrics and comparisons",
    phase: "Phase 9",
  },
  [FeatureFlag.COST_TRACKING]: {
    name: "Cost Tracking",
    description: "Track costs and ROI for campaigns",
    phase: "Phase 9",
  },
  [FeatureFlag.CACHE_MANAGEMENT]: {
    name: "Cache Management",
    description: "Admin interface for cache management",
    phase: "Phase 10",
    experimental: true,
  },
};

/**
 * Check if a feature flag is enabled for a merchant
 */
export async function isFeatureEnabled(
  merchantId: string,
  flag: FeatureFlag
): Promise<boolean> {
  try {
    // Check for merchant-specific override
    const merchant = await db.merchant.findUnique({
      where: { id: merchantId },
      select: { featureFlags: true },
    });

    if (merchant?.featureFlags) {
      const flags = JSON.parse(merchant.featureFlags);
      if (flag in flags) {
        return flags[flag] === true;
      }
    }

    // Fall back to default
    return DEFAULT_FLAGS[flag] ?? false;
  } catch (error) {
    console.error(`[FeatureFlags] Error checking flag ${flag}:`, error);
    return DEFAULT_FLAGS[flag] ?? false;
  }
}

/**
 * Get all feature flags for a merchant
 */
export async function getFeatureFlags(
  merchantId: string
): Promise<Record<FeatureFlag, boolean>> {
  try {
    const merchant = await db.merchant.findUnique({
      where: { id: merchantId },
      select: { featureFlags: true },
    });

    const merchantFlags = merchant?.featureFlags 
      ? JSON.parse(merchant.featureFlags) 
      : {};

    // Merge with defaults
    const flags: Record<string, boolean> = { ...DEFAULT_FLAGS };
    Object.keys(merchantFlags).forEach((key) => {
      flags[key] = merchantFlags[key];
    });

    return flags as Record<FeatureFlag, boolean>;
  } catch (error) {
    console.error(`[FeatureFlags] Error getting flags:`, error);
    return DEFAULT_FLAGS;
  }
}

/**
 * Set a feature flag for a merchant
 */
export async function setFeatureFlag(
  merchantId: string,
  flag: FeatureFlag,
  enabled: boolean
): Promise<void> {
  try {
    const merchant = await db.merchant.findUnique({
      where: { id: merchantId },
      select: { featureFlags: true },
    });

    const currentFlags = merchant?.featureFlags 
      ? JSON.parse(merchant.featureFlags) 
      : {};

    currentFlags[flag] = enabled;

    await db.merchant.update({
      where: { id: merchantId },
      data: { featureFlags: JSON.stringify(currentFlags) },
    });

    console.log(`[FeatureFlags] Set ${flag} = ${enabled} for merchant ${merchantId}`);
  } catch (error) {
    console.error(`[FeatureFlags] Error setting flag ${flag}:`, error);
    throw error;
  }
}

/**
 * Reset all feature flags for a merchant to defaults
 */
export async function resetFeatureFlags(merchantId: string): Promise<void> {
  try {
    await db.merchant.update({
      where: { id: merchantId },
      data: { featureFlags: JSON.stringify({}) },
    });

    console.log(`[FeatureFlags] Reset flags for merchant ${merchantId}`);
  } catch (error) {
    console.error(`[FeatureFlags] Error resetting flags:`, error);
    throw error;
  }
}

/**
 * Get feature flag metadata
 */
export function getFeatureFlagMetadata(flag: FeatureFlag): FeatureFlagMetadata {
  return FEATURE_FLAG_METADATA[flag];
}

/**
 * Get all feature flags with metadata
 */
export function getAllFeatureFlagsWithMetadata(): Array<{
  flag: FeatureFlag;
  metadata: FeatureFlagMetadata;
  defaultEnabled: boolean;
}> {
  return Object.values(FeatureFlag).map((flag) => ({
    flag,
    metadata: FEATURE_FLAG_METADATA[flag],
    defaultEnabled: DEFAULT_FLAGS[flag],
  }));
}

/**
 * Percentage-based rollout
 * Enable feature for a percentage of merchants based on merchant ID hash
 */
export function isEnabledForPercentage(
  merchantId: string,
  percentage: number
): boolean {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < merchantId.length; i++) {
    hash = ((hash << 5) - hash) + merchantId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  const bucket = Math.abs(hash) % 100;
  return bucket < percentage;
}
