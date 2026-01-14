/**
 * @swagger
 * /api/mobile/auth/refresh:
 *   post:
 *     summary: Refresh Customer Access Token
 *     description: Renew an expired customer access token
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
 *                 description: Expired or expiring customer access token
 *                 example: "c7a4b2e8f9d1a3b5c6e7f8g9h0i1j2k3"
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 accessToken:
 *                   type: string
 *                   description: New customer access token
 *                   example: "d8b5c3f0g2e4b6d8f0h2j4k6m8n0p2r4"
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: New token expiration timestamp
 *                   example: "2024-01-10T10:00:00Z"
 *       400:
 *         description: Missing access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid or expired token
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
 *         description: Server error or merchant not configured
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
import type { ActionFunctionArgs } from "react-router";
import { requireMerchant, mobileJson, handleMobileError, MobileAuthError } from "app/services/mobile.server";
import { refreshCustomerToken } from "app/services/customer.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
        return mobileJson({ error: "Method not allowed" }, 405);
    }

    try {
        const merchant = await requireMerchant(request);
        const body = await request.json();

        const { accessToken } = body;

        if (!accessToken) {
            throw new MobileAuthError("Access Token is required", 400);
        }

        if (!merchant.storefrontToken) {
            throw new MobileAuthError("Merchant storefront token not configured", 500);
        }

        const refreshedSession = await refreshCustomerToken(
            merchant.id,
            merchant.shop,
            merchant.storefrontToken,
            accessToken
        );

        return mobileJson({
            success: true,
            accessToken: refreshedSession.accessToken,
            expiresAt: refreshedSession.expiresAt
        });

    } catch (error) {
        return handleMobileError(error);
    }
};