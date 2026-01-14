import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { processReengagement } from "../services/reengagement.server";
import { rateLimit } from "../middleware/security.server";
import db from "../db.server";

/**
 * Re-engagement job processor
 * This endpoint should be called by a daily cron job
 * 
 * Example cron schedule: 0 10 * * * (daily at 10 AM)
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
    // Security: Check for internal processing token
    const authHeader = request.headers.get("Authorization");
    const expectedToken = process.env.JOB_PROCESSING_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
        return mobileJson({ error: "Unauthorized" }, 401);
    }
    
    // Rate limiting
    const clientIP = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitResult = rateLimit(`reengagement-process:${clientIP}`, 5, 60000); // 5 requests per minute
    
    if (!rateLimitResult.allowed) {
        return mobileJson({ error: "Rate limit exceeded" }, 429);
    }

    try {
        console.log("[Reengagement Job] Starting daily re-engagement processing");
        
        // Get all merchants with active re-engagement campaigns
        const merchants = await db.merchant.findMany({
            where: {
                reengagementCampaigns: {
                    some: {
                        isActive: true,
                    },
                },
            },
            select: {
                id: true,
                shop: true,
            },
        });

        console.log(`[Reengagement Job] Found ${merchants.length} merchants with active campaigns`);

        let totalProcessed = 0;
        let totalSent = 0;
        const results = [];

        for (const merchant of merchants) {
            try {
                const result = await processReengagement(merchant.id);
                totalProcessed += result.processed;
                totalSent += result.sent;
                
                results.push({
                    merchantId: merchant.id,
                    shop: merchant.shop,
                    processed: result.processed,
                    sent: result.sent,
                });
            } catch (error: any) {
                console.error(`[Reengagement Job] Failed for merchant ${merchant.id}:`, error);
                results.push({
                    merchantId: merchant.id,
                    shop: merchant.shop,
                    error: error.message,
                });
            }
        }

        console.log(`[Reengagement Job] Completed: ${totalProcessed} customers processed, ${totalSent} notifications sent`);

        return mobileJson({ 
            success: true, 
            merchants: merchants.length,
            totalProcessed,
            totalSent,
            results,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error("[Reengagement Job] Error:", error);
        return handleMobileError(error);
    }
};

export const action = async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
        return mobileJson({ error: "Method not allowed" }, 405);
    }

    // Security: Check for internal processing token
    const authHeader = request.headers.get("Authorization");
    const expectedToken = process.env.JOB_PROCESSING_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
        return mobileJson({ error: "Unauthorized" }, 401);
    }

    // Rate limiting
    const clientIP = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitResult = rateLimit(`reengagement-process:${clientIP}`, 3, 60000); // 3 requests per minute
    
    if (!rateLimitResult.allowed) {
        return mobileJson({ error: "Rate limit exceeded" }, 429);
    }

    try {
        console.log("[Reengagement Job] Starting manual re-engagement processing");
        
        // Get all merchants with active re-engagement campaigns
        const merchants = await db.merchant.findMany({
            where: {
                reengagementCampaigns: {
                    some: {
                        isActive: true,
                    },
                },
            },
            select: {
                id: true,
                shop: true,
            },
        });

        console.log(`[Reengagement Job] Found ${merchants.length} merchants with active campaigns`);

        let totalProcessed = 0;
        let totalSent = 0;
        const results = [];

        for (const merchant of merchants) {
            try {
                const result = await processReengagement(merchant.id);
                totalProcessed += result.processed;
                totalSent += result.sent;
                
                results.push({
                    merchantId: merchant.id,
                    shop: merchant.shop,
                    processed: result.processed,
                    sent: result.sent,
                });
            } catch (error: any) {
                console.error(`[Reengagement Job] Failed for merchant ${merchant.id}:`, error);
                results.push({
                    merchantId: merchant.id,
                    shop: merchant.shop,
                    error: error.message,
                });
            }
        }

        console.log(`[Reengagement Job] Completed: ${totalProcessed} customers processed, ${totalSent} notifications sent`);

        return mobileJson({ 
            success: true, 
            merchants: merchants.length,
            totalProcessed,
            totalSent,
            results,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error("[Reengagement Job] Error:", error);
        return handleMobileError(error);
    }
};
