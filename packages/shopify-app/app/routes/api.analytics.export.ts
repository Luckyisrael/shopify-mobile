import { type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { exportAnalytics } from "../services/analytics.server";

/**
 * API Endpoint: Export Analytics Data
 * GET /api/analytics/export?days=30
 * 
 * Exports analytics data as CSV for the specified date range
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const merchant = await db.merchant.findUnique({
    where: { shop: session.shop }
  });

  if (!merchant) {
    return new Response("Merchant not found", { status: 404 });
  }

  // Parse date range from query params or default to last 30 days
  const url = new URL(request.url);
  const daysParam = url.searchParams.get("days") || "30";
  const days = parseInt(daysParam, 10);
  
  const endDate = new Date();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Generate CSV export
    const csvContent = await exportAnalytics(merchant.id, startDate, endDate);

    // Return CSV file
    const filename = `analytics-export-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`;
    
    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache"
      }
    });
  } catch (error) {
    console.error("Error exporting analytics:", error);
    return new Response("Failed to export analytics", { status: 500 });
  }
};
