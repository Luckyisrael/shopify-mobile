import db from "../db.server";
import { sendPushNotification } from "./push.server";
import { checkUsageLimit, logUsage, PLANS, syncFeatureFlags } from "./billing.server";

// Automation Types
export const AUTOMATION_TYPES = {
    CART_RECOVERY: "CART_RECOVERY",
    SCHEDULED_PUSH: "SCHEDULED_PUSH",
    EVENT_PUSH: "EVENT_PUSH",
} as const;

export const AUTOMATION_STATUS = {
    ACTIVE: "ACTIVE",
    PAUSED: "PAUSED",
} as const;

export const JOB_STATUS = {
    QUEUED: "QUEUED",
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
} as const;

export const EVENT_TYPES = {
    CART_ABANDONED: "CART_ABANDONED",
    CART_UPDATED: "CART_UPDATED",
    ORDER_CREATED: "ORDER_CREATED",
    ORDER_FULFILLED: "ORDER_FULFILLED",
    PUSH_REQUESTED: "PUSH_REQUESTED",
} as const;

// Queue Types
export const QUEUE_TYPES = {
    STANDARD: "standard",
    PRIORITY: "priority",
} as const;

/**
 * Customer-aware event logging with automation triggers
 */
export const logEventV2 = async (
    merchantId: string,
    type: keyof typeof EVENT_TYPES,
    payload: Record<string, any>,
    shopifyCustomerId?: string
) => {
    try {
        // 1. Log the event with customer context
        await db.eventLog.create({
            data: {
                merchantId,
                type,
                shopifyCustomerId,
                payload: JSON.stringify(payload),
            },
        });

        // 2. Trigger automation evaluation
        await evaluateAutomations(merchantId, type, payload, shopifyCustomerId);

    } catch (error) {
        console.error(`[EventLogV2] Failed to log ${type}:`, error);
    }
};

/**
 * Evaluates and triggers automations based on events
 */
export const evaluateAutomations = async (
    merchantId: string,
    eventType: keyof typeof EVENT_TYPES,
    payload: Record<string, any>,
    shopifyCustomerId?: string
) => {
    // Get active automation rules for this merchant
    const rules = await db.automationRule.findMany({
        where: {
            merchantId,
            status: AUTOMATION_STATUS.ACTIVE,
        },
    });

    for (const rule of rules) {
        const config = JSON.parse(rule.config);

        // Cart Recovery Automation
        if (rule.type === AUTOMATION_TYPES.CART_RECOVERY && eventType === EVENT_TYPES.CART_ABANDONED) {
            await triggerCartRecovery(merchantId, rule.id, payload, shopifyCustomerId, config);
        }

        // Order completion cancels cart recovery
        if (eventType === EVENT_TYPES.ORDER_CREATED) {
            await cancelCartRecoveryJobs(merchantId, shopifyCustomerId, payload.cartId);
        }
    }
};

/**
 * Triggers cart recovery automation with customer awareness
 */
export const triggerCartRecovery = async (
    merchantId: string,
    ruleId: string,
    payload: Record<string, any>,
    shopifyCustomerId?: string,
    config: any = {}
) => {
    // Check feature flags
    const flags = await db.featureFlags.findUnique({ where: { merchantId } });
    if (!flags?.cartRecoveryEnabled) {
        console.log(`[CartRecovery] Disabled for merchant ${merchantId}`);
        return;
    }

    // Require customer for personalized recovery
    if (!shopifyCustomerId) {
        console.log(`[CartRecovery] No customer ID for cart ${payload.cartId}`);
        return;
    }

    // Schedule recovery job with delay
    const delay = config.delayMinutes || 30;
    const scheduledFor = new Date(Date.now() + delay * 60 * 1000);

    await db.automationJob.create({
        data: {
            merchantId,
            ruleId,
            shopifyCustomerId,
            cartId: payload.cartId,
            status: JOB_STATUS.QUEUED,
            scheduledFor,
        },
    });

    console.log(`[CartRecovery] Scheduled for customer ${shopifyCustomerId} at ${scheduledFor}`);
};

