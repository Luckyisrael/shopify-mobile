import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`;
    
    // Check if we can access merchant table
    const merchantCount = await db.merchant.count();
    
    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      merchants: merchantCount,
      version: process.env.npm_package_version || "unknown"
    });
  } catch (error) {
    return Response.json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 503 });
  }
};