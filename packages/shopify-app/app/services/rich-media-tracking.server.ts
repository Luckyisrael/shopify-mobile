import db from "../db.server";

/**
 * Rich Media Tracking Service
 * Tracks image load success, rich push delivery, and performance comparison
 * 
 * Requirements: 9.9
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface RichMediaMetrics {
  campaignId: string;
  campaignTitle: string;
  hasRichMedia: boolean;
  
  // Image Tracking
  imageUrl?: string;
  imageLoadAttempts: number;
  imageLoadSuccesses: number;
  imageLoadFailures: number;
  imageLoadSuccessRate: number;
  
  // Delivery Tracking
  totalSent: number;
  richDelivered: number;
  richDeliveryRate: number;
  
  // Performance Comparison
  richOpenRate: number;
  richClickRate: number;
  richConversionRate: number;
}

export interface RichVsStandardComparison {
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  richCampaigns: {
    count: number;
    avgOpenRate: number;
    avgClickRate: number;
    avgConversionRate: number;
    avgRevenue: number;
  };
  
  standardCampaigns: {
    count: number;
    avgOpenRate: number;
    avgClickRate: number;
    avgConversionRate: number;
    avgRevenue: number;
  };
  
  improvement: {
    openRate: number; // Percentage improvement
    clickRate: number;
    conversionRate: number;
    revenue: number;
  };
}

// ============================================================================
// Image Load Tracking Functions
// ============================================================================

/**
 * Record an image load attempt
 */
export async function recordImageLoadAttempt(
  campaignId: string,
  metricId: string,
  success: boolean
): Promise<void> {
  // Store in event log for analytics
  const metric = await db.notificationMetric.findUnique({
    where: { id: metricId },
    include: { campaign: true }
  });

  if (!metric) return;

  await db.eventLog.create({
    data: {
      merchantId: metric.merchantId,
      type: 'RICH_MEDIA_IMAGE_LOAD',
      payload: JSON.stringify({
        campaignId,
        metricId,
        success,
        timestamp: new Date().toISOString()
      })
    }
  });
}

/**
 * Get rich media metrics for a campaign
 */
export async function getRichMediaMetrics(
  campaignId: string
): Promise<RichMediaMetrics> {
  const campaign = await db.pushCampaign.findUnique({
    where: { id: campaignId }
  });

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  // Check if campaign has rich media
  const hasRichMedia = !!(campaign.imageUrl || campaign.actionButtons);

  // Get image load events from event log
  const imageLoadEvents = await db.eventLog.findMany({
    where: {
      merchantId: campaign.merchantId,
      type: 'RICH_MEDIA_IMAGE_LOAD',
      payload: {
        contains: campaignId
      }
    }
  });

  const imageLoadAttempts = imageLoadEvents.length;
  const imageLoadSuccesses = imageLoadEvents.filter(e => {
    try {
      const payload = JSON.parse(e.payload);
      return payload.success === true;
    } catch {
      return false;
    }
  }).length;
  const imageLoadFailures = imageLoadAttempts - imageLoadSuccesses;
  const imageLoadSuccessRate = imageLoadAttempts > 0 
    ? (imageLoadSuccesses / imageLoadAttempts) * 100 
    : 0;

  // Get delivery metrics
  const totalSent = campaign.sentCount;
  const richDelivered = campaign.deliveredCount;
  const richDeliveryRate = totalSent > 0 
    ? (richDelivered / totalSent) * 100 
    : 0;

  // Get performance metrics
  const richOpenRate = richDelivered > 0 
    ? (campaign.openedCount / richDelivered) * 100 
    : 0;
  const richClickRate = campaign.openedCount > 0 
    ? (campaign.clickedCount / campaign.openedCount) * 100 
    : 0;
  const richConversionRate = totalSent > 0 
    ? (campaign.convertedCount / totalSent) * 100 
    : 0;

  return {
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    hasRichMedia,
    imageUrl: campaign.imageUrl || undefined,
    imageLoadAttempts,
    imageLoadSuccesses,
    imageLoadFailures,
    imageLoadSuccessRate: parseFloat(imageLoadSuccessRate.toFixed(2)),
    totalSent,
    richDelivered,
    richDeliveryRate: parseFloat(richDeliveryRate.toFixed(2)),
    richOpenRate: parseFloat(richOpenRate.toFixed(2)),
    richClickRate: parseFloat(richClickRate.toFixed(2)),
    richConversionRate: parseFloat(richConversionRate.toFixed(2))
  };
}

