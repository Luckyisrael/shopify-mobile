import type { ActionFunctionArgs } from "react-router";
import { requireMerchant, mobileJson, handleMobileError, MobileAuthError } from "../../services/mobile.server";
import { createCustomer, loginCustomer } from "../../services/customer.server";

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
