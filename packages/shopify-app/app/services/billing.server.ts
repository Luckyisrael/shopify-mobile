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
        create: {
            merchantId,
            ...config.features,
        },
        update: {
            ...config.features,
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
    // Only sync flags if active, otherwise downgrade to FREE or handle cancellation?
    // Phase 5 says: "On webhook: Update Subscription status, Re-sync FeatureFlags"
    // Ideally if cancelled, we might downgrade to FREE limits but keep status as CANCELLED or similar.
    // For simplicity, if status is ACTIVE, we use the plan. If not, we default to FREE features.

    const effectivePlan = status === "ACTIVE" ? plan : PLANS.FREE;
    await syncFeatureFlags(merchantId, effectivePlan);
};

/**
 * Checks usage limits against feature flags.
 * Throws error if limit reached.
 */
export const checkUsageLimit = async (merchantId: string, feature: 'PUSH' | 'SCHEDULED_PUSH' | 'CART_RECOVERY') => {
    const flags = await db.featureFlags.findUnique({ where: { merchantId } });
    if (!flags) {
        // Should not happen if flags are ensured, but safe fallback
        await syncFeatureFlags(merchantId, PLANS.FREE);
        return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (feature === 'PUSH') {
        const count = await db.usageLog.count({
            where: {
                merchantId,
                feature: 'PUSH',
                timestamp: { gte: startOfMonth }
            }
        });
        if (count >= flags.maxPushCampaignsPerMonth) {
            throw new Error(`Monthly push limit reached (${count}/${flags.maxPushCampaignsPerMonth}). Upgrade to Pro.`);
        }
    } else if (feature === 'SCHEDULED_PUSH') {
        // Count active scheduled jobs or just logs of scheduled creations?
        // Spec says UsageLog. Let's count usage logs for creation this month.
        const count = await db.usageLog.count({
            where: {
                merchantId,
                feature: 'SCHEDULED_PUSH',
                timestamp: { gte: startOfMonth }
            }
        });
        if (count >= flags.maxScheduledCampaigns) {
            throw new Error(`Monthly scheduled campaign limit reached (${count}/${flags.maxScheduledCampaigns}). Upgrade to Pro.`);
        }
    } else if (feature === 'CART_RECOVERY') {
        const count = await db.usageLog.count({
            where: {
                merchantId,
                feature: 'CART_RECOVERY',
                timestamp: { gte: startOfDay }
            }
        });
        if (count >= flags.maxCartRecoveriesPerDay) {
            // For automated jobs, we return false or throw. 
            // Throwing might just log an error in the job queue.
            throw new Error(`Daily cart recovery limit reached (${count}/${flags.maxCartRecoveriesPerDay}).`);
        }
    }
};

/**
 * Logs usage of a feature.
 */
export const logUsage = async (merchantId: string, feature: 'PUSH' | 'SCHEDULED_PUSH' | 'CART_RECOVERY') => {
    await db.usageLog.create({
        data: {
            merchantId,
            feature
        }
    });
};
