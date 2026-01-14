import db from "../db.server";
import { getCampaignMetrics, getMetricsSummary } from "./notification-metrics.server";

/**
 * Performance Comparison Service
 * Provides campaign ranking, trend analysis, and performance benchmarking
 * 
 * Requirements: 9.6, 9.7, 9.11, 9.12
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface CampaignRanking {
  campaignId: string;
  campaignTitle: string;
  sentAt: Date;
  engagementScore: number; // Weighted score combining open, click, conversion rates
  openRate: number;
  clickRate: number;
  conversionRate: number;
  totalRevenue: number;
  rank: number;
}

export interface TrendAnalysis {
  metric: 'openRate' | 'clickRate' | 'conversionRate' | 'revenue';
  currentPeriod: number;
  previousPeriod: number;
  change: number; // Percentage change
  trend: 'up' | 'down' | 'stable';
  dataPoints: {
    date: string;
    value: number;
  }[];
}

export interface TimeToOpenDistribution {
  campaignId: string;
  campaignTitle: string;
  percentiles: {
    p10: number; // 10th percentile in minutes
    p25: number; // 25th percentile
    p50: number; // Median
    p75: number; // 75th percentile
    p90: number; // 90th percentile
  };
  average: number;
  median: number;
}

export interface MerchantBenchmark {
  metric: string;
  merchantValue: number;
  merchantAverage: number;
  industryAverage: number; // Placeholder for future industry data
  percentile: number; // Where merchant ranks (0-100)
  status: 'above_average' | 'average' | 'below_average';
}

// ============================================================================
// Campaign Ranking Functions
// ============================================================================

/**
 * Rank campaigns by engagement score
 * Engagement score = (openRate * 0.3) + (clickRate * 0.3) + (conversionRate * 0.4)
 */
export async function rankCampaignsByEngagement(
  merchantId: string,
  startDate: Date,
  endDate: Date,
  limit: number = 20
): Promise<CampaignRanking[]> {
  const campaigns = await db.pushCampaign.findMany({
    where: {
      merchantId,
      sentAt: { gte: startDate, lte: endDate },
      sentCount: { gt: 0 } // Only campaigns that were actually sent
    },
    orderBy: { sentAt: 'desc' }
  });

  // Calculate engagement score for each campaign
  const rankings: CampaignRanking[] = await Promise.all(
    campaigns.map(async (campaign) => {
      const metrics = await getCampaignMetrics(campaign.id);
      
      // Weighted engagement score
      const engagementScore = 
        (metrics.openRate * 0.3) +
        (metrics.clickRate * 0.3) +
        (metrics.conversionRate * 0.4);

      return {
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        sentAt: campaign.sentAt || campaign.createdAt,
        engagementScore: parseFloat(engagementScore.toFixed(2)),
        openRate: metrics.openRate,
        clickRate: metrics.clickRate,
        conversionRate: metrics.conversionRate,
        totalRevenue: metrics.totalRevenue,
        rank: 0 // Will be set after sorting
      };
    })
  );

  // Sort by engagement score and assign ranks
  rankings.sort((a, b) => b.engagementScore - a.engagementScore);
  rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;
  });

  return rankings.slice(0, limit);
}

/**
 * Rank campaigns by revenue
 */
export async function rankCampaignsByRevenue(
  merchantId: string,
  startDate: Date,
  endDate: Date,
  limit: number = 20
): Promise<CampaignRanking[]> {
  const campaigns = await db.pushCampaign.findMany({
    where: {
      merchantId,
      sentAt: { gte: startDate, lte: endDate },
      revenueGenerated: { gt: 0 }
    },
    orderBy: { revenueGenerated: 'desc' },
    take: limit
  });

  const rankings: CampaignRanking[] = await Promise.all(
    campaigns.map(async (campaign, index) => {
      const metrics = await getCampaignMetrics(campaign.id);
      
      const engagementScore = 
        (metrics.openRate * 0.3) +
        (metrics.clickRate * 0.3) +
        (metrics.conversionRate * 0.4);

      return {
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        sentAt: campaign.sentAt || campaign.createdAt,
        engagementScore: parseFloat(engagementScore.toFixed(2)),
        openRate: metrics.openRate,
        clickRate: metrics.clickRate,
        conversionRate: metrics.conversionRate,
        totalRevenue: metrics.totalRevenue,
        rank: index + 1
      };
    })
  );

  return rankings;
}

