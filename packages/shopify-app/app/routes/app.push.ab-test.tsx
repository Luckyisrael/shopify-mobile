/**
 * A/B Test Manager UI
 * 
 * Allows merchants to create and manage A/B tests for push notifications.
 * Displays real-time results and statistical significance.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";
import { useState, useCallback } from "react";
import {
  createABTest,
  getTests,
  getTestResults,
  declareWinner,
  type ABTestConfig,
} from "../services/ab-testing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const merchantId = session.shop;

  // Get all tests
  const tests = await getTests(merchantId);

  // Get detailed results for each test
  const testsWithResults = await Promise.all(
    tests.map(async (test) => {
      const results = await getTestResults(test.id);
      return {
        ...test,
        results,
      };
    })
  );

  return {
    tests: testsWithResults,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const merchantId = session.shop;

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "create") {
    const config: ABTestConfig = {
      name: formData.get("name") as string,
      variantA: {
        title: formData.get("variantATitle") as string,
        body: formData.get("variantABody") as string,
      },
      variantB: {
        title: formData.get("variantBTitle") as string,
        body: formData.get("variantBBody") as string,
      },
    };

    const test = await createABTest(merchantId, config);
    return { success: true, test };
  }

  if (action === "declareWinner") {
    const testId = formData.get("testId") as string;
    const result = await declareWinner(testId);
    return { success: true, result };
  }

  return { success: false, error: "Invalid action" };
};

export default function ABTestManager() {
  const { tests } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    variantATitle: "",
    variantABody: "",
    variantBTitle: "",
    variantBBody: "",
  });

  const handleCreateTest = useCallback(() => {
    const form = new FormData();
    form.append("action", "create");
    form.append("name", formData.name);
    form.append("description", formData.description);
    form.append("variantATitle", formData.variantATitle);
    form.append("variantABody", formData.variantABody);
    form.append("variantBTitle", formData.variantBTitle);
    form.append("variantBBody", formData.variantBBody);

    submit(form, { method: "post" });
    setShowCreateModal(false);
    
    // Reset form
    setFormData({
      name: "",
      description: "",
      variantATitle: "",
      variantABody: "",
      variantBTitle: "",
      variantBBody: "",
    });
  }, [formData, submit]);

  const handleDeclareWinner = useCallback(
    (testId: string) => {
      const form = new FormData();
      form.append("action", "declareWinner");
      form.append("testId", testId);
      submit(form, { method: "post" });
    },
    [submit]
  );

  const activeTests = tests.filter((test) => test.status === "ACTIVE");
  const completedTests = tests.filter((test) => test.status === "COMPLETED");

  return (
    <s-page heading="A/B Test Manager">
      <s-stack direction="block" gap="base">
        <s-banner tone="info">
          Test different push notification messages to see which performs better.
          Tests automatically track sends, opens, clicks, and conversions.
        </s-banner>

        <s-section>
          <s-stack direction="block" gap="base">
            <s-text>Active Tests</s-text>
            {activeTests.length > 0 ? (
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  {activeTests.map((test) => {
                    const { results } = test;
                    return (
                      <div key={test.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                        <s-stack direction="block" gap="base">
                          <s-text>{test.name}</s-text>
                          <s-badge tone={results.isSignificant ? "success" : "info"}>
                            {results.isSignificant ? "Significant" : "Collecting data"}
                          </s-badge>
                          <s-text>Sends: {results.variantA.sends} / {results.variantB.sends}</s-text>
                          <s-text>
                            Conversion: {(results.variantA.conversionRate * 100).toFixed(2)}% / {(results.variantB.conversionRate * 100).toFixed(2)}%
                          </s-text>
                          {results.winner ? (
                            <s-badge tone="success">Winner: Variant {results.winner}</s-badge>
                          ) : (
                            <s-text>Winner: TBD</s-text>
                          )}
                        </s-stack>
                        <s-button
                          onClick={() => handleDeclareWinner(test.id)}
                          disabled={!results.isSignificant}
                        >
                          Declare Winner
                        </s-button>
                      </div>
                    );
                  })}
                </s-stack>
              </s-box>
            ) : (
              <s-text>No active tests. Create one to get started!</s-text>
            )}
          </s-stack>
        </s-section>

        <s-section>
          <s-stack direction="block" gap="base">
            <s-text>Completed Tests</s-text>
            {completedTests.length > 0 ? (
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  {completedTests.map((test) => {
                    const { results } = test;
                    return (
                      <s-stack key={test.id} direction="inline" gap="base">
                        <s-text>{test.name}</s-text>
                        <s-text>Completed: {new Date(test.completedAt!).toLocaleDateString()}</s-text>
                        {results.winner ? (
                          <s-badge tone="success">Winner: Variant {results.winner}</s-badge>
                        ) : (
                          <s-badge>No winner</s-badge>
                        )}
                        <s-text>Confidence: {results.confidence}%</s-text>
                        <s-text>
                          Conversion: {(results.variantA.conversionRate * 100).toFixed(2)}% / {(results.variantB.conversionRate * 100).toFixed(2)}%
                        </s-text>
                      </s-stack>
                    );
                  })}
                </s-stack>
              </s-box>
            ) : (
              <s-text>No completed tests yet.</s-text>
            )}
          </s-stack>
        </s-section>

        <s-button onClick={() => setShowCreateModal(true)} variant="primary">
          Create Test
        </s-button>

        {showCreateModal && (
          <s-section>
            <s-stack direction="block" gap="base">
              <s-text>Create A/B Test</s-text>
              <s-box padding="base" borderWidth="base" borderRadius="base" background="transparent">
                <s-stack direction="block" gap="base">
                  <s-text-field
                    label="Test Name"
                    value={formData.name}
                    onChange={(event: any) => setFormData({ ...formData, name: event.detail.value })}
                    placeholder="e.g., Welcome Message Test"
                  />

                  <s-text-field
                    label="Description (optional)"
                    value={formData.description}
                    onChange={(event: any) => setFormData({ ...formData, description: event.detail.value })}
                  />

                  <s-text>Variant A</s-text>

                  <s-text-field
                    label="Title"
                    value={formData.variantATitle}
                    onChange={(event: any) => setFormData({ ...formData, variantATitle: event.detail.value })}
                    placeholder="Welcome to our store!"
                  />

                  <s-text-field
                    label="Body"
                    value={formData.variantABody}
                    onChange={(event: any) => setFormData({ ...formData, variantABody: event.detail.value })}
                    placeholder="Get 10% off your first order"
                  />

                  <s-text>Variant B</s-text>

                  <s-text-field
                    label="Title"
                    value={formData.variantBTitle}
                    onChange={(event: any) => setFormData({ ...formData, variantBTitle: event.detail.value })}
                    placeholder="Welcome! Special offer inside"
                  />

                  <s-text-field
                    label="Body"
                    value={formData.variantBBody}
                    onChange={(event: any) => setFormData({ ...formData, variantBBody: event.detail.value })}
                    placeholder="Enjoy 10% off - limited time only!"
                  />

                  <s-stack direction="inline" gap="base">
                    <s-button
                      onClick={handleCreateTest}
                      variant="primary"
                      disabled={!formData.name || !formData.variantATitle || !formData.variantBTitle}
                    >
                      Create Test
                    </s-button>
                    <s-button onClick={() => setShowCreateModal(false)}>
                      Cancel
                    </s-button>
                  </s-stack>
                </s-stack>
              </s-box>
            </s-stack>
          </s-section>
        )}
      </s-stack>
    </s-page>
  );
}
