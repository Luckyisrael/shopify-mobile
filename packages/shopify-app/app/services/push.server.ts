import { Expo } from "expo-server-sdk";
import db from "../db.server";
import { assignVariant, recordTestResult, getVariantContent } from "./ab-testing.server";
import { isNotificationAllowed } from "./customer-preferences.server";

// Create a new Expo SDK client
// optionally providing an access token if you have enabled push security
const expo = new Expo();

export const registerDevice = async (shopDomain: string, token: string, platform: string) => {
    const merchant = await db.merchant.findUnique({ where: { shop: shopDomain } });
    if (!merchant) {
        throw new Error("Merchant not found for shop: " + shopDomain);
    }

    // Upsert the token to ensure it's linked to the merchant
    // If it exists, update the lastActiveAt and platform
    await db.pushToken.upsert({
        where: {
            merchantId_token: {
                merchantId: merchant.id,
                token,
            }
        },
        update: {
            lastActiveAt: new Date(),
            platform
        },
        create: {
            merchantId: merchant.id,
            token,
            platform
        }
    });

    return { success: true };
};

export const sendPushNotification = async (
    merchantId: string,
    title: string,
    body: string,
    category: "cart" | "order" | "promotional" | "highlight" = "promotional"
) => {
    // 1. Fetch all tokens for this merchant
    const tokens = await db.pushToken.findMany({
        where: { merchantId },
    });

    if (!tokens.length) {
        return { success: true, count: 0, message: "No registered devices found." };
    }

    // 2. Filter tokens based on customer preferences
    const allowedTokens = [];
    const blockedCount = { category: 0, quietHours: 0, dailyLimit: 0 };

    for (const t of tokens) {
        if (!Expo.isExpoPushToken(t.token)) {
            console.warn(`Skipping invalid Expo push token: ${t.token}`);
            continue;
        }

        // Check preferences if customer is identified
        if (t.shopifyCustomerId) {
            const check = await isNotificationAllowed(
                merchantId,
                t.shopifyCustomerId,
                category
            );

            if (!check.allowed) {
                // Track why notification was blocked
                if (check.reason?.includes("opted out")) {
                    blockedCount.category++;
                } else if (check.reason?.includes("quiet hours")) {
                    blockedCount.quietHours++;
                } else if (check.reason?.includes("daily limit")) {
                    blockedCount.dailyLimit++;
                }
                continue;
            }
        }

        allowedTokens.push(t);
    }

    if (!allowedTokens.length) {
        return {
            success: true,
            count: 0,
            message: "No eligible devices after preference filtering.",
            blocked: blockedCount,
        };
    }

    // 3. Format messages for Expo
    const messages = allowedTokens.map((t) => ({
        to: t.token,
        sound: 'default',
        title,
        body,
        data: { merchantId, category },
    }));

    // 4. Send in chunks (Expo handles batching)
    const chunks = expo.chunkPushNotifications(messages as any);
    const tickets = [];
    let successCount = 0;

    for (const chunk of chunks) {
        try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
            successCount += ticketChunk.length; // Approximate success

            // NOTE: In a real production app, we would process 'tickets' to check for errors like 'DeviceNotRegistered'
            // and delete those tokens. For Phase 3, we just send.
        } catch (error) {
            console.error("Error sending push chunk:", error);
        }
    }

    return {
        success: true,
        count: successCount,
        blocked: blockedCount,
    };
};

/**
 * Send push notification with A/B testing support
 * 
 * If testId is provided, assigns variants to customers and tracks results.
 * Respects customer notification preferences.
 */
export const sendPushNotificationWithABTest = async (
    merchantId: string,
    title: string,
    body: string,
    testId?: string,
    category: "cart" | "order" | "promotional" | "highlight" = "promotional"
) => {
    // 1. Fetch all tokens for this merchant
    const tokens = await db.pushToken.findMany({
        where: { merchantId },
    });

    if (!tokens.length) {
        return { success: true, count: 0, message: "No registered devices found." };
    }

    // 2. Filter tokens based on customer preferences and format messages
    const messages = [];
    const variantAssignments: { customerId: string; variant: "A" | "B" }[] = [];
    const blockedCount = { category: 0, quietHours: 0, dailyLimit: 0 };

    for (const t of tokens) {
        if (!Expo.isExpoPushToken(t.token)) {
            console.warn(`Skipping invalid Expo push token: ${t.token}`);
            continue;
        }

        // Check preferences if customer is identified
        if (t.shopifyCustomerId) {
            const check = await isNotificationAllowed(
                merchantId,
                t.shopifyCustomerId,
                category
            );

            if (!check.allowed) {
                // Track why notification was blocked
                if (check.reason?.includes("opted out")) {
                    blockedCount.category++;
                } else if (check.reason?.includes("quiet hours")) {
                    blockedCount.quietHours++;
                } else if (check.reason?.includes("daily limit")) {
                    blockedCount.dailyLimit++;
                }
                continue;
            }
        }

        let messageTitle = title;
        let messageBody = body;
        let variant: "A" | "B" | undefined;

        // If A/B test is active, get variant content
        if (testId && t.shopifyCustomerId) {
            try {
                const variantContent = await getVariantContent(testId, t.shopifyCustomerId);
                messageTitle = variantContent.title;
                messageBody = variantContent.body;
                variant = variantContent.variant;

                variantAssignments.push({
                    customerId: t.shopifyCustomerId,
                    variant,
                });
            } catch (error) {
                console.error(`Error getting variant for customer ${t.shopifyCustomerId}:`, error);
                // Fall back to default content
            }
        }

        messages.push({
            to: t.token,
            sound: 'default',
            title: messageTitle,
            body: messageBody,
            data: {
                merchantId,
                testId,
                variant,
                customerId: t.shopifyCustomerId,
                category,
            },
        });
    }

    if (!messages.length) {
        return {
            success: true,
            count: 0,
            message: "No eligible devices after preference filtering.",
            blocked: blockedCount,
        };
    }

    // 3. Send in chunks (Expo handles batching)
    const chunks = expo.chunkPushNotifications(messages as any);
    const tickets = [];
    let successCount = 0;

    for (const chunk of chunks) {
        try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
            successCount += ticketChunk.length;
        } catch (error) {
            console.error("Error sending push chunk:", error);
        }
    }

    // 4. Record sends for A/B test
    if (testId) {
        for (const assignment of variantAssignments) {
            try {
                await recordTestResult(
                    testId,
                    assignment.customerId,
                    "SEND",
                    assignment.variant
                );
            } catch (error) {
                console.error(`Error recording test result:`, error);
            }
        }
    }

    return {
        success: true,
        count: successCount,
        blocked: blockedCount,
    };
};
