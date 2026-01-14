/**
 * Rich vs Standard Push Comparison API Endpoint
 * 
 * Requirements: 9.9
 * 
 * GET /api/admin/rich-comparison?startDate=...&endDate=...
 * 
 * Compares performance of rich push notifications vs standard push
 */

import type { LoaderFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { authenticate } from "../shopify.server";
import { compareRichVsStandard } from "../services/rich-media-tracking.server";

/**
 * GET /api/admin/rich-comparison
 * 
 * Query Parameters:
 * - startDate: ISO date string
 * - endDate: ISO date string
 * 
 * Response:
 * {
 *   "period": {
 *     "startDate": "2024-01-01T00:00:00.000Z",
 *     "endDate": "2024-01-31T23:59:59.999Z"
 *   },
 *   "richCampaigns": {
 *     "count": 25,
 *     "avgOpenRate": 48.5,
 *     "avgClickRate": 15.2,
 *     "avgConversionRate": 4.1,
 *     "avgRevenue": 125.50
 *   },
 *   "standardCampaigns": {
 *     "count": 50,
 *     "avgOpenRate": 42.1,
 *     "avgClickRate": 10.5,
 *     "avgConversionRate": 2.8,
 *     "avgRevenue": 85.25
 *   },
 *   "improvement": {
 *     "openRate": 15.2,
 *     "clickRate": 44.8,
 *     "conversionRate": 46.4,
 *     "revenue": 47.2
 *   }
 * }
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Authenticate the request
    const { session } = await authenticate.admin(request);
    const merchantId = session.shop;

    // Parse query parameters
    const url = new URL(request.url);
    const startDateStr = url.searchParams.get("startDate");
    const endDateStr = url.searchParams.get("endDate");

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

    // Get comparison data
    const comparison = await compareRichVsStandard(merchantId, startDate, endDate);

    return mobileJson(comparison);
  } catch (error: any) {
    console.error("Error fetching rich vs standard comparison:", error);
    return handleMobileError(error);
  }
};