// ============================================================================
// Rich vs Standard Comparison Functions
// ============================================================================

/**
 * Compare rich push performance vs standard push
 */
export async function compareRichVsStandard(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<RichVsStandardComparison> {
  // Get all campaigns in the period
  const allCampaigns = await db.pushCampaign.findMany({
    where: {
      merchantId,
      sentAt: { gte: startDate, lte: endDate },
      sentCount: { gt: 0 }
    }
  });

  // Separate rich and standard campaigns
  const richCampaigns = allCampaigns.filter(c => c.imageUrl || c.actionButtons);
  const standardCampaigns = allCampaigns.filter(c => !c.imageUrl && !c.actionButtons);

  // Calculate averages for rich campaigns
  const richMetrics = calculateAverageMetrics(richCampaigns);
  
  // Calculate averages for standard campaigns
  const standardMetrics = calculateAverageMetrics(standardCampaigns);

  // Calculate improvement percentages
  const improvement = {
    openRate: calculateImprovement(standardMetrics.avgOpenRate, richMetrics.avgOpenRate),
    clickRate: calculateImprovement(standardMetrics.avgClickRate, richMetrics.avgClickRate),
    conversionRate: calculateImprovement(standardMetrics.avgConversionRate, richMetrics.avgConversionRate),
    revenue: calculateImprovement(standardMetrics.avgRevenue, richMetrics.avgRevenue)
  };

  return {
    period: {
      startDate,
      endDate
    },
    richCampaigns: {
      count: richCampaigns.length,
      ...richMetrics
    },
    standardCampaigns: {
      count: standardCampaigns.length,
      ...standardMetrics
    },
    improvement
  };
}

/**
 * Calculate average metrics for a set of campaigns
 */
function calculateAverageMetrics(campaigns: any[]) {
  if (campaigns.length === 0) {
    return {
      avgOpenRate: 0,
      avgClickRate: 0,
      avgConversionRate: 0,
      avgRevenue: 0
    };
  }

  const totals = campaigns.reduce((acc, campaign) => {
    const openRate = campaign.deliveredCount > 0 
      ? (campaign.openedCount / campaign.deliveredCount) * 100 
      : 0;
    const clickRate = campaign.openedCount > 0 
      ? (campaign.clickedCount / campaign.openedCount) * 100 
      : 0;
    const conversionRate = campaign.sentCount > 0 
      ? (campaign.convertedCount / campaign.sentCount) * 100 
      : 0;

    return {
      openRate: acc.openRate + openRate,
      clickRate: acc.clickRate + clickRate,
      conversionRate: acc.conversionRate + conversionRate,
      revenue: acc.revenue + campaign.revenueGenerated
    };
  }, { openRate: 0, clickRate: 0, conversionRate: 0, revenue: 0 });

  return {
    avgOpenRate: parseFloat((totals.openRate / campaigns.length).toFixed(2)),
    avgClickRate: parseFloat((totals.clickRate / campaigns.length).toFixed(2)),
    avgConversionRate: parseFloat((totals.conversionRate / campaigns.length).toFixed(2)),
    avgRevenue: parseFloat((totals.revenue / campaigns.length).toFixed(2))
  };
}

/**
 * Calculate percentage improvement
 */
function calculateImprovement(baseline: number, comparison: number): number {
  if (baseline === 0) return comparison > 0 ? 100 : 0;
  return parseFloat((((comparison - baseline) / baseline) * 100).toFixed(2));
}

// ============================================================================
// Mobile API Functions
// ============================================================================

/**
 * Track image load from mobile app
 */
export async function trackImageLoad(
  campaignId: string,
  customerId: string,
  success: boolean
): Promise<void> {
  // Find the metric for this customer and campaign
  const metric = await db.notificationMetric.findFirst({
    where: {
      campaignId,
      shopifyCustomerId: customerId
    },
    orderBy: { sentAt: 'desc' }
  });

  if (metric) {
    await recordImageLoadAttempt(campaignId, metric.id, success);
  }
}
