import { useLoaderData, useSearchParams } from "react-router";
import { type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { 
  getDashboardMetrics, 
  getPushPerformance, 
  getHighlightAnalytics,
  getRevenueAttribution
} from "../services/analytics.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const merchant = await db.merchant.findUnique({
    where: { shop: session.shop }
  });

  if (!merchant) {
    throw new Response("Merchant not found", { status: 404 });
  }

  // Parse date range from query params or default to last 30 days
  const url = new URL(request.url);
  const daysParam = url.searchParams.get("days") || "30";
  const days = parseInt(daysParam, 10);
  
  const endDate = new Date();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // Calculate previous period for comparison
  const prevEndDate = new Date(startDate);
  const prevStartDate = new Date(prevEndDate.getTime() - days * 24 * 60 * 60 * 1000);

  // Get current period metrics
  const [currentMetrics, pushPerformance, highlightAnalytics, revenueAttribution] = await Promise.all([
    getDashboardMetrics(merchant.id, startDate, endDate),
    getPushPerformance(merchant.id, startDate, endDate),
    getHighlightAnalytics(merchant.id, startDate, endDate),
    getRevenueAttribution(merchant.id, startDate, endDate)
  ]);

  // Get previous period metrics for comparison
  const previousMetrics = await getDashboardMetrics(merchant.id, prevStartDate, prevEndDate);

  return {
    currentMetrics,
    previousMetrics,
    pushPerformance,
    highlightAnalytics,
    revenueAttribution,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      days
    }
  };
};

