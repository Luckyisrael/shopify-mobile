import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getFeatureFlags,
  getAllFeatureFlagsWithMetadata,
  FeatureFlag,
} from "../services/feature-flags.server";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const merchantId = session.shop;

  const merchant = await db.merchant.findUnique({
    where: { shop: merchantId },
  });

  if (!merchant) {
    throw new Response("Merchant not found", { status: 404 });
  }

  const currentFlags = await getFeatureFlags(merchant.id);
  const allFlags = getAllFeatureFlagsWithMetadata();

  // Group flags by phase
  const flagsByPhase: Record<string, typeof allFlags> = {};
  allFlags.forEach((item) => {
    const phase = item.metadata.phase;
    if (!flagsByPhase[phase]) {
      flagsByPhase[phase] = [];
    }
    flagsByPhase[phase].push(item);
  });

  return {
    currentFlags,
    flagsByPhase,
  };
}

export default function FeatureFlagsPage() {
  const { currentFlags, flagsByPhase } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleToggle = (flag: FeatureFlag, currentValue: boolean) => {
    const formData = new FormData();
    formData.append("action", "set_flag");
    formData.append("flag", flag);
    formData.append("enabled", (!currentValue).toString());

    submit(formData, {
      method: "post",
      action: "/api/admin/feature-flags",
    });
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset all feature flags to defaults?")) {
      const formData = new FormData();
      formData.append("action", "reset_flags");

      submit(formData, {
        method: "post",
        action: "/api/admin/feature-flags",
      });
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "2rem"
      }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "600" }}>
          Feature Flags
        </h1>

        <button
          onClick={handleReset}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "var(--p-color-bg-surface-secondary)",
            color: "var(--p-color-text)",
            border: "1px solid var(--p-color-border)",
            borderRadius: "var(--p-border-radius-100)",
            cursor: "pointer",
            fontWeight: "500"
          }}
        >
          Reset to Defaults
        </button>
      </div>

      {/* Info Banner */}
      <div style={{
        padding: "1rem",
        backgroundColor: "var(--p-color-bg-surface-info-subdued)",
        border: "1px solid var(--p-color-border-info)",
        borderRadius: "var(--p-border-radius-200)",
        marginBottom: "2rem"
      }}>
        <p style={{ fontSize: "0.875rem", color: "var(--p-color-text-subdued)" }}>
          Feature flags allow you to enable or disable specific features. Changes take effect immediately.
          Most features are enabled by default as they have been fully implemented and tested.
        </p>
      </div>

      {/* Feature Flags by Phase */}
      {Object.entries(flagsByPhase).map(([phase, flags]) => (
        <div
          key={phase}
          style={{
            backgroundColor: "var(--p-color-bg-surface)",
            border: "1px solid var(--p-color-border)",
            borderRadius: "var(--p-border-radius-200)",
            padding: "1.5rem",
            marginBottom: "1.5rem"
          }}
        >
          <h2 style={{
            fontSize: "1.25rem",
            fontWeight: "600",
            marginBottom: "1rem",
            color: "var(--p-color-text)"
          }}>
            {phase}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {flags.map(({ flag, metadata, defaultEnabled }) => {
              const isEnabled = currentFlags[flag];
              const isModified = isEnabled !== defaultEnabled;

              return (
                <div
                  key={flag}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1rem",
                    backgroundColor: "var(--p-color-bg-surface-secondary)",
                    borderRadius: "var(--p-border-radius-100)",
                    border: metadata.experimental 
                      ? "1px solid var(--p-color-border-warning)" 
                      : "none"
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.25rem"
                    }}>
                      <span style={{ fontWeight: "500" }}>
                        {metadata.name}
                      </span>
                      {metadata.experimental && (
                        <span style={{
                          fontSize: "0.75rem",
                          padding: "0.125rem 0.5rem",
                          backgroundColor: "var(--p-color-bg-fill-warning)",
                          color: "var(--p-color-text-on-color)",
                          borderRadius: "var(--p-border-radius-100)",
                          fontWeight: "500"
                        }}>
                          EXPERIMENTAL
                        </span>
                      )}
                      {isModified && (
                        <span style={{
                          fontSize: "0.75rem",
                          padding: "0.125rem 0.5rem",
                          backgroundColor: "var(--p-color-bg-fill-info)",
                          color: "var(--p-color-text-on-color)",
                          borderRadius: "var(--p-border-radius-100)",
                          fontWeight: "500"
                        }}>
                          MODIFIED
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: "0.875rem",
                      color: "var(--p-color-text-subdued)"
                    }}>
                      {metadata.description}
                    </div>
                    <div style={{
                      fontSize: "0.75rem",
                      color: "var(--p-color-text-subdued)",
                      marginTop: "0.25rem"
                    }}>
                      Default: {defaultEnabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>

                  <label style={{
                    position: "relative",
                    display: "inline-block",
                    width: "48px",
                    height: "24px",
                    marginLeft: "1rem"
                  }}>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggle(flag, isEnabled)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: "absolute",
                      cursor: "pointer",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: isEnabled 
                        ? "var(--p-color-bg-fill-success)" 
                        : "var(--p-color-bg-surface-disabled)",
                      transition: "0.3s",
                      borderRadius: "24px"
                    }}>
                      <span style={{
                        position: "absolute",
                        content: "",
                        height: "18px",
                        width: "18px",
                        left: isEnabled ? "26px" : "3px",
                        bottom: "3px",
                        backgroundColor: "white",
                        transition: "0.3s",
                        borderRadius: "50%"
                      }} />
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Summary */}
      <div style={{
        padding: "1rem",
        backgroundColor: "var(--p-color-bg-surface-secondary)",
        borderRadius: "var(--p-border-radius-200)",
        marginTop: "2rem"
      }}>
        <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "0.5rem" }}>
          Summary
        </h3>
        <div style={{ fontSize: "0.875rem", color: "var(--p-color-text-subdued)" }}>
          {Object.values(currentFlags).filter(Boolean).length} of {Object.keys(currentFlags).length} features enabled
        </div>
      </div>
    </div>
  );
}
