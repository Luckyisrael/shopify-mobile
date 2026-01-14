import type { ActionFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import prisma from "../db.server";

/**
 * Cleanup Job: Remove old push campaign history
 * 
 * This job should be run daily via cron to clean up campaigns older than 90 days.
 * 
 * Cron schedule: 0 2 * * * (2 AM daily)
 * 
 * Example cron setup:
 * curl -X POST https://your-app.com/api/jobs/cleanup-history \
 *   -H "X-Cron-Secret: your-secret-key"
 */

const RETENTION_DAYS = 90;

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return mobileJson({ error: "Method not allowed" }, 405);
  }

  // Verify cron secret
  const cronSecret = request.headers.get("X-Cron-Secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return mobileJson({ error: "Unauthorized" }, 401);
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    console.log(`[Cleanup] Starting cleanup of campaigns older than ${cutoffDate.toISOString()}`);

    // Archive campaigns before deletion (optional - store in separate table or export)
    const campaignsToDelete = await prisma.pushCampaign.findMany({
      where: {
        sentAt: {
          lt: cutoffDate,
        },
        status: "SENT", // Only delete completed campaigns
      },
      select: {
        id: true,
        title: true,
        sentAt: true,
      },
    });

    console.log(`[Cleanup] Found ${campaignsToDelete.length} campaigns to delete`);

    // Delete associated metrics first (cascade should handle this, but being explicit)
    const metricsDeleted = await prisma.notificationMetric.deleteMany({
      where: {
        campaignId: {
          in: campaignsToDelete.map((c) => c.id),
        },
      },
    });

    console.log(`[Cleanup] Deleted ${metricsDeleted.count} metric records`);

    // Delete campaigns
    const campaignsDeleted = await prisma.pushCampaign.deleteMany({
      where: {
        id: {
          in: campaignsToDelete.map((c) => c.id),
        },
      },
    });

    console.log(`[Cleanup] Deleted ${campaignsDeleted.count} campaigns`);

    // Also cleanup old event logs (optional)
    const eventLogsCutoff = new Date();
    eventLogsCutoff.setDate(eventLogsCutoff.getDate() - 180); // Keep event logs for 6 months

    const eventLogsDeleted = await prisma.eventLog.deleteMany({
      where: {
        createdAt: {
          lt: eventLogsCutoff,
        },
      },
    });

    console.log(`[Cleanup] Deleted ${eventLogsDeleted.count} old event logs`);

    return mobileJson({
      success: true,
      campaignsDeleted: campaignsDeleted.count,
      metricsDeleted: metricsDeleted.count,
      eventLogsDeleted: eventLogsDeleted.count,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    console.error("[Cleanup] Error during cleanup:", error);
    return handleMobileError(error);
  }
};
