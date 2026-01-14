/**
 * Customer Notification Preferences Service
 * 
 * Manages customer notification preferences including:
 * - Category-based opt-in/opt-out
 * - Quiet hours configuration
 * - Daily notification limits
 * - Preference statistics for merchants
 */

import prisma from "../db.server";

// ============================================================================
// Types
// ============================================================================

export interface CustomerPreferencesData {
  shopifyCustomerId: string;
  cartNotifications: boolean;
  orderNotifications: boolean;
  promotionalNotifications: boolean;
  highlightNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  maxDailyNotifications?: number;
}

export interface PreferenceStats {
  totalCustomers: number;
  optOutRates: {
    cart: number;
    order: number;
    promotional: number;
    highlights: number;
  };
  quietHoursUsers: number;
  averageMaxDaily: number;
}

export interface NotificationCheckResult {
  allowed: boolean;
  reason?: string;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get customer notification preferences
 * Creates default preferences if none exist
 */
export async function getPreferences(
  merchantId: string,
  shopifyCustomerId: string
): Promise<CustomerPreferencesData> {
  let preferences = await prisma.customerPreferences.findUnique({
    where: {
      merchantId_shopifyCustomerId: {
        merchantId,
        shopifyCustomerId,
      },
    },
  });

  // Create default preferences if none exist
  if (!preferences) {
    preferences = await prisma.customerPreferences.create({
      data: {
        merchantId,
        shopifyCustomerId,
        cartNotifications: true,
        orderNotifications: true,
        promotionalNotifications: true,
        highlightNotifications: true,
        quietHoursEnabled: false,
        maxDailyNotifications: 5,
      },
    });
  }

  return {
    shopifyCustomerId: preferences.shopifyCustomerId,
    cartNotifications: preferences.cartNotifications,
    orderNotifications: preferences.orderNotifications,
    promotionalNotifications: preferences.promotionalNotifications,
    highlightNotifications: preferences.highlightNotifications,
    quietHoursEnabled: preferences.quietHoursEnabled,
    quietHoursStart: preferences.quietHoursStart || undefined,
    quietHoursEnd: preferences.quietHoursEnd || undefined,
    maxDailyNotifications: preferences.maxDailyNotifications || undefined,
  };
}

/**
 * Update customer notification preferences
 */
export async function updatePreferences(
  merchantId: string,
  shopifyCustomerId: string,
  updates: Partial<Omit<CustomerPreferencesData, "shopifyCustomerId">>
): Promise<CustomerPreferencesData> {
  // Validate quiet hours format if provided
  if (updates.quietHoursStart && !isValidTimeFormat(updates.quietHoursStart)) {
    throw new Error("Invalid quietHoursStart format. Use HH:MM format (e.g., '22:00')");
  }
  if (updates.quietHoursEnd && !isValidTimeFormat(updates.quietHoursEnd)) {
    throw new Error("Invalid quietHoursEnd format. Use HH:MM format (e.g., '08:00')");
  }

  // Validate maxDailyNotifications
  if (updates.maxDailyNotifications !== undefined) {
    if (updates.maxDailyNotifications < 0 || updates.maxDailyNotifications > 50) {
      throw new Error("maxDailyNotifications must be between 0 and 50");
    }
  }

  const preferences = await prisma.customerPreferences.upsert({
    where: {
      merchantId_shopifyCustomerId: {
        merchantId,
        shopifyCustomerId,
      },
    },
    update: updates,
    create: {
      merchantId,
      shopifyCustomerId,
      cartNotifications: updates.cartNotifications ?? true,
      orderNotifications: updates.orderNotifications ?? true,
      promotionalNotifications: updates.promotionalNotifications ?? true,
      highlightNotifications: updates.highlightNotifications ?? true,
      quietHoursEnabled: updates.quietHoursEnabled ?? false,
      quietHoursStart: updates.quietHoursStart,
      quietHoursEnd: updates.quietHoursEnd,
      maxDailyNotifications: updates.maxDailyNotifications ?? 5,
    },
  });

  return {
    shopifyCustomerId: preferences.shopifyCustomerId,
    cartNotifications: preferences.cartNotifications,
    orderNotifications: preferences.orderNotifications,
    promotionalNotifications: preferences.promotionalNotifications,
    highlightNotifications: preferences.highlightNotifications,
    quietHoursEnabled: preferences.quietHoursEnabled,
    quietHoursStart: preferences.quietHoursStart || undefined,
    quietHoursEnd: preferences.quietHoursEnd || undefined,
    maxDailyNotifications: preferences.maxDailyNotifications || undefined,
  };
}

/**
 * Check if a notification is allowed based on customer preferences
 */
export async function isNotificationAllowed(
  merchantId: string,
  shopifyCustomerId: string,
  category: "cart" | "order" | "promotional" | "highlight",
  currentTime: Date = new Date()
): Promise<NotificationCheckResult> {
  const preferences = await getPreferences(merchantId, shopifyCustomerId);

  // Check category opt-out
  const categoryMap = {
    cart: preferences.cartNotifications,
    order: preferences.orderNotifications,
    promotional: preferences.promotionalNotifications,
    highlight: preferences.highlightNotifications,
  };

  if (!categoryMap[category]) {
    return {
      allowed: false,
      reason: `Customer has opted out of ${category} notifications`,
    };
  }

  // Check quiet hours
  if (preferences.quietHoursEnabled && preferences.quietHoursStart && preferences.quietHoursEnd) {
    const isQuietHours = isInQuietHours(
      currentTime,
      preferences.quietHoursStart,
      preferences.quietHoursEnd
    );

    if (isQuietHours) {
      return {
        allowed: false,
        reason: `Current time is within customer's quiet hours (${preferences.quietHoursStart} - ${preferences.quietHoursEnd})`,
      };
    }
  }

  // Check daily limit
  if (preferences.maxDailyNotifications !== undefined && preferences.maxDailyNotifications !== null) {
    const todayCount = await getTodayNotificationCount(merchantId, shopifyCustomerId);

    if (todayCount >= preferences.maxDailyNotifications) {
      return {
        allowed: false,
        reason: `Customer has reached daily notification limit (${preferences.maxDailyNotifications})`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Get preference statistics for merchant insights
 */
export async function getPreferenceStats(merchantId: string): Promise<PreferenceStats> {
  const allPreferences = await prisma.customerPreferences.findMany({
    where: { merchantId },
  });

  const totalCustomers = allPreferences.length;

  if (totalCustomers === 0) {
    return {
      totalCustomers: 0,
      optOutRates: {
        cart: 0,
        order: 0,
        promotional: 0,
        highlights: 0,
      },
      quietHoursUsers: 0,
      averageMaxDaily: 5,
    };
  }

  const cartOptOuts = allPreferences.filter((p) => !p.cartNotifications).length;
  const orderOptOuts = allPreferences.filter((p) => !p.orderNotifications).length;
  const promotionalOptOuts = allPreferences.filter((p) => !p.promotionalNotifications).length;
  const highlightOptOuts = allPreferences.filter((p) => !p.highlightNotifications).length;
  const quietHoursUsers = allPreferences.filter((p) => p.quietHoursEnabled).length;

  const totalMaxDaily = allPreferences.reduce(
    (sum, p) => sum + (p.maxDailyNotifications || 5),
    0
  );

  return {
    totalCustomers,
    optOutRates: {
      cart: (cartOptOuts / totalCustomers) * 100,
      order: (orderOptOuts / totalCustomers) * 100,
      promotional: (promotionalOptOuts / totalCustomers) * 100,
      highlights: (highlightOptOuts / totalCustomers) * 100,
    },
    quietHoursUsers,
    averageMaxDaily: totalMaxDaily / totalCustomers,
  };
}

/**
 * Bulk check if notifications are allowed for multiple customers
 * Useful for campaign targeting
 */
export async function filterAllowedCustomers(
  merchantId: string,
  customerIds: string[],
  category: "cart" | "order" | "promotional" | "highlight",
  currentTime: Date = new Date()
): Promise<string[]> {
  const allowedCustomers: string[] = [];

  // Process in batches to avoid overwhelming the database
  const batchSize = 100;
  for (let i = 0; i < customerIds.length; i += batchSize) {
    const batch = customerIds.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (customerId) => {
        const result = await isNotificationAllowed(merchantId, customerId, category, currentTime);
        return { customerId, allowed: result.allowed };
      })
    );

    allowedCustomers.push(...results.filter((r) => r.allowed).map((r) => r.customerId));
  }

  return allowedCustomers;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate time format (HH:MM)
 */
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Check if current time is within quiet hours
 */
function isInQuietHours(currentTime: Date, startTime: string, endTime: string): boolean {
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const startTotalMinutes = startHour * 60 + startMinute;

  const [endHour, endMinute] = endTime.split(":").map(Number);
  const endTotalMinutes = endHour * 60 + endMinute;

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startTotalMinutes > endTotalMinutes) {
    return currentTotalMinutes >= startTotalMinutes || currentTotalMinutes < endTotalMinutes;
  }

  // Normal quiet hours (e.g., 01:00 - 06:00)
  return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
}

/**
 * Get count of notifications sent today to a customer
 */
async function getTodayNotificationCount(
  merchantId: string,
  shopifyCustomerId: string
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const count = await prisma.notificationMetric.count({
    where: {
      merchantId,
      shopifyCustomerId,
      sentAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  return count;
}

/**
 * Reset all preferences for a customer (useful for testing or customer request)
 */
export async function resetPreferences(
  merchantId: string,
  shopifyCustomerId: string
): Promise<CustomerPreferencesData> {
  const preferences = await prisma.customerPreferences.upsert({
    where: {
      merchantId_shopifyCustomerId: {
        merchantId,
        shopifyCustomerId,
      },
    },
    update: {
      cartNotifications: true,
      orderNotifications: true,
      promotionalNotifications: true,
      highlightNotifications: true,
      quietHoursEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      maxDailyNotifications: 5,
    },
    create: {
      merchantId,
      shopifyCustomerId,
      cartNotifications: true,
      orderNotifications: true,
      promotionalNotifications: true,
      highlightNotifications: true,
      quietHoursEnabled: false,
      maxDailyNotifications: 5,
    },
  });

  return {
    shopifyCustomerId: preferences.shopifyCustomerId,
    cartNotifications: preferences.cartNotifications,
    orderNotifications: preferences.orderNotifications,
    promotionalNotifications: preferences.promotionalNotifications,
    highlightNotifications: preferences.highlightNotifications,
    quietHoursEnabled: preferences.quietHoursEnabled,
    quietHoursStart: preferences.quietHoursStart || undefined,
    quietHoursEnd: preferences.quietHoursEnd || undefined,
    maxDailyNotifications: preferences.maxDailyNotifications || undefined,
  };
}
