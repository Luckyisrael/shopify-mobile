/**
 * Mobile API: Customer Notification Preferences
 * 
 * Endpoints for customers to manage their notification preferences
 * 
 * GET  /api/mobile/preferences - Get customer preferences
 * PUT  /api/mobile/preferences - Update customer preferences
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import {
  getPreferences,
  updatePreferences,
  type CustomerPreferencesData,
} from "../services/customer-preferences.server";

// ============================================================================
// GET /api/mobile/preferences
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const merchantId = url.searchParams.get("merchantId");
    const shopifyCustomerId = url.searchParams.get("customerId");

    // Validate required parameters
    if (!merchantId) {
      return mobileJson(
        { error: "Missing required parameter: merchantId" },
        400
      );
    }

    if (!shopifyCustomerId) {
      return mobileJson(
        { error: "Missing required parameter: customerId" },
        400
      );
    }

    // Verify merchant exists
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      return mobileJson({ error: "Merchant not found" }, 404);
    }

    // Get preferences (creates defaults if none exist)
    const preferences = await getPreferences(merchantId, shopifyCustomerId);

    return mobileJson({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error("[Mobile Preferences GET] Error:", error);
    return handleMobileError(error);
  }
}

// ============================================================================
// PUT /api/mobile/preferences
// ============================================================================

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "PUT") {
    return mobileJson({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await request.json();
    const { merchantId, customerId, preferences } = body;

    // Validate required parameters
    if (!merchantId) {
      return mobileJson(
        { error: "Missing required field: merchantId" },
        400
      );
    }

    if (!customerId) {
      return mobileJson(
        { error: "Missing required field: customerId" },
        400
      );
    }

    if (!preferences || typeof preferences !== "object") {
      return mobileJson(
        { error: "Missing or invalid field: preferences" },
        400
      );
    }

    // Verify merchant exists
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      return mobileJson({ error: "Merchant not found" }, 404);
    }

    // Validate preference fields
    const validBooleanFields = [
      "cartNotifications",
      "orderNotifications",
      "promotionalNotifications",
      "highlightNotifications",
      "quietHoursEnabled",
    ];

    const validStringFields = ["quietHoursStart", "quietHoursEnd"];
    const validNumberFields = ["maxDailyNotifications"];

    // Check for invalid fields
    const allowedFields = [
      ...validBooleanFields,
      ...validStringFields,
      ...validNumberFields,
    ];

    const providedFields = Object.keys(preferences);
    const invalidFields = providedFields.filter(
      (field) => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
      return mobileJson(
        {
          error: `Invalid preference fields: ${invalidFields.join(", ")}`,
        },
        400
      );
    }

    // Validate boolean fields
    for (const field of validBooleanFields) {
      if (
        preferences[field] !== undefined &&
        typeof preferences[field] !== "boolean"
      ) {
        return mobileJson(
          {
            error: `Field '${field}' must be a boolean`,
          },
          400
        );
      }
    }

    // Validate string fields
    for (const field of validStringFields) {
      if (
        preferences[field] !== undefined &&
        preferences[field] !== null &&
        typeof preferences[field] !== "string"
      ) {
        return mobileJson(
          {
            error: `Field '${field}' must be a string`,
          },
          400
        );
      }
    }

    // Validate number fields
    for (const field of validNumberFields) {
      if (
        preferences[field] !== undefined &&
        preferences[field] !== null &&
        typeof preferences[field] !== "number"
      ) {
        return mobileJson(
          {
            error: `Field '${field}' must be a number`,
          },
          400
        );
      }
    }

    // Update preferences
    const updatedPreferences = await updatePreferences(
      merchantId,
      customerId,
      preferences
    );

    return mobileJson({
      success: true,
      preferences: updatedPreferences,
      message: "Preferences updated successfully",
    });
  } catch (error) {
    console.error("[Mobile Preferences PUT] Error:", error);

    // Handle validation errors from the service
    if (error instanceof Error && error.message.includes("Invalid")) {
      return mobileJson(
        {
          error: error.message,
        },
        400
      );
    }

    return handleMobileError(error);
  }
}

// ============================================================================
// Example Usage
// ============================================================================

/*

GET Request:
GET /api/mobile/preferences?merchantId=abc123&customerId=cust_456

Response:
{
  "success": true,
  "preferences": {
    "shopifyCustomerId": "cust_456",
    "cartNotifications": true,
    "orderNotifications": true,
    "promotionalNotifications": false,
    "highlightNotifications": true,
    "quietHoursEnabled": true,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00",
    "maxDailyNotifications": 3
  }
}

---

PUT Request:
PUT /api/mobile/preferences
Content-Type: application/json

{
  "merchantId": "abc123",
  "customerId": "cust_456",
  "preferences": {
    "promotionalNotifications": false,
    "quietHoursEnabled": true,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00",
    "maxDailyNotifications": 3
  }
}

Response:
{
  "success": true,
  "preferences": {
    "shopifyCustomerId": "cust_456",
    "cartNotifications": true,
    "orderNotifications": true,
    "promotionalNotifications": false,
    "highlightNotifications": true,
    "quietHoursEnabled": true,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00",
    "maxDailyNotifications": 3
  },
  "message": "Preferences updated successfully"
}

*/
