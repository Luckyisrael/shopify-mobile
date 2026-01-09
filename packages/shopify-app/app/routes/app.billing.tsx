import { useLoaderData, Form, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { PLANS } from "../billing.constants";
import db from "../db.server";

export const loader = async ({ request }: any) => {
    const { session } = await authenticate.admin(request);

    // We rely on our local subscription state which is synced via webhooks

    // If billingCheck returned a Response (redirect), it means we might be enforcing, 
    // but here we just want to know status. 
    // Actually billing.require() redirects if failed!
    // We should use billing.check() if available or catch the throw.
    // The library API varies. `billing.check` is standard.
    // But `billing.require` with onFailure returning a value cancels redirect.
    // So if it returns { hasActivePayment: false }, we are on FREE.

    // Wait, the easiest way to know "Which plan am I on?" is to look at our DB Subscription table,
    // because that's what we trust for FeatureFlags.

    const merchant = await db.merchant.findUnique({
        where: { shop: session.shop },
        include: {
            subscription: true,
            usageLogs: {
                where: { timestamp: { gte: new Date(new Date().setDate(1)) } } // This month roughly
            }
        }
    });

    if (!merchant) return { plan: PLANS.FREE, merchantId: null, usage: { push: 0, scheduled: 0, recovery: 0 } };

    // Calculate usage
    const usage = {
        push: merchant.usageLogs.filter(l => l.feature === 'PUSH').length,
        scheduled: merchant.usageLogs.filter(l => l.feature === 'SCHEDULED_PUSH').length,
        recovery: merchant.usageLogs.filter(l => l.feature === 'CART_RECOVERY').length,
    };

    return {
        plan: merchant.subscription?.status === 'ACTIVE' ? merchant.subscription.plan : PLANS.FREE,
        usage
    };
};

export const action = async ({ request }: any) => {
    const { session, billing } = await authenticate.admin(request);
    const formData = await request.formData();
    const plan = formData.get("plan");

    if (plan === PLANS.FREE) {
        // Handle Downgrade
        // It's tricky to cancel via API directly usually involves cancelling subscription ID.
        // For MVP, we might direct them to Shopify Admin or just update DB if we can cancel API side.
        // billing.cancel() might exist.
        // For now, let's just log. Real downgrade usually requires cancelling the recurring charge.
        // For now, we assume upgrade only flow for billing API simplicity.
        return Response.json({ message: "To downgrade, please cancel the subscription in Shopify Admin." });
    }

    if (plan === PLANS.PRO || plan === PLANS.ENTERPRISE) {
        // Request Payment
        await billing.request({
            plan: plan as string,
            isTest: true, // Always test for dev
            returnUrl: `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/billing`, // Return to here
        });

        // billing.request will THROW a Redirect. Code below is unreachable if successful.
        return null;
    }

    return null;
};

export default function BillingPage() {
    const { plan, usage } = useLoaderData<typeof loader>();
    const nav = useNavigation();
    const isSubmitting = nav.state === "submitting";

    const isCurrent = (p: string) => plan === p;

    return (
        <s-page heading="Billing & Plans">
            <s-stack direction="block" gap="base">

                <s-section heading="Current Usage">
                    <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                        <s-stack direction="inline" gap="400" justify="space-evenly">
                            <s-stack direction="block" gap="025">
                                <s-text tone="subdued">Push Campaigns</s-text>
                                <s-text variant="headingLg">{usage.push} used</s-text>
                            </s-stack>
                            <s-stack direction="block" gap="025">
                                <s-text tone="subdued">Scheduled</s-text>
                                <s-text variant="headingLg">{usage.scheduled} used</s-text>
                            </s-stack>
                            <s-stack direction="block" gap="025">
                                <s-text tone="subdued">Cart Recovery</s-text>
                                <s-text variant="headingLg">{usage.recovery} used</s-text>
                            </s-stack>
                        </s-stack>
                    </s-box>
                </s-section>

                <s-section heading="Available Plans">
                    <s-grid columns={{ xs: 1, sm: 3 }} gap="base">

                        {/* FREE */}
                        <s-box padding="base" borderWidth="base" borderRadius="base" background={isCurrent(PLANS.FREE) ? "bg-surface-active" : "bg-surface"}>
                            <s-stack direction="block" gap="base">
                                <s-text variant="headingMd">Free</s-text>
                                <s-text variant="headingXl">$0<s-text as="span" variant="bodySm" tone="subdued">/mo</s-text></s-text>
                                <s-list>
                                    <s-list-item>20 Push Campaigns/mo</s-list-item>
                                    <s-list-item>2 Scheduled/mo</s-list-item>
                                    <s-list-item>5 Recoveries/day</s-list-item>
                                </s-list>
                                {isCurrent(PLANS.FREE) ? (
                                    <s-button disabled>Current Plan</s-button>
                                ) : (
                                    <s-button disabled>Contact Support to Downgrade</s-button>
                                )}
                            </s-stack>
                        </s-box>

                        {/* PRO */}
                        <s-box padding="base" borderWidth="base" borderRadius="base" borderColor={isCurrent(PLANS.PRO) ? "border-brand" : "border"} background={isCurrent(PLANS.PRO) ? "bg-surface-active" : "bg-surface"}>
                            <s-stack direction="block" gap="base">
                                <s-text variant="headingMd">Pro</s-text>
                                <s-text variant="headingXl">$29<s-text as="span" variant="bodySm" tone="subdued">/mo</s-text></s-text>
                                <s-list>
                                    <s-list-item>200 Push Campaigns/mo</s-list-item>
                                    <s-list-item>20 Scheduled/mo</s-list-item>
                                    <s-list-item>50 Recoveries/day</s-list-item>
                                    <s-list-item>Priority Support</s-list-item>
                                </s-list>
                                {isCurrent(PLANS.PRO) ? (
                                    <s-button disabled>Current Plan</s-button>
                                ) : (
                                    <Form method="post">
                                        <input type="hidden" name="plan" value={PLANS.PRO} />
                                        <s-button type="submit" variant="primary">Upgrade to Pro</s-button>
                                    </Form>
                                )}
                            </s-stack>
                        </s-box>

                        {/* ENTERPRISE */}
                        <s-box padding="base" borderWidth="base" borderRadius="base" background={isCurrent(PLANS.ENTERPRISE) ? "bg-surface-active" : "bg-surface"}>
                            <s-stack direction="block" gap="base">
                                <s-text variant="headingMd">Enterprise</s-text>
                                <s-text variant="headingXl">$199<s-text as="span" variant="bodySm" tone="subdued">/mo</s-text></s-text>
                                <s-list>
                                    <s-list-item>Unlimited Push</s-list-item>
                                    <s-list-item>Unlimited Scheduled</s-list-item>
                                    <s-list-item>Unlimited Recovery</s-list-item>
                                    <s-list-item>AI Features</s-list-item>
                                </s-list>
                                {isCurrent(PLANS.ENTERPRISE) ? (
                                    <s-button disabled>Current Plan</s-button>
                                ) : (
                                    <Form method="post">
                                        <input type="hidden" name="plan" value={PLANS.ENTERPRISE} />
                                        <s-button type="submit" variant="primary">Upgrade to Enterprise</s-button>
                                    </Form>
                                )}
                            </s-stack>
                        </s-box>

                    </s-grid>
                </s-section>

            </s-stack>
        </s-page>
    );
}
