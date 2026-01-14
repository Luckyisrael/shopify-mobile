import db from "../db.server";
import { cache, CacheKeys, CacheTTL, CacheInvalidation } from "./cache.server";

/**
 * Analytics Service
 * Provides comprehensive analytics and metrics for the dashboard
 * Now with in-memory caching for improved performance
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface DashboardMetrics {
  overview: {
    totalCustomers: number;
    activeCustomers: number;
    newCustomers: number;
    churnRate: number;
  };
  pushNotifications: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    openRate: number;
    clickRate: number;
    conversionRate: number;
  };
  revenue: {
    total: number;
    attributed: number;
    roi: number;
  };
  trends: {
    date: string;
    customers: number;
    pushSent: number;
    revenue: number;
  }[];
}

export interface PushPerformance {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalConverted: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  topCampaigns: {
    id: string;
    title: string;
    sent: number;
    openRate: number;
    revenue: number;
  }[];
}

export interface HighlightAnalytics {
  totalViews: number;
  totalClicks: number;
  totalConversions: number;
  clickThroughRate: number;
  conversionRate: number;
  topHighlights: {
    id: string;
    title: string;
    views: number;
    clicks: number;
    clickRate: number;
  }[];
}

export interface RevenueAttribution {
  campaignId: string;
  campaignTitle: string;
  totalRevenue: number;
  conversions: number;
  averageOrderValue: number;
  roi: number;
}

// ============================================================================
// Core Analytics Functions
// ============================================================================

/**
 * Get comprehensive dashboard metrics for a date range
 * Cached for 1 hour to improve performance
 */
export async function getDashboardMetrics(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<DashboardMetrics> {
  const cacheKey = CacheKeys.dashboardMetrics(
    merchantId,
    startDate.toISOString(),
    endDate.toISOString()
  );

  return cache.getOrSet(cacheKey, async () => {
    return await computeDashboardMetrics(merchantId, startDate, endDate);
  }, CacheTTL.LONG);
}

/**
 * Internal function to compute dashboard metrics (not cached)
 */
async function computeDashboardMetrics(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<DashboardMetrics> {
  // Get customer metrics
  const totalCustomers = await db.customerProfile.count({
    where: { merchantId }
  });

  const activeCustomers = await db.customerProfile.count({
    where: {
      merchantId,
      lastSeenAt: { gte: startDate }
    }
  });

  const newCustomers = await db.customerProfile.count({
    where: {
      merchantId,
      createdAt: { gte: startDate, lte: endDate }
    }
  });

  // Calculate churn rate (customers who haven't been active in 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const inactiveCustomers = await db.customerProfile.count({
    where: {
      merchantId,
      lastSeenAt: { lt: thirtyDaysAgo }
    }
  });
  const churnRate = totalCustomers > 0 ? (inactiveCustomers / totalCustomers) * 100 : 0;

  // Get push notification metrics
  const campaigns = await db.pushCampaign.findMany({
    where: {
      merchantId,
      sentAt: { gte: startDate, lte: endDate }
    }
  });

  const pushMetrics = campaigns.reduce((acc, campaign) => ({
    sent: acc.sent + campaign.sentCount,
    delivered: acc.delivered + campaign.deliveredCount,
    opened: acc.opened + campaign.openedCount,
    clicked: acc.clicked + campaign.clickedCount,
    converted: acc.converted + campaign.convertedCount,
    revenue: acc.revenue + campaign.revenueGenerated
  }), { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 });

  const openRate = pushMetrics.delivered > 0 
    ? (pushMetrics.opened / pushMetrics.delivered) * 100 
    : 0;
  const clickRate = pushMetrics.opened > 0 
    ? (pushMetrics.clicked / pushMetrics.opened) * 100 
    : 0;
  const conversionRate = pushMetrics.sent > 0 
    ? (pushMetrics.converted / pushMetrics.sent) * 100 
    : 0;

  // Calculate ROI (simplified - revenue / cost, assuming $0.01 per notification)
  const cost = pushMetrics.sent * 0.01;
  const roi = cost > 0 ? ((pushMetrics.revenue - cost) / cost) * 100 : 0;

  // Generate trend data (daily aggregates)
  const trends = await generateTrendData(merchantId, startDate, endDate);

  return {
    overview: {
      totalCustomers,
      activeCustomers,
      newCustomers,
      churnRate: parseFloat(churnRate.toFixed(2))
    },
    pushNotifications: {
      sent: pushMetrics.sent,
      delivered: pushMetrics.delivered,
      opened: pushMetrics.opened,
      clicked: pushMetrics.clicked,
      openRate: parseFloat(openRate.toFixed(2)),
      clickRate: parseFloat(clickRate.toFixed(2)),
      conversionRate: parseFloat(conversionRate.toFixed(2))
    },
    revenue: {
      total: parseFloat(pushMetrics.revenue.toFixed(2)),
      attributed: parseFloat(pushMetrics.revenue.toFixed(2)),
      roi: parseFloat(roi.toFixed(2))
    },
    trends
  };
}

