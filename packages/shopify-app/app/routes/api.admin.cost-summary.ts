/**
 * Cost Summary API Endpoint
 * 
 * Requirements: 9.10
 * 
 * GET /api/admin/cost-summary?startDate=...&endDate=...&type=summary|efficiency
 * 
 * Provides cost summary and campaign efficiency rankings
 */

import type { LoaderFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { authenticate } from "../shopify.server";
import {
  getCostSummary,
  rankCampaignsByEfficiency
} from "../services/cost-tracking.server";

/**
 * GET /api/admin/cost-summary
 * 
 * Query Parameters:
 * - type: 'summary' | 'efficiency'
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - limit: number (for efficiency rankings, default 20)
 * 
 * Response (type=summary):
 * {
 *   "period": {
 *     "startDate": "2024-01-01T00:00:00.000Z",
 *     "endDate": "2024-01-31T23:59:59.999Z"
 *   },
 *   "totalSpent": 100.00,
 *   "totalRevenue": 2500.00,
 *   "totalProfit": 2400.00,
 *   "overallROI": 2400.00,
 *   "overallROAS": 25.00,
 *   "avgCostPerSend": 0.01,
 *   "avgCostPerClick": 0.08,
 *   "avgCostPerConversion": 2.50,
 *   "campaignCount": 10,
 *   "profitableCampaigns": 8,
 *   "unprofitableCampaigns": 2
 * }
 * 
 * Response (type=efficiency):
 * {
 *   "rankings": [
 *     {
 *       "campaignId": "...",
 *       "campaignTitle": "...",
 *       "costPerConversion": 2.50,
 *       "roi": 2400.00,
 *       "roas": 25.00,
 *       "rank": 1
 *     }
 *   ]
 * }
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Authenticate the request
    const { session } = await authenticate.admin(request);
    const merchantId = session.shop;

    // Parse query parameters
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "summary";
    const startDateStr = url.searchParams.get("startDate");
    const endDateStr = url.searchParams.get("endDate");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    // Validate dates
    if (!startDateStr || !endDateStr) {
      return mobileJson(
        { error: "startDate and endDate are required" },
        400
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return mobileJson(
        { error: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)" },
        400
      );
    }

    // Handle different request types
    switch (type) {
      case "summary": {
        const summary = await getCostSummary(merchantId, startDate, endDate);
        return mobileJson(summary);
      }

      case "efficiency": {
        const rankings = await rankCampaignsByEfficiency(
          merchantId,
          startDate,
          endDate,
          limit
        );
        return mobileJson({ rankings });
      }

      default:
        return mobileJson(
          { error: `Unknown type: ${type}. Use 'summary' or 'efficiency'` },
          400
        );
    }
  } catch (error: any) {
    console.error("Error fetching cost data:", error);
    return handleMobileError(error);
  }
};
