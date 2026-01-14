import db from "../db.server";

/**
 * Notification Metrics Service
 * Provides detailed tracking and analysis of notification performance
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface DetailedCampaignMetrics {
  campaignId: string;
  campaignTitle: string;
  sentAt: Date;
  
  // Core Metrics
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalConverted: number;
  
  // Calculated Rates
  deliveryRate: number;  // delivered / sent
  openRate: number;      // opened / delivered
  clickRate: number;     // clicked / opened
  conversionRate: number; // converted / sent
  
  // Revenue Metrics
  totalRevenue: number;
  averageOrderValue: number;
  
  // Time-based Metrics
  averageTimeToOpen: number; // in minutes
  averageTimeToClick: number; // in minutes
  averageTimeToConvert: number; // in minutes
}

export interface NotificationMetricsSummary {
  // Aggregate Metrics
  totalSends: number;
  totalDeliveries: number;
  totalOpens: number;
  totalClicks: number;
  totalConversions: number;
  
  // Aggregate Rates
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  
  // Revenue
  totalRevenue: number;
  averageOrderValue: number;
  
  // Performance Distribution
  timeToOpenDistribution: {
    under5min: number;
    under30min: number;
    under1hour: number;
    under6hours: number;
    under24hours: number;
    over24hours: number;
  };
}

export interface ButtonPerformance {
  buttonText: string;
  totalClicks: number;
  clickRate: number; // clicks / total opens
  conversions: number;
  conversionRate: number; // conversions / clicks
}

// ============================================================================
// Core Tracking Functions
// ============================================================================

/**
 * Record a notification send event
 */
export async function recordNotificationSent(
  merchantId: string,
  campaignId: string,
  shopifyCustomerId: string,
  pushTokenId: string
): Promise<string> {
  const metric = await db.notificationMetric.create({
    data: {
      merchantId,
      campaignId,
      shopifyCustomerId,
      pushTokenId,
      sentAt: new Date()
    }
  });
  
  // Update campaign sent count
  await db.pushCampaign.update({
    where: { id: campaignId },
    data: { sentCount: { increment: 1 } }
  });
  
  return metric.id;
}

/**
 * Record a notification delivery event
 */
export async function recordNotificationDelivered(
  metricId: string
): Promise<void> {
  const metric = await db.notificationMetric.update({
    where: { id: metricId },
    data: { deliveredAt: new Date() }
  });
  
  // Update campaign delivered count
  await db.pushCampaign.update({
    where: { id: metric.campaignId },
    data: { deliveredCount: { increment: 1 } }
  });
}

/**
 * Record a notification open event
 */
export async function recordNotificationOpened(
  metricId: string
): Promise<void> {
  const metric = await db.notificationMetric.update({
    where: { id: metricId },
    data: { openedAt: new Date() }
  });
  
  // Update campaign opened count
  await db.pushCampaign.update({
    where: { id: metric.campaignId },
    data: { openedCount: { increment: 1 } }
  });
}

/**
 * Record a notification click event
 */
export async function recordNotificationClicked(
  metricId: string,
  buttonClicked?: string
): Promise<void> {
  const metric = await db.notificationMetric.update({
    where: { id: metricId },
    data: { 
      clickedAt: new Date(),
      buttonClicked
    }
  });
  
  // Update campaign clicked count
  await db.pushCampaign.update({
    where: { id: metric.campaignId },
    data: { clickedCount: { increment: 1 } }
  });
}

/**
 * Record a notification conversion event
 */
export async function recordNotificationConversion(
  metricId: string,
  orderId: string,
  orderValue: number
): Promise<void> {
  const metric = await db.notificationMetric.update({
    where: { id: metricId },
    data: { 
      convertedAt: new Date(),
      orderId,
      orderValue
    }
  });
  
  // Update campaign conversion metrics
  await db.pushCampaign.update({
    where: { id: metric.campaignId },
    data: { 
      convertedCount: { increment: 1 },
      revenueGenerated: { increment: orderValue }
    }
  });
}

/**
 * Find metric by campaign and customer for attribution
 */
