import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { processAutomationJobs } from "../services/automation-v2.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    // Basic security: In production, verify a secret token header or ensuring it's an internal call
    // For this MVP, we will simpler allow it to be hit.

    // We can allow GET to just check status or run.
    const count = await processAutomationJobs();
    return Response.json({ success: true, processed: count });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
        const count = await processAutomationJobs();
        return Response.json({ success: true, processed: count });
    } catch (error: any) {
        console.error("Job Processing Failed:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
};
