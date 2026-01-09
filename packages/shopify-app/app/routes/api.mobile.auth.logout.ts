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
