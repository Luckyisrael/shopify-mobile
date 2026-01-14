/**
 * @swagger
 * /api/mobile/push/register:
 *   post:
 *     summary: Register Push Token
 *     description: Register a device token for push notifications
 *     tags: [Push Notifications]
 *     security:
 *       - ShopDomain: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceToken
 *               - platform
 *             properties:
 *               deviceToken:
 *                 type: string
 *                 description: Expo push token for the device
 *                 example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
 *               platform:
 *                 type: string
 *                 enum: [ios, android]
 *                 description: Device platform
 *                 example: "ios"
 *               shopifyCustomerId:
 *                 type: string
 *                 description: Optional customer ID to link token to specific customer
 *                 example: "gid://shopify/Customer/123456789"
 *     responses:
 *       200:
 *         description: Device token registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing required fields or invalid X-Shop-Domain header
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
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { registerDevice } from "app/services/push.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    // Handle CORS preflight if this route were to receive OPTIONS (though usually handled by server framework)
    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Shop-Domain",
            }
        });
    }

    if (request.method !== "POST") {
        return mobileJson({ error: "Method not allowed" }, 405);
    }

    const shopDomain = request.headers.get("X-Shop-Domain");
    if (!shopDomain) {
        return mobileJson({ error: "Missing X-Shop-Domain header" }, 400);
    }

    try {
        const body = await request.json();
        const { deviceToken, platform } = body;

        if (!deviceToken || !platform) {
            return mobileJson({ error: "Missing deviceToken or platform" }, 400);
        }

        await registerDevice(shopDomain, deviceToken, platform);

        return mobileJson({ success: true });
    } catch (error: any) {
        console.error("Registration failed:", error);
        return handleMobileError(error);
    }
};
