/**
 * Campaign Button Performance API Endpoint
 * 
 * Requirements: 9.8
 * 
 * GET /api/admin/campaigns/:campaignId/buttons
 * 
 * Provides detailed performance metrics for action buttons in a campaign
 */

import type { LoaderFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { authenticate } from "../shopify.server";
import { getButtonPerformance } from "../services/notification-metrics.server";
import db from "../db.server";

/**
 * GET /api/admin/campaigns/:campaignId/buttons
 * 
 * Response:
 * {
 *   "campaignId": "...",
 *   "campaignTitle": "...",
 *   "totalOpens": 1000,
 *   "buttons": [
 *     {
 *       "buttonText": "Shop Now",
 *       "totalClicks": 120,
 *       "clickRate": 12.0,
 *       "conversions": 15,
 *       "conversionRate": 12.5
 *     },
 *     {
 *       "buttonText": "Learn More",
 *       "totalClicks": 80,
 *       "clickRate": 8.0,
 *       "conversions": 5,
 *       "conversionRate": 6.25
 *     }
 *   ]
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

    // Get total opens for the campaign
    const totalOpens = await db.notificationMetric.count({
      where: {
        campaignId,
        openedAt: { not: null }
      }
    });

    // Get button performance
    const buttons = await getButtonPerformance(campaignId);

    return mobileJson({
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      totalOpens,
      buttons
    });
  } catch (error: any) {
    console.error("Error fetching button performance:", error);
    return handleMobileError(error);
  }
};
