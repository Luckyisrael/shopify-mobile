/**
 * Rich Push Notification API Endpoint
 * 
 * Requirements: 3.7, 3.8, 3.9, 3.10, 3.11, 3.12
 * 
 * POST /api/admin/push/rich
 * 
 * Allows merchants to send rich push notifications via API
 * with images, action buttons, and deep links.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sendRichPush, type RichPushConfig } from "../services/rich-push.server";
import { checkUsageLimit, logUsage } from "../services/billing.server";

/**
 * POST /api/admin/push/rich
 * 
 * Send a rich push notification
 * 
 * Request Body:
 * {
 *   "title": "New Collection Drop!",
 *   "body": "Check out our latest summer styles...",
 *   "imageUrl": "https://example.com/image.jpg", // optional
 *   "deepLink": "myapp://products/summer", // optional
 *   "actionButtons": [ // optional, max 2
 *     {
 *       "id": "button1",
 *       "title": "Shop Now",
 *       "action": "myapp://shop"
 *     }
 *   ],
 *   "segment": { // optional
 *     "customerIds": ["customer_id_1", "customer_id_2"],
 *     "tags": ["vip", "summer_2024"]
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "count": 150,
 *   "campaignId": "campaign_id",
 *   "errors": [] // optional warnings
 * }
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Authenticate the request
  const { session } = await authenticate.admin(request);

  // Only allow POST requests
  if (request.method !== "POST") {
    return mobileJson({ error: "Method not allowed" }, 405);
  }

  try {
    // Get merchant
    const merchant = await db.merchant.findUnique({
      where: { shop: session.shop },
    });

    if (!merchant) {
      return mobileJson({ error: "Merchant not found" }, 404);
    }

    // Parse request body
    const body = await request.json();
    const { title, body: messageBody, imageUrl, deepLink, actionButtons, segment } = body;

    // Validate required fields
    if (!title || !messageBody) {
      return mobileJson(
        { error: "Title and body are required" },
        400
      );
    }

    // Validate title and body length
    if (title.length > 50) {
      return mobileJson(
        { error: "Title must be 50 characters or less" },
        400
      );
    }

    if (messageBody.length > 150) {
      return mobileJson(
        { error: "Body must be 150 characters or less" },
        400
      );
    }

    // Validate image URL format if provided
    if (imageUrl) {
      try {
        const url = new URL(imageUrl);
        if (url.protocol !== 'https:') {
          return mobileJson(
            { error: "Image URL must use HTTPS protocol" },
            400
          );
        }
      } catch (error) {
        return mobileJson(
          { error: "Invalid image URL format" },
          400
        );
      }
    }

    // Validate action buttons
    if (actionButtons) {
      if (!Array.isArray(actionButtons)) {
        return mobileJson(
          { error: "Action buttons must be an array" },
          400
        );
      }

      if (actionButtons.length > 2) {
        return mobileJson(
          { error: "Maximum 2 action buttons allowed" },
          400
        );
      }

      // Validate each button
      for (const button of actionButtons) {
        if (!button.id || !button.title) {
          return mobileJson(
            { error: "Each button must have an id and title" },
            400
          );
        }

        if (button.title.length > 20) {
          return mobileJson(
            { error: "Button title must be 20 characters or less" },
            400
          );
        }
      }
    }

    // Validate segment if provided
    if (segment) {
      if (segment.customerIds && !Array.isArray(segment.customerIds)) {
        return mobileJson(
          { error: "Segment customerIds must be an array" },
          400
        );
      }

      if (segment.tags && !Array.isArray(segment.tags)) {
        return mobileJson(
          { error: "Segment tags must be an array" },
          400
        );
      }
    }

    // Check usage limits
    try {
      await checkUsageLimit(merchant.id, 'PUSH');
    } catch (error: any) {
      return mobileJson(
        { error: error.message || "Usage limit exceeded" },
        429
      );
    }

    // Build rich push config
    const config: RichPushConfig = {
      title,
      body: messageBody,
      imageUrl,
      deepLink,
      actionButtons,
    };

    // Send rich push notification
    const result = await sendRichPush(merchant.id, config, segment);

    // Log usage if successful
    if (result.success && result.count > 0) {
      await logUsage(merchant.id, 'PUSH');
    }

    // Return result
    return mobileJson({
      success: result.success,
      count: result.count,
      campaignId: result.campaignId,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error("Error sending rich push notification:", error);
    return handleMobileError(error);
  }
};

/**
 * GET /api/admin/push/rich/:campaignId
 * 
 * Get rich push campaign details and metrics
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const merchant = await db.merchant.findUnique({
      where: { shop: session.shop },
    });

    if (!merchant) {
      return mobileJson({ error: "Merchant not found" }, 404);
    }

    const { campaignId } = params;

    if (!campaignId) {
      return mobileJson({ error: "Campaign ID is required" }, 400);
    }

    // Get campaign with metrics
    const campaign = await db.pushCampaign.findUnique({
      where: {
        id: campaignId,
        merchantId: merchant.id, // Ensure merchant owns this campaign
      },
      include: {
        metrics: true,
      },
    });

    if (!campaign) {
      return mobileJson({ error: "Campaign not found" }, 404);
    }

    // Parse action buttons if present
    let actionButtons;
    if (campaign.actionButtons) {
      try {
        actionButtons = JSON.parse(campaign.actionButtons);
      } catch (error) {
        console.error("Error parsing action buttons:", error);
      }
    }

    // Calculate metrics from the campaign counts
    const metrics = {
      sent: campaign.sentCount || 0,
      delivered: campaign.deliveredCount || 0,
      opened: campaign.openedCount || 0,
      clicked: campaign.clickedCount || 0,
      converted: campaign.convertedCount || 0,
    };

    const openRate = metrics.sent > 0 ? (metrics.opened / metrics.sent) * 100 : 0;
    const clickRate = metrics.opened > 0 ? (metrics.clicked / metrics.opened) * 100 : 0;
    const conversionRate = metrics.sent > 0 ? (metrics.converted / metrics.sent) * 100 : 0;

    return mobileJson({
      campaign: {
        id: campaign.id,
        title: campaign.title,
        body: campaign.body,
        imageUrl: campaign.imageUrl,
        deepLink: campaign.deepLink,
        actionButtons,
        status: campaign.status,
        recipientCount: campaign.sentCount,
        sentAt: campaign.sentAt,
        scheduledFor: campaign.scheduledFor,
      },
      metrics: {
        sent: metrics.sent,
        delivered: metrics.delivered,
        opened: metrics.opened,
        clicked: metrics.clicked,
        converted: metrics.converted,
        openRate: openRate.toFixed(2),
        clickRate: clickRate.toFixed(2),
        conversionRate: conversionRate.toFixed(2),
      },
    });
  } catch (error: any) {
    console.error("Error fetching campaign:", error);
    return handleMobileError(error);
  }
};
