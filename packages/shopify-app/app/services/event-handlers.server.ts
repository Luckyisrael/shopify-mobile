import db from "../db.server";
import { sendPushNotification } from "./push.server";
import { AUTOMATION_TYPES, JOB_STATUS } from "./automation-v2.server";
import { recordAppOpen } from "./send-time-optimizer.server";

/**
 * Comprehensive event handlers for all event types
 */

/**
 * CART_UPDATED Event Handler
 * Triggered when customer adds items to cart
 * Actions:
 * - Update customer last seen
 * - Track cart value
 * - Prepare for potential cart recovery
 */
export async function handleCartUpdated(
  merchantId: string,
  payload: Record<string, any>,
  shopifyCustomerId?: string
) {
  console.log(`[Event] CART_UPDATED for merchant ${merchantId}`);

  try {
    // Update customer last seen if customer is known
    if (shopifyCustomerId) {
      await db.customerProfile.updateMany({
        where: {
          merchantId,
          shopifyCustomerId
        },
        data: {
          lastSeenAt: new Date()
        }
      });
    }

    // Track cart metrics for analytics
    const cartValue = payload.totalAmount || 0;
    const itemCount = payload.quantity || payload.itemCount || 0;

    console.log(`[Event] Cart updated: ${itemCount} items, $${cartValue}`);

    // If cart has items and customer is known, this could trigger cart recovery later
    if (itemCount > 0 && shopifyCustomerId) {
      console.log(`[Event] Cart recovery candidate: ${shopifyCustomerId}`);
    }

  } catch (error) {
    console.error(`[Event] Failed to handle CART_UPDATED:`, error);
  }
}

/**
 * CART_ABANDONED Event Handler
 * Triggered when cart is abandoned (no activity for X minutes)
 * Actions:
 * - Schedule cart recovery push notification
 * - Track abandonment metrics
 */
export async function handleCartAbandoned(
  merchantId: string,
  payload: Record<string, any>,
  shopifyCustomerId?: string
) {
  console.log(`[Event] CART_ABANDONED for merchant ${merchantId}`);

  try {
    if (!shopifyCustomerId) {
      console.log(`[Event] Cart abandoned but no customer ID - skipping recovery`);
      return;
    }

    // Check if customer has push token
    const pushToken = await db.pushToken.findFirst({
      where: {
        merchantId,
        shopifyCustomerId
      }
    });

    if (!pushToken) {
      console.log(`[Event] No push token for customer - skipping recovery`);
      return;
    }

    // Find active cart recovery rule
    const rule = await db.automationRule.findFirst({
      where: {
        merchantId,
        type: AUTOMATION_TYPES.CART_RECOVERY,
        status: "ACTIVE"
      }
    });

    if (!rule) {
      console.log(`[Event] No active cart recovery rule - skipping`);
      return;
    }

    const config = JSON.parse(rule.config);
    const delayMinutes = config.delayMinutes || 30;

    // Schedule cart recovery job
    const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);

    await db.automationJob.create({
      data: {
        merchantId,
        ruleId: rule.id,
        shopifyCustomerId,
        cartId: payload.cartId,
        status: JOB_STATUS.QUEUED,
        scheduledFor
      }
    });

    console.log(`[Event] Cart recovery scheduled for ${scheduledFor.toISOString()}`);

  } catch (error) {
    console.error(`[Event] Failed to handle CART_ABANDONED:`, error);
  }
}

/**
 * ORDER_CREATED Event Handler
 * Triggered when customer completes a purchase
 * Actions:
 * - Cancel any pending cart recovery
 * - Send order confirmation push
 * - Update customer profile
 * - Track conversion metrics
 */
