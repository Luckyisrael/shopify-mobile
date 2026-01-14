import { BillingInterval } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { PLANS } from "../billing.constants";

export { PLANS };

export const PLAN_CONFIGS = {
    [PLANS.FREE]: {
        name: "Free",
        amount: 0,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
        features: {
            maxPushCampaignsPerMonth: 20,
            maxScheduledCampaigns: 2,
            maxCartRecoveriesPerDay: 5,
            maxProductHighlights: 20,
            schedulingEnabled: true,
            cartRecoveryEnabled: true,
            priorityJobs: false,
            aiFeaturesEnabled: false,
        },
    },
    [PLANS.PRO]: {
        name: "Pro",
        amount: 29,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
        features: {
            maxPushCampaignsPerMonth: 200,
            maxScheduledCampaigns: 20,
            maxCartRecoveriesPerDay: 50,
            maxProductHighlights: 100,
            schedulingEnabled: true,
            cartRecoveryEnabled: true,
            priorityJobs: true,
            aiFeaturesEnabled: false,
        },
    },
    [PLANS.ENTERPRISE]: {
        name: "Enterprise",
        amount: 199,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
        features: {
            maxPushCampaignsPerMonth: 999999, // Infinity-ish
            maxScheduledCampaigns: 999999,
            maxCartRecoveriesPerDay: 999999,
            maxProductHighlights: 999999,
            schedulingEnabled: true,
            cartRecoveryEnabled: true,
            priorityJobs: true,
            aiFeaturesEnabled: true,
        },
    },
};

/**
 * Syncs the feature flags for a merchant based on their plan.
 */
export const syncFeatureFlags = async (merchantId: string, plan: string) => {
    const config = PLAN_CONFIGS[plan] || PLAN_CONFIGS[PLANS.FREE];

    await db.featureFlags.upsert({
        where: { merchantId },
        update: {
            maxPushCampaignsPerMonth: config.features.maxPushCampaignsPerMonth,
            maxScheduledCampaigns: config.features.maxScheduledCampaigns,
            maxCartRecoveriesPerDay: config.features.maxCartRecoveriesPerDay,
            maxProductHighlights: config.features.maxProductHighlights,
            schedulingEnabled: config.features.schedulingEnabled,
            cartRecoveryEnabled: config.features.cartRecoveryEnabled,
            priorityJobs: config.features.priorityJobs,
            aiFeaturesEnabled: config.features.aiFeaturesEnabled,
        },
        create: {
            merchantId,
            maxPushCampaignsPerMonth: config.features.maxPushCampaignsPerMonth,
            maxScheduledCampaigns: config.features.maxScheduledCampaigns,
            maxCartRecoveriesPerDay: config.features.maxCartRecoveriesPerDay,
            maxProductHighlights: config.features.maxProductHighlights,
            schedulingEnabled: config.features.schedulingEnabled,
            cartRecoveryEnabled: config.features.cartRecoveryEnabled,
            priorityJobs: config.features.priorityJobs,
            aiFeaturesEnabled: config.features.aiFeaturesEnabled,
        },
    });
};

/**
 * Updates the subscription status in the database.
 */
export const updateSubscription = async (merchantId: string, shopifySubscriptionId: string, status: string, plan: string) => {
    // 1. Update Subscription Table
    await db.subscription.upsert({
        where: { merchantId },
        create: {
            merchantId,
            shopifySubscriptionId,
            plan,
            status,
        },
        update: {
            shopifySubscriptionId,
            plan,
            status,
        }
    });

    // 2. Sync Feature Flags
    const effectivePlan = status === "ACTIVE" ? plan : PLANS.FREE;
    await syncFeatureFlags(merchantId, effectivePlan);
};

/**
 * Check if merchant can use a feature based on usage limits
 */
export const checkUsageLimit = async (merchantId: string, feature: string, currentUsage?: number) => {
    const flags = await db.featureFlags.findUnique({
        where: { merchantId },
    });

    if (!flags) {
        // Create default flags if they don't exist
        await syncFeatureFlags(merchantId, PLANS.FREE);
        return checkUsageLimit(merchantId, feature, currentUsage);
    }

    const now = new Date();
    let limit = 0;
    let period = "";

    switch (feature) {
        case "PUSH":
            // Monthly limit
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const pushCount = currentUsage ?? await db.usageLog.count({
                where: {
                    merchantId,
                    feature: "PUSH",
                    timestamp: { gte: startOfMonth },
                },
            });
            limit = flags.maxPushCampaignsPerMonth;
            period = "month";
            if (pushCount >= limit) {
                throw new Error(`Push campaign limit reached (${limit} per ${period}). Upgrade your plan for more campaigns.`);
            }
            break;

        case "CART_RECOVERY":
            // Daily limit
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const recoveryCount = currentUsage ?? await db.usageLog.count({
                where: {
                    merchantId,
                    feature: "CART_RECOVERY",
                    timestamp: { gte: startOfDay },
                },
            });
            limit = flags.maxCartRecoveriesPerDay;
            period = "day";
            if (recoveryCount >= limit) {
                throw new Error(`Cart recovery limit reached (${limit} per ${period}). Upgrade your plan for more recoveries.`);
            }
            break;

        case "PRODUCT_HIGHLIGHT":
            // Monthly limit
            const startOfHighlightMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const highlightCount = currentUsage ?? await db.productHighlight.count({
                where: {
                    merchantId,
                    createdAt: { gte: startOfHighlightMonth },
                },
            });
            limit = flags.maxProductHighlights;
            period = "month";
            if (highlightCount >= limit) {
                throw new Error(`Product highlight limit reached (${limit} per ${period}). Upgrade to Pro for more highlights.`);
            }
            break;

        case "SCHEDULED_PUSH":
            // Monthly limit for scheduled campaigns
            const startOfScheduledMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const scheduledCount = currentUsage ?? await db.usageLog.count({
                where: {
                    merchantId,
                    feature: "SCHEDULED_PUSH",
                    timestamp: { gte: startOfScheduledMonth },
                },
            });
            limit = flags.maxScheduledCampaigns;
            period = "month";
            if (scheduledCount >= limit) {
                throw new Error(`Scheduled campaign limit reached (${limit} per ${period}). Upgrade your plan for more campaigns.`);
            }
            break;

        default:
            throw new Error(`Unknown feature: ${feature}`);
    }
};

/**
 * Log usage for billing tracking
 */
export const logUsage = async (merchantId: string, feature: string) => {
    await db.usageLog.create({
        data: {
            merchantId,
            feature,
        },
    });
};
