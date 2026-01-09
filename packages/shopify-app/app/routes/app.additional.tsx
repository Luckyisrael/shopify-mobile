import { Form, useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sendPushNotification } from "../services/push.server";
import { scheduleJob, JOB_TYPES, JOB_STATUS } from "../services/automation.server";
import { checkUsageLimit, logUsage } from "../services/billing.server";

export const loader = async ({ request }: any) => {
  const { session } = await authenticate.admin(request);

  const merchant = await db.merchant.findUnique({
    where: { shop: session.shop },
    include: {
      _count: { select: { pushTokens: true } },
      jobs: {
        where: {
          type: JOB_TYPES.SCHEDULED_CAMPAIGN,
          status: JOB_STATUS.PENDING
        },
        orderBy: { scheduledAt: 'asc' }
      }
    }
  });

  return {
    deviceCount: merchant?._count?.pushTokens || 0,
    merchantId: merchant?.id,
    scheduledJobs: merchant?.jobs || []
  };
};

export const action = async ({ request }: any) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const merchant = await db.merchant.findUnique({ where: { shop: session.shop } });
  if (!merchant) return Response.json({ error: "Merchant not found" });

  if (intent === "cancelJob") {
    const jobId = String(formData.get("jobId"));
    await db.job.update({
      where: { id: jobId },
      data: { status: JOB_STATUS.CANCELLED }
    });
    return Response.json({ success: true, message: "Campaign cancelled." });
  }

  const title = formData.get("title");
  const body = formData.get("body");
  const sendLater = formData.get("sendLater") === "on";
  const scheduledDate = formData.get("scheduledDate");
  const scheduledTime = formData.get("scheduledTime");

  if (!title || !body) {
    return Response.json({ error: "Title and Body are required" });
  }

  try {
    if (sendLater) {
      if (!scheduledDate || !scheduledTime) {
        return Response.json({ error: "Date and Time required for scheduled campaigns." });
      }
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);

      // Scheduling logic checks limits internally in automation.server.ts
      await scheduleJob(
        merchant.id,
        JOB_TYPES.SCHEDULED_CAMPAIGN,
        { title, body },
        scheduledAt
      );

      return Response.json({ success: true, message: "Campaign scheduled!" });
    } else {
      // Manual Push
      // 1. Check Limits
      await checkUsageLimit(merchant.id, 'PUSH');

      // 2. Send
      const result = await sendPushNotification(merchant.id, String(title), String(body));

      // 3. Log Usage (only if successful count > 0 ideally, but simple "attempt" is safer for throttling)
      // The prompt says "No UI button disables...". "usage.pushThisMonth >= flags... throw".
      await logUsage(merchant.id, 'PUSH');

      return Response.json(result);
    }
  } catch (e: any) {
    return Response.json({ error: e.message || "Action failed" });
  }
};

export default function PushPage() {
  const { deviceCount, scheduledJobs } = useLoaderData<typeof loader>();
  const actionData = useActionData() as any;
  const nav = useNavigation();
  const submit = useSubmit();

  const isSending = nav.state === "submitting" && nav.formData?.get("intent") !== "cancelJob";

  return (
    <s-page heading="Push Notifications">

      <s-stack direction="block" gap="base">
        {/* Success/Error Banners */}
        {actionData?.success && (
          <s-banner heading="Success" tone="success">
            {actionData.message || `Sent to ${actionData.count} devices!`}
          </s-banner>
        )}
        {actionData?.error && (
          <s-banner heading="Error" tone="critical">
            {actionData.error}
          </s-banner>
        )}

        <s-section heading="Overview">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
            <s-stack direction="inline" gap="base">
              <s-text type="strong">Registered Devices:</s-text>
              <s-text>{deviceCount}</s-text>
            </s-stack>
          </s-box>
        </s-section>

        <s-section heading="Send Notification">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
            <s-stack direction="block" gap="base">
              <s-text tone="subdued">
                Send a manual broadcast or schedule for later.
              </s-text>
              <Form method="post">
                <s-stack direction="block" gap="base">
                  <s-text-field
                    label="Title"
                    name="title"
                    placeholder="New Collection Drop!"
                    required
                  />
                  <s-text-field
                    label="Message Body"
                    name="body"
                    placeholder="Check out our latest summer styles..."
                    multiline={3}
                    required
                  />

                  <s-stack direction="block" gap="050">
                    <s-text type="strong">Audience</s-text>
                    <select name="segment" style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #ccc' }}>
                      <option value="all">All Users ({deviceCount})</option>
                      <option value="abandoned_cart" disabled>Users with Abandoned Carts (Automated Only)</option>
                      <option value="past_buyers" disabled>Past Buyers (Coming Soon)</option>
                    </select>
                  </s-stack>

                  <s-box padding="base" background="bg-surface-secondary" borderRadius="base">
                    <s-stack direction="block" gap="base">
                      <s-stack direction="inline" align="center" gap="base">
                        <input type="checkbox" name="sendLater" id="sendLater" style={{ width: 16, height: 16 }} />
                        <label htmlFor="sendLater"><s-text type="strong">Schedule for later</s-text></label>
                      </s-stack>

                      <s-stack direction="inline" gap="base">
                        <input type="date" name="scheduledDate" style={{ padding: 8 }} />
                        <input type="time" name="scheduledTime" style={{ padding: 8 }} />
                      </s-stack>
                    </s-stack>
                  </s-box>

                  <s-button type="submit" variant="primary" loading={isSending}>
                    Send / Schedule
                  </s-button>
                </s-stack>
              </Form>
            </s-stack>
          </s-box>
        </s-section>

        {/* Scheduled Campaigns List */}
        <s-section heading="Scheduled Campaigns">
          {scheduledJobs.length === 0 ? (
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-text tone="subdued">No campaigns scheduled.</s-text>
            </s-box>
          ) : (
            <s-stack direction="block" gap="base">
              {scheduledJobs.map((job: any) => {
                const payload = JSON.parse(job.payload);
                return (
                  <s-box key={job.id} padding="base" borderWidth="base" borderRadius="base" background="transparent">
                    <s-stack direction="inline" align="center" justify="space-between">
                      <s-stack direction="block" gap="050">
                        <s-text type="strong">{payload.title}</s-text>
                        <s-text tone="subdued">Scheduled: {new Date(job.scheduledAt).toLocaleString()}</s-text>
                      </s-stack>
                      <Form method="post">
                        <input type="hidden" name="intent" value="cancelJob" />
                        <input type="hidden" name="jobId" value={job.id} />
                        <s-button type="submit" tone="critical">Cancel</s-button>
                      </Form>
                    </s-stack>
                  </s-box>
                );
              })}
            </s-stack>
          )}
        </s-section>

      </s-stack>
    </s-page>
  );
}
