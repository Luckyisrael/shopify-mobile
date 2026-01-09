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
