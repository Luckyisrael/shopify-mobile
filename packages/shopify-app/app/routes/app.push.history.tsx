import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, useNavigate } from "react-router";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

interface CampaignRow {
  id: string;
  date: string;
  title: string;
  audience: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  openRate: string;
  clickRate: string;
  status: string;
}

interface CampaignDetail {
  id: string;
  title: string;
  body: string;
  sentAt: string;
  audience: string;
  recipientCount: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  revenue: number;
  imageUrl?: string;
  deepLink?: string;
  actionButtons?: string;
  status: string;
  errorMessage?: string;
  abTestId?: string;
  variant?: string;
  automationRuleId?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const merchantId = session.shop;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const status = url.searchParams.get("status") || "all";
  const search = url.searchParams.get("search") || "";

  const skip = (page - 1) * limit;

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

  // Get campaigns with metrics
  const [campaigns, total] = await Promise.all([
    prisma.pushCampaign.findMany({
      where,
      skip,
      take: limit,
      orderBy: { sentAt: "desc" },
      include: {
        metrics: true,
        abTest: true,
      },
    }),
    prisma.pushCampaign.count({ where }),
  ]);

  const pages = Math.ceil(total / limit);

  return {
    campaigns,
    total,
    page,
    pages,
    limit,
  };
};