export async function handleOrderCreated(
  merchantId: string,
  payload: Record<string, any>,
  shopifyCustomerId?: string
) {
  console.log(`[Event] ORDER_CREATED for merchant ${merchantId}`);

  try {
    // Cancel any pending cart recovery jobs
    if (shopifyCustomerId) {
      const cancelledJobs = await db.automationJob.updateMany({
        where: {
          merchantId,
          shopifyCustomerId,
          status: JOB_STATUS.QUEUED,
          rule: {
            type: AUTOMATION_TYPES.CART_RECOVERY
          }
        },
        data: {
          status: JOB_STATUS.COMPLETED,
          result: JSON.stringify({ cancelled: true, reason: "Order completed" })
        }
      });

      console.log(`[Event] Cancelled ${cancelledJobs.count} cart recovery jobs`);
    }

    // Update customer last seen
    if (shopifyCustomerId) {
      await db.customerProfile.updateMany({
        where: {
          merchantId,
          shopifyCustomerId
        },
        data: {
          lastSeenAt: new Date()
        }
      });

      // Check for re-engagement success (purchase counts as re-engagement)
      try {
        const { markReengaged } = await import("./reengagement.server");
        const result = await markReengaged(merchantId, shopifyCustomerId);
        if (result.marked > 0) {
          console.log(`[Event] Marked ${result.marked} re-engagement notifications as successful (purchase)`);
        }
      } catch (error) {
        console.error(`[Event] Failed to mark re-engagement:`, error);
        // Don't fail the entire handler if re-engagement tracking fails
      }
    }

    // Send order confirmation push (optional - can be configured)
    const orderNumber = payload.orderNumber || payload.orderId;
    const orderTotal = payload.totalAmount || 0;

    if (shopifyCustomerId) {
      try {
        await sendPushNotification(
          merchantId,
          "🎉 Order Confirmed!",
          `Thank you for your order #${orderNumber}. We'll send you updates as it ships!`,
          "order"
        );
        console.log(`[Event] Order confirmation push sent`);
      } catch (error) {
        console.error(`[Event] Failed to send order confirmation:`, error);
      }
    }

    console.log(`[Event] Order created: #${orderNumber}, $${orderTotal}`);

  } catch (error) {
    console.error(`[Event] Failed to handle ORDER_CREATED:`, error);
  }
}

/**
 * ORDER_FULFILLED Event Handler
 * Triggered when order is shipped/fulfilled
 * Actions:
 * - Send shipping notification push
 * - Update customer engagement
 * - Track fulfillment metrics
 */
export async function handleOrderFulfilled(
  merchantId: string,
  payload: Record<string, any>,
  shopifyCustomerId?: string
) {
  console.log(`[Event] ORDER_FULFILLED for merchant ${merchantId}`);

  try {
    const orderNumber = payload.orderNumber || payload.orderId;
    const trackingNumber = payload.trackingNumber;
    const trackingUrl = payload.trackingUrl;

    // Send shipping notification
    if (shopifyCustomerId) {
      let message = `Your order #${orderNumber} has shipped!`;
      if (trackingNumber) {
        message += ` Track it with: ${trackingNumber}`;
      }

      try {
        await sendPushNotification(
          merchantId,
          "📦 Order Shipped!",
          message,
          "order"
        );
        console.log(`[Event] Shipping notification sent`);
      } catch (error) {
        console.error(`[Event] Failed to send shipping notification:`, error);
      }
    }

    // Update customer last interaction
    if (shopifyCustomerId) {
      await db.customerProfile.updateMany({
        where: {
          merchantId,
          shopifyCustomerId
        },
        data: {
          lastSeenAt: new Date()
        }
      });
    }

    console.log(`[Event] Order fulfilled: #${orderNumber}`);

  } catch (error) {
    console.error(`[Event] Failed to handle ORDER_FULFILLED:`, error);
  }
}

/**
 * PUSH_REQUESTED Event Handler
 * Triggered when a manual push is sent
 * Actions:
 * - Log push metrics
 * - Track delivery status
 */
export async function handlePushRequested(
  merchantId: string,
  payload: Record<string, any>,
  shopifyCustomerId?: string
) {
  console.log(`[Event] PUSH_REQUESTED for merchant ${merchantId}`);

  try {
    const pushType = payload.pushType || "manual";
    const recipientCount = payload.recipientCount || 0;

    console.log(`[Event] Push sent: ${pushType}, ${recipientCount} recipients`);

    // Track push metrics for analytics
    // This is already logged in the EventLog table

  } catch (error) {
    console.error(`[Event] Failed to handle PUSH_REQUESTED:`, error);
  }
}

