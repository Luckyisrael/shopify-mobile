import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { authenticate } from "../shopify.server";
import {
  getFeatureFlags,
  setFeatureFlag,
  resetFeatureFlags,
  getAllFeatureFlagsWithMetadata,
  FeatureFlag,
} from "../services/feature-flags.server";
import db from "../db.server";

/**
 * Feature Flags Management API
 * 
 * GET /api/admin/feature-flags - Get all feature flags for merchant
 * POST /api/admin/feature-flags - Update feature flags
 */

// Get feature flags
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchantId = session.shop;

  try {
    // Get merchant
    const merchant = await db.merchant.findUnique({
      where: { shop: merchantId },
    });

    if (!merchant) {
      return mobileJson(
        { success: false, error: "Merchant not found" },
        404
      );
    }

    // Get current flags
    const currentFlags = await getFeatureFlags(merchant.id);

    // Get all available flags with metadata
    const allFlags = getAllFeatureFlagsWithMetadata();

    return mobileJson({
      success: true,
      currentFlags,
      availableFlags: allFlags,
    });
  } catch (error) {
    console.error("[Feature Flags API] Error:", error);
    return handleMobileError(error);
  }
}

// Update feature flags
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchantId = session.shop;

  try {
    // Get merchant
    const merchant = await db.merchant.findUnique({
      where: { shop: merchantId },
    });

    if (!merchant) {
      return mobileJson(
        { success: false, error: "Merchant not found" },
        404
      );
    }

    const formData = await request.formData();
    const action = formData.get("action") as string;

    switch (action) {
      case "set_flag": {
        const flag = formData.get("flag") as FeatureFlag;
        const enabled = formData.get("enabled") === "true";

        if (!flag || !Object.values(FeatureFlag).includes(flag)) {
          return mobileJson(
            { success: false, error: "Invalid flag" },
            400
          );
        }

        await setFeatureFlag(merchant.id, flag, enabled);

        return mobileJson({
          success: true,
          message: `Feature flag ${flag} ${enabled ? "enabled" : "disabled"}`,
        });
      }

      case "reset_flags": {
        await resetFeatureFlags(merchant.id);

        return mobileJson({
          success: true,
          message: "All feature flags reset to defaults",
        });
      }

      default:
        return mobileJson(
          { success: false, error: "Invalid action" },
          400
        );
    }
  } catch (error) {
    console.error("[Feature Flags API] Error:", error);
    return handleMobileError(error);
  }
}