/**
 * Cancels cart recovery jobs when order is created
 */
export const cancelCartRecoveryJobs = async (
    merchantId: string,
    shopifyCustomerId?: string,
    cartId?: string
) => {
    const whereClause: any = {
        merchantId,
        status: JOB_STATUS.QUEUED,
        rule: { type: AUTOMATION_TYPES.CART_RECOVERY },
    };

    if (shopifyCustomerId) {
        whereClause.shopifyCustomerId = shopifyCustomerId;
    }

    if (cartId) {
        whereClause.cartId = cartId;
    }

    const cancelledJobs = await db.automationJob.updateMany({
        where: whereClause,
        data: { status: JOB_STATUS.FAILED, result: JSON.stringify({ reason: "Order completed" }) },
    });

    console.log(`[CartRecovery] Cancelled ${cancelledJobs.count} jobs for order completion`);
};

/**
 * Creates a scheduled push campaign
 */
export const createScheduledCampaign = async (
    merchantId: string,
    title: string,
    body: string,
    scheduledFor: Date,
    audience: "all" | "logged_in" | "cart_owners" = "all"
) => {
    // Check feature flags and limits
    const flags = await db.featureFlags.findUnique({ where: { merchantId } });
    if (!flags?.schedulingEnabled) {
        throw new Error("Scheduled campaigns are disabled");
    }

    await checkUsageLimit(merchantId, 'SCHEDULED_PUSH');

    // Create automation rule
    const rule = await db.automationRule.create({
        data: {
            merchantId,
            type: AUTOMATION_TYPES.SCHEDULED_PUSH,
            status: AUTOMATION_STATUS.ACTIVE,
            config: JSON.stringify({
                title,
                body,
                audience,
            }),
        },
    });

    // Resolve audience and create jobs
    const customers = await resolveAudience(merchantId, audience);
    
    for (const customer of customers) {
        await db.automationJob.create({
            data: {
                merchantId,
                ruleId: rule.id,
                shopifyCustomerId: customer.shopifyCustomerId,
                status: JOB_STATUS.QUEUED,
                scheduledFor,
            },
        });
    }

    await logUsage(merchantId, 'SCHEDULED_PUSH');
    
    return { ruleId: rule.id, jobsCreated: customers.length };
};

/**
 * Resolves audience for campaigns
 */
export const resolveAudience = async (
    merchantId: string,
    audience: "all" | "logged_in" | "cart_owners"
) => {
    switch (audience) {
        case "logged_in":
            return await db.customerProfile.findMany({
                where: { merchantId },
                select: { shopifyCustomerId: true },
            });

        case "cart_owners":
            // Get customers who have active sessions (likely have carts)
            const activeSessions = await db.customerSession.findMany({
                where: {
                    merchantId,
                    expiresAt: { gt: new Date() },
                },
                select: { shopifyCustomerId: true },
            });
            return activeSessions.map(s => ({ shopifyCustomerId: s.shopifyCustomerId }));

        case "all":
        default:
            return await db.customerProfile.findMany({
                where: { merchantId },
                select: { shopifyCustomerId: true },
            });
    }
};

/**
 * Processes automation jobs with priority queue support
 */
export const processAutomationJobs = async () => {
    const now = new Date();

    // Process priority queue first (Pro/Enterprise)
    await processJobQueue("priority", now);
    
    // Then standard queue
    await processJobQueue("standard", now);
};

/**
 * Processes jobs from a specific queue
 */
export const processJobQueue = async (queueType: "standard" | "priority", now: Date) => {
    // Determine which merchants get priority
    const priorityMerchants = await db.merchant.findMany({
        where: {
            featureFlags: {
                priorityJobs: true,
            },
        },
        select: { id: true },
    });

    const priorityMerchantIds = priorityMerchants.map(m => m.id);

    const whereClause: any = {
        status: JOB_STATUS.QUEUED,
        scheduledFor: { lte: now },
    };

    if (queueType === "priority") {
        whereClause.merchantId = { in: priorityMerchantIds };
    } else {
        whereClause.merchantId = { notIn: priorityMerchantIds };
    }

    const jobs = await db.automationJob.findMany({
        where: whereClause,
        include: {
            merchant: {
                include: { featureFlags: true },
            },
            rule: true,
        },
        take: 50, // Process in batches
        orderBy: { scheduledFor: 'asc' },
    });

    console.log(`[JobQueue:${queueType}] Processing ${jobs.length} jobs`);

    for (const job of jobs) {
        await processAutomationJob(job);
    }
};