export async function findMetricForAttribution(
  campaignId: string,
  shopifyCustomerId: string,
  orderId: string
): Promise<string | null> {
  // Find the most recent notification sent to this customer from this campaign
  // within the 24-hour attribution window
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const metric = await db.notificationMetric.findFirst({
    where: {
      campaignId,
      shopifyCustomerId,
      sentAt: { gte: twentyFourHoursAgo },
      orderId: null // Not already attributed
    },
    orderBy: { sentAt: 'desc' }
  });
  
  return metric?.id || null;
}

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Get detailed metrics for a specific campaign
 */
export async function getCampaignMetrics(
  campaignId: string
): Promise<DetailedCampaignMetrics> {
  const campaign = await db.pushCampaign.findUnique({
    where: { id: campaignId }
  });
  
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  
  const metrics = await db.notificationMetric.findMany({
    where: { campaignId }
  });
  
  // Calculate core metrics
  const totalSent = metrics.length;
  const totalDelivered = metrics.filter(m => m.deliveredAt).length;
  const totalOpened = metrics.filter(m => m.openedAt).length;
  const totalClicked = metrics.filter(m => m.clickedAt).length;
  const totalConverted = metrics.filter(m => m.convertedAt).length;
  
  // Calculate rates
  const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
  const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
  const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;
  const conversionRate = totalSent > 0 ? (totalConverted / totalSent) * 100 : 0;
  
  // Calculate revenue metrics
  const totalRevenue = metrics.reduce((sum, m) => sum + (m.orderValue || 0), 0);
  const averageOrderValue = totalConverted > 0 ? totalRevenue / totalConverted : 0;
  
  // Calculate time-based metrics
  const averageTimeToOpen = calculateAverageTime(
    metrics.filter(m => m.sentAt && m.openedAt),
    'sentAt',
    'openedAt'
  );
  
  const averageTimeToClick = calculateAverageTime(
    metrics.filter(m => m.openedAt && m.clickedAt),
    'openedAt',
    'clickedAt'
  );
  
  const averageTimeToConvert = calculateAverageTime(
    metrics.filter(m => m.sentAt && m.convertedAt),
    'sentAt',
    'convertedAt'
  );
  
  return {
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    sentAt: campaign.sentAt || campaign.createdAt,
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    totalConverted,
    deliveryRate: parseFloat(deliveryRate.toFixed(2)),
    openRate: parseFloat(openRate.toFixed(2)),
    clickRate: parseFloat(clickRate.toFixed(2)),
    conversionRate: parseFloat(conversionRate.toFixed(2)),
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
    averageTimeToOpen: parseFloat(averageTimeToOpen.toFixed(2)),
    averageTimeToClick: parseFloat(averageTimeToClick.toFixed(2)),
    averageTimeToConvert: parseFloat(averageTimeToConvert.toFixed(2))
  };
}

/**
 * Get aggregate metrics summary for a merchant
 */
