
import type { LoaderFunctionArgs } from "react-router";
import { handleMobileError, mobileJson, requireMerchant } from "../services/mobile.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        const merchant = await requireMerchant(request);

        // We assume the first mobile app is the "active" one for now as per Phase 1
        const mobileApp = merchant.mobileApps[0];

        return mobileJson({
            appName: mobileApp?.appName || merchant.shop,
            primaryColor: mobileApp?.primaryColor || "#000000",
            logoUrl: mobileApp?.logoUrl || null,
            shopDomain: merchant.shop,
            isActive: mobileApp?.isActive ?? false,
        });
    } catch (error) {
        return handleMobileError(error);
    }
};
