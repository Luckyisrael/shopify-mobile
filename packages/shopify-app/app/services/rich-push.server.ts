import { Expo, ExpoPushMessage } from "expo-server-sdk";
import db from "../db.server";
import { isNotificationAllowed } from "./customer-preferences.server";
import { invalidatePushCache } from "./analytics.server";

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Rich Push Notification Configuration
 */
export interface RichPushConfig {
  title: string;
  body: string;
  imageUrl?: string;
  deepLink?: string;
  actionButtons?: Array<{
    id: string;
    title: string;
    action?: string; // deep link or action identifier
  }>;
  data?: Record<string, any>;
}

/**
 * Validate image URL for rich push notifications
 * 
 * Requirements: 3.2
 * - Must be HTTPS
 * - Must be accessible
 * - Should be optimized for mobile (< 1MB recommended)
 */
export const validateImageUrl = async (imageUrl: string): Promise<{ valid: boolean; error?: string }> => {
  try {
    // Check if URL is HTTPS
    const url = new URL(imageUrl);
    if (url.protocol !== 'https:') {
      return { valid: false, error: 'Image URL must use HTTPS protocol' };
    }

    // Attempt to fetch the image to verify it's accessible
    const response = await fetch(imageUrl, { method: 'HEAD' });
    
    if (!response.ok) {
      return { valid: false, error: `Image URL returned status ${response.status}` };
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      return { valid: false, error: 'URL does not point to an image' };
    }

    // Check file size (warn if > 1MB)
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 1024 * 1024) {
      console.warn(`Image size is ${contentLength} bytes (> 1MB). Consider optimizing for mobile.`);
    }

    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid image URL' 
    };
  }
};

/**
 * Format rich push payload for Expo
 * 
 * Requirements: 3.7, 3.8
 * Converts our rich push config to Expo's format with proper structure
 */
export const formatRichPushPayload = (
  token: string,
  config: RichPushConfig,
  merchantId: string,
  customerId?: string
): ExpoPushMessage => {
  const message: ExpoPushMessage = {
    to: token,
    sound: 'default',
    title: config.title,
    body: config.body,
    data: {
      merchantId,
      customerId,
      type: 'rich',
      ...config.data,
    },
  };

  // Add image if provided
  if (config.imageUrl) {
    // Expo supports images in the data payload
    // The mobile app will handle displaying the image
    message.data = {
      ...message.data,
      imageUrl: config.imageUrl,
    };
  }

  // Add deep link if provided
  if (config.deepLink) {
    message.data = {
      ...message.data,
      deepLink: config.deepLink,
    };
  }

  // Add action buttons if provided (max 2)
  if (config.actionButtons && config.actionButtons.length > 0) {
    const buttons = config.actionButtons.slice(0, 2); // Limit to 2 buttons
    message.data = {
      ...message.data,
      actionButtons: buttons,
    };
  }

  return message;
};

/**
 * Send rich push notification to all customers of a merchant
 * 
 * Requirements: 3.1, 3.2, 3.7, 3.8
 * Respects customer notification preferences
 * 
 * @param merchantId - The merchant ID
 * @param config - Rich push configuration
 * @param segmentFilter - Optional filter for customer segmentation
 * @param category - Notification category for preference checking
 * @returns Result with success count and any errors
 */
