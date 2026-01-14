import type { ActionFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { logEventV2, EVENT_TYPES, sendCustomerPush } from "../services/automation-v2.server";
import { checkUsageLimit, logUsage } from "../services/billing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
        return mobileJson({ error: "Method not allowed" }, 405);
    }

    try {
        const { session } = await authenticate.admin(request);
        const body = await request.json();

        const { title, body: messageBody, audience = "all" } = body;

        if (!title || !messageBody) {
            return mobileJson({ error: "Title and body are required" }, 400);
        }

        const merchant = await db.merchant.findUnique({ where: { shop: session.shop } });
        if (!merchant) {
            return mobileJson({ error: "Merchant not found" }, 404);
        }

        // Check usage limits
        await checkUsageLimit(merchant.id, 'PUSH');

        // Resolve audience
        let customers: { shopifyCustomerId: string }[] = [];
        
        switch (audience) {
            case "logged_in":
                customers = await db.customerProfile.findMany({
                    where: { merchantId: merchant.id },
                    select: { shopifyCustomerId: true },
                });
                break;

            case "cart_owners":
                const activeSessions = await db.customerSession.findMany({
                    where: {
                        merchantId: merchant.id,
                        expiresAt: { gt: new Date() },
                    },
                    select: { shopifyCustomerId: true },
                });
                customers = activeSessions.map(s => ({ shopifyCustomerId: s.shopifyCustomerId }));
                break;

            case "all":
            default:
                // Broadcast to all tokens (no customer targeting)
                const result = await sendCustomerPush(merchant.id, undefined, title, messageBody);
                await logUsage(merchant.id, 'PUSH');
                
                await logEventV2(merchant.id, EVENT_TYPES.PUSH_REQUESTED, {
                    title,
                    body: messageBody,
                    audience,
                    immediate: true,
                });

                return mobileJson({
                    success: true,
                    message: "Push notification sent to all devices",
                    result,
                });
        }

        // Send to specific customers
        let successCount = 0;
        let totalTargeted = customers.length;

        for (const customer of customers) {
            try {
                await sendCustomerPush(merchant.id, customer.shopifyCustomerId, title, messageBody);
                successCount++;
            } catch (error) {
                console.error(`Failed to send push to customer ${customer.shopifyCustomerId}:`, error);
            }
        }

        await logUsage(merchant.id, 'PUSH');
        
        await logEventV2(merchant.id, EVENT_TYPES.PUSH_REQUESTED, {
            title,
            body: messageBody,
            audience,
            immediate: true,
            targeted: totalTargeted,
            successful: successCount,
        });

        return mobileJson({
            success: true,
            message: `Push notification sent to ${successCount}/${totalTargeted} customers`,
            targeted: totalTargeted,
            successful: successCount,
        });

    } catch (error: any) {
        console.error("Manual push failed:", error);
        return handleMobileError(error);
    }
};