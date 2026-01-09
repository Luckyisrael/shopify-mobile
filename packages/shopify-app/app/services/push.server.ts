import { Expo } from "expo-server-sdk";
import db from "../db.server";

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

export const sendPushNotification = async (merchantId: string, title: string, body: string) => {
    // 1. Fetch all tokens for this merchant
    const tokens = await db.pushToken.findMany({
        where: { merchantId },
    });

    if (!tokens.length) {
        return { success: true, count: 0, message: "No registered devices found." };
    }

    // 2. Format messages for Expo
    // Only send to valid Expo push tokens
    const messages = [];
    for (const t of tokens) {
        if (!Expo.isExpoPushToken(t.token)) {
            console.warn(`Skipping invalid Expo push token: ${t.token}`);
            continue;
        }
        messages.push({
            to: t.token,
            sound: 'default',
            title,
            body,
            data: { merchantId },
        });
    }

    // 3. Send in chunks (Expo handles batching)
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

    return { success: true, count: successCount };
};
