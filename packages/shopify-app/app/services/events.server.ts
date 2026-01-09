import db from "../db.server";
import { scheduleJob, cancelJobs, JOB_TYPES } from "./automation.server";

export type EventType = "APP_OPENED" | "PRODUCT_VIEWED" | "CART_CREATED" | "CHECKOUT_STARTED" | "ORDER_COMPLETED";

/**
 * Logs key commerce events silently.
 * Failures are caught and logged to console, but do not throw errors.
 */
export const logEvent = async (merchantId: string, type: EventType, payload: Record<string, any>) => {
    try {
        // 1. Log the event
        await db.eventLog.create({
            data: {
                merchantId,
                type,
                payload: JSON.stringify(payload),
            },
        });

        // 2. Trigger Automation Logic
        if (type === "CART_CREATED") {
            // Schedule recovery push in 30 minutes
            const delay = 30 * 60 * 1000;
            const scheduledAt = new Date(Date.now() + delay);

            await scheduleJob(
                merchantId,
                JOB_TYPES.RECOVERY_PUSH,
                { cartId: payload.cartId }, // Payload context
                scheduledAt
            );
        }
        else if (type === "ORDER_COMPLETED") {
            // User bought! Cancel any pending recovery pushes
            await cancelJobs(merchantId, JOB_TYPES.RECOVERY_PUSH);
        }

    } catch (error) {
        // Silent failure as per requirements
        console.error(`[EventLog] Failed to log ${type}:`, error);
    }
};
