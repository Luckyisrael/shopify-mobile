import db from "../db.server";

/**
 * Cost Tracking Service
 * Tracks campaign costs, calculates CPC, and provides ROI metrics
 * 
 * Requirements: 9.10
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface CampaignCostMetrics {
  campaignId: string;
  campaignTitle: string;
  
  // Cost Metrics
  totalCost: number;
  costPerSend: number;
  costPerClick: number;
  costPerConversion: number;
  
  // Volume Metrics
  totalSent: number;
  totalClicks: number;
  totalConversions: number;
  
  // Revenue Metrics
  totalRevenue: number;
  roi: number; // Return on Investment percentage
  roas: number; // Return on Ad Spend (revenue / cost)
  
  // Efficiency Metrics
  profitMargin: number; // (revenue - cost) / revenue * 100
  breakEvenConversions: number; // How many conversions needed to break even
}

export interface CampaignEfficiencyRanking {
  campaignId: string;
  campaignTitle: string;
  costPerConversion: number;
  roi: number;
  roas: number;
  rank: number;
}

export interface CostSummary {
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  totalSpent: number;
  totalRevenue: number;
  totalProfit: number;
  overallROI: number;
  overallROAS: number;
  
  avgCostPerSend: number;
  avgCostPerClick: number;
  avgCostPerConversion: number;
  
  campaignCount: number;
  profitableCampaigns: number;
  unprofitableCampaigns: number;
}

// ============================================================================
// Cost Configuration
// ============================================================================

// Default cost per notification send (in dollars)
// This can be configured per merchant in the future
const DEFAULT_COST_PER_SEND = 0.01; // $0.01 per notification

/**
 * Get cost per send for a merchant
 * In the future, this could be stored in merchant settings
 */
export function getCostPerSend(merchantId: string): number {
  // TODO: Fetch from merchant settings when implemented
  return DEFAULT_COST_PER_SEND;
}

// ============================================================================
// Campaign Cost Functions
// ============================================================================

/**
 * Calculate detailed cost metrics for a campaign
 */
export async function getCampaignCostMetrics(
  campaignId: string
): Promise<CampaignCostMetrics> {
  const campaign = await db.pushCampaign.findUnique({
    where: { id: campaignId }
  });

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  const costPerSend = getCostPerSend(campaign.merchantId);
  
  // Calculate costs
  const totalCost = campaign.sentCount * costPerSend;
  const costPerClick = campaign.clickedCount > 0 
    ? totalCost / campaign.clickedCount 
    : 0;
  const costPerConversion = campaign.convertedCount > 0 
    ? totalCost / campaign.convertedCount 
    : 0;

  // Calculate revenue metrics
  const totalRevenue = campaign.revenueGenerated;
  const profit = totalRevenue - totalCost;
  const roi = totalCost > 0 
    ? (profit / totalCost) * 100 
    : 0;
  const roas = totalCost > 0 
    ? totalRevenue / totalCost 
    : 0;

  // Calculate efficiency metrics
  const profitMargin = totalRevenue > 0 
    ? (profit / totalRevenue) * 100 
    : 0;
  const breakEvenConversions = costPerConversion > 0 
    ? Math.ceil(totalCost / costPerConversion) 
    : 0;

  return {
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    totalCost: parseFloat(totalCost.toFixed(2)),
    costPerSend: parseFloat(costPerSend.toFixed(4)),
    costPerClick: parseFloat(costPerClick.toFixed(2)),
    costPerConversion: parseFloat(costPerConversion.toFixed(2)),
    totalSent: campaign.sentCount,
    totalClicks: campaign.clickedCount,
    totalConversions: campaign.convertedCount,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    roi: parseFloat(roi.toFixed(2)),
    roas: parseFloat(roas.toFixed(2)),
    profitMargin: parseFloat(profitMargin.toFixed(2)),
    breakEvenConversions
  };
}

/**
 * Rank campaigns by cost efficiency
 */
export async function rankCampaignsByEfficiency(
  merchantId: string,
  startDate: Date,
  endDate: Date,
  limit: number = 20
): Promise<CampaignEfficiencyRanking[]> {
  const campaigns = await db.pushCampaign.findMany({
    where: {
      merchantId,
      sentAt: { gte: startDate, lte: endDate },
      convertedCount: { gt: 0 } // Only campaigns with conversions
    }
  });

  const costPerSend = getCostPerSend(merchantId);

  // Calculate efficiency metrics for each campaign
  const rankings: CampaignEfficiencyRanking[] = campaigns.map(campaign => {
    const totalCost = campaign.sentCount * costPerSend;
    const costPerConversion = campaign.convertedCount > 0 
      ? totalCost / campaign.convertedCount 
      : Infinity;
    const profit = campaign.revenueGenerated - totalCost;
    const roi = totalCost > 0 
      ? (profit / totalCost) * 100 
      : 0;
    const roas = totalCost > 0 
      ? campaign.revenueGenerated / totalCost 
      : 0;

    return {
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      costPerConversion: parseFloat(costPerConversion.toFixed(2)),
      roi: parseFloat(roi.toFixed(2)),
      roas: parseFloat(roas.toFixed(2)),
      rank: 0 // Will be set after sorting
    };
  });

  // Sort by cost per conversion (lower is better)
  rankings.sort((a, b) => a.costPerConversion - b.costPerConversion);
  
  // Assign ranks
  rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;
  });

  return rankings.slice(0, limit);
}

