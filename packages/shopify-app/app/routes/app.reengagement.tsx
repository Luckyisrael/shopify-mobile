import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { useState, useCallback } from "react";
import {
  getReengagementCampaigns,
  createReengagementCampaign,
  toggleReengagementCampaign,
  getReengagementMetrics,
  getInactiveCustomerCounts,
} from "../services/reengagement.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const merchantId = session.shop;

  const [campaigns, metrics, inactiveCounts] = await Promise.all([
    getReengagementCampaigns(merchantId),
    getReengagementMetrics(merchantId),
    getInactiveCustomerCounts(merchantId),
  ]);

  return { campaigns, metrics, inactiveCounts };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const merchantId = session.shop;

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "create" || action === "update") {
    const tier = parseInt(formData.get("tier") as string);
    const title = formData.get("title") as string;
    const body = formData.get("body") as string;
    const enabled = formData.get("enabled") === "true";

    await createReengagementCampaign(merchantId, tier, title, body, enabled);
    
    return { success: true, message: "Campaign saved successfully" };
  }

  if (action === "toggle") {
    const campaignId = formData.get("campaignId") as string;
    const enabled = formData.get("enabled") === "true";

    await toggleReengagementCampaign(merchantId, campaignId, enabled);
    
    return { success: true, message: "Campaign toggled successfully" };
  }

  return { success: false, message: "Invalid action" };
};

