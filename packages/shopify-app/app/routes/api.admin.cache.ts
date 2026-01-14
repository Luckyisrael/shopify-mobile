import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { authenticate } from "../shopify.server";
import { cache, CacheInvalidation } from "../services/cache.server";

/**
 * Cache Management API
 * 
 * GET /api/admin/cache - Get cache statistics
 * POST /api/admin/cache - Invalidate cache
 * DELETE /api/admin/cache - Clear all cache
 */

// Get cache statistics
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  const stats = cache.getStats();

  return mobileJson({
    success: true,
    stats: {
      ...stats,
      hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
    },
  });
}

// Invalidate or clear cache
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchantId = session.shop;

  const formData = await request.formData();
  const action = formData.get("action") as string;
  const pattern = formData.get("pattern") as string | null;

  try {
    switch (action) {
      case "invalidate_merchant": {
        const deleted = CacheInvalidation.invalidateMerchant(merchantId);
        return mobileJson({
          success: true,
          message: `Invalidated ${deleted} cache entries for merchant`,
          deleted,
        });
      }

      case "invalidate_dashboard": {
        const deleted = CacheInvalidation.invalidateDashboard(merchantId);
        return mobileJson({
          success: true,
          message: `Invalidated ${deleted} dashboard cache entries`,
          deleted,
        });
      }

      case "invalidate_push": {
        const deleted = CacheInvalidation.invalidatePush(merchantId);
        return mobileJson({
          success: true,
          message: `Invalidated ${deleted} push notification cache entries`,
          deleted,
        });
      }

      case "invalidate_pattern": {
        if (!pattern) {
          return mobileJson(
            { success: false, error: "Pattern is required" },
            400
          );
        }
        const deleted = cache.deletePattern(pattern);
        return mobileJson({
          success: true,
          message: `Invalidated ${deleted} cache entries matching pattern`,
          deleted,
        });
      }

      case "clear_all": {
        cache.clear();
        return mobileJson({
          success: true,
          message: "All cache cleared",
        });
      }

      case "cleanup": {
        const cleaned = cache.cleanup();
        return mobileJson({
          success: true,
          message: `Cleaned up ${cleaned} expired entries`,
          cleaned,
        });
      }

      default:
        return mobileJson(
          { success: false, error: "Invalid action" },
          400
        );
    }
  } catch (error) {
    console.error("[Cache API] Error:", error);
    return handleMobileError(error);
  }
}
