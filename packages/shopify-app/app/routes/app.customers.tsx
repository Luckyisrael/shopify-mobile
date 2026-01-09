import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const merchant = await db.merchant.findUnique({
    where: { shop: session.shop },
    include: {
      customers: {
        orderBy: { lastSeenAt: 'desc' },
        take: 10 // Show recent 10 customers
      },
      customerSessions: {
        where: {
          expiresAt: { gt: new Date() } // Active sessions only
        }
      }
    }
  });

  if (!merchant) {
    return { 
      totalCustomers: 0, 
      activeCustomers24h: 0, 
      activeSessions: 0, 
      recentCustomers: [] 
    };
  }

  // Calculate 24h active customers
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activeCustomers24h = await db.customerProfile.count({
    where: {
      merchantId: merchant.id,
      lastSeenAt: { gte: yesterday }
    }
  });

  return {
    totalCustomers: merchant.customers.length,
    activeCustomers24h,
    activeSessions: merchant.customerSessions.length,
    recentCustomers: merchant.customers.map(customer => ({
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      lastSeenAt: customer.lastSeenAt,
      createdAt: customer.createdAt
    }))
  };
};

export default function CustomersPage() {
  const { totalCustomers, activeCustomers24h, activeSessions, recentCustomers } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Customer Health">
      <s-stack direction="block" gap="base">
        
        {/* Customer Stats */}
        <s-section heading="Customer Statistics">
          <s-stack direction="inline" gap="base">
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text tone="neutral">Total Customers</s-text>
                <s-text>{totalCustomers}</s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text tone="neutral">Active (24h)</s-text>
                <s-text>{activeCustomers24h}</s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                <s-text tone="neutral">Active Sessions</s-text>
                <s-text>{activeSessions}</s-text>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>

        {/* Recent Customers */}
        <s-section heading="Recent Customer Activity">
          {recentCustomers.length === 0 ? (
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-text tone="neutral">No customers yet. Customers will appear here once they sign up through your mobile app.</s-text>
            </s-box>
          ) : (
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="base">
                {recentCustomers.map((customer) => (
                  <s-stack key={customer.id} direction="block" gap="base">
                    <s-text>
                      {customer.firstName && customer.lastName 
                        ? `${customer.firstName} ${customer.lastName}` 
                        : customer.email}
                    </s-text>
                    <s-text tone="neutral">{customer.email}</s-text>
                    <s-text tone="neutral">
                      Last seen: {new Date(customer.lastSeenAt).toLocaleDateString()} | 
                      Joined: {new Date(customer.createdAt).toLocaleDateString()}
                    </s-text>
                  </s-stack>
                ))}
              </s-stack>
            </s-box>
          )}
        </s-section>

        {/* Info Banner */}
        <s-banner heading="Customer Privacy" tone="info">
          This section shows read-only customer statistics and recent activity. 
          No customer data can be edited or exported from this interface. 
          All customer management is handled through Shopify's native customer system.
        </s-banner>

      </s-stack>
    </s-page>
  );
}