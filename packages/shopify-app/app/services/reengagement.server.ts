import db from "../db.server";
import { sendCustomerPush } from "./automation-v2.server";
import { checkUsageLimit, logUsage } from "./billing.server";

/**
 * Re-engagement Campaign Tiers
 */
export const REENGAGEMENT_TIERS = {
  TIER_7: 7,   // 7 days inactive
  TIER_14: 14, // 14 days inactive
  TIER_30: 30, // 30 days inactive
} as const;

export const CAMPAIGN_STATUS = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
} as const;

/**
 * Creates or updates a re-engagement campaign configuration
 */
export const createReengagementCampaign = async (
  merchantId: string,
  tier: number,
  title: string,
  body: string,
  enabled: boolean = true
) => {
  // Validate tier
  if (![7, 14, 30].includes(tier)) {
    throw new Error("Invalid tier. Must be 7, 14, or 30 days");
  }

  const tierString = `${tier}_DAY`;

  // Check if campaign exists for this tier
  const existing = await db.reengagementCampaign.findFirst({
    where: {
      merchantId,
      tier: tierString,
    },
  });

  if (existing) {
    // Update existing campaign
    return await db.reengagementCampaign.update({
      where: { id: existing.id },
      data: {
        title,
        body,
        isActive: enabled,
        updatedAt: new Date(),
      },
    });
  } else {
    // Create new campaign
    return await db.reengagementCampaign.create({
      data: {
        merchantId,
        tier: tierString,
        title,
        body,
        isActive: enabled,
      },
    });
  }
};

/**
 * Gets all re-engagement campaigns for a merchant
 */
export const getReengagementCampaigns = async (merchantId: string) => {
  return await db.reengagementCampaign.findMany({
    where: { merchantId },
    orderBy: { tier: 'asc' },
  });
};

/**
 * Processes re-engagement campaigns for all tiers
 * This should be called by a daily cron job
 */
export const processReengagement = async (merchantId: string) => {
  console.log(`[Reengagement] Processing campaigns for merchant ${merchantId}`);

  // Get all active campaigns
  const campaigns = await db.reengagementCampaign.findMany({
    where: {
      merchantId,
      isActive: true,
    },
  });

  if (campaigns.length === 0) {
    console.log(`[Reengagement] No active campaigns for merchant ${merchantId}`);
    return { processed: 0, sent: 0 };
  }

  let totalProcessed = 0;
  let totalSent = 0;

  // Process each tier
  for (const campaign of campaigns) {
    const result = await processReengagementTier(merchantId, campaign);
    totalProcessed += result.processed;
    totalSent += result.sent;
  }

  console.log(`[Reengagement] Completed: ${totalProcessed} customers processed, ${totalSent} notifications sent`);

  return { processed: totalProcessed, sent: totalSent };
};

/**
 * Processes a single re-engagement tier
 */
