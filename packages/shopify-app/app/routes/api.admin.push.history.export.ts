import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const merchantId = session.shop;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const search = url.searchParams.get("search") || "";

  // Build where clause
  const where: any = { merchantId };

  if (status !== "all") {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { body: { contains: search, mode: "insensitive" } },
    ];
  }

  // Get all campaigns matching filters (no pagination for export)
  const campaigns = await prisma.pushCampaign.findMany({
    where,
    orderBy: { sentAt: "desc" },
    include: {
      abTest: true,
    },
    take: 1000, // Limit to prevent memory issues
  });

  // Generate CSV
  const headers = [
    "Date",
    "Title",
    "Body",
    "Audience",
    "Status",
    "Sent",
    "Delivered",
    "Opened",
    "Clicked",
    "Converted",
    "Revenue",
    "Open Rate",
    "Click Rate",
    "Conversion Rate",
    "A/B Test",
    "Variant",
  ];

  const rows = campaigns.map((campaign) => {
    const sent = campaign.sentCount || 0;
    const opened = campaign.openedCount || 0;
    const clicked = campaign.clickedCount || 0;
    const converted = campaign.convertedCount || 0;
    const revenue = campaign.revenueGenerated || 0;

    const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(2) : "0";
    const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(2) : "0";
    const conversionRate = sent > 0 ? ((converted / sent) * 100).toFixed(2) : "0";

    return [
      campaign.sentAt ? new Date(campaign.sentAt).toISOString() : "",
      `"${campaign.title.replace(/"/g, '""')}"`,
      `"${campaign.body.replace(/"/g, '""')}"`,
      campaign.audience,
      campaign.status,
      sent,
      campaign.deliveredCount || 0,
      opened,
      clicked,
      converted,
      revenue.toFixed(2),
      `${openRate}%`,
      `${clickRate}%`,
      `${conversionRate}%`,
      campaign.abTestId ? "Yes" : "No",
      campaign.variant || "",
    ];
  });

  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="push-history-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
};
