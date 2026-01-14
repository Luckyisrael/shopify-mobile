import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { 
  createProductHighlight, 
  getAllHighlights, 
  deactivateHighlight,
  getHighlightStats
} from "../services/product-highlights.server";

export const loader = async ({ request }: any) => {
  const { session, admin } = await authenticate.admin(request);

  const merchant = await db.merchant.findUnique({
    where: { shop: session.shop },
    include: {
      featureFlags: true
    }
  });

  if (!merchant) {
    throw new Response("Merchant not found", { status: 404 });
  }

  // Get products from Shopify for selection
  const productsResponse = await admin.graphql(`
    query getProducts($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            title
            handle
            featuredImage {
              url
            }
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `, {
    variables: { first: 50 }
  });

  const productsJson = await productsResponse.json();
  const products = productsJson.data?.products?.edges?.map((edge: any) => edge.node) || [];

  // Get highlights and stats
  const [highlights, stats] = await Promise.all([
    getAllHighlights(merchant.id),
    getHighlightStats(merchant.id)
  ]);

  // Check current month usage
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  
  const highlightsThisMonth = await db.productHighlight.count({
    where: {
      merchantId: merchant.id,
      createdAt: { gte: currentMonth }
    }
  });

  const maxHighlights = merchant.featureFlags?.maxProductHighlights || 20;

  return {
    products,
    highlights,
    stats,
    usage: {
      current: highlightsThisMonth,
      limit: maxHighlights,
      remaining: Math.max(0, maxHighlights - highlightsThisMonth)
    }
  };
};

export const action = async ({ request }: any) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const merchant = await db.merchant.findUnique({ where: { shop: session.shop } });
  if (!merchant) return Response.json({ error: "Merchant not found" });

  if (intent === "create") {
    const shopifyProductId = formData.get("productId");
    const title = formData.get("title");
    const description = formData.get("description");
    const ctaText = formData.get("ctaText");
    const sendNotification = formData.get("sendNotification") === "on";

    if (!shopifyProductId || !title) {
      return Response.json({ error: "Product and title are required" });
    }

    try {
      // Get product details from Shopify
      const productResponse = await admin.graphql(`
        query getProduct($id: ID!) {
          product(id: $id) {
            id
            title
            handle
            featuredImage {
              url
            }
            onlineStoreUrl
          }
        }
      `, {
        variables: { id: shopifyProductId }
      });

      const productJson = await productResponse.json();
      const product = productJson.data?.product;

      if (!product) {
        return Response.json({ error: "Product not found" });
      }

      const highlight = await createProductHighlight(merchant.id, {
        shopifyProductId: String(shopifyProductId),
        title: String(title),
        description: description ? String(description) : undefined,
        imageUrl: product.featuredImage?.url,
        productUrl: product.onlineStoreUrl,
        ctaText: ctaText ? String(ctaText) : undefined
      }, sendNotification);

      return Response.json({ 
        success: true, 
        message: "Product highlight created successfully!",
        highlight 
      });

    } catch (error: any) {
      return Response.json({ error: error.message || "Failed to create highlight" });
    }
  }

  if (intent === "deactivate") {
    const highlightId = formData.get("highlightId");
    
    if (!highlightId) {
      return Response.json({ error: "Highlight ID is required" });
    }

    const success = await deactivateHighlight(merchant.id, String(highlightId));
    
    if (success) {
      return Response.json({ success: true, message: "Highlight deactivated" });
    } else {
      return Response.json({ error: "Failed to deactivate highlight" });
    }
  }

  return Response.json({ error: "Invalid intent" });
};

