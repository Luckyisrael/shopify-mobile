import { Form, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureFeatureFlags, processPendingJobs } from "../services/automation.server";
import db from "../db.server";

export const loader = async ({ request }: any) => {
    const { session } = await authenticate.admin(request);

    const merchant = await db.merchant.findUnique({ where: { shop: session.shop } });
    if (!merchant) return { flags: null };

    const featureFlags = await ensureFeatureFlags(merchant.id);
    return { flags: featureFlags };
};

export const action = async ({ request }: any) => {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "triggerJobs") {
        const count = await processPendingJobs();
        return Response.json({ success: true, message: `Processed ${count} jobs.` });
    }

    const merchant = await db.merchant.findUnique({ where: { shop: session.shop } });
    if (!merchant) return Response.json({ error: "Merchant not found" });

    const cartRecoveryEnabled = formData.get("cartRecoveryEnabled") === "on";
    const pushSchedulingEnabled = formData.get("pushSchedulingEnabled") === "on";

    await db.featureFlags.upsert({
        where: { merchantId: merchant.id },
        create: {
            merchantId: merchant.id,
            cartRecoveryEnabled,
            pushSchedulingEnabled
        },
        update: {
            cartRecoveryEnabled,
            pushSchedulingEnabled
        }
    });

    return Response.json({ success: true });
};

export default function SettingsPage() {
    const { flags } = useLoaderData<typeof loader>() || {};
    const nav = useNavigation();
    const isSaving = nav.state === "submitting";

    if (!flags) return <s-page heading="Settings">Loading...</s-page>;

    return (
        <s-page heading="Automation Settings">
            <s-section heading="Feature Configuration">
                <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                    <Form method="post">
                        <s-stack direction="block" gap="base">
                            <s-text>Control which automation features are active for your mobile app.</s-text>

                            <s-stack direction="inline" gap="base">
                                <input
                                    type="checkbox"
                                    name="cartRecoveryEnabled"
                                    id="cartRecovery"
                                    defaultChecked={flags.cartRecoveryEnabled}
                                    style={{ width: 20, height: 20 }}
                                />
                                <label htmlFor="cartRecovery">
                                    <s-text type="strong">Enable Abandoned Cart Recovery</s-text>
                                    <s-text tone="neutral">Automatically send a push notification 30 minutes after a cart is abandoned.</s-text>
                                </label>
                            </s-stack>

                            <s-stack direction="inline" gap="base">
                                <input
                                    type="checkbox"
                                    name="pushSchedulingEnabled"
                                    id="pushScheduling"
                                    defaultChecked={flags.pushSchedulingEnabled}
                                    style={{ width: 20, height: 20 }}
                                />
                                <label htmlFor="pushScheduling">
                                    <s-text type="strong">Enable Push Scheduling</s-text>
                                    <s-text tone="neutral">Allow scheduling marketing campaigns for a future date/time.</s-text>
                                </label>
                            </s-stack>

                            <s-button type="submit" variant="primary" loading={isSaving}>Save Settings</s-button>
                        </s-stack>
                    </Form>
                </s-box>
            </s-section>

            <s-section heading="Testing & Debugging">
                <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                    <s-stack direction="block" gap="base">
                        <s-text>
                            Manually run the background job queue. Detailed logs will appear in your server console.
                        </s-text>
                        <Form method="post">
                            <input type="hidden" name="intent" value="triggerJobs" />
                            <s-button type="submit">Run Automation Queue Now</s-button>
                        </Form>
                    </s-stack>
                </s-box>
            </s-section>
        </s-page>
    );
}