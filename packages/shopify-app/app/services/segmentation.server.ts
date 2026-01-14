import db from "../db.server";

export const SEGMENT_TYPES = {
  ALL_CUSTOMERS: "all_customers",
  ACTIVE_CUSTOMERS: "active_customers", 
  CART_ABANDONERS: "cart_abandoners",
  RECENT_BUYERS: "recent_buyers",
  HIGH_VALUE: "high_value",
  INACTIVE: "inactive",
  FIRST_TIME_VISITORS: "first_time_visitors"
} as const;

export interface SegmentConfig {
  type: keyof typeof SEGMENT_TYPES;
  name: string;
  description: string;
  estimatedSize?: number;
}

export const PREDEFINED_SEGMENTS: SegmentConfig[] = [
  {
    type: "ALL_CUSTOMERS",
    name: "All Customers",
    description: "Every customer with a registered device"
  },
  {
    type: "ACTIVE_CUSTOMERS", 
    name: "Active Customers",
    description: "Customers who opened the app in the last 7 days"
  },
  {
    type: "CART_ABANDONERS",
    name: "Cart Abandoners", 
    description: "Customers who added items to cart but didn't purchase (last 24 hours)"
  },
  {
    type: "RECENT_BUYERS",
    name: "Recent Buyers",
    description: "Customers who made a purchase in the last 30 days"
  },
  {
    type: "HIGH_VALUE",
    name: "High Value Customers",
    description: "Customers with multiple purchases (VIP treatment)"
  },
  {
    type: "INACTIVE",
    name: "Inactive Customers", 
    description: "Customers who haven't opened the app in 30+ days"
  },
  {
    type: "FIRST_TIME_VISITORS",
    name: "First Time Visitors",
    description: "Customers who just signed up (last 3 days)"
  }
];

/**
 * Get customer IDs for a specific segment
 */
export async function getSegmentCustomers(
  merchantId: string, 
  segmentType: keyof typeof SEGMENT_TYPES
): Promise<string[]> {
  
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  switch (segmentType) {
    case "ALL_CUSTOMERS":
      const allCustomers = await db.customerProfile.findMany({
        where: { merchantId },
        select: { shopifyCustomerId: true }
      });
      return allCustomers.map(c => c.shopifyCustomerId);

    case "ACTIVE_CUSTOMERS":
      const activeCustomers = await db.customerProfile.findMany({
        where: {
          merchantId,
          lastSeenAt: { gte: sevenDaysAgo }
        },
        select: { shopifyCustomerId: true }
      });
      return activeCustomers.map(c => c.shopifyCustomerId);

    case "CART_ABANDONERS":
      // Find customers who had CART_UPDATED events but no ORDER_CREATED in last 24h
      const cartEvents = await db.eventLog.findMany({
        where: {
          merchantId,
          type: "CART_UPDATED",
          createdAt: { gte: twentyFourHoursAgo },
          shopifyCustomerId: { not: null }
        },
        select: { shopifyCustomerId: true },
        distinct: ['shopifyCustomerId']
      });

      const orderEvents = await db.eventLog.findMany({
        where: {
          merchantId,
          type: "ORDER_CREATED", 
          createdAt: { gte: twentyFourHoursAgo },
          shopifyCustomerId: { not: null }
        },
        select: { shopifyCustomerId: true }
      });

      const orderCustomerIds = new Set(orderEvents.map(e => e.shopifyCustomerId));
      return cartEvents
        .filter(e => e.shopifyCustomerId && !orderCustomerIds.has(e.shopifyCustomerId))
        .map(e => e.shopifyCustomerId!);

    case "RECENT_BUYERS":
      const recentBuyers = await db.eventLog.findMany({
        where: {
          merchantId,
          type: "ORDER_CREATED",
          createdAt: { gte: thirtyDaysAgo },
          shopifyCustomerId: { not: null }
        },
        select: { shopifyCustomerId: true },
        distinct: ['shopifyCustomerId']
      });
      return recentBuyers.map(e => e.shopifyCustomerId!);

    case "HIGH_VALUE":
      // Customers with 3+ orders
      const highValueCustomers = await db.eventLog.groupBy({
        by: ['shopifyCustomerId'],
        where: {
          merchantId,
          type: "ORDER_CREATED",
          shopifyCustomerId: { not: null }
        },
        having: {
          shopifyCustomerId: { _count: { gte: 3 } }
        }
      });
      return highValueCustomers.map(g => g.shopifyCustomerId!);

    case "INACTIVE":
      const inactiveCustomers = await db.customerProfile.findMany({
        where: {
          merchantId,
          lastSeenAt: { lt: thirtyDaysAgo }
        },
        select: { shopifyCustomerId: true }
      });
      return inactiveCustomers.map(c => c.shopifyCustomerId);

    case "FIRST_TIME_VISITORS":
      const newCustomers = await db.customerProfile.findMany({
        where: {
          merchantId,
          createdAt: { gte: threeDaysAgo }
        },
        select: { shopifyCustomerId: true }
      });
      return newCustomers.map(c => c.shopifyCustomerId);

    default:
      return [];
  }
}

/**
 * Get segment size estimate without fetching all customers
 */
export async function getSegmentSize(
  merchantId: string,
  segmentType: keyof typeof SEGMENT_TYPES
): Promise<number> {
  
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  switch (segmentType) {
    case "ALL_CUSTOMERS":
      return await db.customerProfile.count({
        where: { merchantId }
      });

    case "ACTIVE_CUSTOMERS":
      return await db.customerProfile.count({
        where: {
          merchantId,
          lastSeenAt: { gte: sevenDaysAgo }
        }
      });

    case "CART_ABANDONERS":
      // Approximate count - customers with cart events but no orders in 24h
      const cartCount = await db.eventLog.count({
        where: {
          merchantId,
          type: "CART_UPDATED",
          createdAt: { gte: twentyFourHoursAgo },
          shopifyCustomerId: { not: null }
        }
      });
      const orderCount = await db.eventLog.count({
        where: {
          merchantId,
          type: "ORDER_CREATED",
          createdAt: { gte: twentyFourHoursAgo },
          shopifyCustomerId: { not: null }
        }
      });
      return Math.max(0, cartCount - orderCount);

    case "RECENT_BUYERS":
      return await db.eventLog.count({
        where: {
          merchantId,
          type: "ORDER_CREATED",
          createdAt: { gte: thirtyDaysAgo },
          shopifyCustomerId: { not: null }
        }
      });

    case "HIGH_VALUE":
      // Approximate - this would need a more complex query
      return Math.floor(await db.customerProfile.count({ where: { merchantId } }) * 0.1);

    case "INACTIVE":
      return await db.customerProfile.count({
        where: {
          merchantId,
          lastSeenAt: { lt: thirtyDaysAgo }
        }
      });

    case "FIRST_TIME_VISITORS":
      return await db.customerProfile.count({
        where: {
          merchantId,
          createdAt: { gte: threeDaysAgo }
        }
      });

    default:
      return 0;
  }
}

/**
 * Get all segments with their estimated sizes
 */
export async function getSegmentsWithSizes(merchantId: string): Promise<SegmentConfig[]> {
  const segments = [...PREDEFINED_SEGMENTS];
  
  for (const segment of segments) {
    segment.estimatedSize = await getSegmentSize(merchantId, segment.type);
  }
  
  return segments;
}