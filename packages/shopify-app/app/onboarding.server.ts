
import db from "./db.server";
import { createDefaultAutomationRules } from "./services/automation-v2.server";

interface OnboardingArgs {
    session: {
        shop: string;
        accessToken: string;
    };
    admin: any; // Using any for AdminClient to avoid complex type checking issues for now
}

export async function handleOnboarding({ session, admin }: OnboardingArgs) {
    const { shop, accessToken } = session;

    console.log(`[Onboarding] Starting for ${shop}...`);

    // 1. Fetch Shop Name
    const shopResponse = await admin.graphql(
        `#graphql
    query getShopName {
      shop {
        name
      }
    }`
    );
    const shopJson = await shopResponse.json();
    const shopName = shopJson.data?.shop?.name || shop;

    // 2. Generate Storefront Access Token
    const tokenResponse = await admin.graphql(
        `#graphql
    mutation storefrontAccessTokenCreate($input: StorefrontAccessTokenInput!) {
      storefrontAccessTokenCreate(input: $input) {
        storefrontAccessToken {
          accessToken
        }
        userErrors {
          field
          message
        }
      }
    }`,
        {
            variables: {
                input: {
                    title: "Mobile App Connector",
                },
            },
        }
    );
    const tokenJson = await tokenResponse.json();
    const storefrontToken =
        tokenJson.data?.storefrontAccessTokenCreate?.storefrontAccessToken
            ?.accessToken;

    if (!storefrontToken) {
        console.error(
            "Failed to create storefront token",
            tokenJson.data?.storefrontAccessTokenCreate?.userErrors
        );
        // Proceeding without it might break the "Required Flow", but we shouldn't crash everything. 
        // However prompt says "Store the Storefront token securely" is required.
        // We will upsert what we have.
    }

    // 3. Upsert Merchant
    const merchant = await db.merchant.upsert({
        where: { shop },
        update: {
            accessToken,
            storefrontToken,
            updatedAt: new Date(),
        },
        create: {
            shop,
            accessToken,
            storefrontToken,
            installedAt: new Date(),
        },
    });

    console.log(`[Onboarding] Merchant upserted: ${merchant.id}`);

    // 4. Create default MobileApp if none exists
    // Check if one exists
    const existingApp = await db.mobileApp.findFirst({
        where: { merchantId: merchant.id },
    });

    if (!existingApp) {
        await db.mobileApp.create({
            data: {
                merchantId: merchant.id,
                appName: shopName,
                primaryColor: "#000000", // Fallback color
                isActive: true,
            },
        });
        console.log(`[Onboarding] Default MobileApp created for ${merchant.id}`);
    } else {
        console.log(`[Onboarding] MobileApp already exists for ${merchant.id}`);
    }

    // 5. Create default automation rules
    await createDefaultAutomationRules(merchant.id);

    console.log(`[Onboarding] Complete for ${shop}`);
}
