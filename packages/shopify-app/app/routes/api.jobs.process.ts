import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { mobileJson, handleMobileError } from "../services/mobile.server";
import { processAutomationJobs } from "../services/automation-v2.server";
import { rateLimit } from "../middleware/security.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    // Security: Check for internal processing token
    const authHeader = request.headers.get("Authorization");
    const expectedToken = process.env.JOB_PROCESSING_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
        return mobileJson({ error: "Unauthorized" }, 401);
    }
    
    // Rate limiting
    const clientIP = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitResult = rateLimit(`job-process:${clientIP}`, 10, 60000); // 10 requests per minute
    
    if (!rateLimitResult.allowed) {
        return mobileJson({ error: "Rate limit exceeded" }, 429);
    }

    try {
        const count = await processAutomationJobs();
        return mobileJson({ 
            success: true, 
            processed: count,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("[Job Processing] Error:", error);
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
    const rateLimitResult = rateLimit(`job-process:${clientIP}`, 5, 60000); // 5 requests per minute
    
    if (!rateLimitResult.allowed) {
        return mobileJson({ error: "Rate limit exceeded" }, 429);
    }

    try {
        const count = await processAutomationJobs();
        return mobileJson({ 
            success: true, 
            processed: count,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error("Job Processing Failed:", error);
        return handleMobileError(error);
    }
};
