/**
 * @swagger
 * /api/mobile/cart:
 *   post:
 *     summary: Create Shopping Cart
 *     description: Create a new shopping cart with product variants via Shopify Storefront API
 *     tags: [Cart]
 *     security:
 *       - ShopDomain: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - variantId
 *               - quantity
 *             properties:
 *               variantId:
 *                 type: string
 *                 description: Shopify product variant ID
 *                 example: "gid://shopify/ProductVariant/123456789"
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 description: Quantity of items to add to cart
 *                 example: 2
 *               customerAccessToken:
 *                 type: string
 *                 description: Optional customer access token to associate cart with customer
 *                 example: "c7a4b2e8f9d1a3b5c6e7f8g9h0i1j2k3"
 *     responses:
 *       201:
 *         description: Cart created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cartId:
 *                   type: string
 *                   description: Unique cart identifier
 *                   example: "gid://shopify/Cart/Z2lkOi8vc2hvcGlmeS9DYXJ0LzEyMzQ1Njc4OTA"
 *                 checkoutUrl:
 *                   type: string
 *                   format: uri
 *                   description: URL to complete checkout
 *                   example: "https://shop.myshopify.com/cart/c/Z2lkOi8vc2hvcGlmeS9DYXJ0LzEyMzQ1Njc4OTA"
 *                 quantity:
 *                   type: integer
 *                   description: Total quantity of items in cart
 *                   example: 2
 *       400:
 *         description: Missing required fields
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
 *       422:
 *         description: Cart creation failed (e.g., out of stock, invalid variant)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Cart creation failed"
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                       message:
 *                         type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import type { ActionFunctionArgs } from "react-router";
import { getStorefrontClient, handleMobileError, mobileJson, requireMerchant, MobileAuthError } from "../services/mobile.server";
import { logEventV2, EVENT_TYPES } from "../services/automation-v2.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
        return handleMobileError(new MobileAuthError("Method not allowed", 405));
    }

    try {
        const merchant = await requireMerchant(request);
        const client = await getStorefrontClient(merchant.shop, merchant.storefrontToken!);

        const payload = await request.json();
        const { variantId, quantity, customerAccessToken } = payload;

        if (!variantId || !quantity) {
            throw new MobileAuthError("Missing variantId or quantity", 400);
        }

        const mutation = `#graphql
      mutation cartCreate($lines: [CartLineInput!]!, $buyerIdentity: CartBuyerIdentityInput) {
        cartCreate(input: { lines: $lines, buyerIdentity: $buyerIdentity }) {
          cart {
            id
            checkoutUrl
            totalQuantity
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

        const variables: any = {
            lines: [
                {
                    merchandiseId: variantId,
                    quantity: parseInt(quantity, 10)
                }
            ]
        };

        if (customerAccessToken) {
            variables.buyerIdentity = { customerAccessToken };
        }

        const { data, errors } = await client.request(mutation, {
            variables
        });

        if (errors) {
            console.error("Storefront API Errors:", errors);
            throw new Error("Failed to create cart");
        }

        const userErrors = data?.cartCreate?.userErrors;
        if (userErrors && userErrors.length > 0) {
            // Return 422 for business logic errors from Shopify (e.g. out of stock)
            return mobileJson({
                error: "Cart creation failed",
                details: userErrors
            }, 422);
        }

        const cart = data?.cartCreate?.cart;

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

        // Log cart creation event for automation (cart recovery)
        await logEventV2(merchant.id, EVENT_TYPES.CART_UPDATED, {
            cartId: cart.id,
            variantId,
            quantity: parseInt(quantity, 10),
            hasCustomer: !!customerAccessToken
        }, shopifyCustomerId);

        return mobileJson({
            cartId: cart.id,
            checkoutUrl: cart.checkoutUrl,
            quantity: cart.totalQuantity
        }, 201);

    } catch (error) {
        return handleMobileError(error);
    }
};