/**
 * Processes a single automation job
 */
export const processAutomationJob = async (job: any) => {
    try {
        // Mark as running
        await db.automationJob.update({
            where: { id: job.id },
            data: { status: JOB_STATUS.RUNNING, executedAt: new Date() },
        });

        const config = JSON.parse(job.rule.config);
        let result: any = {};

        if (job.rule.type === AUTOMATION_TYPES.CART_RECOVERY) {
            result = await executeCartRecovery(job, config);
        } else if (job.rule.type === AUTOMATION_TYPES.SCHEDULED_PUSH) {
            result = await executeScheduledPush(job, config);
        }

        // Mark as completed
        await db.automationJob.update({
            where: { id: job.id },
            data: {
                status: JOB_STATUS.COMPLETED,
                result: JSON.stringify(result),
            },
        });

    } catch (error: any) {
        console.error(`[JobQueue] Job ${job.id} failed:`, error);
        
        await db.automationJob.update({
            where: { id: job.id },
            data: {
                status: JOB_STATUS.FAILED,
                result: JSON.stringify({ error: error.message }),
            },
        });
    }
};

/**
 * Executes cart recovery push notification
 */
export const executeCartRecovery = async (job: any, config: any) => {
    // Check daily limit
    await checkUsageLimit(job.merchantId, 'CART_RECOVERY');

    // Send personalized push to specific customer
    const result = await sendCustomerPush(
        job.merchantId,
        job.shopifyCustomerId,
        config.title || "You forgot something! 🛒",
        config.body || "Your cart is waiting. Complete your purchase now!",
        { cartId: job.cartId }
    );

    await logUsage(job.merchantId, 'CART_RECOVERY');
    
    return result;
};

/**
 * Executes scheduled push campaign
 */
export const executeScheduledPush = async (job: any, config: any) => {
    // Send push to specific customer
    const result = await sendCustomerPush(
        job.merchantId,
        job.shopifyCustomerId,
        config.title,
        config.body
    );

    return result;
};

/**
 * Customer-targeted push notification
 */
export const sendCustomerPush = async (
    merchantId: string,
    shopifyCustomerId?: string,
    title: string,
    body: string,
    data: any = {}
) => {
    if (shopifyCustomerId) {
        // Send to specific customer's linked tokens
        const tokens = await db.pushToken.findMany({
            where: {
                merchantId,
                shopifyCustomerId,
            },
        });

        if (tokens.length === 0) {
            return { success: false, reason: "No push tokens for customer" };
        }

        // Use existing push service but target specific tokens
        let successCount = 0;
        for (const token of tokens) {
            try {
                await sendPushNotification(merchantId, title, body);
                successCount++;
            } catch (error) {
                console.error(`Failed to send push to token ${token.id}:`, error);
            }
        }

        return { success: true, tokensTargeted: tokens.length, successCount };
    } else {
        // Broadcast to all merchant tokens
        return await sendPushNotification(merchantId, title, body);
    }
};

/**
 * Creates default automation rules for new merchants
 */
export const createDefaultAutomationRules = async (merchantId: string) => {
    // Cart Recovery Rule
    await db.automationRule.create({
        data: {
            merchantId,
            type: AUTOMATION_TYPES.CART_RECOVERY,
            status: AUTOMATION_STATUS.ACTIVE,
            config: JSON.stringify({
                delayMinutes: 30,
                title: "You forgot something! 🛒",
                body: "Your cart is waiting. Complete your purchase now!",
            }),
        },
    });

    console.log(`[Automation] Created default rules for merchant ${merchantId}`);
};