export default function ReengagementPage() {
  const { campaigns, metrics, inactiveCounts } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  // Form state for each tier
  const [tier7, setTier7] = useState(() => {
    const campaign = campaigns.find((c: any) => c.tier === "7_DAY");
    return {
      title: campaign?.title || "We miss you! 🎉",
      body: campaign?.body || "It's been a week! Check out what's new in our store.",
      enabled: campaign?.isActive ?? true,
    };
  });

  const [tier14, setTier14] = useState(() => {
    const campaign = campaigns.find((c: any) => c.tier === "14_DAY");
    return {
      title: campaign?.title || "Come back for exclusive deals! 💎",
      body: campaign?.body || "We have special offers just for you. Don't miss out!",
      enabled: campaign?.isActive ?? true,
    };
  });

  const [tier30, setTier30] = useState(() => {
    const campaign = campaigns.find((c: any) => c.tier === "30_DAY");
    return {
      title: campaign?.title || "We'd love to see you again! ❤️",
      body: campaign?.body || "It's been a while! Here's a special welcome back offer.",
      enabled: campaign?.isActive ?? true,
    };
  });

  const handleSave = useCallback((tier: number, data: any) => {
    const formData = new FormData();
    formData.append("action", "create");
    formData.append("tier", tier.toString());
    formData.append("title", data.title);
    formData.append("body", data.body);
    formData.append("enabled", data.enabled.toString());
    submit(formData, { method: "post" });
  }, [submit]);

  const handleToggle = useCallback((campaignId: string, enabled: boolean) => {
    const formData = new FormData();
    formData.append("action", "toggle");
    formData.append("campaignId", campaignId);
    formData.append("enabled", enabled.toString());
    submit(formData, { method: "post" });
  }, [submit]);

  return (
    <s-page heading="Re-engagement Campaigns">
      <s-stack direction="block" gap="base">
        <s-banner tone="info">
          Re-engagement campaigns automatically send notifications to customers who haven't
          opened your app in 7, 14, or 30 days. Customize your messages for each tier below.
        </s-banner>

        <s-section>
          <s-stack direction="block" gap="base">
            <s-text>Overall Performance (Last 30 Days)</s-text>
            <s-stack direction="inline" gap="base">
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text>Notifications Sent</s-text>
                  <s-text>{metrics.overall.sent}</s-text>
                </s-stack>
              </s-box>
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text>Customers Re-engaged</s-text>
                  <s-text>{metrics.overall.reengaged}</s-text>
                </s-stack>
              </s-box>
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text>Re-engagement Rate</s-text>
                  <s-text>{metrics.overall.reengagementRate}%</s-text>
                </s-stack>
              </s-box>
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text>Avg. Time to Re-engage</s-text>
                  <s-text>{metrics.overall.avgTimeToReengage}h</s-text>
                </s-stack>
              </s-box>
            </s-stack>
          </s-stack>
        </s-section>

        <s-section>
          <s-stack direction="block" gap="base">
            <s-text>Campaign Performance by Tier</s-text>
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                {metrics.tierMetrics.map((metric: any) => (
                  <s-stack key={metric.tier} direction="inline" gap="base">
                    <s-text>{metric.tier} days</s-text>
                    <s-text>Sent: {metric.sent}</s-text>
                    <s-text>Re-engaged: {metric.reengaged}</s-text>
                    <s-text>Rate: {metric.reengagementRate}%</s-text>
                    <s-badge tone={metric.isActive ? "success" : "info"}>
                      {metric.isActive ? "Active" : "Paused"}
                    </s-badge>
                  </s-stack>
                ))}
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>

        {/* 7-Day Tier */}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text>7-Day Inactive Campaign</s-text>
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-stack direction="inline" gap="base">
                  <s-stack direction="block" gap="base">
                    <s-text>7-Day Inactive Campaign</s-text>
                    <s-text>
                      Target customers who haven't opened the app in 7 days
                      {inactiveCounts[7] > 0 && ` (${inactiveCounts[7]} customers eligible)`}
                    </s-text>
                  </s-stack>
                  <s-badge tone={tier7.enabled ? "success" : "info"}>
                    {tier7.enabled ? "Active" : "Paused"}
                  </s-badge>
                </s-stack>

                <s-stack direction="block" gap="base">
                  <s-text-field
                    label="Notification Title"
                    value={tier7.title}
                    onChange={(event: any) => setTier7({ ...tier7, title: event.detail.value })}
                  />
                  <s-text-field
                    label="Notification Body"
                    value={tier7.body}
                    onChange={(event: any) => setTier7({ ...tier7, body: event.detail.value })}
                  />
                  <s-stack direction="inline" gap="base">
                    <s-button
                      onClick={() => handleSave(7, tier7)}
                      loading={isLoading}
                      variant="primary"
                    >
                      Save Campaign
                    </s-button>
                    <s-button
                      onClick={() => {
                        const campaign = campaigns.find((c: any) => c.tier === "7_DAY");
                        if (campaign) {
                          handleToggle(campaign.id, !tier7.enabled);
                          setTier7({ ...tier7, enabled: !tier7.enabled });
                        }
                      }}
                      loading={isLoading}
                    >
                      {tier7.enabled ? "Pause" : "Activate"}
                    </s-button>
                  </s-stack>
                </s-stack>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>

        {/* 14-Day Tier */}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text>14-Day Inactive Campaign</s-text>
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-stack direction="inline" gap="base">
                  <s-stack direction="block" gap="base">
                    <s-text>14-Day Inactive Campaign</s-text>
                    <s-text>
                      Target customers who haven't opened the app in 14 days
                      {inactiveCounts[14] > 0 && ` (${inactiveCounts[14]} customers eligible)`}
                    </s-text>
                  </s-stack>
                  <s-badge tone={tier14.enabled ? "success" : "info"}>
                    {tier14.enabled ? "Active" : "Paused"}
                  </s-badge>
                </s-stack>

                <s-stack direction="block" gap="base">
                  <s-text-field
                    label="Notification Title"
                    value={tier14.title}
                    onChange={(event: any) => setTier14({ ...tier14, title: event.detail.value })}
                  />
                  <s-text-field
                    label="Notification Body"
                    value={tier14.body}
                    onChange={(event: any) => setTier14({ ...tier14, body: event.detail.value })}
                  />
                  <s-stack direction="inline" gap="base">
                    <s-button
                      onClick={() => handleSave(14, tier14)}
                      loading={isLoading}
                      variant="primary"
                    >
                      Save Campaign
                    </s-button>
                    <s-button
                      onClick={() => {
                        const campaign = campaigns.find((c: any) => c.tier === "14_DAY");
                        if (campaign) {
                          handleToggle(campaign.id, !tier14.enabled);
                          setTier14({ ...tier14, enabled: !tier14.enabled });
                        }
                      }}
                      loading={isLoading}
                    >
                      {tier14.enabled ? "Pause" : "Activate"}
                    </s-button>
                  </s-stack>
                </s-stack>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>

        {/* 30-Day Tier */}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text>30-Day Inactive Campaign</s-text>
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-stack direction="inline" gap="base">
                  <s-stack direction="block" gap="base">
                    <s-text>30-Day Inactive Campaign</s-text>
                    <s-text>
                      Target customers who haven't opened the app in 30 days
                      {inactiveCounts[30] > 0 && ` (${inactiveCounts[30]} customers eligible)`}
                    </s-text>
                  </s-stack>
                  <s-badge tone={tier30.enabled ? "success" : "info"}>
                    {tier30.enabled ? "Active" : "Paused"}
                  </s-badge>
                </s-stack>

                <s-stack direction="block" gap="base">
                  <s-text-field
                    label="Notification Title"
                    value={tier30.title}
                    onChange={(event: any) => setTier30({ ...tier30, title: event.detail.value })}
                  />
                  <s-text-field
                    label="Notification Body"
                    value={tier30.body}
                    onChange={(event: any) => setTier30({ ...tier30, body: event.detail.value })}
                  />
                  <s-stack direction="inline" gap="base">
                    <s-button
                      onClick={() => handleSave(30, tier30)}
                      loading={isLoading}
                      variant="primary"
                    >
                      Save Campaign
                    </s-button>
                    <s-button
                      onClick={() => {
                        const campaign = campaigns.find((c: any) => c.tier === "30_DAY");
                        if (campaign) {
                          handleToggle(campaign.id, !tier30.enabled);
                          setTier30({ ...tier30, enabled: !tier30.enabled });
                        }
                      }}
                      loading={isLoading}
                    >
                      {tier30.enabled ? "Pause" : "Activate"}
                    </s-button>
                  </s-stack>
                </s-stack>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>

        <s-banner tone="info">
          <s-text>How it works:</s-text> Re-engagement campaigns run daily and automatically
          send notifications to eligible customers. A customer is only sent one notification
          per tier every 30 days to avoid spam.
        </s-banner>
      </s-stack>
    </s-page>
  );
}
