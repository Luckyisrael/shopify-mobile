/**
 * @swagger
 * /api/mobile/auth/signup:
 *   post:
 *     summary: Customer Signup
 *     description: Create a new customer account via Shopify Storefront API
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
 *               - firstName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Customer email address
 *                 example: newcustomer@example.com
 *               password:
 *                 type: string
 *                 description: Customer password (min 8 characters)
 *                 example: password123
 *               firstName:
 *                 type: string
 *                 description: Customer first name
 *                 example: John
 *               lastName:
 *                 type: string
 *                 description: Customer last name (optional)
 *                 example: Doe
 *               phone:
 *                 type: string
 *                 description: Customer phone number (optional)
 *                 example: "+1234567890"
 *               autoLogin:
 *                 type: boolean
 *                 description: Automatically log in after signup
 *                 default: false
 *               pushToken:
 *                 type: string
 *                 description: Optional Expo push token to link to customer
 *                 example: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 *     responses:
 *       200:
 *         description: Signup successful
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "Account created successfully"
 *                     customer:
 *                       $ref: '#/components/schemas/Customer'
 *                 - $ref: '#/components/schemas/CustomerSession'
 *       400:
 *         description: Missing required fields or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email already exists
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
import { createCustomer, loginCustomer } from "app/services/customer.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
        return mobileJson({ error: "Method not allowed" }, 405);
    }

    try {
        const merchant = await requireMerchant(request);
        const body = await request.json();

        const { email, password, firstName, lastName, autoLogin, pushToken } = body;

        if (!email || !password) {
            throw new MobileAuthError("Email and password are required", 400);
        }

        if (!merchant.storefrontToken) {
            throw new MobileAuthError("Merchant storefront token not configured", 500);
        }

        // 1. Create Customer
        const customer = await createCustomer(
            merchant.id,
            merchant.shop,
            merchant.storefrontToken,
            { email, password, firstName, lastName }
        );

        // 2. Auto Login if requested
        let session = null;
        if (autoLogin) {
            session = await loginCustomer(
                merchant.id,
                merchant.shop,
                merchant.storefrontToken,
                { email, password }, // Use same creds
                pushToken // Pass push token for linking
            );
        }

        return mobileJson({
            success: true,
            customer,
            session
        });

    } catch (error) {
        return handleMobileError(error);
    }
};
