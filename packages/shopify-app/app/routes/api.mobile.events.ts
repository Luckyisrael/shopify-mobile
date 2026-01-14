/**
 * @swagger
 * /api/mobile/events:
 *   post:
 *     summary: Track Customer Events
 *     description: |
 *       Log customer behavior events for analytics and automation triggers.
 *       
 *       **Supported Event Types:**
 *       - `CART_UPDATED` - Customer adds/updates items in cart
 *       - `CART_ABANDONED` - Cart abandoned (triggers recovery automation)
 *       - `ORDER_CREATED` - Order completed (cancels cart recovery, sends confirmation)
 *       - `ORDER_FULFILLED` - Order shipped (sends shipping notification)
 *       - `PUSH_REQUESTED` - Manual push notification sent
 *       - `PRODUCT_VIEWED` - Customer views a product
 *       - `CUSTOMER_REGISTERED` - New customer signup (sends welcome push)
 *       - `APP_OPENED` - Customer opens the mobile app
 *       - `SEARCH_PERFORMED` - Customer performs a search
 *     tags: [Events]
 *     security:
 *       - ShopDomain: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *             properties:
 *               eventType:
 *                 type: string
 *                 enum: [
 *                   CART_ABANDONED,
 *                   CART_UPDATED,
 *                   ORDER_CREATED,
 *                   ORDER_FULFILLED,
 *                   PUSH_REQUESTED,
 *                   PRODUCT_VIEWED,
 *                   CUSTOMER_REGISTERED,
 *                   APP_OPENED,
 *                   SEARCH_PERFORMED
 *                 ]
 *                 description: Type of event to track
 *                 example: "CART_ABANDONED"
 *               payload:
 *                 type: object
 *                 description: Event-specific data
 *                 example: { "cartId": "gid://shopify/Cart/123", "itemCount": 3, "totalAmount": 99.99 }
 *               customerAccessToken:
 *                 type: string
 *                 description: Optional customer access token to associate event with customer
 *                 example: "c7a4b2e8f9d1a3b5c6e7f8g9h0i1j2k3"
 *           examples:
 *             cartAbandoned:
 *               summary: Cart Abandoned
 *               value:
 *                 eventType: "CART_ABANDONED"
 *                 payload:
 *                   cartId: "gid://shopify/Cart/123"
 *                   itemCount: 3
 *                   totalAmount: 99.99
 *                 customerAccessToken: "c7a4b2e8f9d1a3b5c6e7f8g9h0i1j2k3"
 *             orderCreated:
 *               summary: Order Created
 *               value:
 *                 eventType: "ORDER_CREATED"
 *                 payload:
 *                   orderId: "gid://shopify/Order/456"
 *                   orderNumber: "1001"
 *                   totalAmount: 99.99
 *                   cartId: "gid://shopify/Cart/123"
 *                 customerAccessToken: "c7a4b2e8f9d1a3b5c6e7f8g9h0i1j2k3"
 *             productViewed:
 *               summary: Product Viewed
 *               value:
 *                 eventType: "PRODUCT_VIEWED"
 *                 payload:
 *                   productId: "gid://shopify/Product/789"
 *                   productTitle: "Summer T-Shirt"
 *                 customerAccessToken: "c7a4b2e8f9d1a3b5c6e7f8g9h0i1j2k3"
 *             appOpened:
 *               summary: App Opened
 *               value:
 *                 eventType: "APP_OPENED"
 *                 payload:
 *                   timestamp: "2024-01-09T10:00:00Z"
 *                 customerAccessToken: "c7a4b2e8f9d1a3b5c6e7f8g9h0i1j2k3"
 *     responses:
 *       200:
 *         description: Event tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing or invalid event type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       405:
 *         description: Method not allowed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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