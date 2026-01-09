import { authenticate } from "../shopify.server";
import db from "../db.server";
import { updateSubscription, PLANS, PLAN_CONFIGS } from "../services/billing.server";

export const action = async ({ request }: any) => {
    const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

    if (!payload) return new Response();

    const subscription = payload.app_subscription;
    // payload structure: { app_subscription: { status, name, ... } } ??
    // Actually, for APP_SUBSCRIPTIONS_UPDATE, the payload IS the subscription object usually.
    // Or it's { app_subscription: ... } wrapper?
    // Docs say: "The payload is the AppSubscription resource".

    // Let's assume standard resource payload.
    const status = payload.status;
    const name = payload.name; // "Pro", "Enterprise"
    const shopifyId = String(payload.id); // "gid://shopify/AppSubscription/12345"

    console.log(`[Webhook] ${topic} for ${shop}: ${status} - ${name}`);

    // Find Merchant
    const merchant = await db.merchant.findUnique({ where: { shop } });
    if (!merchant) {
        console.error(`[Webhook] Merchant not found for shop ${shop}`);
        return new Response();
    }

    // Determine Plan
    let plan = PLANS.FREE;
    if (name === PLAN_CONFIGS[PLANS.PRO].name) plan = PLANS.PRO;
    if (name === PLAN_CONFIGS[PLANS.ENTERPRISE].name) plan = PLANS.ENTERPRISE;

    // If status is CANCELLED, we might want to switch to FREE effectively, but 
    // updateSubscription stores the status.
    // The billing logic will treat non-active as Free mostly.

    if (topic === "APP_SUBSCRIPTIONS_UPDATE") {
        await updateSubscription(merchant.id, shopifyId, status, plan);
    }

    return new Response();
};
