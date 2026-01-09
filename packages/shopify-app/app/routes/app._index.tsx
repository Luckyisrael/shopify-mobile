import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const [shopResponse, merchant] = await Promise.all([
    admin.graphql(
      `#graphql
        query getShopDetails {
          shop {
            name
            url
            email
            myshopifyDomain
            plan {
              displayName
              partnerDevelopment
              shopifyPlus
            }
          }
        }`,
    ),
    db.merchant.findUnique({
      where: { shop: session.shop },
      include: { mobileApps: true },
    }),
  ]);

  const shopJson = await shopResponse.json();

  return {
    shop: shopJson.data!.shop,
    merchant,
    mobileApp: merchant?.mobileApps[0] || null,
  };
};

export default function Index() {
  const { shop, merchant, mobileApp } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Shopify app template">
      <s-section heading="Current Store Details">
        <s-stack direction="block" gap="base">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="base"
          >
            <s-stack direction="block" >
              <s-text type="strong">{shop.name}</s-text>
              <s-stack direction="inline" >
                <s-text type="strong">Domain:</s-text>
                <s-text>{shop.myshopifyDomain}</s-text>
              </s-stack>
              <s-stack direction="inline" >
                <s-text type="strong">Email:</s-text>
                <s-text>{shop.email}</s-text>
              </s-stack>
              <s-stack direction="inline" >
                <s-text type="strong">Plan:</s-text>
                <s-text>{shop.plan.displayName} {shop.plan.partnerDevelopment ? '(Partner)' : ''}</s-text>
              </s-stack>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Mobile App Status">
        <s-stack direction="block" gap="base">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="transparent"
          >
            <s-stack direction="block" >
              <s-stack direction="inline" >
                <s-text type="strong">Mobile App Name:</s-text>
                <s-text>{mobileApp ? mobileApp.appName : "Not Configured"}</s-text>
              </s-stack>
              <s-stack direction="inline" >
                <s-text type="strong">Status:</s-text>
                <s-text>{mobileApp?.isActive ? "Active" : "Inactive"}</s-text>
              </s-stack>
              <s-stack direction="inline" >
                <s-text type="strong">Merchant Install:</s-text>
                <s-text>{merchant ? `Installed at ${new Date(merchant.installedAt).toLocaleDateString()}` : "Pending Onboarding"}</s-text>
              </s-stack>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
