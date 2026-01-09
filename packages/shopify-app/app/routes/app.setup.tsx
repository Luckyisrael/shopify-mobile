import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { getStorefrontClient } from "../services/mobile.server";
import db from "../db.server";

export const loader = async ({ request }: any) => {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    const merchant = await db.merchant.findUnique({
        where: { shop },
        include: { mobileApps: true }
    });

    return {
        merchant,
        shop
    };
};

export const action = async ({ request }: any) => {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("actionType");

    if (actionType === "saveTokens") {
        const storefrontToken = formData.get("storefrontToken");
        const appName = formData.get("appName"); // Optional

        if (!storefrontToken) {
            return Response.json({ error: "Storefront Token is required" }, { status: 400 });
        }

        // Update Merchant
        await db.merchant.upsert({
            where: { shop: session.shop },
            update: { storefrontToken: String(storefrontToken) },
            create: {
                shop: session.shop,
                accessToken: session.accessToken || "",
                storefrontToken: String(storefrontToken)
            }
        });

        return Response.json({ success: true, message: "Configuration saved successfully!" });
    }

    if (actionType === "testApi") {
        try {
            const merchant = await db.merchant.findUnique({ where: { shop: session.shop } });
            if (!merchant || !merchant.storefrontToken) {
                return Response.json({ error: "No token saved yet. Please save first." }, { status: 400 });
            }

            const client = await getStorefrontClient(session.shop, merchant.storefrontToken);
            const query = `{ shop { name primaryDomain { url } } products(first:1) { edges { node { title } } } }`;

            const { data, errors } = await client.request(query);

            if (errors) return Response.json({ error: "API Error: " + JSON.stringify(errors) });

            return Response.json({
                success: true,
                apiData: {
                    shopName: data.shop.name,
                    domain: data.shop.primaryDomain.url,
                    sampleProduct: data.products.edges[0]?.node?.title || "No products found"
                }
            });

        } catch (e: any) {
            return Response.json({ error: "Connection Failed: " + e.message });
        }
    }

    return null;
};

export default function Setup() {
    const { merchant, shop } = useLoaderData<typeof loader>();
    const actionData = useActionData() as any;
    const nav = useNavigation();

    const isSaving = nav.state === "submitting" && nav.formData?.get("actionType") === "saveTokens";
    const isTesting = nav.state === "submitting" && nav.formData?.get("actionType") === "testApi";

    return (
        <s-page heading="Mobile Connector Setup">
            <s-stack direction="block" gap="base">

                {/* Success/Error Banners */}
                {actionData?.success && (
                    <s-banner heading="Success" tone="success">
                        {actionData.message || "Operation successful"}
                    </s-banner>
                )}
                {actionData?.error && (
                    <s-banner heading="Error" tone="critical">
                        {actionData.error}
                    </s-banner>
                )}

                {/* Current Status */}
                <s-section heading="Current Status">
                    <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                        <s-text><b>Shop Domain:</b> {shop}</s-text>
                        <s-text>
                            <b>Storefront Token:</b> {merchant?.storefrontToken ? "✅ Configured" : "❌ Not Configured"}
                        </s-text>
                    </s-box>
                </s-section>

                {/* Manual Token Configuration */}
                <s-section heading="Configure Storefront API Token">
                    <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                        <s-stack direction="block" gap="base">
                            <s-text>
                                Get your Storefront Access Token from the <b>Headless</b> sales channel in your Shopify Admin:
                            </s-text>
                            <s-text tone="info">
                                Admin → Sales Channels → Headless → Select your storefront → Copy the <b>Public access token</b>
                            </s-text>

                            <Form method="post">
                                <input type="hidden" name="actionType" value="saveTokens" />
                                <s-stack direction="block" gap="base">
                                    <s-text-field
                                        label="Storefront Access Token (Public)"
                                        name="storefrontToken"
                                        value={merchant?.storefrontToken || ""}
                                        placeholder="e.g., shpat_xxxxxxxxxxxxx"
                                        required
                                    />
                                    {/**(TODO: Lucky - remove this later, not neccessary. ) */}
                                    <s-text-field
                                        label="Mobile App Name (Optional)"
                                        name="appName"
                                        placeholder="My Mobile Store"
                                    />
                                    <s-button type="submit" variant="primary" loading={isSaving}>Save Configuration</s-button>
                                </s-stack>
                            </Form>
                        </s-stack>
                    </s-box>
                </s-section>

                {/* Test Connection */}
                <s-section heading="Test API Connection">
                    <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                        <s-stack direction="block" gap="base">
                            <s-text>Verify that the token works and we can fetch products.</s-text>
                            <Form method="post">
                                <input type="hidden" name="actionType" value="testApi" />
                                <s-button type="submit" loading={isTesting}>Test API Connection</s-button>
                            </Form>

                            {actionData?.apiData && (
                                <s-box padding="base" background="transparent" borderRadius="base">
                                    <s-text type="strong">✅ API Connection Successful!</s-text>
                                    <pre>{JSON.stringify(actionData.apiData, null, 2)}</pre>
                                </s-box>
                            )}
                        </s-stack>
                    </s-box>
                </s-section>

            </s-stack>
        </s-page>
    );
}
