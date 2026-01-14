/**
 * Mobile Image Load Tracking Endpoint
 * 
 * Requirements: 9.9
 * 
 * POST /api/mobile/image-load
 * 
 * Tracks when an image in a rich push notification loads successfully or fails
 */

import type { ActionFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { trackImageLoad } from "../services/rich-media-tracking.server";
import db from "../db.server";

/**
 * POST /api/mobile/image-load
 * 
 * Request Body:
 * {
 *   "campaignId": "campaign_id",
 *   "customerId": "customer_id",
 *   "token": "expo_push_token",
 *   "success": true,
 *   "imageUrl": "https://...",
 *   "errorMessage": "Failed to load image", // optional, if success=false
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
    const { campaignId, customerId, token, success, imageUrl, errorMessage, timestamp } = body;

    // Validate required fields
    if (!campaignId) {
      return mobileJson(
        { error: "Campaign ID is required" },
        400
      );
    }

    if (typeof success !== 'boolean') {
      return mobileJson(
        { error: "success field is required and must be a boolean" },
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

    // Track the image load event
    if (customerId) {
      await trackImageLoad(campaignId, customerId, success);
    }

    // Log the event for analytics
    if (token) {
      const pushToken = await db.pushToken.findFirst({
        where: { token },
      });

      if (pushToken) {
        await db.eventLog.create({
          data: {
            merchantId: pushToken.merchantId,
            type: 'RICH_MEDIA_IMAGE_LOAD',
            payload: JSON.stringify({
              campaignId,
              customerId,
              success,
              imageUrl,
              errorMessage: success ? undefined : errorMessage,
              timestamp: timestamp || new Date().toISOString(),
            }),
          },
        });
      }
    }

    return mobileJson({ success: true });
  } catch (error: any) {
    console.error("Error tracking image load:", error);
    return handleMobileError(error);
  }
};