// ============================================================================
// Trend Analysis Functions
// ============================================================================

/**
 * Analyze trends over time for key metrics
 */
export async function analyzeTrends(
  merchantId: string,
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
): Promise<TrendAnalysis[]> {
  // Get metrics for both periods
  const currentMetrics = await getMetricsSummary(merchantId, currentStart, currentEnd);
  const previousMetrics = await getMetricsSummary(merchantId, previousStart, previousEnd);

  // Calculate trends for each metric
  const trends: TrendAnalysis[] = [
    {
      metric: 'openRate',
      currentPeriod: currentMetrics.openRate,
      previousPeriod: previousMetrics.openRate,
      change: calculatePercentageChange(previousMetrics.openRate, currentMetrics.openRate),
      trend: determineTrend(previousMetrics.openRate, currentMetrics.openRate),
      dataPoints: await getDailyMetricData(merchantId, currentStart, currentEnd, 'openRate')
    },
    {
      metric: 'clickRate',
      currentPeriod: currentMetrics.clickRate,
      previousPeriod: previousMetrics.clickRate,
      change: calculatePercentageChange(previousMetrics.clickRate, currentMetrics.clickRate),
      trend: determineTrend(previousMetrics.clickRate, currentMetrics.clickRate),
      dataPoints: await getDailyMetricData(merchantId, currentStart, currentEnd, 'clickRate')
    },
    {
      metric: 'conversionRate',
      currentPeriod: currentMetrics.conversionRate,
      previousPeriod: previousMetrics.conversionRate,
      change: calculatePercentageChange(previousMetrics.conversionRate, currentMetrics.conversionRate),
      trend: determineTrend(previousMetrics.conversionRate, currentMetrics.conversionRate),
      dataPoints: await getDailyMetricData(merchantId, currentStart, currentEnd, 'conversionRate')
    },
    {
      metric: 'revenue',
      currentPeriod: currentMetrics.totalRevenue,
      previousPeriod: previousMetrics.totalRevenue,
      change: calculatePercentageChange(previousMetrics.totalRevenue, currentMetrics.totalRevenue),
      trend: determineTrend(previousMetrics.totalRevenue, currentMetrics.totalRevenue),
      dataPoints: await getDailyMetricData(merchantId, currentStart, currentEnd, 'revenue')
    }
  ];

  return trends;
}

/**
 * Get daily metric data for trend charts
 */
