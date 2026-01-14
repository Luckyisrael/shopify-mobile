/**
 * Rich Push Notifications UI
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 * 
 * Allows merchants to send rich push notifications with:
 * - Images
 * - Action buttons (up to 2)
 * - Deep links
 * - Preview functionality
 */

import { useState } from "react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sendRichPush, validateImageUrl } from "../services/rich-push.server";
import { checkUsageLimit, logUsage } from "../services/billing.server";

export const loader = async ({ request }: any) => {
  const { session } = await authenticate.admin(request);

  const merchant = await db.merchant.findUnique({
    where: { shop: session.shop },
    include: {
      _count: { select: { pushTokens: true } },
    },
  });

  // Get optimization stats
  let optimizationStats = null;
  if (merchant) {
    try {
      const { getOptimizationStats } = await import("../services/send-time-optimizer.server");
      optimizationStats = await getOptimizationStats(merchant.id);
    } catch (error) {
      console.error("Failed to load optimization stats:", error);
    }
  }

  return {
    deviceCount: merchant?._count?.pushTokens || 0,
    merchantId: merchant?.id,
    optimizationStats,
  };
};

export const action = async ({ request }: any) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const merchant = await db.merchant.findUnique({ where: { shop: session.shop } });
  if (!merchant) return Response.json({ error: "Merchant not found" });

  // Validate image URL if provided
  if (intent === "validateImage") {
    const imageUrl = formData.get("imageUrl");
    if (!imageUrl) {
      return Response.json({ error: "Image URL is required" });
    }

    const validation = await validateImageUrl(String(imageUrl));
    return Response.json(validation);
  }

  // Send rich push notification
  if (intent === "send") {
    const title = formData.get("title");
    const body = formData.get("body");
    const imageUrl = formData.get("imageUrl");
    const deepLink = formData.get("deepLink");
    const button1Title = formData.get("button1Title");
    const button1Action = formData.get("button1Action");
    const button2Title = formData.get("button2Title");
    const button2Action = formData.get("button2Action");
    const useOptimalTime = formData.get("useOptimalTime") === "true";

    if (!title || !body) {
      return Response.json({ error: "Title and Body are required" });
    }

    try {
      // Check usage limits
      await checkUsageLimit(merchant.id, 'PUSH');

      // Build action buttons array
      const actionButtons = [];
      if (button1Title) {
        actionButtons.push({
          id: 'button1',
          title: String(button1Title),
          action: button1Action ? String(button1Action) : undefined,
        });
      }
      if (button2Title) {
        actionButtons.push({
          id: 'button2',
          title: String(button2Title),
          action: button2Action ? String(button2Action) : undefined,
        });
      }

      // If optimal time is selected, use the optimal time campaign
      if (useOptimalTime) {
        const { createOptimalTimeCampaign } = await import("../services/automation-v2.server");
        
        const result = await createOptimalTimeCampaign(
          merchant.id,
          String(title),
          String(body),
          "all" // audience
        );

        return Response.json({
          success: true,
          count: result.jobsCreated,
          message: `Scheduled ${result.jobsCreated} notifications at optimal times`,
          ruleId: result.ruleId,
        });
      }

      // Send rich push immediately
      const result = await sendRichPush(merchant.id, {
        title: String(title),
        body: String(body),
        imageUrl: imageUrl ? String(imageUrl) : undefined,
        deepLink: deepLink ? String(deepLink) : undefined,
        actionButtons: actionButtons.length > 0 ? actionButtons : undefined,
      });

      // Log usage
      if (result.success) {
        await logUsage(merchant.id, 'PUSH');
      }

      return Response.json(result);
    } catch (e: any) {
      return Response.json({ error: e.message || "Failed to send notification" });
    }
  }

  return Response.json({ error: "Invalid intent" });
};