/**
 * Get cost summary for a period
 */
export async function getCostSummary(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<CostSummary> {
  const campaigns = await db.pushCampaign.findMany({
    where: {
      merchantId,
      sentAt: { gte: startDate, lte: endDate }
    }
  });

  const costPerSend = getCostPerSend(merchantId);

  // Calculate totals
  const totals = campaigns.reduce((acc, campaign) => {
    const campaignCost = campaign.sentCount * costPerSend;
    const campaignProfit = campaign.revenueGenerated - campaignCost;
    
    return {
      totalSpent: acc.totalSpent + campaignCost,
      totalRevenue: acc.totalRevenue + campaign.revenueGenerated,
      totalProfit: acc.totalProfit + campaignProfit,
      totalSent: acc.totalSent + campaign.sentCount,
      totalClicks: acc.totalClicks + campaign.clickedCount,
      totalConversions: acc.totalConversions + campaign.convertedCount,
      profitableCampaigns: acc.profitableCampaigns + (campaignProfit > 0 ? 1 : 0),
      unprofitableCampaigns: acc.unprofitableCampaigns + (campaignProfit <= 0 ? 1 : 0)
    };
  }, {
    totalSpent: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalSent: 0,
    totalClicks: 0,
    totalConversions: 0,
    profitableCampaigns: 0,
    unprofitableCampaigns: 0
  });

  // Calculate overall metrics
  const overallROI = totals.totalSpent > 0 
    ? (totals.totalProfit / totals.totalSpent) * 100 
    : 0;
  const overallROAS = totals.totalSpent > 0 
    ? totals.totalRevenue / totals.totalSpent 
    : 0;

  // Calculate averages
  const avgCostPerSend = costPerSend;
  const avgCostPerClick = totals.totalClicks > 0 
    ? totals.totalSpent / totals.totalClicks 
    : 0;
  const avgCostPerConversion = totals.totalConversions > 0 
    ? totals.totalSpent / totals.totalConversions 
    : 0;

  return {
    period: {
      startDate,
      endDate
    },
    totalSpent: parseFloat(totals.totalSpent.toFixed(2)),
    totalRevenue: parseFloat(totals.totalRevenue.toFixed(2)),
    totalProfit: parseFloat(totals.totalProfit.toFixed(2)),
    overallROI: parseFloat(overallROI.toFixed(2)),
    overallROAS: parseFloat(overallROAS.toFixed(2)),
    avgCostPerSend: parseFloat(avgCostPerSend.toFixed(4)),
    avgCostPerClick: parseFloat(avgCostPerClick.toFixed(2)),
    avgCostPerConversion: parseFloat(avgCostPerConversion.toFixed(2)),
    campaignCount: campaigns.length,
    profitableCampaigns: totals.profitableCampaigns,
    unprofitableCampaigns: totals.unprofitableCampaigns
  };
}

// ============================================================================
// Cost Projection Functions
// ============================================================================

/**
 * Project costs for a planned campaign
 */
export function projectCampaignCost(
  merchantId: string,
  estimatedSends: number,
  estimatedConversionRate: number,
  estimatedAverageOrderValue: number
): {
  estimatedCost: number;
  estimatedRevenue: number;
  estimatedProfit: number;
  estimatedROI: number;
  breakEvenConversions: number;
} {
  const costPerSend = getCostPerSend(merchantId);
  const estimatedCost = estimatedSends * costPerSend;
  const estimatedConversions = estimatedSends * (estimatedConversionRate / 100);
  const estimatedRevenue = estimatedConversions * estimatedAverageOrderValue;
  const estimatedProfit = estimatedRevenue - estimatedCost;
  const estimatedROI = estimatedCost > 0 
    ? (estimatedProfit / estimatedCost) * 100 
    : 0;
  const breakEvenConversions = estimatedAverageOrderValue > 0 
    ? Math.ceil(estimatedCost / estimatedAverageOrderValue) 
    : 0;

  return {
    estimatedCost: parseFloat(estimatedCost.toFixed(2)),
    estimatedRevenue: parseFloat(estimatedRevenue.toFixed(2)),
    estimatedProfit: parseFloat(estimatedProfit.toFixed(2)),
    estimatedROI: parseFloat(estimatedROI.toFixed(2)),
    breakEvenConversions
  };
}
