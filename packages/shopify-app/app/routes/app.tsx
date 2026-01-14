import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { Breadcrumbs } from "../components/Breadcrumbs";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        {/* Dashboard */}
        <s-link href="/app">Dashboard</s-link>

        {/* Analytics & Insights */}
        <s-link href="/app/analytics" >Analytics</s-link>
        <s-link href="/app/analytics/enhanced" >Enhanced Analytics</s-link>

        {/* Push Notifications */}
        <s-link href="/app/additional" >Send Push</s-link>
        <s-link href="/app/push/rich" >Rich Push</s-link>
        <s-link href="/app/push/ab-test" >A/B Testing</s-link>
        <s-link href="/app/push/history" >Push History</s-link>

        {/* Engagement */}
        <s-link href="/app/reengagement" >Re-engagement</s-link>
        <s-link href="/app/preferences" >Customer Preferences</s-link>

        {/* Content */}
        <s-link href="/app/highlights" >Product Stories</s-link>
        <s-link href="/app/templates" >Templates</s-link>

        {/* Automation */}
        <s-link href="/app/automation" >Automation</s-link>

        {/* Management */}
        <s-link href="/app/customers" >Customers</s-link>
        <s-link href="/app/setup" >Setup</s-link>
        <s-link href="/app/billing" >Billing</s-link>
        <s-link href="/app/settings" >Settings</s-link>
        <s-link href="/app/feature-flags" >Feature Flags</s-link>
        <s-link href="/app/cache" >Cache</s-link>

        {/* Documentation */}
        <s-link href="/api/docs" >API Docs</s-link>

      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
