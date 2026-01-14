/**
 * @swagger
 * /api/mobile/auth/login:
 *   post:
 *     summary: Customer Login
 *     description: Authenticate a customer using email and password via Shopify Storefront API
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
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Customer email address
 *                 example: customer@example.com
 *               password:
 *                 type: string
 *                 description: Customer password
 *                 example: password123
 *               pushToken:
 *                 type: string
 *                 description: Optional Expo push token to link to customer
 *                 example: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomerSession'
 *       400:
 *         description: Missing email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
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
import { loginCustomer } from "app/services/customer.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
        return mobileJson({ error: "Method not allowed" }, 405);
    }

    try {
        const merchant = await requireMerchant(request);
        const body = await request.json();

        const { email, password, pushToken } = body;

        if (!email || !password) {
            throw new MobileAuthError("Email and password are required", 400);
        }

        if (!merchant.storefrontToken) {
            throw new MobileAuthError("Merchant storefront token not configured", 500);
        }

        const session = await loginCustomer(
            merchant.id,
            merchant.shop,
            merchant.storefrontToken,
            { email, password },
            pushToken
        );

        return mobileJson({
            success: true,
            customer: session.customer,
            accessToken: session.accessToken,
            expiresAt: session.expiresAt
        });

    } catch (error) {
        return handleMobileError(error);
    }
};
