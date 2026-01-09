
import { createStorefrontApiClient } from "@shopify/storefront-api-client";
import db from "../db.server";


export class MobileAuthError extends Error {
    constructor(message: string, public status: number = 401) {
        super(message);
        this.name = "MobileAuthError";
    }
}

export async function requireMerchant(request: Request) {
    const shopDomain = request.headers.get("X-Shop-Domain");

    if (!shopDomain) {
        throw new MobileAuthError("Missing X-Shop-Domain header", 400);
    }

    const merchant = await db.merchant.findUnique({
        where: { shop: shopDomain },
        include: { mobileApps: true },
    });

    if (!merchant) {
        throw new MobileAuthError("Merchant not found", 404);
    }

    return merchant;
}

export async function getStorefrontClient(shopDomain: string, storefrontToken: string) {
    if (!storefrontToken) {
        throw new MobileAuthError("Merchant has no storefront token", 500);
    }

    return createStorefrontApiClient({
        storeDomain: `https://${shopDomain}`,
        apiVersion: "2025-01",
        publicAccessToken: storefrontToken,
    });
}

// Response helper for consistent error handling
export function mobileJson(data: any, status: number = 200) {
    return Response.json(data, { status });
}

export function handleMobileError(error: any) {
    console.error("[Mobile API Error]", error);

    if (error instanceof MobileAuthError) {
        return Response.json({ error: error.message }, { status: error.status });
    }

    return Response.json({ error: "Internal Server Error" }, { status: 500 });
}
