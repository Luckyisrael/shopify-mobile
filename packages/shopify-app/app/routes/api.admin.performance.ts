/**
 * Performance Comparison API Endpoint
 * 
 * Requirements: 9.6, 9.7, 9.11, 9.12
 * 
 * GET /api/admin/performance?type=rankings|trends|distribution|benchmark
 * 
 * Provides campaign performance comparisons, rankings, and trend analysis
 */

import type { LoaderFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { authenticate } from "../shopify.server";
import {
  rankCampaignsByEngagement,
  rankCampaignsByRevenue,
  analyzeTrends,
  getTimeToOpenDistribution,
  compareToBenchmark
} from "../services/performance-comparison.server";

/**
 * GET /api/admin/performance
 * 
 * Query Parameters:
 * - type: 'rankings' | 'trends' | 'distribution' | 'benchmark'
 * - rankBy: 'engagement' | 'revenue' (for rankings type)
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - limit: number (for rankings, default 20)
 * 
 * Response varies by type:
 * 
 * Rankings:
 * {
 *   "rankings": [
 *     {
 *       "campaignId": "...",
 *       "campaignTitle": "...",
 *       "rank": 1,
 *       "engagementScore": 85.5,
 *       "openRate": 45.2,
 *       "clickRate": 12.3,
 *       "conversionRate": 3.5,
 *       "totalRevenue": 1250.00
 *     }
 *   ]
 * }
 * 
 * Trends:
 * {
 *   "trends": [
 *     {
 *       "metric": "openRate",
 *       "currentPeriod": 45.2,
 *       "previousPeriod": 42.1,
 *       "change": 7.36,
 *       "trend": "up",
 *       "dataPoints": [...]
 *     }
 *   ]
 * }
 * 
 * Distribution:
 * {
 *   "distributions": [
 *     {
 *       "campaignId": "...",
 *       "campaignTitle": "...",
 *       "percentiles": {
 *         "p10": 2.5,
 *         "p25": 5.0,
 *         "p50": 15.0,
 *         "p75": 45.0,
 *         "p90": 120.0
 *       },
 *       "average": 35.2,
 *       "median": 15.0
 *     }
 *   ]
 * }
 * 
 * Benchmark:
 * {
 *   "benchmarks": [
 *     {
 *       "metric": "Open Rate",
 *       "merchantValue": 45.2,
 *       "merchantAverage": 42.1,
 *       "industryAverage": 42.1,
 *       "percentile": 75,
 *       "status": "above_average"
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
    const type = url.searchParams.get("type") || "rankings";
    const rankBy = url.searchParams.get("rankBy") || "engagement";
    const startDateStr = url.searchParams.get("startDate");
    const endDateStr = url.searchParams.get("endDate");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    // Validate and parse dates
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
      case "rankings": {
        const rankings = rankBy === "revenue"
          ? await rankCampaignsByRevenue(merchantId, startDate, endDate, limit)
          : await rankCampaignsByEngagement(merchantId, startDate, endDate, limit);

        return mobileJson({ rankings });
      }

      case "trends": {
        // Calculate previous period (same duration as current period)
        const duration = endDate.getTime() - startDate.getTime();
        const previousEnd = new Date(startDate.getTime() - 1);
        const previousStart = new Date(previousEnd.getTime() - duration);

        const trends = await analyzeTrends(
          merchantId,
          startDate,
          endDate,
          previousStart,
          previousEnd
        );

        return mobileJson({ trends });
      }

      case "distribution": {
        const distributions = await getTimeToOpenDistribution(
          merchantId,
          startDate,
          endDate
        );

        return mobileJson({ distributions });
      }

      case "benchmark": {
        const benchmarks = await compareToBenchmark(
          merchantId,
          startDate,
          endDate
        );

        return mobileJson({ benchmarks });
      }

      default:
        return mobileJson(
          { error: `Unknown type: ${type}. Use 'rankings', 'trends', 'distribution', or 'benchmark'` },
          400
        );
    }
  } catch (error: any) {
    console.error("Error fetching performance data:", error);
    return handleMobileError(error);
  }
};
