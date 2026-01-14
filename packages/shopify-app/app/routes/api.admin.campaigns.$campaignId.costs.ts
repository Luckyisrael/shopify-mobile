/**
 * Campaign Cost Metrics API Endpoint
 * 
 * Requirements: 9.10
 * 
 * GET /api/admin/campaigns/:campaignId/costs
 * 
 * Provides detailed cost and ROI metrics for a campaign
 */

import type { LoaderFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { authenticate } from "../shopify.server";
import { getCampaignCostMetrics } from "../services/cost-tracking.server";
import db from "../db.server";

/**
 * GET /api/admin/campaigns/:campaignId/costs
 * 
 * Response:
 * {
 *   "campaignId": "...",
 *   "campaignTitle": "...",
 *   "totalCost": 10.00,
 *   "costPerSend": 0.01,
 *   "costPerClick": 0.08,
 *   "costPerConversion": 2.50,
 *   "totalSent": 1000,
 *   "totalClicks": 120,
 *   "totalConversions": 4,
 *   "totalRevenue": 250.00,
 *   "roi": 2400.00,
 *   "roas": 25.00,
 *   "profitMargin": 96.00,
 *   "breakEvenConversions": 4
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

    // Get cost metrics
    const metrics = await getCampaignCostMetrics(campaignId);

    return mobileJson(metrics);
  } catch (error: any) {
    console.error("Error fetching campaign cost metrics:", error);
    return handleMobileError(error);
  }
};
