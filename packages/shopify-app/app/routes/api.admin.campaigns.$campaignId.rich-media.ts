/**
 * Campaign Rich Media Metrics API Endpoint
 * 
 * Requirements: 9.9
 * 
 * GET /api/admin/campaigns/:campaignId/rich-media
 * 
 * Provides rich media performance metrics for a campaign
 */

import type { LoaderFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { authenticate } from "../shopify.server";
import { getRichMediaMetrics } from "../services/rich-media-tracking.server";
import db from "../db.server";

/**
 * GET /api/admin/campaigns/:campaignId/rich-media
 * 
 * Response:
 * {
 *   "campaignId": "...",
 *   "campaignTitle": "...",
 *   "hasRichMedia": true,
 *   "imageUrl": "https://...",
 *   "imageLoadAttempts": 1000,
 *   "imageLoadSuccesses": 950,
 *   "imageLoadFailures": 50,
 *   "imageLoadSuccessRate": 95.0,
 *   "totalSent": 1000,
 *   "richDelivered": 980,
 *   "richDeliveryRate": 98.0,
 *   "richOpenRate": 45.2,
 *   "richClickRate": 12.3,
 *   "richConversionRate": 3.5
 * }
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    // Authenticate the request
    const { session } = await authenticate.admin(request);
    const merchantId = session.shop;

    const { campaignId } = params;

    if (!campaignId) {
      return mobileJson(
        { error: "Campaign ID is required" },
        400
      );
    }

    // Verify campaign exists and belongs to merchant
    const campaign = await db.pushCampaign.findFirst({
      where: {
        id: campaignId,
        merchantId
      }
    });

    if (!campaign) {
      return mobileJson(
        { error: "Campaign not found" },
        404
      );
    }

    // Get rich media metrics
    const metrics = await getRichMediaMetrics(campaignId);

    return mobileJson(metrics);
  } catch (error: any) {
    console.error("Error fetching rich media metrics:", error);
    return handleMobileError(error);
  }
};
