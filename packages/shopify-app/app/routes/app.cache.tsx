import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import { cache } from "../services/cache.server";
import { isFeatureEnabled, FeatureFlag } from "../services/feature-flags.server";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchantId = session.shop;

  // Get merchant
  const merchant = await db.merchant.findUnique({
    where: { shop: merchantId },
  });

  if (!merchant) {
    throw new Response("Merchant not found", { status: 404 });
  }

  // Check if cache management feature is enabled
  const cacheManagementEnabled = await isFeatureEnabled(
    merchant.id,
    FeatureFlag.CACHE_MANAGEMENT
  );

  if (!cacheManagementEnabled) {
    throw new Response("Cache management feature is not enabled", { status: 403 });
  }

  const stats = cache.getStats();

  return {
    stats: {
      ...stats,
      hitRatePercent: (stats.hitRate * 100).toFixed(2),
    },
  };
}

export default function CacheManagementPage() {
  const { stats } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleAction = (action: string, pattern?: string) => {
    const formData = new FormData();
    formData.append("action", action);
    if (pattern) {
      formData.append("pattern", pattern);
    }

    submit(formData, {
      method: "post",
      action: "/api/admin/cache",
    });
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "2rem" }}>
        Cache Management
      </h1>

      {/* Cache Statistics */}
      <div style={{
        backgroundColor: "var(--p-color-bg-surface)",
        border: "1px solid var(--p-color-border)",
        borderRadius: "var(--p-border-radius-200)",
        padding: "1.5rem",
        marginBottom: "2rem"
      }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem" }}>
          Cache Statistics
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem"
        }}>
          <div>
            <div style={{ fontSize: "0.875rem", color: "var(--p-color-text-subdued)", marginBottom: "0.5rem" }}>
              Cache Hits
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: "600" }}>
              {stats.hits.toLocaleString()}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.875rem", color: "var(--p-color-text-subdued)", marginBottom: "0.5rem" }}>
              Cache Misses
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: "600" }}>
              {stats.misses.toLocaleString()}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.875rem", color: "var(--p-color-text-subdued)", marginBottom: "0.5rem" }}>
              Hit Rate
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "var(--p-color-text-success)" }}>
              {stats.hitRatePercent}%
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.875rem", color: "var(--p-color-text-subdued)", marginBottom: "0.5rem" }}>
              Cached Entries
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: "600" }}>
              {stats.size.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Cache Actions */}
      <div style={{
        backgroundColor: "var(--p-color-bg-surface)",
        border: "1px solid var(--p-color-border)",
        borderRadius: "var(--p-border-radius-200)",
        padding: "1.5rem"
      }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem" }}>
          Cache Actions
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem",
            backgroundColor: "var(--p-color-bg-surface-secondary)",
            borderRadius: "var(--p-border-radius-100)"
          }}>
            <div>
              <div style={{ fontWeight: "500", marginBottom: "0.25rem" }}>
                Invalidate Merchant Cache
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--p-color-text-subdued)" }}>
                Clear all cached data for your merchant
              </div>
            </div>
            <button
              onClick={() => handleAction("invalidate_merchant")}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "var(--p-color-bg-fill-warning)",
                color: "var(--p-color-text-on-color)",
                border: "none",
                borderRadius: "var(--p-border-radius-100)",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              Invalidate
            </button>
          </div>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem",
            backgroundColor: "var(--p-color-bg-surface-secondary)",
            borderRadius: "var(--p-border-radius-100)"
          }}>
            <div>
              <div style={{ fontWeight: "500", marginBottom: "0.25rem" }}>
                Invalidate Dashboard Cache
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--p-color-text-subdued)" }}>
                Clear cached dashboard metrics
              </div>
            </div>
            <button
              onClick={() => handleAction("invalidate_dashboard")}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "var(--p-color-bg-fill-warning)",
                color: "var(--p-color-text-on-color)",
                border: "none",
                borderRadius: "var(--p-border-radius-100)",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              Invalidate
            </button>
          </div>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem",
            backgroundColor: "var(--p-color-bg-surface-secondary)",
            borderRadius: "var(--p-border-radius-100)"
          }}>
            <div>
              <div style={{ fontWeight: "500", marginBottom: "0.25rem" }}>
                Invalidate Push Cache
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--p-color-text-subdued)" }}>
                Clear cached push notification data
              </div>
            </div>
            <button
              onClick={() => handleAction("invalidate_push")}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "var(--p-color-bg-fill-warning)",
                color: "var(--p-color-text-on-color)",
                border: "none",
                borderRadius: "var(--p-border-radius-100)",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              Invalidate
            </button>
          </div>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem",
            backgroundColor: "var(--p-color-bg-surface-secondary)",
            borderRadius: "var(--p-border-radius-100)"
          }}>
            <div>
              <div style={{ fontWeight: "500", marginBottom: "0.25rem" }}>
                Cleanup Expired Entries
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--p-color-text-subdued)" }}>
                Remove expired cache entries
              </div>
            </div>
            <button
              onClick={() => handleAction("cleanup")}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "var(--p-color-bg-fill-brand)",
                color: "var(--p-color-text-on-color)",
                border: "none",
                borderRadius: "var(--p-border-radius-100)",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              Cleanup
            </button>
          </div>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem",
            backgroundColor: "var(--p-color-bg-surface-critical-subdued)",
            borderRadius: "var(--p-border-radius-100)",
            border: "1px solid var(--p-color-border-critical)"
          }}>
            <div>
              <div style={{ fontWeight: "500", marginBottom: "0.25rem", color: "var(--p-color-text-critical)" }}>
                Clear All Cache
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--p-color-text-subdued)" }}>
                ⚠️ Clear entire cache (all merchants)
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear ALL cache? This affects all merchants.")) {
                  handleAction("clear_all");
                }
              }}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "var(--p-color-bg-fill-critical)",
                color: "var(--p-color-text-on-color)",
                border: "none",
                borderRadius: "var(--p-border-radius-100)",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Cache Information */}
      <div style={{
        marginTop: "2rem",
        padding: "1rem",
        backgroundColor: "var(--p-color-bg-surface-info-subdued)",
        border: "1px solid var(--p-color-border-info)",
        borderRadius: "var(--p-border-radius-200)"
      }}>
        <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "0.5rem" }}>
          About Caching
        </h3>
        <ul style={{ fontSize: "0.875rem", color: "var(--p-color-text-subdued)", paddingLeft: "1.5rem" }}>
          <li>Analytics data is cached for 1 hour to improve performance</li>
          <li>Cache is automatically invalidated when new data is added</li>
          <li>Expired entries are cleaned up every 5 minutes</li>
          <li>Cache is stored in memory and will be cleared on server restart</li>
          <li>High hit rate ({">"} 70%) indicates good cache performance</li>
        </ul>
      </div>
    </div>
  );
}