export default function EnhancedAnalyticsPage() {
  const { currentMetrics, previousMetrics, pushPerformance, highlightAnalytics, revenueAttribution, dateRange } = 
    useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  // Calculate percentage changes
  const calculateChange = (current: number, previous: number): string => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  // Date range options
  const dateRangeOptions = [
    { label: "Last 7 days", value: "7" },
    { label: "Last 30 days", value: "30" },
    { label: "Last 90 days", value: "90" }
  ];

  const handleDateRangeChange = (days: string) => {
    setSearchParams({ days });
  };

  const handleExport = () => {
    // Trigger CSV download
    window.location.href = `/api/analytics/export?days=${dateRange.days}`;
  };

  return (
    <s-page heading="Enhanced Analytics">
      <s-stack direction="block" gap="base">
        
        {/* Date Range Selector and Export Button */}
        <s-section>
          <s-stack direction="inline" gap="base">
            <s-text type="strong">Date Range:</s-text>
            {dateRangeOptions.map(option => (
              <s-button
                key={option.value}
                variant={dateRange.days.toString() === option.value ? "primary" : "secondary"}
                onClick={() => handleDateRangeChange(option.value)}
              >
                {option.label}
              </s-button>
            ))}
            <s-button
              variant="secondary"
              onClick={handleExport}
            >
              Export CSV
            </s-button>
          </s-stack>
        </s-section>

        {/* Overview Metrics Cards */}
        <s-section heading="Customer Overview">
          <s-stack direction="inline" gap="base">
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text>Total Customers</s-text>
                <s-text type="strong">{currentMetrics.overview.totalCustomers.toLocaleString()}</s-text>
                <s-text tone={calculateChange(currentMetrics.overview.totalCustomers, previousMetrics.overview.totalCustomers).startsWith('+') ? "success" : "critical"}>
                  {calculateChange(currentMetrics.overview.totalCustomers, previousMetrics.overview.totalCustomers)} vs previous
                </s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text>Active Customers</s-text>
                <s-text type="strong">{currentMetrics.overview.activeCustomers.toLocaleString()}</s-text>
                <s-text tone={calculateChange(currentMetrics.overview.activeCustomers, previousMetrics.overview.activeCustomers).startsWith('+') ? "success" : "critical"}>
                  {calculateChange(currentMetrics.overview.activeCustomers, previousMetrics.overview.activeCustomers)} vs previous
                </s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text>New Customers</s-text>
                <s-text type="strong">{currentMetrics.overview.newCustomers.toLocaleString()}</s-text>
                <s-text tone={calculateChange(currentMetrics.overview.newCustomers, previousMetrics.overview.newCustomers).startsWith('+') ? "success" : "critical"}>
                  {calculateChange(currentMetrics.overview.newCustomers, previousMetrics.overview.newCustomers)} vs previous
                </s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text>Churn Rate</s-text>
                <s-text type="strong">{currentMetrics.overview.churnRate.toFixed(1)}%</s-text>
                <s-text tone={calculateChange(currentMetrics.overview.churnRate, previousMetrics.overview.churnRate).startsWith('-') ? "success" : "critical"}>
                  {calculateChange(currentMetrics.overview.churnRate, previousMetrics.overview.churnRate)} vs previous
                </s-text>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>

        {/* Push Notification Performance */}
        <s-section heading="Push Notification Performance">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text>Sent</s-text>
                  <s-text type="strong">{currentMetrics.pushNotifications.sent.toLocaleString()}</s-text>
                  <s-text tone={calculateChange(currentMetrics.pushNotifications.sent, previousMetrics.pushNotifications.sent).startsWith('+') ? "success" : "neutral"}>
                    {calculateChange(currentMetrics.pushNotifications.sent, previousMetrics.pushNotifications.sent)}
                  </s-text>
                </s-stack>
              </s-box>
              
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text>Delivered</s-text>
                  <s-text type="strong">{currentMetrics.pushNotifications.delivered.toLocaleString()}</s-text>
                  <s-text tone={calculateChange(currentMetrics.pushNotifications.delivered, previousMetrics.pushNotifications.delivered).startsWith('+') ? "success" : "neutral"}>
                    {calculateChange(currentMetrics.pushNotifications.delivered, previousMetrics.pushNotifications.delivered)}
                  </s-text>
                </s-stack>
              </s-box>
              
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text>Opened</s-text>
                  <s-text type="strong">{currentMetrics.pushNotifications.opened.toLocaleString()}</s-text>
                  <s-text tone={calculateChange(currentMetrics.pushNotifications.opened, previousMetrics.pushNotifications.opened).startsWith('+') ? "success" : "neutral"}>
                    {calculateChange(currentMetrics.pushNotifications.opened, previousMetrics.pushNotifications.opened)}
                  </s-text>
                </s-stack>
              </s-box>
              
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text>Clicked</s-text>
                  <s-text type="strong">{currentMetrics.pushNotifications.clicked.toLocaleString()}</s-text>
                  <s-text tone={calculateChange(currentMetrics.pushNotifications.clicked, previousMetrics.pushNotifications.clicked).startsWith('+') ? "success" : "neutral"}>
                    {calculateChange(currentMetrics.pushNotifications.clicked, previousMetrics.pushNotifications.clicked)}
                  </s-text>
                </s-stack>
              </s-box>
            </s-stack>

            {/* Performance Rates */}
            <s-stack direction="inline" gap="base">
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text>Open Rate</s-text>
                  <s-text type="strong">{currentMetrics.pushNotifications.openRate.toFixed(1)}%</s-text>
                  <s-text tone={calculateChange(currentMetrics.pushNotifications.openRate, previousMetrics.pushNotifications.openRate).startsWith('+') ? "success" : "critical"}>
                    {calculateChange(currentMetrics.pushNotifications.openRate, previousMetrics.pushNotifications.openRate)}
                  </s-text>
                </s-stack>
              </s-box>
              
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text>Click Rate</s-text>
                  <s-text type="strong">{currentMetrics.pushNotifications.clickRate.toFixed(1)}%</s-text>
                  <s-text tone={calculateChange(currentMetrics.pushNotifications.clickRate, previousMetrics.pushNotifications.clickRate).startsWith('+') ? "success" : "critical"}>
                    {calculateChange(currentMetrics.pushNotifications.clickRate, previousMetrics.pushNotifications.clickRate)}
                  </s-text>
                </s-stack>
              </s-box>
              
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text>Conversion Rate</s-text>
                  <s-text type="strong">{currentMetrics.pushNotifications.conversionRate.toFixed(1)}%</s-text>
                  <s-text tone={calculateChange(currentMetrics.pushNotifications.conversionRate, previousMetrics.pushNotifications.conversionRate).startsWith('+') ? "success" : "critical"}>
                    {calculateChange(currentMetrics.pushNotifications.conversionRate, previousMetrics.pushNotifications.conversionRate)}
                  </s-text>
                </s-stack>
              </s-box>
            </s-stack>
          </s-stack>
        </s-section>

        {/* Revenue Metrics */}
        <s-section heading="Revenue Attribution">
          <s-stack direction="inline" gap="base">
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text>Total Revenue</s-text>
                <s-text type="strong">${currentMetrics.revenue.total.toLocaleString()}</s-text>
                <s-text tone={calculateChange(currentMetrics.revenue.total, previousMetrics.revenue.total).startsWith('+') ? "success" : "critical"}>
                  {calculateChange(currentMetrics.revenue.total, previousMetrics.revenue.total)} vs previous
                </s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text>Attributed to Push</s-text>
                <s-text type="strong">${currentMetrics.revenue.attributed.toLocaleString()}</s-text>
                <s-text tone={calculateChange(currentMetrics.revenue.attributed, previousMetrics.revenue.attributed).startsWith('+') ? "success" : "critical"}>
                  {calculateChange(currentMetrics.revenue.attributed, previousMetrics.revenue.attributed)} vs previous
                </s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text>ROI</s-text>
                <s-text type="strong">{currentMetrics.revenue.roi.toFixed(0)}%</s-text>
                <s-text tone={calculateChange(currentMetrics.revenue.roi, previousMetrics.revenue.roi).startsWith('+') ? "success" : "critical"}>
                  {calculateChange(currentMetrics.revenue.roi, previousMetrics.revenue.roi)} vs previous
                </s-text>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>

        {/* Top Performing Campaigns */}
        {pushPerformance.topCampaigns.length > 0 && (
          <s-section heading="Top Performing Campaigns">
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                {pushPerformance.topCampaigns.slice(0, 5).map((campaign, index) => (
                  <s-stack key={campaign.id} direction="inline" gap="base">
                    <s-stack direction="inline" gap="base">
                      <s-text type="strong">{index + 1}.</s-text>
                      <s-stack direction="block" gap="base">
                        <s-text type="strong">{campaign.title}</s-text>
                        <s-text>{campaign.sent.toLocaleString()} sent</s-text>
                      </s-stack>
                    </s-stack>
                    <s-stack direction="inline" gap="base">
                      <s-stack direction="block" gap="base">
                        <s-text>Open Rate</s-text>
                        <s-text type="strong">{campaign.openRate.toFixed(1)}%</s-text>
                      </s-stack>
                      <s-stack direction="block" gap="base">
                        <s-text>Revenue</s-text>
                        <s-text type="strong">${campaign.revenue.toLocaleString()}</s-text>
                      </s-stack>
                    </s-stack>
                  </s-stack>
                ))}
              </s-stack>
            </s-box>
          </s-section>
        )}

        {/* Product Highlights Performance */}
        {highlightAnalytics.totalViews > 0 && (
          <s-section heading="Product Highlights Performance">
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="base">
                <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                  <s-stack direction="block" gap="base">
                    <s-text>Total Views</s-text>
                    <s-text type="strong">{highlightAnalytics.totalViews.toLocaleString()}</s-text>
                  </s-stack>
                </s-box>
                
                <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                  <s-stack direction="block" gap="base">
                    <s-text>Total Clicks</s-text>
                    <s-text type="strong">{highlightAnalytics.totalClicks.toLocaleString()}</s-text>
                  </s-stack>
                </s-box>
                
                <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                  <s-stack direction="block" gap="base">
                    <s-text>Click-Through Rate</s-text>
                    <s-text type="strong">{highlightAnalytics.clickThroughRate.toFixed(1)}%</s-text>
                  </s-stack>
                </s-box>
                
                <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                  <s-stack direction="block" gap="base">
                    <s-text>Conversions</s-text>
                    <s-text type="strong">{highlightAnalytics.totalConversions.toLocaleString()}</s-text>
                  </s-stack>
                </s-box>
              </s-stack>

              {highlightAnalytics.topHighlights.length > 0 && (
                <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                  <s-stack direction="block" gap="base">
                    <s-text type="strong">Top Highlights</s-text>
                    {highlightAnalytics.topHighlights.slice(0, 5).map((highlight, index) => (
                      <s-stack key={highlight.id} direction="inline" gap="base">
                        <s-stack direction="inline" gap="base">
                          <s-text type="strong">{index + 1}.</s-text>
                          <s-text>{highlight.title}</s-text>
                        </s-stack>
                        <s-stack direction="inline" gap="base">
                          <s-text>{highlight.views.toLocaleString()} views</s-text>
                          <s-text>{highlight.clicks.toLocaleString()} clicks</s-text>
                          <s-text type="strong">{highlight.clickRate.toFixed(1)}% CTR</s-text>
                        </s-stack>
                      </s-stack>
                    ))}
                  </s-stack>
                </s-box>
              )}
            </s-stack>
          </s-section>
        )}

        {/* Trend Charts */}
        {currentMetrics.trends.length > 0 && (
          <s-section heading="Performance Trends">
            <s-stack direction="block" gap="base">
              {/* Customer Trend Chart */}
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text type="strong">Customer Activity Over Time</s-text>
                  <s-stack direction="block" gap="base">
                    {currentMetrics.trends.map((trend) => (
                      <s-stack key={trend.date} direction="inline" gap="base">
                        <s-text>{new Date(trend.date).toLocaleDateString()}</s-text>
                        <s-stack direction="inline" gap="base">
                          <s-text>{trend.customers} customers</s-text>
                          <s-text>|</s-text>
                          <s-text>{trend.pushSent} notifications</s-text>
                          <s-text>|</s-text>
                          <s-text>${trend.revenue.toFixed(2)} revenue</s-text>
                        </s-stack>
                      </s-stack>
                    ))}
                  </s-stack>
                </s-stack>
              </s-box>

              {/* Visual Bar Chart for Trends */}
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text type="strong">Daily Revenue Trend</s-text>
                  <s-stack direction="block" gap="base">
                    {currentMetrics.trends.map((trend) => {
                      const maxRevenue = Math.max(...currentMetrics.trends.map(t => t.revenue));
                      const barWidth = maxRevenue > 0 ? (trend.revenue / maxRevenue) * 100 : 0;
                      return (
                        <s-stack key={trend.date} direction="inline" gap="base">
                          <s-text>{new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</s-text>
                          <div style={{ width: `${barWidth}%`, minWidth: '20px', backgroundColor: '#008060', padding: '8px', borderRadius: '4px' }}>
                            <s-text>${trend.revenue.toFixed(0)}</s-text>
                          </div>
                        </s-stack>
                      );
                    })}
                  </s-stack>
                </s-stack>
              </s-box>
            </s-stack>
          </s-section>
        )}

        {/* Revenue Attribution Bar Chart */}
        {revenueAttribution.length > 0 && (
          <s-section heading="Revenue Attribution by Campaign">
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text type="strong">Top Revenue Generating Campaigns</s-text>
                <s-stack direction="block" gap="base">
                  {revenueAttribution.slice(0, 10).map((attribution) => {
                    const maxRevenue = Math.max(...revenueAttribution.map(a => a.totalRevenue));
                    const barWidth = maxRevenue > 0 ? (attribution.totalRevenue / maxRevenue) * 100 : 0;
                    return (
                      <s-stack key={attribution.campaignId} direction="block" gap="base">
                        <s-stack direction="inline" gap="base">
                          <s-text type="strong">{attribution.campaignTitle}</s-text>
                          <s-text>${attribution.totalRevenue.toLocaleString()} ({attribution.conversions} conversions)</s-text>
                        </s-stack>
                        <s-stack direction="inline" gap="base">
                          <div style={{ width: `${barWidth}%`, minWidth: '40px', backgroundColor: '#2C6ECB', padding: '8px', borderRadius: '4px' }}>
                            <s-text>ROI: {attribution.roi.toFixed(0)}%</s-text>
                          </div>
                          <s-text>AOV: ${attribution.averageOrderValue.toFixed(2)}</s-text>
                        </s-stack>
                      </s-stack>
                    );
                  })}
                </s-stack>
              </s-stack>
            </s-box>
          </s-section>
        )}

      </s-stack>
    </s-page>
  );
}
