/**
 * @swagger
 * /api/mobile/auth/logout:
 *   post:
 *     summary: Customer Logout
 *     description: Revoke customer access token and unlink push token
 *     tags: [Authentication]
 *     security:
 *       - ShopDomain: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *             properties:
 *               accessToken:
 *                 type: string
 *                 description: Customer access token to revoke
 *                 example: "c7a4b2e8f9d1a3b5c6e7f8g9h0i1j2k3"
 *               pushToken:
 *                 type: string
 *                 description: Optional push token to unlink from customer
 *                 example: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 *       400:
 *         description: Missing access token
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
import { requireMerchant, mobileJson, handleMobileError, MobileAuthError } from "app/services/mobile.server";
import { logoutCustomer } from "app/services/customer.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
        return mobileJson({ error: "Method not allowed" }, 405);
    }

    try {
        const merchant = await requireMerchant(request);
        const body = await request.json();

        const { accessToken, pushToken } = body;

        if (!accessToken) {
            throw new MobileAuthError("Access Token is required", 400);
        }

        if (!merchant.storefrontToken) {
            throw new MobileAuthError("Merchant storefront token not configured", 500);
        }

        await logoutCustomer(
            merchant.id,
            merchant.shop,
            merchant.storefrontToken,
            accessToken,
            pushToken
        );

        return mobileJson({ success: true });

    } catch (error) {
        return handleMobileError(error);
    }
};
