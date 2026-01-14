import db from "../db.server";

/**
 * Send Time Optimization Service
 * 
 * Analyzes customer app open patterns to determine optimal send times
 * for push notifications, maximizing engagement rates.
 */

const MINIMUM_DATA_POINTS = 5;
const DEFAULT_SEND_HOUR = 10; // 10 AM merchant timezone

interface HourlyActivity {
  [hour: number]: number; // hour (0-23) -> count
}

interface OptimalTimeResult {
  optimalHour: number;
  confidence: number; // 0-1, based on data points
  dataPoints: number;
  timezone?: string;
}

/**
 * Records an app open event for send time learning
 * 
 * @param merchantId - Merchant ID
 * @param customerId - Shopify customer ID
 * @param timestamp - When the app was opened
 */
export async function recordAppOpen(
  merchantId: string,
  customerId: string,
  timestamp: Date = new Date()
): Promise<void> {
  try {
    const hour = timestamp.getHours(); // 0-23

    // Find or create send time profile
    let profile = await db.sendTimeProfile.findUnique({
      where: {
        merchantId_shopifyCustomerId: {
          merchantId,
          shopifyCustomerId: customerId,
        },
      },
    });

    if (!profile) {
      // Create new profile
      const initialActivity: HourlyActivity = { [hour]: 1 };
      
      profile = await db.sendTimeProfile.create({
        data: {
          merchantId,
          shopifyCustomerId: customerId,
          hourlyActivity: JSON.stringify(initialActivity),
          dataPoints: 1,
        },
      });
    } else {
      // Update existing profile
      const activity: HourlyActivity = JSON.parse(profile.hourlyActivity);
      activity[hour] = (activity[hour] || 0) + 1;

      await db.sendTimeProfile.update({
        where: { id: profile.id },
        data: {
          hourlyActivity: JSON.stringify(activity),
          dataPoints: profile.dataPoints + 1,
          updatedAt: new Date(),
        },
      });
    }

    // Recalculate optimal time if we have enough data
    if (profile.dataPoints + 1 >= MINIMUM_DATA_POINTS) {
      await calculateAndUpdateOptimalTime(merchantId, customerId);
    }

  } catch (error) {
    console.error(`[SendTimeOptimizer] Failed to record app open:`, error);
    throw error;
  }
}

/**
 * Calculates optimal send time for a customer based on their activity
 * 
 * @param merchantId - Merchant ID
 * @param customerId - Shopify customer ID
 * @returns Optimal hour (0-23) or null if insufficient data
 */
export async function calculateOptimalTime(
  merchantId: string,
  customerId: string
): Promise<number | null> {
  try {
    const profile = await db.sendTimeProfile.findUnique({
      where: {
        merchantId_shopifyCustomerId: {
          merchantId,
          shopifyCustomerId: customerId,
        },
      },
    });

    if (!profile || profile.dataPoints < MINIMUM_DATA_POINTS) {
      return null;
    }

    const activity: HourlyActivity = JSON.parse(profile.hourlyActivity);
    
    // Find hour with highest activity
    let maxHour = 0;
    let maxCount = 0;

    for (const [hourStr, count] of Object.entries(activity)) {
      const hour = parseInt(hourStr);
      if (count > maxCount) {
        maxCount = count;
        maxHour = hour;
      }
    }

    return maxHour;

  } catch (error) {
    console.error(`[SendTimeOptimizer] Failed to calculate optimal time:`, error);
    return null;
  }
}

/**
 * Calculates and updates the optimal time in the database
 * 
 * @param merchantId - Merchant ID
 * @param customerId - Shopify customer ID
 */
async function calculateAndUpdateOptimalTime(
  merchantId: string,
  customerId: string
): Promise<void> {
  const optimalHour = await calculateOptimalTime(merchantId, customerId);
  
  if (optimalHour !== null) {
    await db.sendTimeProfile.update({
      where: {
        merchantId_shopifyCustomerId: {
          merchantId,
          shopifyCustomerId: customerId,
        },
      },
      data: {
        optimalHour,
        lastCalculated: new Date(),
      },
    });
  }
}

/**
 * Gets optimal send time with fallback to default
 * 
 * @param merchantId - Merchant ID
 * @param customerId - Shopify customer ID
 * @param fallbackHour - Default hour if no data (default: 10 AM)
 * @returns Optimal hour (0-23)
 */
