import db from "../db.server";
import { sendPushNotification } from "./push.server";
import { checkUsageLimit, logUsage, PLANS, syncFeatureFlags } from "./billing.server";

export const JOB_TYPES = {
    RECOVERY_PUSH: "RECOVERY_PUSH",
    SCHEDULED_CAMPAIGN: "SCHEDULED_CAMPAIGN",
};

export const JOB_STATUS = {
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
};

/**
 * Ensures feature flags exist for a merchant.
 */
export const ensureFeatureFlags = async (merchantId: string) => {
    const flags = await db.featureFlags.findUnique({ where: { merchantId } });
    if (flags) return flags;

    // Use Free Plan defaults via sync logic
    await syncFeatureFlags(merchantId, PLANS.FREE);
    return await db.featureFlags.findUniqueOrThrow({ where: { merchantId } });
};

/**
 * Schedules a background job.
 */
export const scheduleJob = async (
    merchantId: string,
    type: string,
    payload: any,
    scheduledAt: Date
) => {
    // Check feature flags
    const flags = await ensureFeatureFlags(merchantId);

    if (type === JOB_TYPES.RECOVERY_PUSH) {
        if (!flags.cartRecoveryEnabled) return null;
        // Limit for recovery is checked at execution time to be accurate to "sent" messages
    }

    if (type === JOB_TYPES.SCHEDULED_CAMPAIGN) {
        if (!flags.pushSchedulingEnabled) return null;

        // Enforce limit on creation
        try {
            await checkUsageLimit(merchantId, 'SCHEDULED_PUSH');
            await logUsage(merchantId, 'SCHEDULED_PUSH');
        } catch (e) {
            console.warn(`[ScheduleJob] Limit reached: ${e.message}`);
            throw e; // Bubble up so UI knows
        }
    }

    return await db.job.create({
        data: {
            merchantId,
            type,
            payload: JSON.stringify(payload),
            scheduledAt,
            status: JOB_STATUS.PENDING,
        },
    });
};

/**
 * Cancels pending jobs matching criteria.
 * Useful for stopping cart recovery if an order is placed.
 */
export const cancelJobs = async (merchantId: string, type: string) => {
    // For MVP, we cancel all pending jobs of this type. 
    // In a real app, we might match by a refined payload criteria (e.g. cartId).
    await db.job.updateMany({
        where: {
            merchantId,
            type,
            status: JOB_STATUS.PENDING
        },
        data: {
            status: JOB_STATUS.CANCELLED
        }
    });
};

/**
 * Processes all due jobs.
 * In a real environment, this would be a separate worker.
 * For this localized setup, we can call it periodically or on-demand.
 */
export const processPendingJobs = async () => {
    const now = new Date();

    // Find due jobs
    const jobs = await db.job.findMany({
        where: {
            status: JOB_STATUS.PENDING,
            scheduledAt: { lte: now }
        },
        include: { merchant: true } // We need merchant context
    });

    console.log(`[JobQueue] Found ${jobs.length} pending jobs.`);

    for (const job of jobs) {
        try {
            // Mark processing
            await db.job.update({ where: { id: job.id }, data: { status: JOB_STATUS.PROCESSING } });

            const payload = JSON.parse(job.payload);

            if (job.type === JOB_TYPES.RECOVERY_PUSH) {
                // Check daily limit before sending
                await checkUsageLimit(job.merchantId, 'CART_RECOVERY');

                // Send "You left something behind!"
                await sendPushNotification(
                    job.merchantId,
                    "You forgot something! 🛒",
                    "Your cart is waiting. Complete your purchase now!"
                );

                await logUsage(job.merchantId, 'CART_RECOVERY');
            }
            else if (job.type === JOB_TYPES.SCHEDULED_CAMPAIGN) {
                await sendPushNotification(
                    job.merchantId,
                    payload.title,
                    payload.body
                );
                // Usage for scheduled campaigns is logged on creation (scheduleJob)
            }

            // Mark complete
            await db.job.update({ where: { id: job.id }, data: { status: JOB_STATUS.COMPLETED } });

        } catch (e: any) {
            console.error(`[JobQueue] Job ${job.id} failed:`, e);
            // If limit error, maybe mark slightly differently? For now FAILED is fine.
            await db.job.update({
                where: { id: job.id },
                data: {
                    status: JOB_STATUS.FAILED,
                    payload: JSON.stringify({ ...JSON.parse(job.payload || "{}"), error: e.message }) // Store error if possible or just rely on logs
                }
            });
        }
    }

    return jobs.length;
};
