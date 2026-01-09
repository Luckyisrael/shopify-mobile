
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