export default function HighlightsPage() {
  const { products, highlights, stats, usage } = useLoaderData<typeof loader>();
  const actionData = useActionData() as any;
  const nav = useNavigation();

  const isSubmitting = nav.state === "submitting";
  const canCreateMore = usage.remaining > 0;

  // Format time remaining
  const formatTimeRemaining = (milliseconds: number) => {
    if (milliseconds <= 0) return "Expired";
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  return (
    <s-page heading="Product Highlights">
      <s-stack direction="block" gap="base">

        {/* Success/Error Messages */}
        {actionData?.success && (
          <s-banner heading="Success" tone="success">
            {actionData.message}
          </s-banner>
        )}
        {actionData?.error && (
          <s-banner heading="Error" tone="critical">
            {actionData.error}
          </s-banner>
        )}

        {/* Usage Stats */}
        <s-section heading="Usage & Statistics">
          <s-stack direction="inline" gap="base">
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="050">
                <s-text type="strong" size="large">{usage.current}/{usage.limit}</s-text>
                <s-text tone="subdued">This Month</s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="050">
                <s-text type="strong" size="large">{stats.active}</s-text>
                <s-text tone="subdued">Active Now</s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="050">
                <s-text type="strong" size="large">{stats.totalViews}</s-text>
                <s-text tone="subdued">Total Views</s-text>
              </s-stack>
            </s-box>
            
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-stack direction="block" gap="050">
                <s-text type="strong" size="large">{stats.clickThroughRate}%</s-text>
                <s-text tone="subdued">Click Rate</s-text>
              </s-stack>
            </s-box>
          </s-stack>
        </s-section>

        {/* Create New Highlight */}
        <s-section heading="Create Product Highlight">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
            {!canCreateMore ? (
              <s-banner heading="Limit Reached" tone="warning">
                You've reached your monthly limit of {usage.limit} product highlights. 
                Upgrade to Pro for more highlights!
              </s-banner>
            ) : (
              <Form method="post">
                <input type="hidden" name="intent" value="create" />
                <s-stack direction="block" gap="base">
                  
                  <s-text tone="subdued">
                    Create a 48-hour product story that will be featured prominently in your mobile app.
                    {usage.remaining} highlights remaining this month.
                  </s-text>

                  <s-stack direction="inline" gap="base">
                    <div style={{ flex: 1 }}>
                      <label>
                        <s-text type="strong">Select Product</s-text>
                        <select name="productId" required style={{ width: '100%', padding: '8px', marginTop: '4px' }}>
                          <option value="">Choose a product...</option>
                          {products.map((product: any) => (
                            <option key={product.id} value={product.id}>
                              {product.title} - ${product.priceRangeV2?.minVariantPrice?.amount || '0'}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </s-stack>

                  <s-text-field
                    label="Highlight Title"
                    name="title"
                    placeholder="🔥 Flash Sale - 50% Off!"
                    required
                  />

                  <s-text-field
                    label="Description (Optional)"
                    name="description"
                    placeholder="Limited time offer on our best-selling item..."
                    multiline={2}
                  />

                  <s-text-field
                    label="Call-to-Action Text"
                    name="ctaText"
                    placeholder="Shop Now"
                    defaultValue="Shop Now"
                  />

                  <s-stack direction="inline" align="center" gap="base">
                    <input type="checkbox" name="sendNotification" id="sendNotification" defaultChecked />
                    <label htmlFor="sendNotification">
                      <s-text>Send push notification to all users</s-text>
                    </label>
                  </s-stack>

                  <s-button type="submit" variant="primary" loading={isSubmitting}>
                    Create Highlight
                  </s-button>

                </s-stack>
              </Form>
            )}
          </s-box>
        </s-section>

        {/* Active Highlights */}
        <s-section heading="Current Highlights">
          {highlights.length === 0 ? (
            <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
              <s-text tone="subdued">No product highlights created yet.</s-text>
            </s-box>
          ) : (
            <s-stack direction="block" gap="base">
              {highlights.map((highlight: any) => (
                <s-box key={highlight.id} padding="base" borderWidth="base" borderRadius="base" 
                       background={highlight.isExpired ? "bg-surface-secondary" : "transparent"}>
                  <s-stack direction="inline" align="center" justify="space-between">
                    
                    <s-stack direction="block" gap="050">
                      <s-stack direction="inline" align="center" gap="050">
                        <s-text type="strong">{highlight.title}</s-text>
                        {highlight.isExpired ? (
                          <s-badge tone="critical">Expired</s-badge>
                        ) : highlight.isActive ? (
                          <s-badge tone="success">Active</s-badge>
                        ) : (
                          <s-badge>Inactive</s-badge>
                        )}
                      </s-stack>
                      
                      <s-text tone="subdued">
                        {highlight.description || "No description"}
                      </s-text>
                      
                      <s-stack direction="inline" gap="base">
                        <s-text tone="subdued" size="small">
                          👁️ {highlight.viewCount} views
                        </s-text>
                        <s-text tone="subdued" size="small">
                          👆 {highlight.clickCount} clicks
                        </s-text>
                        <s-text tone="subdued" size="small">
                          ⏰ {formatTimeRemaining(highlight.timeRemaining)}
                        </s-text>
                      </s-stack>
                    </s-stack>

                    {highlight.isActive && !highlight.isExpired && (
                      <Form method="post">
                        <input type="hidden" name="intent" value="deactivate" />
                        <input type="hidden" name="highlightId" value={highlight.id} />
                        <s-button type="submit" tone="critical" size="small">
                          Deactivate
                        </s-button>
                      </Form>
                    )}

                  </s-stack>
                </s-box>
              ))}
            </s-stack>
          )}
        </s-section>

      </s-stack>
    </s-page>
  );
}