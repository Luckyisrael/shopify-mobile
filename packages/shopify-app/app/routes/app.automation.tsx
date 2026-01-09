import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { createScheduledCampaign, AUTOMATION_TYPES, JOB_STATUS } from "../services/automation-v2.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const merchant = await db.merchant.findUnique({
    where: { shop: session.shop },
    include: {
      // automationRules: {
      //   orderBy: { createdAt: 'desc' },
      // },
      // automationJobs: {
      //   orderBy: { createdAt: 'desc' },
      //   take: 20,
      //   include: {
      //     rule: true,
      //   },
      // },
      featureFlags: true,
      usageLogs: {
        where: {
          timestamp: { gte: new Date(new Date().setDate(1)) }, // This month
        },
      },
    },
  });

  if (!merchant) {
    return {
      automationRules: [],
      recentJobs: [],
      usage: { push: 0, scheduled: 0, recovery: 0 },
      flags: null,
    };
  }

  // Calculate usage stats
  const usage = {
    push: merchant.usageLogs ? merchant.usageLogs.filter((l: any) => l.feature === 'PUSH').length : 0,
    scheduled: merchant.usageLogs ? merchant.usageLogs.filter((l: any) => l.feature === 'SCHEDULED_PUSH').length : 0,
    recovery: merchant.usageLogs ? merchant.usageLogs.filter((l: any) => l.feature === 'CART_RECOVERY').length : 0,
  };

  // Calculate job stats - temporarily disabled until schema migration
  const jobStats = { total: 0, completed: 0, failed: 0, queued: 0 };

  return {
    automationRules: [], // merchant.automationRules || [],
    recentJobs: [], // merchant.automationJobs || [],
    usage,
    jobStats,
    flags: merchant.featureFlags,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  const merchant = await db.merchant.findUnique({ where: { shop: session.shop } });
  if (!merchant) {
    return Response.json({ error: "Merchant not found" }, { status: 404 });
  }

  if (actionType === "createCampaign") {
    const title = formData.get("title") as string;
    const body = formData.get("body") as string;
    const audience = formData.get("audience") as "all" | "logged_in" | "cart_owners";
    const scheduledFor = new Date(formData.get("scheduledFor") as string);

    try {
      const result = await createScheduledCampaign(
        merchant.id,
        title,
        body,
        scheduledFor,
        audience
      );

      return Response.json({
        success: true,
        message: `Campaign scheduled! ${result.jobsCreated} customers will receive the notification.`,
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  if (actionType === "toggleRule") {
    // Temporarily disabled until schema migration
    // const ruleId = formData.get("ruleId") as string;
    // const newStatus = formData.get("status") as "ACTIVE" | "PAUSED";

    // await db.automationRule.update({
    //   where: { id: ruleId },
    //   data: { status: newStatus },
    // });

    return Response.json({ success: true, message: "Feature coming soon after database migration" });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
};

export default function AutomationPage() {
  const { automationRules, recentJobs, usage, jobStats, flags } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const isSubmitting = nav.state === "submitting";

  return (
    <s-page heading="Automation & Push Campaigns">
      <s-stack direction="block" gap="base">

        {/* Usage Stats */}
        <s-section heading="Usage This Month">
          <s-stack direction="inline" gap="base">
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text tone="neutral">Push Campaigns</s-text>
                <s-text>{usage.push} / {flags?.maxPushCampaignsPerMonth || 20}</s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text tone="neutral">Scheduled Campaigns</s-text>
                <s-text>{usage.scheduled} / {flags?.maxScheduledCampaigns || 2}</s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text tone="neutral">Cart Recoveries</s-text>
                <s-text>{usage.recovery} (daily limit: {flags?.maxCartRecoveriesPerDay || 5})</s-text>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>

        {/* Job Stats */}
        <s-section heading="Automation Performance">
          <s-stack direction="inline" gap="base">
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text tone="neutral">Total Jobs</s-text>
                <s-text>{jobStats.total}</s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text tone="success">Completed</s-text>
                <s-text>{jobStats.completed}</s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text tone="caution">Queued</s-text>
                <s-text>{jobStats.queued}</s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text tone="critical">Failed</s-text>
                <s-text>{jobStats.failed}</s-text>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>

        {/* Create Campaign */}
        <s-section heading="Create Scheduled Campaign">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
            <Form method="post">
              <input type="hidden" name="actionType" value="createCampaign" />
              <s-stack direction="block" gap="base">
                <s-text-field
                  label="Campaign Title"
                  name="title"
                  placeholder="Flash Sale! 50% Off Everything"
                  required
                />
                <s-text-field
                  label="Message Body"
                  name="body"
                  placeholder="Don't miss out on our biggest sale of the year!"
                  required
                />
                <s-stack direction="block" gap="base">
                  <s-text>Audience</s-text>
                  <select name="audience" style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}>
                    <option value="all">All Customers</option>
                    <option value="logged_in">Logged-in Customers</option>
                    <option value="cart_owners">Cart Owners</option>
                  </select>
                </s-stack>
                <s-text-field
                  label="Schedule For"
                  name="scheduledFor"
                  required
                />
                <s-button type="submit" variant="primary" loading={isSubmitting}>
                  Schedule Campaign
                </s-button>
              </s-stack>
            </Form>
          </s-box>
        </s-section>

        {/* Automation Rules */}
        <s-section heading="Automation Rules">
          {automationRules.length === 0 ? (
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-text tone="neutral">No automation rules configured yet.</s-text>
            </s-box>
          ) : (
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                {automationRules.map((rule) => (
                  <s-stack key={rule.id} direction="inline">
                    <s-stack direction="block" gap="base">
                      <s-text>{rule.type.replace('_', ' ')}</s-text>
                      <s-text tone="neutral">
                        Status: {rule.status} | Created: {new Date(rule.createdAt).toLocaleDateString()}
                      </s-text>
                    </s-stack>
                    <Form method="post">
                      <input type="hidden" name="actionType" value="toggleRule" />
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <input type="hidden" name="status" value={rule.status === "ACTIVE" ? "PAUSED" : "ACTIVE"} />
                      <s-button type="submit" variant="secondary">
                        {rule.status === "ACTIVE" ? "Pause" : "Activate"}
                      </s-button>
                    </Form>
                  </s-stack>
                ))}
              </s-stack>
            </s-box>
          )}
        </s-section>

        {/* Recent Jobs */}
        <s-section heading="Recent Automation Jobs">
          {recentJobs.length === 0 ? (
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-text tone="neutral">No automation jobs yet.</s-text>
            </s-box>
          ) : (
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                {recentJobs.map((job) => (
                  <s-stack key={job.id} direction="block" gap="base">
                    <s-text>
                      {job.rule.type.replace('_', ' ')} - {job.status}
                    </s-text>
                    <s-text tone="neutral">
                      Scheduled: {new Date(job.scheduledFor).toLocaleString()} |
                      {job.executedAt && ` Executed: ${new Date(job.executedAt).toLocaleString()} |`}
                      Customer: {job.shopifyCustomerId ? 'Yes' : 'Anonymous'}
                    </s-text>
                  </s-stack>
                ))}
              </s-stack>
            </s-box>
          )}
        </s-section>

      </s-stack>
    </s-page>
  );
}