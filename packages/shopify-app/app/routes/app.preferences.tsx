/**
 * Customer Notification Preferences Dashboard
 * 
 * Displays aggregate preference statistics for merchants to understand
 * customer notification preferences and opt-out rates.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getPreferenceStats } from "../services/customer-preferences.server";

// ============================================================================
// Loader
// ============================================================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  const merchant = await prisma.merchant.findUnique({
    where: { shop },
  });

  if (!merchant) {
    throw new Response("Merchant not found", { status: 404 });
  }

  const stats = await getPreferenceStats(merchant.id);

  return { stats };
};

// ============================================================================
// Component
// ============================================================================

export default function PreferencesPage() {
  const { stats } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Customer Notification Preferences">
      <s-stack direction="block" gap="base">
        {/* Overview Banner */}
        <s-section>
          <s-banner tone="info">
            <p>
              Customer preferences help you send notifications at the right time
              and frequency. Respecting preferences improves engagement and
              reduces opt-outs.
            </p>
          </s-banner>
        </s-section>

        {/* Summary Stats */}
        <s-section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
            <s-section>
              <s-stack direction="block" gap="base">
                <s-text>
                  Total Customers
                </s-text>
                <s-text>
                  {stats.totalCustomers.toLocaleString()}
                </s-text>
                <s-text>
                  With preference settings
                </s-text>
              </s-stack>
            </s-section>

            <s-section>
              <s-stack direction="block" gap="base">
                <s-text>
                  Quiet Hours Users
                </s-text>
                <s-text>
                  {stats.quietHoursUsers.toLocaleString()}
                </s-text>
                <s-text>
                  {stats.totalCustomers > 0
                    ? `${((stats.quietHoursUsers / stats.totalCustomers) * 100).toFixed(1)}% of customers`
                    : "0% of customers"}
                </s-text>
              </s-stack>
            </s-section>

            <s-section>
              <s-stack direction="block" gap="base">
                <s-text>
                  Avg Daily Limit
                </s-text>
                <s-text>
                  {stats.averageMaxDaily.toFixed(1)}
                </s-text>
                <s-text>
                  Notifications per day
                </s-text>
              </s-stack>
            </s-section>

            <s-section>
              <s-stack direction="block" gap="base">
                <s-text>
                  Highest Opt-Out
                </s-text>
                <s-text>
                  {Math.max(
                    stats.optOutRates.cart,
                    stats.optOutRates.order,
                    stats.optOutRates.promotional,
                    stats.optOutRates.highlights
                  ).toFixed(1)}
                  %
                </s-text>
                <s-text>
                  {getHighestOptOutCategory(stats.optOutRates)}
                </s-text>
              </s-stack>
            </s-section>
          </div>
        </s-section>

        {/* Opt-Out Rates by Category */}
        <s-section>
          <s-section>
            <s-stack direction="block" gap="base">
              <s-text>
                Opt-Out Rates by Category
              </s-text>
              <s-text>
                Percentage of customers who have disabled each notification type
              </s-text>

              <s-stack direction="block" gap="base">
                {/* Cart Notifications */}
                <s-stack direction="block" gap="base">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <s-text>
                      Cart Notifications
                    </s-text>
                    <s-text>
                      {stats.optOutRates.cart.toFixed(1)}%
                    </s-text>
                  </div>
                  <div style={{ width: "100%", height: "8px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}>
                    <div style={{ 
                      width: `${stats.optOutRates.cart}%`, 
                      height: "100%", 
                      backgroundColor: getProgressColor(stats.optOutRates.cart),
                      borderRadius: "4px"
                    }} />
                  </div>
                </s-stack>

                {/* Order Notifications */}
                <s-stack direction="block" gap="base">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <s-text>
                      Order Notifications
                    </s-text>
                    <s-text>
                      {stats.optOutRates.order.toFixed(1)}%
                    </s-text>
                  </div>
                  <div style={{ width: "100%", height: "8px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}>
                    <div style={{ 
                      width: `${stats.optOutRates.order}%`, 
                      height: "100%", 
                      backgroundColor: getProgressColor(stats.optOutRates.order),
                      borderRadius: "4px"
                    }} />
                  </div>
                </s-stack>

                {/* Promotional Notifications */}
                <s-stack direction="block" gap="base">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <s-text>
                      Promotional Notifications
                    </s-text>
                    <s-text>
                      {stats.optOutRates.promotional.toFixed(1)}%
                    </s-text>
                  </div>
                  <div style={{ width: "100%", height: "8px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}>
                    <div style={{ 
                      width: `${stats.optOutRates.promotional}%`, 
                      height: "100%", 
                      backgroundColor: getProgressColor(stats.optOutRates.promotional),
                      borderRadius: "4px"
                    }} />
                  </div>
                </s-stack>

                {/* Product Highlights */}
                <s-stack direction="block" gap="base">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <s-text>
                      Product Highlights
                    </s-text>
                    <s-text>
                      {stats.optOutRates.highlights.toFixed(1)}%
                    </s-text>
                  </div>
                  <div style={{ width: "100%", height: "8px", backgroundColor: "#e0e0e0", borderRadius: "4px" }}>
                    <div style={{ 
                      width: `${stats.optOutRates.highlights}%`, 
                      height: "100%", 
                      backgroundColor: getProgressColor(stats.optOutRates.highlights),
                      borderRadius: "4px"
                    }} />
                  </div>
                </s-stack>
              </s-stack>
            </s-stack>
          </s-section>
        </s-section>

        {/* Insights and Recommendations */}
        <s-section>
          <s-section>
            <s-stack direction="block" gap="base">
              <s-text>
                Insights & Recommendations
              </s-text>

              {getInsights(stats).map((insight, index) => (
                <s-banner key={index} tone={insight.tone}>
                  <s-stack direction="block" gap="base">
                    <s-text>
                      {insight.title}
                    </s-text>
                    <s-text>
                      {insight.message}
                    </s-text>
                    {insight.actions && (
                      <ul>
                        {insight.actions.map((action, i) => (
                          <li key={i}>{action}</li>
                        ))}
                      </ul>
                    )}
                  </s-stack>
                </s-banner>
              ))}

              {getInsights(stats).length === 0 && (
                <s-banner tone="success">
                  <p>
                    Great job! Your notification preferences are well-balanced.
                    Keep monitoring opt-out rates to maintain high engagement.
                  </p>
                </s-banner>
              )}
            </s-stack>
          </s-section>
        </s-section>

        {/* Best Practices */}
        <s-section>
          <s-section>
            <s-stack direction="block" gap="base">
              <s-text>
                Best Practices
              </s-text>
              <ul>
                <li>
                  <strong>Respect quiet hours:</strong> Customers who set quiet
                  hours are more likely to engage when notifications arrive at
                  their preferred times.
                </li>
                <li>
                  <strong>Monitor opt-out rates:</strong> If a category exceeds
                  20% opt-out rate, consider reducing frequency or improving
                  content relevance.
                </li>
                <li>
                  <strong>Segment your audience:</strong> Use customer
                  preferences to create targeted campaigns that respect
                  individual choices.
                </li>
                <li>
                  <strong>Test and optimize:</strong> Use A/B testing to find
                  the right balance between engagement and respecting
                  preferences.
                </li>
                <li>
                  <strong>Provide value:</strong> Ensure every notification
                  provides clear value to reduce opt-outs.
                </li>
              </ul>
            </s-stack>
          </s-section>
        </s-section>
      </s-stack>
    </s-page>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getProgressTone(rate: number): "success" | "attention" | "critical" {
  if (rate < 10) return "success";
  if (rate < 20) return "attention";
  return "critical";
}

function getProgressColor(rate: number): string {
  if (rate < 10) return "#4caf50";
  if (rate < 20) return "#ff9800";
  return "#f44336";
}

function getHighestOptOutCategory(optOutRates: {
  cart: number;
  order: number;
  promotional: number;
  highlights: number;
}): string {
  const rates = [
    { name: "Cart", rate: optOutRates.cart },
    { name: "Order", rate: optOutRates.order },
    { name: "Promotional", rate: optOutRates.promotional },
    { name: "Highlights", rate: optOutRates.highlights },
  ];

  const highest = rates.reduce((prev, current) =>
    current.rate > prev.rate ? current : prev
  );

  return highest.name;
}

interface Insight {
  title: string;
  message: string;
  tone: "info" | "warning" | "critical" | "success";
  actions?: string[];
}

function getInsights(stats: {
  totalCustomers: number;
  optOutRates: {
    cart: number;
    order: number;
    promotional: number;
    highlights: number;
  };
  quietHoursUsers: number;
  averageMaxDaily: number;
}): Insight[] {
  const insights: Insight[] = [];

  // Check for high opt-out rates
  if (stats.optOutRates.promotional > 20) {
    insights.push({
      title: "High Promotional Opt-Out Rate",
      message: `${stats.optOutRates.promotional.toFixed(1)}% of customers have disabled promotional notifications. This is above the recommended threshold of 20%.`,
      tone: "critical",
      actions: [
        "Review promotional content for relevance",
        "Reduce promotional notification frequency",
        "Use A/B testing to optimize messaging",
        "Consider segmenting your audience for more targeted campaigns",
      ],
    });
  }

  if (stats.optOutRates.cart > 15) {
    insights.push({
      title: "Elevated Cart Notification Opt-Outs",
      message: `${stats.optOutRates.cart.toFixed(1)}% of customers have disabled cart notifications. Consider reviewing your cart recovery strategy.`,
      tone: "warning",
      actions: [
        "Ensure cart notifications are timely (not too frequent)",
        "Personalize cart recovery messages",
        "Test different timing strategies",
      ],
    });
  }

  // Check quiet hours adoption
  const quietHoursPercentage =
    stats.totalCustomers > 0
      ? (stats.quietHoursUsers / stats.totalCustomers) * 100
      : 0;

  if (quietHoursPercentage > 30) {
    insights.push({
      title: "High Quiet Hours Adoption",
      message: `${quietHoursPercentage.toFixed(1)}% of your customers use quiet hours. This indicates strong preference for time-based control.`,
      tone: "info",
      actions: [
        "Consider using send time optimization for better engagement",
        "Respect quiet hours to maintain customer trust",
      ],
    });
  }

  // Check average daily limit
  if (stats.averageMaxDaily < 3) {
    insights.push({
      title: "Low Daily Notification Limits",
      message: `Customers have set an average daily limit of ${stats.averageMaxDaily.toFixed(1)} notifications. This suggests preference for less frequent communication.`,
      tone: "info",
      actions: [
        "Prioritize high-value notifications",
        "Combine multiple updates into digest notifications",
        "Focus on quality over quantity",
      ],
    });
  }

  return insights;
}