export const sendRichPush = async (
  merchantId: string,
  config: RichPushConfig,
  segmentFilter?: {
    customerIds?: string[];
    tags?: string[];
  },
  category: "cart" | "order" | "promotional" | "highlight" = "promotional"
): Promise<{
  success: boolean;
  count: number;
  errors?: string[];
  campaignId?: string;
  blocked?: { category: number; quietHours: number; dailyLimit: number };
}> => {
  const errors: string[] = [];
  const blockedCount = { category: 0, quietHours: 0, dailyLimit: 0 };

  // Validate image URL if provided
  if (config.imageUrl) {
    const validation = await validateImageUrl(config.imageUrl);
    if (!validation.valid) {
      return {
        success: false,
        count: 0,
        errors: [validation.error || 'Invalid image URL'],
      };
    }
  }

  // Validate action buttons (max 2)
  if (config.actionButtons && config.actionButtons.length > 2) {
    return {
      success: false,
      count: 0,
      errors: ['Maximum 2 action buttons allowed'],
    };
  }

  // Create campaign record
  const campaign = await db.pushCampaign.create({
    data: {
      merchantId,
      title: config.title,
      body: config.body,
      imageUrl: config.imageUrl,
      deepLink: config.deepLink,
      actionButtons: config.actionButtons ? JSON.stringify(config.actionButtons) : null,
      audience: segmentFilter?.customerIds ? 'segment' : 'all', // Add required audience field
      status: 'SENDING',
      scheduledFor: new Date(),
      sentAt: new Date(),
    },
  });

  // Fetch tokens based on segment filter
  let tokens;
  if (segmentFilter?.customerIds && segmentFilter.customerIds.length > 0) {
    tokens = await db.pushToken.findMany({
      where: {
        merchantId,
        shopifyCustomerId: {
          in: segmentFilter.customerIds,
        },
      },
    });
  } else {
    tokens = await db.pushToken.findMany({
      where: { merchantId },
    });
  }

  if (!tokens.length) {
    await db.pushCampaign.update({
      where: { id: campaign.id },
      data: { status: 'COMPLETED' },
    });
    return {
      success: true,
      count: 0,
      campaignId: campaign.id,
      errors: ['No registered devices found'],
    };
  }

  // Filter tokens based on customer preferences and format messages
  const messages: ExpoPushMessage[] = [];
  for (const t of tokens) {
    if (!Expo.isExpoPushToken(t.token)) {
      console.warn(`Skipping invalid Expo push token: ${t.token}`);
      errors.push(`Invalid token: ${t.token}`);
      continue;
    }

    // Check preferences if customer is identified
    if (t.shopifyCustomerId) {
      const check = await isNotificationAllowed(
        merchantId,
        t.shopifyCustomerId,
        category
      );

      if (!check.allowed) {
        // Track why notification was blocked
        if (check.reason?.includes("opted out")) {
          blockedCount.category++;
        } else if (check.reason?.includes("quiet hours")) {
          blockedCount.quietHours++;
        } else if (check.reason?.includes("daily limit")) {
          blockedCount.dailyLimit++;
        }
        continue;
      }
    }

    const message = formatRichPushPayload(
      t.token,
      config,
      merchantId,
      t.shopifyCustomerId || undefined
    );
    messages.push(message);
  }

  // Send in chunks
  const chunks = expo.chunkPushNotifications(messages);
  let successCount = 0;
  let failureCount = 0;

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      
      // Process tickets to count successes and failures
      for (const ticket of ticketChunk) {
        if (ticket.status === 'ok') {
          successCount++;
        } else {
          failureCount++;
          if ('message' in ticket) {
            errors.push(ticket.message);
          }
        }
      }
    } catch (error) {
      console.error("Error sending rich push chunk:", error);
      failureCount += chunk.length;
      errors.push(error instanceof Error ? error.message : 'Unknown error sending chunk');
    }
  }

  // Update campaign with results
  await db.pushCampaign.update({
    where: { id: campaign.id },
    data: {
      status: 'SENT',
      sentCount: successCount,
      targetedCount: successCount + failureCount,
    },
  });

  return {
    success: successCount > 0,
    count: successCount,
    campaignId: campaign.id,
    errors: errors.length > 0 ? errors : undefined,
    blocked: blockedCount,
  };

  // Invalidate push cache after sending campaign
  invalidatePushCache(merchantId);

  return result;
};

/**
 * Get rich push campaign details
 * 
 * @param campaignId - Campaign ID
 * @returns Campaign details with metrics
 */
export const getRichPushCampaign = async (campaignId: string) => {
  const campaign = await db.pushCampaign.findUnique({
    where: { id: campaignId },
    include: {
      metrics: true,
    },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  // Parse action buttons if present
  let actionButtons;
  if (campaign.actionButtons) {
    try {
      actionButtons = JSON.parse(campaign.actionButtons);
    } catch (error) {
      console.error('Error parsing action buttons:', error);
    }
  }

  return {
    ...campaign,
    actionButtons,
  };
};

/**
 * Track rich push notification opened
 * 
 * Requirements: 3.11
 * 
 * @param campaignId - Campaign ID
 * @param customerId - Customer ID who opened the notification
 */
export const trackRichPushOpened = async (campaignId: string, customerId?: string) => {
  // Update campaign counts
  await db.pushCampaign.update({
    where: { id: campaignId },
    data: {
      openedCount: {
        increment: 1,
      },
    },
  });

  // Create individual metric record for detailed tracking
  if (customerId) {
    await db.notificationMetric.create({
      data: {
        merchantId: (await db.pushCampaign.findUnique({ where: { id: campaignId } }))!.merchantId,
        campaignId,
        shopifyCustomerId: customerId,
        openedAt: new Date(),
      },
    });
  }

  // Log the event for analytics
  console.log(`Rich push opened - Campaign: ${campaignId}, Customer: ${customerId || 'unknown'}`);
};

/**
 * Track rich push action button clicked
 * 
 * Requirements: 3.12
 * 
 * @param campaignId - Campaign ID
 * @param buttonId - Button ID that was clicked
 * @param customerId - Customer ID who clicked
 */
export const trackRichPushButtonClick = async (
  campaignId: string,
  buttonId: string,
  customerId?: string
) => {
  // Update campaign counts
  await db.pushCampaign.update({
    where: { id: campaignId },
    data: {
      clickedCount: {
        increment: 1,
      },
    },
  });

  // Create individual metric record for detailed tracking
  if (customerId) {
    await db.notificationMetric.create({
      data: {
        merchantId: (await db.pushCampaign.findUnique({ where: { id: campaignId } }))!.merchantId,
        campaignId,
        shopifyCustomerId: customerId,
        clickedAt: new Date(),
        buttonClicked: buttonId,
      },
    });
  }

  // Log the event for detailed analytics
  console.log(
    `Rich push button clicked - Campaign: ${campaignId}, Button: ${buttonId}, Customer: ${customerId || 'unknown'}`
  );
};
