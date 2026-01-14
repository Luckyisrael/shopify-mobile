import db from "../db.server";
import { sendPushNotification } from "./push.server";
import { checkUsageLimit, logUsage } from "./billing.server";

export interface CreateHighlightData {
  shopifyProductId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  productUrl?: string;
  ctaText?: string;
}

export interface ProductHighlightWithStats {
  id: string;
  shopifyProductId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  ctaText: string;
  isActive: boolean;
  expiresAt: Date;
  viewCount: number;
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
  timeRemaining: number; // milliseconds until expiry
  isExpired: boolean;
}

/**
 * Create a new product highlight
 */
export async function createProductHighlight(
  merchantId: string,
  data: CreateHighlightData,
  sendNotification: boolean = true
): Promise<ProductHighlightWithStats> {
  
  // Check usage limits (20 free highlights per month)
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  
  const highlightsThisMonth = await db.productHighlight.count({
    where: {
      merchantId,
      createdAt: { gte: currentMonth }
    }
  });

  await checkUsageLimit(merchantId, 'PRODUCT_HIGHLIGHT', highlightsThisMonth);

  // Create highlight (expires in 48 hours)
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  
  const highlight = await db.productHighlight.create({
    data: {
      merchantId,
      shopifyProductId: data.shopifyProductId,
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      productUrl: data.productUrl,
      ctaText: data.ctaText || "Shop Now",
      expiresAt
    }
  });

  // Log usage for billing
  await logUsage(merchantId, 'PRODUCT_HIGHLIGHT');

  // Send push notification about new highlight
  if (sendNotification) {
    try {
      await sendPushNotification(
        merchantId,
        `🌟 New Product Highlight: ${data.title}`,
        data.description || "Check out our featured product!",
        {
          type: "PRODUCT_HIGHLIGHT",
          highlightId: highlight.id,
          productId: data.shopifyProductId
        }
      );
    } catch (error) {
      console.error("Failed to send highlight notification:", error);
      // Don't fail the highlight creation if notification fails
    }
  }

  return formatHighlightWithStats(highlight);
}

/**
 * Get active highlights for a merchant
 */
export async function getActiveHighlights(merchantId: string): Promise<ProductHighlightWithStats[]> {
  const highlights = await db.productHighlight.findMany({
    where: {
      merchantId,
      isActive: true,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });

  return highlights.map(formatHighlightWithStats);
}

/**
 * Get all highlights (including expired) for admin
 */
export async function getAllHighlights(merchantId: string): Promise<ProductHighlightWithStats[]> {
  const highlights = await db.productHighlight.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'desc' }
  });

  return highlights.map(formatHighlightWithStats);
}

/**
 * Get a specific highlight by ID
 */
export async function getHighlightById(
  merchantId: string, 
  highlightId: string
): Promise<ProductHighlightWithStats | null> {
  const highlight = await db.productHighlight.findFirst({
    where: {
      id: highlightId,
      merchantId
    }
  });

  return highlight ? formatHighlightWithStats(highlight) : null;
}

/**
 * Track highlight view
 */
export async function trackHighlightView(highlightId: string): Promise<void> {
  await db.productHighlight.update({
    where: { id: highlightId },
    data: { viewCount: { increment: 1 } }
  });
}

/**
 * Track highlight click
 */
export async function trackHighlightClick(highlightId: string): Promise<void> {
  await db.productHighlight.update({
    where: { id: highlightId },
    data: { clickCount: { increment: 1 } }
  });
}

/**
 * Deactivate a highlight
 */
export async function deactivateHighlight(
  merchantId: string, 
  highlightId: string
): Promise<boolean> {
  const result = await db.productHighlight.updateMany({
    where: {
      id: highlightId,
      merchantId
    },
    data: { isActive: false }
  });

  return result.count > 0;
}

/**
 * Clean up expired highlights (run via cron)
 */
export async function cleanupExpiredHighlights(): Promise<number> {
  const result = await db.productHighlight.updateMany({
    where: {
      expiresAt: { lt: new Date() },
      isActive: true
    },
    data: { isActive: false }
  });

  console.log(`[Cleanup] Deactivated ${result.count} expired highlights`);
  return result.count;
}

/**
 * Get highlight statistics for analytics
 */
export async function getHighlightStats(merchantId: string) {
  const [total, active, expired, stats] = await Promise.all([
    // Total highlights created
    db.productHighlight.count({
      where: { merchantId }
    }),
    
    // Currently active
    db.productHighlight.count({
      where: {
        merchantId,
        isActive: true,
        expiresAt: { gt: new Date() }
      }
    }),
    
    // Expired highlights
    db.productHighlight.count({
      where: {
        merchantId,
        expiresAt: { lt: new Date() }
      }
    }),
    
    // Aggregate stats
    db.productHighlight.aggregate({
      where: { merchantId },
      _sum: {
        viewCount: true,
        clickCount: true
      },
      _avg: {
        viewCount: true,
        clickCount: true
      }
    })
  ]);

  const clickThroughRate = stats._sum.viewCount && stats._sum.viewCount > 0 
    ? (stats._sum.clickCount || 0) / stats._sum.viewCount * 100 
    : 0;

  return {
    total,
    active,
    expired,
    totalViews: stats._sum.viewCount || 0,
    totalClicks: stats._sum.clickCount || 0,
    averageViews: Math.round(stats._avg.viewCount || 0),
    averageClicks: Math.round(stats._avg.clickCount || 0),
    clickThroughRate: Math.round(clickThroughRate * 100) / 100
  };
}

/**
 * Format highlight with calculated stats
 */
function formatHighlightWithStats(highlight: any): ProductHighlightWithStats {
  const now = Date.now();
  const expiresAt = new Date(highlight.expiresAt).getTime();
  const timeRemaining = Math.max(0, expiresAt - now);
  const isExpired = timeRemaining === 0;

  return {
    ...highlight,
    timeRemaining,
    isExpired
  };
}

/**
 * Auto-create highlights for new products (premium feature)
 */
export async function autoHighlightNewProducts(): Promise<void> {
  // This would be called via webhook when new products are created
  // Implementation would fetch recent products and auto-create highlights
  // for Pro/Enterprise merchants only
  
  console.log("[Auto-Highlight] Feature not yet implemented - requires product webhooks");
}