export default function PushHistory() {
  const { campaigns, total, page, pages } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  const [modalActive, setModalActive] = useState(false);

  const statusFilter = searchParams.get("status") || "all";
  const searchQuery = searchParams.get("search") || "";

  const handleStatusChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("status", value);
      params.set("page", "1");
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set("search", value);
      } else {
        params.delete("search");
      }
      params.set("page", "1");
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set("page", newPage.toString());
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const handleExport = useCallback(async () => {
    const params = new URLSearchParams(searchParams);
    window.open(`/api/admin/push/history/export?${params.toString()}`, "_blank");
  }, [searchParams]);

  const handleRowClick = useCallback((campaign: any) => {
    const detail: CampaignDetail = {
      id: campaign.id,
      title: campaign.title,
      body: campaign.body,
      sentAt: campaign.sentAt ? new Date(campaign.sentAt).toLocaleString() : "Not sent",
      audience: campaign.audience,
      recipientCount: campaign.recipientCount || 0,
      sent: campaign.metrics?.sent || 0,
      delivered: campaign.metrics?.delivered || 0,
      opened: campaign.metrics?.opened || 0,
      clicked: campaign.metrics?.clicked || 0,
      converted: campaign.metrics?.conversions || 0,
      revenue: campaign.metrics?.revenue || 0,
      imageUrl: campaign.imageUrl,
      deepLink: campaign.deepLink,
      actionButtons: campaign.actionButtons,
      status: campaign.status,
      errorMessage: campaign.errorMessage,
      abTestId: campaign.abTestId,
      variant: campaign.variant,
      automationRuleId: campaign.automationRuleId,
    };
    setSelectedCampaign(detail);
    setModalActive(true);
  }, []);

  const handleResend = useCallback(async () => {
    if (!selectedCampaign) return;
    
    // Navigate to push notification form with pre-filled data
    navigate(`/app/additional?resend=${selectedCampaign.id}`);
  }, [selectedCampaign, navigate]);

  // Transform campaigns for display
  const rows: CampaignRow[] = campaigns.map((campaign: any) => {
    const metrics = campaign.metrics || {};
    const sent = metrics.sent || 0;
    const opened = metrics.opened || 0;
    const clicked = metrics.clicked || 0;
    const delivered = metrics.delivered || 0;

    return {
      id: campaign.id,
      date: campaign.sentAt
        ? new Date(campaign.sentAt).toLocaleDateString()
        : "Not sent",
      title: campaign.title,
      audience: campaign.audience,
      sent,
      delivered,
      opened,
      clicked,
      openRate: sent > 0 ? `${((opened / sent) * 100).toFixed(1)}%` : "0%",
      clickRate: sent > 0 ? `${((clicked / sent) * 100).toFixed(1)}%` : "0%",
      status: campaign.status,
    };
  });

  return (
    <s-page heading="Push Notification History">
      <s-stack direction="block" gap="base">
        <s-section>
          <s-section>
            <s-stack direction="block" gap="base">
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <div style={{ flex: "1" }}>
                  <s-text-field
                    label=""
                    value={searchQuery}
                    onChange={(event: any) => handleSearchChange(event.detail.value)}
                    placeholder="Search campaigns..."
                  />
                </div>
                <div style={{ width: "200px" }}>
                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="SENT">Sent</option>
                    <option value="SENDING">Sending</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="DRAFT">Draft</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                      <th style={{ padding: "0.75rem", textAlign: "left" }}>Date</th>
                      <th style={{ padding: "0.75rem", textAlign: "left" }}>Title</th>
                      <th style={{ padding: "0.75rem", textAlign: "left" }}>Audience</th>
                      <th style={{ padding: "0.75rem", textAlign: "right" }}>Sent</th>
                      <th style={{ padding: "0.75rem", textAlign: "left" }}>Open Rate</th>
                      <th style={{ padding: "0.75rem", textAlign: "left" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr 
                        key={row.id}
                        onClick={() => handleRowClick(campaigns[index])}
                        style={{ 
                          borderBottom: "1px solid #e0e0e0",
                          cursor: "pointer",
                          transition: "background-color 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        <td style={{ padding: "0.75rem" }}>{row.date}</td>
                        <td style={{ padding: "0.75rem" }}>{row.title}</td>
                        <td style={{ padding: "0.75rem" }}>{row.audience}</td>
                        <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.sent}</td>
                        <td style={{ padding: "0.75rem" }}>{row.openRate}</td>
                        <td style={{ padding: "0.75rem" }}>
                          <s-badge
                            tone={
                              row.status === "SENT"
                                ? "success"
                                : row.status === "FAILED"
                                ? "critical"
                                : row.status === "SENDING"
                                ? "info"
                                : undefined
                            }
                          >
                            {row.status}
                          </s-badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem" }}>
                  <s-button
                    disabled={page === 1}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    Previous
                  </s-button>
                  <s-text>
                    Page {page} of {pages}
                  </s-text>
                  <s-button
                    disabled={page === pages}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    Next
                  </s-button>
                </div>
              )}
            </s-stack>
          </s-section>
        </s-section>
      </s-stack>

      {selectedCampaign && modalActive && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "2rem",
            borderRadius: "8px",
            maxWidth: "600px",
            maxHeight: "80vh",
            overflow: "auto",
            width: "90%"
          }}>
            <s-stack direction="block" gap="base">
              <s-text>{selectedCampaign.title}</s-text>
              
              <s-stack direction="block" gap="base">
                <s-text>
                  {selectedCampaign.body}
                </s-text>
              </s-stack>

              <s-stack direction="block" gap="base">
                <s-text>
                  <strong>Sent:</strong> {selectedCampaign.sentAt}
                </s-text>
                <s-text>
                  <strong>Audience:</strong> {selectedCampaign.audience} (
                  {selectedCampaign.recipientCount} customers)
                </s-text>
                {selectedCampaign.abTestId && (
                  <s-text>
                    <strong>A/B Test:</strong> Variant {selectedCampaign.variant}
                  </s-text>
                )}
                {selectedCampaign.automationRuleId && (
                  <s-text>
                    <strong>Automation:</strong> Triggered by automation rule
                  </s-text>
                )}
              </s-stack>

              <s-stack direction="block" gap="base">
                <s-text>
                  Performance
                </s-text>
                <s-text>
                  • Sent: {selectedCampaign.sent}
                </s-text>
                <s-text>
                  • Delivered: {selectedCampaign.delivered} (
                  {selectedCampaign.sent > 0
                    ? ((selectedCampaign.delivered / selectedCampaign.sent) * 100).toFixed(1)
                    : 0}
                  %)
                </s-text>
                <s-text>
                  • Opened: {selectedCampaign.opened} (
                  {selectedCampaign.sent > 0
                    ? ((selectedCampaign.opened / selectedCampaign.sent) * 100).toFixed(1)
                    : 0}
                  %)
                </s-text>
                <s-text>
                  • Clicked: {selectedCampaign.clicked} (
                  {selectedCampaign.sent > 0
                    ? ((selectedCampaign.clicked / selectedCampaign.sent) * 100).toFixed(1)
                    : 0}
                  %)
                </s-text>
                <s-text>
                  • Converted: {selectedCampaign.converted} (
                  {selectedCampaign.sent > 0
                    ? ((selectedCampaign.converted / selectedCampaign.sent) * 100).toFixed(1)
                    : 0}
                  %)
                </s-text>
                <s-text>
                  • Revenue: ${selectedCampaign.revenue.toFixed(2)}
                </s-text>
              </s-stack>

              {selectedCampaign.imageUrl && (
                <s-stack direction="block" gap="base">
                  <s-text>
                    Rich Media
                  </s-text>
                  <s-text>
                    <strong>Image:</strong> {selectedCampaign.imageUrl}
                  </s-text>
                </s-stack>
              )}

              {selectedCampaign.deepLink && (
                <s-text>
                  <strong>Deep Link:</strong> {selectedCampaign.deepLink}
                </s-text>
              )}

              {selectedCampaign.status === "FAILED" && selectedCampaign.errorMessage && (
                <s-stack direction="block" gap="base">
                  <s-text>
                    Error Details
                  </s-text>
                  <s-text>
                    {selectedCampaign.errorMessage}
                  </s-text>
                </s-stack>
              )}

              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <s-button onClick={handleResend} variant="primary">
                  Resend
                </s-button>
                <s-button onClick={() => setModalActive(false)}>
                  Close
                </s-button>
              </div>
            </s-stack>
          </div>
        </div>
      )}
    </s-page>
  );
}