export const processReengagementTier = async (
  merchantId: string,
  campaign: any
) => {
  const tierDays = parseInt(campaign.tier.replace('_DAY', ''));
  const { title, body } = campaign;
  
  // Find inactive customers for this tier
  const inactiveCustomers = await findInactiveCustomers(merchantId, tierDays);
  
  console.log(`[Reengagement:${tierDays}d] Found ${inactiveCustomers.length} inactive customers`);

  let sent = 0;

  for (const customer of inactiveCustomers) {
    try {
      // Check if already sent for this tier (using EventLog as history)
      const recentSent = await db.eventLog.findFirst({
        where: {
          merchantId,
          shopifyCustomerId: customer.shopifyCustomerId,
          type: 'REENGAGEMENT_SENT',
          payload: {
            contains: campaign.id,
          },
          createdAt: {
            // Don't resend within 30 days
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      });

      if (recentSent) {
        console.log(`[Reengagement] Already sent to ${customer.shopifyCustomerId} recently`);
        continue;
      }

      // Check usage limits
      await checkUsageLimit(merchantId, 'PUSH');

      // Send re-engagement push
      const result = await sendCustomerPush(
        merchantId,
        customer.shopifyCustomerId,
        title,
        body,
        { type: 'reengagement', tier: tierDays, campaignId: campaign.id }
      );

      if (result.success) {
        // Log the send event
        await db.eventLog.create({
          data: {
            merchantId,
            shopifyCustomerId: customer.shopifyCustomerId,
            type: 'REENGAGEMENT_SENT',
            payload: JSON.stringify({
              campaignId: campaign.id,
              tier: tierDays,
              sentAt: new Date().toISOString(),
            }),
          },
        });

        // Update campaign stats
        await db.reengagementCampaign.update({
          where: { id: campaign.id },
          data: {
            sent: { increment: 1 },
            triggered: { increment: 1 },
          },
        });

        await logUsage(merchantId, 'PUSH');
        sent++;
      }
    } catch (error) {
      console.error(`[Reengagement] Failed to send to ${customer.shopifyCustomerId}:`, error);
      // Continue with other customers
    }
  }

  return { processed: inactiveCustomers.length, sent };
};

/**
 * Finds customers who have been inactive for the specified number of days
 */
export const findInactiveCustomers = async (
  merchantId: string,
  inactiveDays: number
) => {
  const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

  // Find customers whose last activity was before the cutoff
  const customers = await db.customerProfile.findMany({
    where: {
      merchantId,
      lastSeenAt: {
        lt: cutoffDate,
      },
    },
    select: {
      shopifyCustomerId: true,
      lastSeenAt: true,
    },
  });

  // Filter to only those with push tokens
  const customersWithTokens = [];
  for (const customer of customers) {
    const hasToken = await db.pushToken.findFirst({
      where: {
        merchantId,
        shopifyCustomerId: customer.shopifyCustomerId,
      },
    });
    if (hasToken) {
      customersWithTokens.push(customer);
    }
  }

  return customersWithTokens;
};

/**
 * Marks a customer as re-engaged
 * Called when customer opens app or makes a purchase after re-engagement notification
 */
export const markReengaged = async (
  merchantId: string,
  shopifyCustomerId: string
) => {
  // Find recent re-engagement notifications sent to this customer
  const recentNotifications = await db.eventLog.findMany({
    where: {
      merchantId,
      shopifyCustomerId,
      type: 'REENGAGEMENT_SENT',
      createdAt: {
        // Within last 7 days
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  if (recentNotifications.length === 0) {
    return { marked: 0 };
  }

  // Mark as re-engaged by creating success events
  for (const notification of recentNotifications) {
    const payload = JSON.parse(notification.payload);
    
    // Check if already marked
    const alreadyMarked = await db.eventLog.findFirst({
      where: {
        merchantId,
        shopifyCustomerId,
        type: 'REENGAGEMENT_SUCCESS',
        payload: {
          contains: payload.campaignId,
        },
      },
    });

    if (!alreadyMarked) {
      await db.eventLog.create({
        data: {
          merchantId,
          shopifyCustomerId,
          type: 'REENGAGEMENT_SUCCESS',
          payload: JSON.stringify({
            campaignId: payload.campaignId,
            tier: payload.tier,
            reengagedAt: new Date().toISOString(),
          }),
        },
      });

      // Update campaign success count
      await db.reengagementCampaign.update({
        where: { id: payload.campaignId },
        data: {
          reengaged: { increment: 1 },
        },
      });
    }
  }

  console.log(`[Reengagement] Marked ${recentNotifications.length} notifications as successful for ${shopifyCustomerId}`);

  return { marked: recentNotifications.length };
};

/**
 * Gets re-engagement metrics for a merchant
 */
export const getReengagementMetrics = async (merchantId: string) => {
  // Get all campaigns with their stats
  const campaigns = await db.reengagementCampaign.findMany({
    where: { merchantId },
    orderBy: { tier: 'asc' },
  });

  // Get detailed history for date range analysis
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const sentEvents = await db.eventLog.findMany({
    where: {
      merchantId,
      type: 'REENGAGEMENT_SENT',
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  const successEvents = await db.eventLog.findMany({
    where: {
      merchantId,
      type: 'REENGAGEMENT_SUCCESS',
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  // Calculate metrics per tier
  const tierMetrics = campaigns.map(campaign => {
    const tierSent = sentEvents.filter(e => {
      const payload = JSON.parse(e.payload);
      return payload.campaignId === campaign.id;
    });
    
    const tierSuccess = successEvents.filter(e => {
      const payload = JSON.parse(e.payload);
      return payload.campaignId === campaign.id;
    });

    const sent = tierSent.length;
    const reengaged = tierSuccess.length;
    const reengagementRate = sent > 0 ? (reengaged / sent) * 100 : 0;
    const tierDays = parseInt(campaign.tier.replace('_DAY', ''));

    return {
      tier: tierDays,
      title: campaign.title,
      body: campaign.body,
      isActive: campaign.isActive,
      sent,
      reengaged,
      reengagementRate: Math.round(reengagementRate * 10) / 10,
      totalSent: campaign.sent,
      totalReengaged: campaign.reengaged,
      lifetimeRate: campaign.sent > 0 
        ? Math.round((campaign.reengaged / campaign.sent) * 1000) / 10
        : 0,
    };
  });

  // Overall metrics
  const totalSent = sentEvents.length;
  const totalReengaged = successEvents.length;
  const overallRate = totalSent > 0 ? (totalReengaged / totalSent) * 100 : 0;

  // Calculate average time to re-engage
  let avgTimeToReengage = 0;
  if (successEvents.length > 0) {
    const totalTime = successEvents.reduce((sum: number, successEvent: any) => {
      const successPayload = JSON.parse(successEvent.payload);
      const sentEvent = sentEvents.find(e => {
        const sentPayload = JSON.parse(e.payload);
        return sentPayload.campaignId === successPayload.campaignId;
      });
      
      if (sentEvent) {
        const timeDiff = successEvent.createdAt.getTime() - sentEvent.createdAt.getTime();
        return sum + timeDiff;
      }
      return sum;
    }, 0);
    avgTimeToReengage = Math.round(totalTime / successEvents.length / (1000 * 60 * 60)); // Convert to hours
  }

  return {
    tierMetrics,
    overall: {
      sent: totalSent,
      reengaged: totalReengaged,
      reengagementRate: Math.round(overallRate * 10) / 10,
      avgTimeToReengage, // in hours
    },
  };
};

/**
 * Toggles a re-engagement campaign on/off
 */
export const toggleReengagementCampaign = async (
  merchantId: string,
  campaignId: string,
  enabled: boolean
) => {
  return await db.reengagementCampaign.update({
    where: {
      id: campaignId,
      merchantId, // Ensure merchant owns this campaign
    },
    data: {
      isActive: enabled,
      updatedAt: new Date(),
    },
  });
};

/**
 * Deletes a re-engagement campaign
 */
export const deleteReengagementCampaign = async (
  merchantId: string,
  campaignId: string
) => {
  // Delete campaign
  return await db.reengagementCampaign.delete({
    where: {
      id: campaignId,
      merchantId, // Ensure merchant owns this campaign
    },
  });
};

/**
 * Gets inactive customer count for each tier
 * Useful for preview before enabling campaigns
 */
export const getInactiveCustomerCounts = async (merchantId: string) => {
  const tiers = [7, 14, 30];
  const counts: Record<number, number> = {};

  for (const tier of tiers) {
    const customers = await findInactiveCustomers(merchantId, tier);
    counts[tier] = customers.length;
  }

  return counts;
};