export async function getOptimalSendTime(
  merchantId: string,
  customerId: string,
  fallbackHour: number = DEFAULT_SEND_HOUR
): Promise<number> {
  try {
    const profile = await db.sendTimeProfile.findUnique({
      where: {
        merchantId_shopifyCustomerId: {
          merchantId,
          shopifyCustomerId: customerId,
        },
      },
    });

    // Use calculated optimal time if available and we have enough data
    if (profile && profile.optimalHour !== null && profile.dataPoints >= MINIMUM_DATA_POINTS) {
      return profile.optimalHour;
    }

    // Fall back to default
    return fallbackHour;

  } catch (error) {
    console.error(`[SendTimeOptimizer] Failed to get optimal send time:`, error);
    return fallbackHour;
  }
}

/**
 * Gets detailed optimal time information for a customer
 * 
 * @param merchantId - Merchant ID
 * @param customerId - Shopify customer ID
 * @returns Optimal time result with confidence and metadata
 */
export async function getOptimalTimeDetails(
  merchantId: string,
  customerId: string
): Promise<OptimalTimeResult | null> {
  try {
    const profile = await db.sendTimeProfile.findUnique({
      where: {
        merchantId_shopifyCustomerId: {
          merchantId,
          shopifyCustomerId: customerId,
        },
      },
    });

    if (!profile) {
      return null;
    }

    const optimalHour = profile.optimalHour ?? DEFAULT_SEND_HOUR;
    
    // Calculate confidence based on data points
    // More data points = higher confidence (capped at 1.0)
    const confidence = Math.min(profile.dataPoints / 20, 1.0);

    return {
      optimalHour,
      confidence,
      dataPoints: profile.dataPoints,
      timezone: profile.timezone ?? undefined,
    };

  } catch (error) {
    console.error(`[SendTimeOptimizer] Failed to get optimal time details:`, error);
    return null;
  }
}

/**
 * Schedules a notification at the optimal time for a customer
 * 
 * @param merchantId - Merchant ID
 * @param customerId - Shopify customer ID
 * @param notification - Notification config (title, body, data)
 * @param ruleId - Automation rule ID
 * @returns Created automation job
 */
export async function scheduleAtOptimalTime(
  merchantId: string,
  customerId: string,
  notification: {
    title: string;
    body: string;
    data?: any;
  },
  ruleId: string
): Promise<any> {
  try {
    const optimalHour = await getOptimalSendTime(merchantId, customerId);
    
    // Calculate next occurrence of optimal hour
    const now = new Date();
    const scheduledFor = new Date(now);
    scheduledFor.setHours(optimalHour, 0, 0, 0);
    
    // If optimal hour has passed today, schedule for tomorrow
    if (scheduledFor <= now) {
      scheduledFor.setDate(scheduledFor.getDate() + 1);
    }

    // Create automation job
    const job = await db.automationJob.create({
      data: {
        merchantId,
        ruleId,
        shopifyCustomerId: customerId,
        status: "QUEUED",
        scheduledFor,
      },
    });

    console.log(
      `[SendTimeOptimizer] Scheduled notification for customer ${customerId} at ${scheduledFor.toISOString()} (hour ${optimalHour})`
    );

    return job;

  } catch (error) {
    console.error(`[SendTimeOptimizer] Failed to schedule at optimal time:`, error);
    throw error;
  }
}

/**
 * Batch schedules notifications at optimal times for multiple customers
 * 
 * @param merchantId - Merchant ID
 * @param customerIds - Array of Shopify customer IDs
 * @param notification - Notification config (title, body, data)
 * @param ruleId - Automation rule ID
 * @returns Array of created automation jobs
 */
export async function batchScheduleOptimal(
  merchantId: string,
  customerIds: string[],
  notification: {
    title: string;
    body: string;
    data?: any;
  },
  ruleId: string
): Promise<any[]> {
  const jobs: any[] = [];

  for (const customerId of customerIds) {
    try {
      const job = await scheduleAtOptimalTime(
        merchantId,
        customerId,
        notification,
        ruleId
      );
      jobs.push(job);
    } catch (error) {
      console.error(
        `[SendTimeOptimizer] Failed to schedule for customer ${customerId}:`,
        error
      );
      // Continue with other customers
    }
  }

  console.log(
    `[SendTimeOptimizer] Batch scheduled ${jobs.length}/${customerIds.length} notifications`
  );

  return jobs;
}

