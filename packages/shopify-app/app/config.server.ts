
const requiredEnvVars = [
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET",
    "SHOPIFY_APP_URL",
];

const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
    throw new Error(
        `Missing required environment variables: ${missingVars.join(", ")}`
    );
}

export const config = {
    shopify: {
        apiKey: process.env.SHOPIFY_API_KEY!,
        apiSecret: process.env.SHOPIFY_API_SECRET!,
        apiVersion: process.env.SHOPIFY_API_VERSION || "2025-01",
        scopes: (process.env.SCOPES || "read_products,read_customers,read_orders,write_checkouts").split(","),
        appUrl: process.env.SHOPIFY_APP_URL!,
    },
};