async function getDailyMetricData(
  merchantId: string,
  startDate: Date,
  endDate: Date,
  metric: string
): Promise<{ date: string; value: number }[]> {
  const dataPoints: { date: string; value: number }[] = [];
  
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const campaigns = await db.pushCampaign.findMany({
      where: {
        merchantId,
        sentAt: { gte: currentDate, lt: nextDate }
      }
    });

    let value = 0;
    
    if (metric === 'openRate') {
      const totalDelivered = campaigns.reduce((sum, c) => sum + c.deliveredCount, 0);
      const totalOpened = campaigns.reduce((sum, c) => sum + c.openedCount, 0);
      value = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
    } else if (metric === 'clickRate') {
      const totalOpened = campaigns.reduce((sum, c) => sum + c.openedCount, 0);
      const totalClicked = campaigns.reduce((sum, c) => sum + c.clickedCount, 0);
      value = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;
    } else if (metric === 'conversionRate') {
      const totalSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
      const totalConverted = campaigns.reduce((sum, c) => sum + c.convertedCount, 0);
      value = totalSent > 0 ? (totalConverted / totalSent) * 100 : 0;
    } else if (metric === 'revenue') {
      value = campaigns.reduce((sum, c) => sum + c.revenueGenerated, 0);
    }

    dataPoints.push({
      date: currentDate.toISOString().split('T')[0],
      value: parseFloat(value.toFixed(2))
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dataPoints;
}

// ============================================================================
// Time-to-Open Distribution Functions
// ============================================================================

/**
 * Calculate time-to-open distribution for campaigns
 */
export async function getTimeToOpenDistribution(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<TimeToOpenDistribution[]> {
  const campaigns = await db.pushCampaign.findMany({
    where: {
      merchantId,
      sentAt: { gte: startDate, lte: endDate },
      openedCount: { gt: 0 }
    }
  });

  const distributions: TimeToOpenDistribution[] = await Promise.all(
    campaigns.map(async (campaign) => {
      const metrics = await db.notificationMetric.findMany({
        where: {
          campaignId: campaign.id,
          sentAt: { not: null },
          openedAt: { not: null }
        }
      });

      // Calculate time-to-open for each metric (in minutes)
      const times = metrics.map(m => {
        const sent = m.sentAt!.getTime();
        const opened = m.openedAt!.getTime();
        return (opened - sent) / (1000 * 60);
      });

      if (times.length === 0) {
        return {
          campaignId: campaign.id,
          campaignTitle: campaign.title,
          percentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 },
          average: 0,
          median: 0
        };
      }

      times.sort((a, b) => a - b);

      return {
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        percentiles: {
          p10: parseFloat(calculatePercentile(times, 10).toFixed(2)),
          p25: parseFloat(calculatePercentile(times, 25).toFixed(2)),
          p50: parseFloat(calculatePercentile(times, 50).toFixed(2)),
          p75: parseFloat(calculatePercentile(times, 75).toFixed(2)),
          p90: parseFloat(calculatePercentile(times, 90).toFixed(2))
        },
        average: parseFloat((times.reduce((sum, t) => sum + t, 0) / times.length).toFixed(2)),
        median: parseFloat(calculatePercentile(times, 50).toFixed(2))
      };
    })
  );

  return distributions;
}

// ============================================================================
// Benchmark Comparison Functions
// ============================================================================

/**
 * Compare merchant performance against their historical average
 */
export async function compareToBenchmark(
  merchantId: string,
  currentStart: Date,
  currentEnd: Date
): Promise<MerchantBenchmark[]> {
  // Get current period metrics
  const currentMetrics = await getMetricsSummary(merchantId, currentStart, currentEnd);

  // Get historical average (last 90 days before current period)
  const historicalStart = new Date(currentStart);
  historicalStart.setDate(historicalStart.getDate() - 90);
  const historicalEnd = new Date(currentStart);
  historicalEnd.setDate(historicalEnd.getDate() - 1);

  const historicalMetrics = await getMetricsSummary(merchantId, historicalStart, historicalEnd);

  // Calculate benchmarks
  const benchmarks: MerchantBenchmark[] = [
    createBenchmark('Open Rate', currentMetrics.openRate, historicalMetrics.openRate),
    createBenchmark('Click Rate', currentMetrics.clickRate, historicalMetrics.clickRate),
    createBenchmark('Conversion Rate', currentMetrics.conversionRate, historicalMetrics.conversionRate),
    createBenchmark('Average Order Value', currentMetrics.averageOrderValue, historicalMetrics.averageOrderValue)
  ];

  return benchmarks;
}

/**
 * Create a benchmark comparison object
 */
function createBenchmark(
  metric: string,
  currentValue: number,
  historicalAverage: number
): MerchantBenchmark {
  // Calculate percentile (simplified - assumes normal distribution)
  const percentile = currentValue >= historicalAverage ? 75 : 25;
  
  let status: 'above_average' | 'average' | 'below_average';
  const difference = currentValue - historicalAverage;
  const percentDiff = historicalAverage > 0 ? (difference / historicalAverage) * 100 : 0;

  if (percentDiff > 10) {
    status = 'above_average';
  } else if (percentDiff < -10) {
    status = 'below_average';
  } else {
    status = 'average';
  }

  return {
    metric,
    merchantValue: parseFloat(currentValue.toFixed(2)),
    merchantAverage: parseFloat(historicalAverage.toFixed(2)),
    industryAverage: parseFloat(historicalAverage.toFixed(2)), // Placeholder
    percentile,
    status
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate percentage change between two values
 */
function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return parseFloat((((newValue - oldValue) / oldValue) * 100).toFixed(2));
}

/**
 * Determine trend direction
 */
function determineTrend(oldValue: number, newValue: number): 'up' | 'down' | 'stable' {
  const change = calculatePercentageChange(oldValue, newValue);
  if (Math.abs(change) < 5) return 'stable';
  return change > 0 ? 'up' : 'down';
}

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}