/**
 * Gets optimal time distribution across all customers for a merchant
 * Useful for showing merchants when their notifications will be sent
 * 
 * @param merchantId - Merchant ID
 * @param customerIds - Optional array of customer IDs to analyze
 * @returns Distribution of optimal send times
 */
export async function getOptimalTimeDistribution(
  merchantId: string,
  customerIds?: string[]
): Promise<{ hour: number; count: number; percentage: number }[]> {
  try {
    const whereClause: any = { merchantId };
    
    if (customerIds && customerIds.length > 0) {
      whereClause.shopifyCustomerId = { in: customerIds };
    }

    const profiles = await db.sendTimeProfile.findMany({
      where: whereClause,
      select: {
        optimalHour: true,
        dataPoints: true,
      },
    });

    // Count customers by optimal hour
    const distribution: { [hour: number]: number } = {};
    let totalWithData = 0;

    for (const profile of profiles) {
      if (profile.optimalHour !== null && profile.dataPoints >= MINIMUM_DATA_POINTS) {
        distribution[profile.optimalHour] = (distribution[profile.optimalHour] || 0) + 1;
        totalWithData++;
      } else {
        // Count customers using default time
        distribution[DEFAULT_SEND_HOUR] = (distribution[DEFAULT_SEND_HOUR] || 0) + 1;
        totalWithData++;
      }
    }

    // Convert to array format
    const result = Object.entries(distribution).map(([hourStr, count]) => ({
      hour: parseInt(hourStr),
      count,
      percentage: totalWithData > 0 ? (count / totalWithData) * 100 : 0,
    }));

    // Sort by hour
    result.sort((a, b) => a.hour - b.hour);

    return result;

  } catch (error) {
    console.error(`[SendTimeOptimizer] Failed to get distribution:`, error);
    return [];
  }
}

/**
 * Updates timezone for a customer's send time profile
 * 
 * @param merchantId - Merchant ID
 * @param customerId - Shopify customer ID
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 */
export async function updateCustomerTimezone(
  merchantId: string,
  customerId: string,
  timezone: string
): Promise<void> {
  try {
    await db.sendTimeProfile.upsert({
      where: {
        merchantId_shopifyCustomerId: {
          merchantId,
          shopifyCustomerId: customerId,
        },
      },
      update: {
        timezone,
        updatedAt: new Date(),
      },
      create: {
        merchantId,
        shopifyCustomerId: customerId,
        hourlyActivity: JSON.stringify({}),
        dataPoints: 0,
        timezone,
      },
    });

    console.log(`[SendTimeOptimizer] Updated timezone for customer ${customerId} to ${timezone}`);

  } catch (error) {
    console.error(`[SendTimeOptimizer] Failed to update timezone:`, error);
    throw error;
  }
}

/**
 * Gets statistics about send time optimization for a merchant
 * 
 * @param merchantId - Merchant ID
 * @returns Statistics about optimization coverage and performance
 */
export async function getOptimizationStats(
  merchantId: string
): Promise<{
  totalCustomers: number;
  customersWithData: number;
  customersOptimized: number;
  averageDataPoints: number;
  coveragePercentage: number;
}> {
  try {
    const profiles = await db.sendTimeProfile.findMany({
      where: { merchantId },
      select: {
        dataPoints: true,
        optimalHour: true,
      },
    });

    const totalCustomers = await db.customerProfile.count({
      where: { merchantId },
    });

    const customersWithData = profiles.length;
    const customersOptimized = profiles.filter(
      p => p.optimalHour !== null && p.dataPoints >= MINIMUM_DATA_POINTS
    ).length;

    const averageDataPoints = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.dataPoints, 0) / profiles.length
      : 0;

    const coveragePercentage = totalCustomers > 0
      ? (customersOptimized / totalCustomers) * 100
      : 0;

    return {
      totalCustomers,
      customersWithData,
      customersOptimized,
      averageDataPoints: Math.round(averageDataPoints * 10) / 10,
      coveragePercentage: Math.round(coveragePercentage * 10) / 10,
    };

  } catch (error) {
    console.error(`[SendTimeOptimizer] Failed to get optimization stats:`, error);
    return {
      totalCustomers: 0,
      customersWithData: 0,
      customersOptimized: 0,
      averageDataPoints: 0,
      coveragePercentage: 0,
    };
  }
}