/**
 * Additional Event Handlers for Future Implementation
 */

/**
 * PRODUCT_VIEWED Event Handler
 * Track product views for recommendations
 */
export async function handleProductViewed(
  merchantId: string,
  payload: Record<string, any>,
  shopifyCustomerId?: string
) {
  console.log(`[Event] PRODUCT_VIEWED for merchant ${merchantId}`);

  try {
    const productId = payload.productId;
    const productTitle = payload.productTitle;

    if (shopifyCustomerId) {
      // Update customer last seen
      await db.customerProfile.updateMany({
        where: {
          merchantId,
          shopifyCustomerId
        },
        data: {
          lastSeenAt: new Date()
        }
      });
    }

    console.log(`[Event] Product viewed: ${productTitle || productId}`);

  } catch (error) {
    console.error(`[Event] Failed to handle PRODUCT_VIEWED:`, error);
  }
}

/**
 * CUSTOMER_REGISTERED Event Handler
 * Welcome new customers
 */
export async function handleCustomerRegistered(
  merchantId: string,
  payload: Record<string, any>,
  shopifyCustomerId?: string
) {
  console.log(`[Event] CUSTOMER_REGISTERED for merchant ${merchantId}`);

  try {
    if (!shopifyCustomerId) return;

    // Send welcome push notification
    try {
      await sendPushNotification(
        merchantId,
        "👋 Welcome!",
        "Thanks for joining us! Check out our latest products and exclusive offers.",
        "promotional"
      );
      console.log(`[Event] Welcome push sent`);
    } catch (error) {
      console.error(`[Event] Failed to send welcome push:`, error);
    }

  } catch (error) {
    console.error(`[Event] Failed to handle CUSTOMER_REGISTERED:`, error);
  }
}

/**
 * APP_OPENED Event Handler
 * Track app engagement and record for send time optimization
 */
export async function handleAppOpened(
  merchantId: string,
  payload: Record<string, any>,
  shopifyCustomerId?: string
) {
  console.log(`[Event] APP_OPENED for merchant ${merchantId}`);

  try {
    const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();

    if (shopifyCustomerId) {
      // Update customer last seen
      await db.customerProfile.updateMany({
        where: {
          merchantId,
          shopifyCustomerId
        },
        data: {
          lastSeenAt: new Date()
        }
      });

      // Record app open for send time optimization
      try {
        await recordAppOpen(merchantId, shopifyCustomerId, timestamp);
        console.log(`[Event] Recorded app open for send time optimization`);
      } catch (error) {
        console.error(`[Event] Failed to record app open for optimization:`, error);
        // Don't fail the entire handler if optimization tracking fails
      }

      // Check for re-engagement success
      try {
        const { markReengaged } = await import("./reengagement.server");
        const result = await markReengaged(merchantId, shopifyCustomerId);
        if (result.marked > 0) {
          console.log(`[Event] Marked ${result.marked} re-engagement notifications as successful`);
        }
      } catch (error) {
        console.error(`[Event] Failed to mark re-engagement:`, error);
        // Don't fail the entire handler if re-engagement tracking fails
      }
    }

    console.log(`[Event] App opened by customer at ${timestamp.toISOString()}`);

  } catch (error) {
    console.error(`[Event] Failed to handle APP_OPENED:`, error);
  }
}

/**
 * SEARCH_PERFORMED Event Handler
 * Track search queries for insights
 */
export async function handleSearchPerformed(
  merchantId: string,
  payload: Record<string, any>,
  shopifyCustomerId?: string
) {
  console.log(`[Event] SEARCH_PERFORMED for merchant ${merchantId}`);

  try {
    const searchQuery = payload.query;
    const resultsCount = payload.resultsCount || 0;

    console.log(`[Event] Search: "${searchQuery}", ${resultsCount} results`);

    // Could be used for:
    // - Popular search terms
    // - Zero-result searches (add products)
    // - Personalized recommendations

  } catch (error) {
    console.error(`[Event] Failed to handle SEARCH_PERFORMED:`, error);
  }
}