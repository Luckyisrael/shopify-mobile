import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: any) => {
  const { session } = await authenticate.admin(request);

  const merchant = await db.merchant.findUnique({
    where: { shop: session.shop },
    include: {
      _count: {
        select: {
          pushTokens: true,
          eventLogs: true,
          automationJobs: true,
          customers: true
        }
      }
    }
  });

  if (!merchant) {
    throw new Response("Merchant not found", { status: 404 });
  }

  // Get analytics data
  const [
    pushStats,
    eventStats,
    customerStats,
    jobStats
  ] = await Promise.all([
    // Push notification stats (last 30 days)
    db.eventLog.groupBy({
      by: ['type'],
      where: {
        merchantId: merchant.id,
        type: 'PUSH_REQUESTED',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      _count: true
    }),
    
    // Event breakdown
    db.eventLog.groupBy({
      by: ['type'],
      where: {
        merchantId: merchant.id,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      _count: true
    }),
    
    // Customer activity
    db.customerProfile.findMany({
      where: {
        merchantId: merchant.id,
        lastSeenAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      select: { lastSeenAt: true }
    }),
    
    // Job success rate
    db.automationJob.groupBy({
      by: ['status'],
      where: {
        merchantId: merchant.id,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      _count: true
    })
  ]);

  return {
    totals: {
      devices: merchant._count.pushTokens,
      customers: merchant._count.customers,
      events: merchant._count.eventLogs,
      jobs: merchant._count.automationJobs
    },
    pushStats,
    eventStats,
    customerStats: customerStats.length,
    jobStats
  };
};

export default function AnalyticsPage() {
  const { totals, pushStats, eventStats, customerStats, jobStats } = useLoaderData<typeof loader>();

  const successRate = jobStats.reduce((acc, stat) => {
    if (stat.status === 'COMPLETED') return acc + stat._count;
    return acc;
  }, 0) / jobStats.reduce((acc, stat) => acc + stat._count, 0) * 100;

  return (
    <s-page heading="Analytics">
      <s-stack direction="block" gap="base">
        
        {/* Overview Cards */}
        <s-section heading="Overview (Last 30 Days)">
          <s-stack direction="inline" gap="base">
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text type="strong">{totals.devices}</s-text>
                <s-text>Active Devices</s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text type="strong">{totals.customers}</s-text>
                <s-text>Total Customers</s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text type="strong">{customerStats}</s-text>
                <s-text>Active This Week</s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text type="strong">{successRate.toFixed(1)}%</s-text>
                <s-text>Job Success Rate</s-text>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>

        {/* Event Breakdown */}
        <s-section heading="Event Activity">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
            <s-stack direction="block" gap="base">
              {eventStats.map(stat => (
                <s-stack key={stat.type} direction="inline">
                  <s-text>{stat.type.replace(/_/g, ' ')}</s-text>
                  <s-text type="strong">{stat._count}</s-text>
                </s-stack>
              ))}
            </s-stack>
          </s-box>
        </s-section>

        {/* Job Performance */}
        <s-section heading="Automation Performance">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
            <s-stack direction="block" gap="base">
              {jobStats.map(stat => (
                <s-stack key={stat.status} direction="inline">
                  <s-text>{stat.status}</s-text>
                  <s-text type="strong">{stat._count}</s-text>
                </s-stack>
              ))}
            </s-stack>
          </s-box>
        </s-section>

      </s-stack>
    </s-page>
  );
}