/**
 * Mobile Notification Button Clicked Tracking Endpoint
 * 
 * Requirements: 3.12, 9.1, 9.4, 9.8
 * 
 * POST /api/mobile/notification/clicked
 * 
 * Tracks when a user clicks an action button in a rich push notification.
 * Called by the mobile app when a button is tapped.
 */

import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { trackRichPushButtonClick } from "../services/rich-push.server";
import { recordNotificationClicked } from "../services/notification-metrics.server";

/**
 * POST /api/mobile/notification/clicked
 * 
 * Request Body:
 * {
 *   "campaignId": "campaign_id",
 *   "buttonId": "button1", // or "button2"
 *   "buttonText": "Shop Now", // optional - button label
 *   "customerId": "customer_id", // optional
 *   "token": "expo_push_token",
 *   "metricId": "metric_id", // optional - if known
 *   "timestamp": "2024-01-15T10:30:00Z" // optional
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "metricId": "metric_id"
 * }
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Only allow POST requests
  if (request.method !== "POST") {
    return mobileJson({ error: "Method not allowed" }, 405);
  }

  try {
    // Parse request body
    const body = await request.json();
    const { campaignId, buttonId, buttonText, customerId, token, metricId, timestamp } = body;

    // Validate required fields
    if (!campaignId) {
      return mobileJson(
        { error: "Campaign ID is required" },
        400
      );
    }

    if (!buttonId) {
      return mobileJson(
        { error: "Button ID is required" },
        400
      );
    }

    // Verify campaign exists
    const campaign = await db.pushCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return mobileJson(
        { error: "Campaign not found" },
        404
      );
    }

    // Find or use the metric ID
    let actualMetricId = metricId;
    
    if (!actualMetricId && customerId) {
      // Try to find the metric by campaign and customer
      const metric = await db.notificationMetric.findFirst({
        where: {
          campaignId,
          shopifyCustomerId: customerId,
          clickedAt: null // Not already clicked
        },
        orderBy: { sentAt: 'desc' }
      });
      
      actualMetricId = metric?.id;
    }

    // Record the click event in detailed metrics
    if (actualMetricId) {
      await recordNotificationClicked(actualMetricId, buttonText || buttonId);
    }

    // Track the button click event (legacy rich push tracking)
    await trackRichPushButtonClick(campaignId, buttonId, customerId);

    // Log the event for detailed analytics
    if (token) {
      const pushToken = await db.pushToken.findFirst({
        where: { token },
      });

      if (pushToken) {
        await db.eventLog.create({
          data: {
            merchantId: pushToken.merchantId,
            type: 'NOTIFICATION_BUTTON_CLICKED',
            payload: JSON.stringify({
              campaignId,
              buttonId,
              buttonText,
              customerId,
              metricId: actualMetricId,
              timestamp: timestamp || new Date().toISOString(),
            }),
          },
        });
      }
    }

    return mobileJson({ success: true, metricId: actualMetricId });
  } catch (error: any) {
    console.error("Error tracking button click:", error);
    return handleMobileError(error);
  }
};