export async function getMetricsSummary(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<NotificationMetricsSummary> {
  const campaigns = await db.pushCampaign.findMany({
    where: {
      merchantId,
      sentAt: { gte: startDate, lte: endDate }
    }
  });
  
  const campaignIds = campaigns.map(c => c.id);
  
  const metrics = await db.notificationMetric.findMany({
    where: {
      merchantId,
      campaignId: { in: campaignIds }
    }
  });
  
  // Calculate aggregate metrics
  const totalSends = metrics.length;
  const totalDeliveries = metrics.filter(m => m.deliveredAt).length;
  const totalOpens = metrics.filter(m => m.openedAt).length;
  const totalClicks = metrics.filter(m => m.clickedAt).length;
  const totalConversions = metrics.filter(m => m.convertedAt).length;
  
  // Calculate aggregate rates
  const deliveryRate = totalSends > 0 ? (totalDeliveries / totalSends) * 100 : 0;
  const openRate = totalDeliveries > 0 ? (totalOpens / totalDeliveries) * 100 : 0;
  const clickRate = totalOpens > 0 ? (totalClicks / totalOpens) * 100 : 0;
  const conversionRate = totalSends > 0 ? (totalConversions / totalSends) * 100 : 0;
  
  // Calculate revenue
  const totalRevenue = metrics.reduce((sum, m) => sum + (m.orderValue || 0), 0);
  const averageOrderValue = totalConversions > 0 ? totalRevenue / totalConversions : 0;
  
  // Calculate time-to-open distribution
  const timeToOpenDistribution = calculateTimeDistribution(
    metrics.filter(m => m.sentAt && m.openedAt)
  );
  
  return {
    totalSends,
    totalDeliveries,
    totalOpens,
    totalClicks,
    totalConversions,
    deliveryRate: parseFloat(deliveryRate.toFixed(2)),
    openRate: parseFloat(openRate.toFixed(2)),
    clickRate: parseFloat(clickRate.toFixed(2)),
    conversionRate: parseFloat(conversionRate.toFixed(2)),
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
    timeToOpenDistribution
  };
}

/**
 * Get button performance metrics for a campaign
 */
export async function getButtonPerformance(
  campaignId: string
): Promise<ButtonPerformance[]> {
  const metrics = await db.notificationMetric.findMany({
    where: { 
      campaignId,
      buttonClicked: { not: null }
    }
  });
  
  const totalOpens = await db.notificationMetric.count({
    where: { 
      campaignId,
      openedAt: { not: null }
    }
  });
  
  // Group by button
  const buttonGroups = new Map<string, typeof metrics>();
  metrics.forEach(metric => {
    if (metric.buttonClicked) {
      const existing = buttonGroups.get(metric.buttonClicked) || [];
      buttonGroups.set(metric.buttonClicked, [...existing, metric]);
    }
  });
  
  // Calculate performance for each button
  const performance: ButtonPerformance[] = [];
  
  for (const [buttonText, buttonMetrics] of buttonGroups) {
    const totalClicks = buttonMetrics.length;
    const conversions = buttonMetrics.filter(m => m.convertedAt).length;
    const clickRate = totalOpens > 0 ? (totalClicks / totalOpens) * 100 : 0;
    const conversionRate = totalClicks > 0 ? (conversions / totalClicks) * 100 : 0;
    
    performance.push({
      buttonText,
      totalClicks,
      clickRate: parseFloat(clickRate.toFixed(2)),
      conversions,
      conversionRate: parseFloat(conversionRate.toFixed(2))
    });
  }
  
  return performance.sort((a, b) => b.totalClicks - a.totalClicks);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate average time between two events in minutes
 */
function calculateAverageTime(
  metrics: any[],
  startField: string,
  endField: string
): number {
  if (metrics.length === 0) return 0;
  
  const times = metrics.map(m => {
    const start = m[startField] as Date;
    const end = m[endField] as Date;
    return (end.getTime() - start.getTime()) / (1000 * 60); // Convert to minutes
  });
  
  const sum = times.reduce((acc, time) => acc + time, 0);
  return sum / times.length;
}

/**
 * Calculate time-to-open distribution
 */
function calculateTimeDistribution(
  metrics: any[]
): NotificationMetricsSummary['timeToOpenDistribution'] {
  const distribution = {
    under5min: 0,
    under30min: 0,
    under1hour: 0,
    under6hours: 0,
    under24hours: 0,
    over24hours: 0
  };
  
  metrics.forEach(metric => {
    const timeToOpen = (metric.openedAt.getTime() - metric.sentAt.getTime()) / (1000 * 60); // minutes
    
    if (timeToOpen < 5) {
      distribution.under5min++;
    } else if (timeToOpen < 30) {
      distribution.under30min++;
    } else if (timeToOpen < 60) {
      distribution.under1hour++;
    } else if (timeToOpen < 360) {
      distribution.under6hours++;
    } else if (timeToOpen < 1440) {
      distribution.under24hours++;
    } else {
      distribution.over24hours++;
    }
  });
  
  return distribution;
}

/**
 * Calculate percentile for time-based metrics
 */
export function calculatePercentile(
  values: number[],
  percentile: number
): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
