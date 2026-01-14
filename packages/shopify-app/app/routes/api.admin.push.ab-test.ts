/**
 * A/B Test API Endpoint
 * 
 * POST /api/admin/push/ab-test - Create a new A/B test
 * 
 * Allows programmatic creation of A/B tests for push notifications.
 */

import type { ActionFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { authenticate } from "../shopify.server";
import { createABTest, type ABTestConfig } from "../services/ab-testing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return mobileJson({ error: "Method not allowed" }, 405);
  }

  try {
    const { session } = await authenticate.admin(request);
    const merchantId = session.shop;

    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return mobileJson({ error: "Test name is required" }, 400);
    }

    if (!body.variantA || !body.variantA.title || !body.variantA.body) {
      return mobileJson(
        { error: "Variant A title and body are required" },
        400
      );
    }

    if (!body.variantB || !body.variantB.title || !body.variantB.body) {
      return mobileJson(
        { error: "Variant B title and body are required" },
        400
      );
    }

    const config: ABTestConfig = {
      name: body.name,
      description: body.description,
      variantA: {
        title: body.variantA.title,
        body: body.variantA.body,
      },
      variantB: {
        title: body.variantB.title,
        body: body.variantB.body,
      },
      targetAudience: body.targetAudience,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    };

    const test = await createABTest(merchantId, config);

    return mobileJson({
      success: true,
      test: {
        id: test.id,
        name: test.name,
        status: test.status,
        variantA: {
          title: test.variantATitle,
          body: test.variantABody,
        },
        variantB: {
          title: test.variantBTitle,
          body: test.variantBBody,
        },
        createdAt: test.createdAt,
      },
    });
  } catch (error) {
    console.error("[API] Error creating A/B test:", error);
    return handleMobileError(error);
  }
};
