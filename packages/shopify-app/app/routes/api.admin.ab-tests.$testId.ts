/**
 * A/B Test Results API Endpoint
 * 
 * GET /api/admin/ab-tests/:testId - Get detailed test results
 * 
 * Returns comprehensive test results including statistical analysis.
 */

import type { LoaderFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { authenticate } from "../shopify.server";
import { getTestResults, getTest } from "../services/ab-testing.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    const merchantId = session.shop;

    const testId = params.testId;
    if (!testId) {
      return mobileJson({ error: "Test ID is required" }, 400);
    }

    // Get test to verify ownership
    const test = await getTest(testId);
    if (!test) {
      return mobileJson({ error: "Test not found" }, 404);
    }

    if (test.merchantId !== merchantId) {
      return mobileJson({ error: "Unauthorized" }, 403);
    }

    // Get detailed results
    const results = await getTestResults(testId);

    return mobileJson({
      success: true,
      test: {
        id: test.id,
        name: test.name,
        description: test.description,
        status: test.status,
        createdAt: test.createdAt,
        completedAt: test.completedAt,
      },
      results,
    });
  } catch (error) {
    console.error("[API] Error fetching A/B test results:", error);
    return handleMobileError(error);
  }
};