/**
 * Get push notification performance metrics
 * Cached for 1 hour to improve performance
 */
export async function getPushPerformance(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<PushPerformance> {
  const cacheKey = CacheKeys.pushPerformance(
    merchantId,
    startDate.toISOString(),
    endDate.toISOString()
  );

  return cache.getOrSet(cacheKey, async () => {
    return await computePushPerformance(merchantId, startDate, endDate);
  }, CacheTTL.LONG);
}

/**
 * Internal function to compute push performance (not cached)
 */
async function computePushPerformance(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<PushPerformance> {
  const campaigns = await db.pushCampaign.findMany({
    where: {
      merchantId,
      sentAt: { gte: startDate, lte: endDate }
    },
    orderBy: { sentAt: 'desc' }
  });

  const totals = campaigns.reduce((acc, campaign) => ({
    sent: acc.sent + campaign.sentCount,
    delivered: acc.delivered + campaign.deliveredCount,
    opened: acc.opened + campaign.openedCount,
    clicked: acc.clicked + campaign.clickedCount,
    converted: acc.converted + campaign.convertedCount
  }), { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 });

  const openRate = totals.delivered > 0 
    ? (totals.opened / totals.delivered) * 100 
    : 0;
  const clickRate = totals.opened > 0 
    ? (totals.clicked / totals.opened) * 100 
    : 0;
  const conversionRate = totals.sent > 0 
    ? (totals.converted / totals.sent) * 100 
    : 0;

  // Get top performing campaigns
  const topCampaigns = campaigns
    .filter(c => c.sentCount > 0)
    .map(c => ({
      id: c.id,
      title: c.title,
      sent: c.sentCount,
      openRate: c.deliveredCount > 0 
        ? parseFloat(((c.openedCount / c.deliveredCount) * 100).toFixed(2))
        : 0,
      revenue: parseFloat(c.revenueGenerated.toFixed(2))
    }))
    .sort((a, b) => b.openRate - a.openRate)
    .slice(0, 10);

  return {
    totalSent: totals.sent,
    totalDelivered: totals.delivered,
    totalOpened: totals.opened,
    totalClicked: totals.clicked,
    totalConverted: totals.converted,
    openRate: parseFloat(openRate.toFixed(2)),
    clickRate: parseFloat(clickRate.toFixed(2)),
    conversionRate: parseFloat(conversionRate.toFixed(2)),
    topCampaigns
  };
}

/**
 * Get product highlight analytics
 * Cached for 1 hour to improve performance
 */
export async function getHighlightAnalytics(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<HighlightAnalytics> {
  const cacheKey = CacheKeys.highlightAnalytics(
    merchantId,
    startDate.toISOString(),
    endDate.toISOString()
  );

  return cache.getOrSet(cacheKey, async () => {
    return await computeHighlightAnalytics(merchantId, startDate, endDate);
  }, CacheTTL.LONG);
}

/**
 * Internal function to compute highlight analytics (not cached)
 */
async function computeHighlightAnalytics(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<HighlightAnalytics> {
  const highlights = await db.productHighlight.findMany({
    where: {
      merchantId,
      createdAt: { gte: startDate, lte: endDate }
    }
  });

  const totals = highlights.reduce((acc, highlight) => ({
    views: acc.views + highlight.viewCount,
    clicks: acc.clicks + highlight.clickCount
  }), { views: 0, clicks: 0 });

  // For now, we'll estimate conversions as 10% of clicks
  // In a real implementation, this would track actual purchases
  const totalConversions = Math.floor(totals.clicks * 0.1);

  const clickThroughRate = totals.views > 0 
    ? (totals.clicks / totals.views) * 100 
    : 0;
  const conversionRate = totals.clicks > 0 
    ? (totalConversions / totals.clicks) * 100 
    : 0;

  const topHighlights = highlights
    .filter(h => h.viewCount > 0)
    .map(h => ({
      id: h.id,
      title: h.title,
      views: h.viewCount,
      clicks: h.clickCount,
      clickRate: h.viewCount > 0 
        ? parseFloat(((h.clickCount / h.viewCount) * 100).toFixed(2))
        : 0
    }))
    .sort((a, b) => b.clickRate - a.clickRate)
    .slice(0, 10);

  return {
    totalViews: totals.views,
    totalClicks: totals.clicks,
    totalConversions,
    clickThroughRate: parseFloat(clickThroughRate.toFixed(2)),
    conversionRate: parseFloat(conversionRate.toFixed(2)),
    topHighlights
  };
}

/**
 * Get revenue attribution for campaigns with 24-hour attribution window
 * Cached for 1 hour to improve performance
 */
export async function getRevenueAttribution(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<RevenueAttribution[]> {
  const cacheKey = CacheKeys.revenueAttribution(
    merchantId,
    startDate.toISOString(),
    endDate.toISOString()
  );

  return cache.getOrSet(cacheKey, async () => {
    return await computeRevenueAttribution(merchantId, startDate, endDate);
  }, CacheTTL.LONG);
}

/**
 * Internal function to compute revenue attribution (not cached)
 */
async function computeRevenueAttribution(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<RevenueAttribution[]> {
  const campaigns = await db.pushCampaign.findMany({
    where: {
      merchantId,
      sentAt: { gte: startDate, lte: endDate }
    },
    orderBy: { revenueGenerated: 'desc' }
  });

  // Calculate attribution metrics for each campaign
  const attributions: RevenueAttribution[] = campaigns.map(campaign => {
    const totalRevenue = campaign.revenueGenerated;
    const conversions = campaign.convertedCount;
    const averageOrderValue = conversions > 0 ? totalRevenue / conversions : 0;
    
    // Calculate ROI (assuming $0.01 per notification sent)
    const cost = campaign.sentCount * 0.01;
    const roi = cost > 0 ? ((totalRevenue - cost) / cost) * 100 : 0;

    return {
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      conversions,
      averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
      roi: parseFloat(roi.toFixed(2))
    };
  });

  return attributions.filter(a => a.totalRevenue > 0);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate daily trend data for charts
 */
async function generateTrendData(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<{ date: string; customers: number; pushSent: number; revenue: number }[]> {
  const trends: { date: string; customers: number; pushSent: number; revenue: number }[] = [];
  
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Get active customers for this day
    const customers = await db.customerProfile.count({
      where: {
        merchantId,
        lastSeenAt: { gte: currentDate, lt: nextDate }
      }
    });

    // Get push notifications sent this day
    const campaigns = await db.pushCampaign.findMany({
      where: {
        merchantId,
        sentAt: { gte: currentDate, lt: nextDate }
      }
    });

    const pushSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
    const revenue = campaigns.reduce((sum, c) => sum + c.revenueGenerated, 0);

    trends.push({
      date: currentDate.toISOString().split('T')[0],
      customers,
      pushSent,
      revenue: parseFloat(revenue.toFixed(2))
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return trends;
}

/**
 * Export analytics data as CSV
 */
export async function exportAnalytics(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<string> {
  // Get all analytics data
  const [metrics, pushPerformance, highlightAnalytics, revenueAttribution] = await Promise.all([
    getDashboardMetrics(merchantId, startDate, endDate),
    getPushPerformance(merchantId, startDate, endDate),
    getHighlightAnalytics(merchantId, startDate, endDate),
    getRevenueAttribution(merchantId, startDate, endDate)
  ]);

  // Build CSV content
  const lines: string[] = [];
  
  // Header
  lines.push('Shopify Mobile Connector - Analytics Export');
  lines.push(`Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  lines.push('');
  
  // Overview Metrics
  lines.push('OVERVIEW METRICS');
  lines.push('Metric,Value');
  lines.push(`Total Customers,${metrics.overview.totalCustomers}`);
  lines.push(`Active Customers,${metrics.overview.activeCustomers}`);
  lines.push(`New Customers,${metrics.overview.newCustomers}`);
  lines.push(`Churn Rate,${metrics.overview.churnRate}%`);
  lines.push('');
  
  // Push Notification Metrics
  lines.push('PUSH NOTIFICATION METRICS');
  lines.push('Metric,Value');
  lines.push(`Sent,${metrics.pushNotifications.sent}`);
  lines.push(`Delivered,${metrics.pushNotifications.delivered}`);
  lines.push(`Opened,${metrics.pushNotifications.opened}`);
  lines.push(`Clicked,${metrics.pushNotifications.clicked}`);
  lines.push(`Open Rate,${metrics.pushNotifications.openRate}%`);
  lines.push(`Click Rate,${metrics.pushNotifications.clickRate}%`);
  lines.push(`Conversion Rate,${metrics.pushNotifications.conversionRate}%`);
  lines.push('');
  
  // Revenue Metrics
  lines.push('REVENUE METRICS');
  lines.push('Metric,Value');
  lines.push(`Total Revenue,$${metrics.revenue.total}`);
  lines.push(`Attributed Revenue,$${metrics.revenue.attributed}`);
  lines.push(`ROI,${metrics.revenue.roi}%`);
  lines.push('');
  
  // Top Campaigns
  if (pushPerformance.topCampaigns.length > 0) {
    lines.push('TOP PERFORMING CAMPAIGNS');
    lines.push('Campaign,Sent,Open Rate,Revenue');
    pushPerformance.topCampaigns.forEach(campaign => {
      lines.push(`"${campaign.title}",${campaign.sent},${campaign.openRate}%,$${campaign.revenue}`);
    });
    lines.push('');
  }
  
  // Revenue Attribution
  if (revenueAttribution.length > 0) {
    lines.push('REVENUE ATTRIBUTION BY CAMPAIGN');
    lines.push('Campaign,Revenue,Conversions,AOV,ROI');
    revenueAttribution.forEach(attr => {
      lines.push(`"${attr.campaignTitle}",$${attr.totalRevenue},${attr.conversions},$${attr.averageOrderValue},${attr.roi}%`);
    });
    lines.push('');
  }
  
  // Product Highlights
  if (highlightAnalytics.totalViews > 0) {
    lines.push('PRODUCT HIGHLIGHTS METRICS');
    lines.push('Metric,Value');
    lines.push(`Total Views,${highlightAnalytics.totalViews}`);
    lines.push(`Total Clicks,${highlightAnalytics.totalClicks}`);
    lines.push(`Click-Through Rate,${highlightAnalytics.clickThroughRate}%`);
    lines.push(`Conversions,${highlightAnalytics.totalConversions}`);
    lines.push(`Conversion Rate,${highlightAnalytics.conversionRate}%`);
    lines.push('');
    
    if (highlightAnalytics.topHighlights.length > 0) {
      lines.push('TOP HIGHLIGHTS');
      lines.push('Highlight,Views,Clicks,Click Rate');
      highlightAnalytics.topHighlights.forEach(highlight => {
        lines.push(`"${highlight.title}",${highlight.views},${highlight.clicks},${highlight.clickRate}%`);
      });
      lines.push('');
    }
  }
  
  // Daily Trends
  if (metrics.trends.length > 0) {
    lines.push('DAILY TRENDS');
    lines.push('Date,Customers,Push Sent,Revenue');
    metrics.trends.forEach(trend => {
      lines.push(`${trend.date},${trend.customers},${trend.pushSent},$${trend.revenue}`);
    });
  }
  
  return lines.join('\n');
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Invalidate analytics cache for a merchant
 * Call this when new data is added that should update analytics
 */
export function invalidateAnalyticsCache(merchantId: string): void {
  CacheInvalidation.invalidateAllAnalytics(merchantId);
}

/**
 * Invalidate dashboard cache specifically
 */
export function invalidateDashboardCache(merchantId: string): void {
  CacheInvalidation.invalidateDashboard(merchantId);
}

/**
 * Invalidate push performance cache
 */
export function invalidatePushCache(merchantId: string): void {
  CacheInvalidation.invalidatePush(merchantId);
}

