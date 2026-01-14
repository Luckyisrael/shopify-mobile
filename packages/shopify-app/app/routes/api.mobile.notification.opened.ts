/**
 * Mobile Notification Opened Tracking Endpoint
 * 
 * Requirements: 3.11, 9.1, 9.2, 9.3
 * 
 * POST /api/mobile/notification/opened
 * 
 * Tracks when a user opens a push notification.
 * Called by the mobile app when a notification is tapped.
 */

import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { trackRichPushOpened } from "../services/rich-push.server";
import { recordNotificationOpened } from "../services/notification-metrics.server";

/**
 * POST /api/mobile/notification/opened
 * 
 * Request Body:
 * {
 *   "campaignId": "campaign_id",
 *   "customerId": "customer_id", // optional
 *   "token": "expo_push_token",
 *   "metricId": "metric_id", // optional - if known
 *   "timestamp": "2024-01-15T10:30:00Z" // optional
 * }
 * 
 * Response:
 * {
 *   "success": true
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
    const { campaignId, customerId, token, metricId, timestamp } = body;

    // Validate required fields
    if (!campaignId) {
      return mobileJson(
        { error: "Campaign ID is required" },
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
          openedAt: null // Not already opened
        },
        orderBy: { sentAt: 'desc' }
      });
      
      actualMetricId = metric?.id;
    }

    // Record the open event in detailed metrics
    if (actualMetricId) {
      await recordNotificationOpened(actualMetricId);
    }

    // Track the open event (legacy rich push tracking)
    await trackRichPushOpened(campaignId, customerId);

    // Log the event for analytics
    if (token) {
      const pushToken = await db.pushToken.findFirst({
        where: { token },
      });

      if (pushToken) {
        await db.eventLog.create({
          data: {
            merchantId: pushToken.merchantId,
            type: 'NOTIFICATION_OPENED',
            payload: JSON.stringify({
              campaignId,
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
    console.error("Error tracking notification opened:", error);
    return handleMobileError(error);
  }
};
