import type { ActionFunctionArgs } from "react-router";
import { requireMerchant, mobileJson, handleMobileError, MobileAuthError } from "../services/mobile.server";
import { logEventV2, EVENT_TYPES } from "../services/automation-v2.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
        return mobileJson({ error: "Method not allowed" }, 405);
    }

    try {
        const merchant = await requireMerchant(request);
        const body = await request.json();

        const { eventType, payload, customerAccessToken } = body;

        if (!eventType) {
            throw new MobileAuthError("Event type is required", 400);
        }

        // Validate event types
        const validEvents = Object.values(EVENT_TYPES);
        if (!validEvents.includes(eventType)) {
            throw new MobileAuthError("Invalid event type", 400);
        }

        // Resolve customer ID from access token if provided
        let shopifyCustomerId: string | undefined;
        if (customerAccessToken) {
            const session = await db.customerSession.findFirst({
                where: {
                    merchantId: merchant.id,
                    customerAccessToken,
                    expiresAt: { gt: new Date() },
                },
            });
            shopifyCustomerId = session?.shopifyCustomerId;
        }

        await logEventV2(merchant.id, eventType, payload || {}, shopifyCustomerId);

        return mobileJson({ success: true });

    } catch (error) {
        return handleMobileError(error);
    }
};