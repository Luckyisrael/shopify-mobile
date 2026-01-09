import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { logEventV2, EVENT_TYPES } from "../services/automation-v2.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`[Webhook] ${topic} for ${shop}`);

    if (!payload) return new Response();

    try {
        // Find merchant
        const merchant = await db.merchant.findUnique({ where: { shop } });
        if (!merchant) {
            console.error(`[Webhook] Merchant not found for shop ${shop}`);
            return new Response();
        }

        // Extract customer ID
        const customerId = payload.customer?.id;

        await logEventV2(
            merchant.id,
            EVENT_TYPES.ORDER_CREATED,
            {
                orderId: payload.id,
                orderNumber: payload.order_number,
                cartToken: payload.cart_token,
                totalPrice: payload.total_price,
                currency: payload.currency,
                lineItemsCount: payload.line_items?.length || 0,
                customerEmail: payload.customer?.email,
            },
            customerId
        );

    } catch (error) {
        console.error(`[Webhook] Error processing ${topic}:`, error);
    }

    return new Response();
};