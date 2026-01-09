import type { ActionFunctionArgs } from "react-router";
import { registerDevice } from "app/services/push.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    // Handle CORS preflight if this route were to receive OPTIONS (though usually handled by server framework)
    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Shop-Domain",
            }
        });
    }

    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const shopDomain = request.headers.get("X-Shop-Domain");
    if (!shopDomain) {
        return Response.json({ error: "Missing X-Shop-Domain header" }, {
            status: 400,
            headers: { "Access-Control-Allow-Origin": "*" }
        });
    }

    try {
        const body = await request.json();
        const { deviceToken, platform } = body;

        if (!deviceToken || !platform) {
            return Response.json({ error: "Missing deviceToken or platform" }, {
                status: 400,
                headers: { "Access-Control-Allow-Origin": "*" }
            });
        }

        await registerDevice(shopDomain, deviceToken, platform);

        return Response.json({ success: true }, {
            headers: { "Access-Control-Allow-Origin": "*" }
        });
    } catch (error: any) {
        console.error("Registration failed:", error);
        return Response.json({ error: error.message || "Internal Server Error" }, {
            status: 500,
            headers: { "Access-Control-Allow-Origin": "*" }
        });
    }
};