export default function RichPushPage() {
  const { deviceCount, optimizationStats } = useLoaderData<typeof loader>();
  const actionData = useActionData() as any;
  const nav = useNavigation();

  const [imageUrl, setImageUrl] = useState("");
  const [imageValidation, setImageValidation] = useState<{ valid?: boolean; error?: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const isSending = nav.state === "submitting" && nav.formData?.get("intent") === "send";
  const isValidating = nav.state === "submitting" && nav.formData?.get("intent") === "validateImage";

  const handleValidateImage = async () => {
    if (!imageUrl) {
      setImageValidation({ valid: false, error: "Please enter an image URL" });
      return;
    }

    const formData = new FormData();
    formData.append("intent", "validateImage");
    formData.append("imageUrl", imageUrl);

    try {
      const response = await fetch("", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      setImageValidation(result);
    } catch (error) {
      setImageValidation({ valid: false, error: "Failed to validate image" });
    }
  };

  return (
    <s-page heading="Rich Push Notifications">
      <s-stack direction="block" gap="base">
        {/* Success/Error Banners */}
        {actionData?.success && (
          <s-banner heading="Success" tone="success">
            {actionData.count > 0
              ? `Rich notification sent to ${actionData.count} devices!`
              : "No devices to send to"}
            {actionData.campaignId && (
              <s-text>Campaign ID: {actionData.campaignId}</s-text>
            )}
          </s-banner>
        )}
        {actionData?.error && (
          <s-banner heading="Error" tone="critical">
            {actionData.error}
          </s-banner>
        )}
        {actionData?.errors && actionData.errors.length > 0 && (
          <s-banner heading="Warnings" tone="warning">
            <s-stack direction="block" gap="base">
              {actionData.errors.slice(0, 3).map((err: string, i: number) => (
                <s-text key={i}>{err}</s-text>
              ))}
            </s-stack>
          </s-banner>
        )}

        {/* Info Banner */}
        <s-banner heading="Rich Push Notifications">
          <s-text>
            Create engaging notifications with images, action buttons, and deep links.
            Rich notifications have higher engagement rates than standard text notifications.
          </s-text>
        </s-banner>

        {/* Overview */}
        <s-section heading="Overview">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="base">
                <s-text type="strong">Registered Devices:</s-text>
                <s-text>{deviceCount}</s-text>
              </s-stack>
              
              {optimizationStats && (
                <>
                  <s-stack direction="inline" gap="base">
                    <s-text type="strong">Customers with Optimal Time Data:</s-text>
                    <s-text>
                      {optimizationStats.customersOptimized} / {optimizationStats.totalCustomers}
                      {' '}({optimizationStats.coveragePercentage}%)
                    </s-text>
                  </s-stack>
                  <s-text>
                    Optimal send times are calculated based on customer app usage patterns.
                    More data = better optimization.
                  </s-text>
                </>
              )}
            </s-stack>
          </s-box>
        </s-section>

        {/* Rich Notification Form */}
        <s-section heading="Create Rich Notification">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
            <Form method="post">
              <input type="hidden" name="intent" value="send" />
              <s-stack direction="block" gap="base">
                {/* Basic Content */}
                <s-text type="strong">Basic Content</s-text>
                <s-text-field
                  label="Title"
                  name="title"
                  placeholder="New Collection Drop!"
                  required
                />
                <s-text>Keep it short and attention-grabbing (max 50 characters)</s-text>
                <s-text-field
                  label="Message Body"
                  name="body"
                  placeholder="Check out our latest summer styles..."
                  required
                />
                <s-text>Provide clear value proposition (max 150 characters)</s-text>

                {/* Rich Media */}
                <s-box padding="base" background="transparent" borderRadius="base" borderWidth="base">
                  <s-stack direction="block" gap="base">
                    <s-text type="strong">Rich Media (Optional)</s-text>
                    
                    {/* Image URL */}
                    <s-stack direction="block" gap="base">
                      <s-text-field
                        label="Image URL"
                        name="imageUrl"
                        placeholder="https://example.com/image.jpg"
                        value={imageUrl}
                        onChange={(e: any) => setImageUrl(e.target.value)}
                      />
                      <s-text>HTTPS URL to an image (JPG, PNG). Recommended size: 1200x600px, &lt; 1MB</s-text>
                      <s-stack direction="inline" gap="base">
                        <s-button
                          type="button"
                          onClick={handleValidateImage}
                          loading={isValidating}
                          disabled={!imageUrl}
                        >
                          Validate Image
                        </s-button>
                        {imageValidation?.valid && (
                          <s-text tone="success">✓ Image is valid</s-text>
                        )}
                        {imageValidation?.error && (
                          <s-text tone="critical">{imageValidation.error}</s-text>
                        )}
                      </s-stack>
                    </s-stack>

                    {/* Deep Link */}
                    <s-text-field
                      label="Deep Link"
                      name="deepLink"
                      placeholder="myapp://products/summer-collection"
                    />
                    <s-text>Optional deep link to open when notification is tapped</s-text>
                  </s-stack>
                </s-box>

                {/* Action Buttons */}
                <s-box padding="base" background="transparent" borderRadius="base" borderWidth="base">
                  <s-stack direction="block" gap="base">
                    <s-text type="strong">Action Buttons (Optional, Max 2)</s-text>
                    <s-text>
                      Add interactive buttons to your notification for quick actions
                    </s-text>

                    {/* Button 1 */}
                    <s-stack direction="block" gap="base">
                      <s-text>Button 1</s-text>
                      <s-text-field
                        label="Button Title"
                        name="button1Title"
                        placeholder="Shop Now"
                      />
                      <s-text>Short action text (max 20 characters)</s-text>
                      <s-text-field
                        label="Button Action"
                        name="button1Action"
                        placeholder="myapp://shop"
                      />
                      <s-text>Deep link or action identifier</s-text>
                    </s-stack>

                    {/* Button 2 */}
                    <s-stack direction="block" gap="base">
                      <s-text>Button 2</s-text>
                      <s-text-field
                        label="Button Title"
                        name="button2Title"
                        placeholder="View Details"
                      />
                      <s-text>Short action text (max 20 characters)</s-text>
                      <s-text-field
                        label="Button Action"
                        name="button2Action"
                        placeholder="myapp://details"
                      />
                      <s-text>Deep link or action identifier</s-text>
                    </s-stack>
                  </s-stack>
                </s-box>

                {/* Scheduling Options */}
                <s-box padding="base" background="transparent" borderRadius="base" borderWidth="base">
                  <s-stack direction="block" gap="base">
                    <s-text type="strong">Scheduling (Optional)</s-text>
                    <s-text>
                      Send notifications at the optimal time for each customer based on their app usage patterns
                    </s-text>

                    <s-stack direction="inline" gap="base">
                      <input
                        type="checkbox"
                        id="useOptimalTime"
                        name="useOptimalTime"
                        value="true"
                        style={{ width: 16, height: 16 }}
                      />
                      <label htmlFor="useOptimalTime">
                        <s-text type="strong">Send at optimal time for each customer</s-text>
                      </label>
                    </s-stack>

                    <s-text>
                      When enabled, notifications will be scheduled for each customer's most active hour.
                      Customers without enough data will receive notifications at 10 AM (merchant timezone).
                    </s-text>
                  </s-stack>
                </s-box>

                {/* Preview Toggle */}
                <s-stack direction="inline" gap="base">
                  <input
                    type="checkbox"
                    id="showPreview"
                    checked={showPreview}
                    onChange={(e) => setShowPreview(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <label htmlFor="showPreview">
                    <s-text type="strong">Show Preview</s-text>
                  </label>
                </s-stack>

                {/* Preview */}
                {showPreview && (
                  <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                    <s-stack direction="block" gap="base">
                      <s-text type="strong">Notification Preview</s-text>
                      <s-text>
                        This is an approximate preview. Actual appearance may vary by device.
                      </s-text>
                      <div style={{ maxWidth: '400px' }}>
                        <s-box
                          padding="base"
                          borderWidth="base"
                          borderRadius="base"
                          background="transparent"
                        >
                          <s-stack direction="block" gap="base">
                            {imageUrl && imageValidation?.valid && (
                              <img
                                src={imageUrl}
                                alt="Preview"
                                style={{
                                  width: '100%',
                                  borderRadius: '8px',
                                  marginBottom: '8px',
                                }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <s-text type="strong">
                              {(document.querySelector('[name="title"]') as HTMLInputElement)?.value || 'Title'}
                            </s-text>
                            <s-text>
                              {(document.querySelector('[name="body"]') as HTMLInputElement)?.value || 'Message body'}
                            </s-text>
                          </s-stack>
                        </s-box>
                      </div>
                    </s-stack>
                  </s-box>
                )}

                {/* Submit */}
                <s-button type="submit" variant="primary" loading={isSending}>
                  Send Rich Notification
                </s-button>
              </s-stack>
            </Form>
          </s-box>
        </s-section>

        {/* Best Practices */}
        <s-section heading="Best Practices">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
            <s-stack direction="block" gap="base">
              <s-text type="strong">Image Guidelines:</s-text>
              <ul style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '8px' }}>
                <li>Use high-quality images (1200x600px recommended)</li>
                <li>Keep file size under 1MB for fast loading</li>
                <li>Use HTTPS URLs only</li>
                <li>Test images on different devices</li>
              </ul>

              <s-text type="strong">Action Button Tips:</s-text>
              <ul style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '8px' }}>
                <li>Use clear, action-oriented text (e.g., "Shop Now", "Learn More")</li>
                <li>Limit to 2 buttons for better UX</li>
                <li>Ensure deep links are properly configured in your app</li>
              </ul>

              <s-text type="strong">Performance:</s-text>
              <ul style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '8px' }}>
                <li>Rich notifications typically have 2-3x higher engagement</li>
                <li>Images increase open rates by 40-50%</li>
                <li>Action buttons improve click-through rates by 30%</li>
              </ul>
            </s-stack>
          </s-box>
        </s-section>
      </s-stack>
    </s-page>
  );
}
