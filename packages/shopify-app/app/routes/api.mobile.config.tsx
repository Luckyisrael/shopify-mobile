/**
 * @swagger
 * /api/mobile/config:
 *   get:
 *     summary: Get Mobile App Configuration
 *     description: Fetch mobile app branding and configuration settings
 *     tags: [Configuration]
 *     security:
 *       - ShopDomain: []
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 appName:
 *                   type: string
 *                   description: Mobile app display name
 *                   example: "My Store"
 *                 primaryColor:
 *                   type: string
 *                   description: Primary brand color (hex code)
 *                   example: "#FF6B6B"
 *                 logoUrl:
 *                   type: string
 *                   format: uri
 *                   nullable: true
 *                   description: URL to app logo image
 *                   example: "https://cdn.shopify.com/logo.png"
 *                 shopDomain:
 *                   type: string
 *                   description: Shopify store domain
 *                   example: "mystore.myshopify.com"
 *                 isActive:
 *                   type: boolean
 *                   description: Whether mobile app is active
 *                   example: true
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import type { LoaderFunctionArgs} from "react-router";
import { handleMobileError, mobileJson, requireMerchant } from "../services/mobile.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        const merchant = await requireMerchant(request);

        // We assume the first mobile app is the "active" one for now as per Phase 1
        const mobileApp = merchant.mobileApps[0];

        return mobileJson({
            appName: mobileApp?.appName || merchant.shop,
            primaryColor: mobileApp?.primaryColor || "#000000",
            logoUrl: mobileApp?.logoUrl || null,
            shopDomain: merchant.shop,
            isActive: mobileApp?.isActive ?? false,
        });
    } catch (error) {
        return handleMobileError(error);
    }
};
