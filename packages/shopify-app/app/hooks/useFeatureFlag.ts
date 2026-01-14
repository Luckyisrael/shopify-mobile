import { useRouteLoaderData } from "react-router";
import { FeatureFlag } from "../services/feature-flags.server";

/**
 * Hook to check if a feature flag is enabled
 * 
 * Usage:
 * ```tsx
 * const isEnabled = useFeatureFlag(FeatureFlag.RICH_PUSH);
 * 
 * if (isEnabled) {
 *   return <RichPushFeature />;
 * }
 * ```
 * 
 * Note: This requires the route loader to include feature flags in the data.
 * Add this to your loader:
 * ```ts
 * const flags = await getFeatureFlags(merchantId);
 * return json({ ...otherData, featureFlags: flags });
 * ```
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  const data = useRouteLoaderData("root") as any;
  
  if (!data?.featureFlags) {
    console.warn(`[useFeatureFlag] Feature flags not found in loader data. Flag: ${flag}`);
    return false;
  }

  return data.featureFlags[flag] ?? false;
}

/**
 * Hook to get all feature flags
 */
export function useFeatureFlags(): Record<FeatureFlag, boolean> | null {
  const data = useRouteLoaderData("root") as any;
  return data?.featureFlags ?? null;
}
