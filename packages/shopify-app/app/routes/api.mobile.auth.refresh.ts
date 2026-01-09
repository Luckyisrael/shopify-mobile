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