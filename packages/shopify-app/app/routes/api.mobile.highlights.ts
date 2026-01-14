/**
 * @swagger
 * /api/mobile/highlights:
 *   get:
 *     summary: Get Product Highlights
 *     description: Fetch active product highlights (stories) for the mobile app
 *     tags: [Product Highlights]
 *     security:
 *       - ShopDomain: []
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Optional highlight ID to fetch specific highlight (also tracks view)
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Highlights retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   description: Single highlight response
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     highlight:
 *                       $ref: '#/components/schemas/ProductHighlight'
 *                 - type: object
 *                   description: Multiple highlights response
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     highlights:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ProductHighlight'
 *                     count:
 *                       type: integer
 *                       description: Number of active highlights
 *                       example: 3
 *       404:
 *         description: Highlight not found (when ID specified)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Track Highlight Interaction
 *     description: Track clicks and other interactions with product highlights
 *     tags: [Product Highlights]
 *     security:
 *       - ShopDomain: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - highlightId
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [click]
 *                 description: Type of interaction to track
 *                 example: "click"
 *               highlightId:
 *                 type: string
 *                 description: ID of the highlight being interacted with
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Interaction tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Click tracked"
 *                 highlight:
 *                   type: object
 *                   description: Updated highlight with new click count
 *                   properties:
 *                     id:
 *                       type: string
 *                     clickCount:
 *                       type: integer
 *                       example: 24
 *       400:
 *         description: Missing required fields or invalid action
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Highlight not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireMerchant, mobileJson, handleMobileError } from "app/services/mobile.server";
import { 
  getActiveHighlights, 
  trackHighlightView, 
  trackHighlightClick,
  getHighlightById
} from "app/services/product-highlights.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const merchant = await requireMerchant(request);
    const url = new URL(request.url);
    const highlightId = url.searchParams.get("id");

    if (highlightId) {
      // Get specific highlight
      const highlight = await getHighlightById(merchant.id, highlightId);
      
      if (!highlight) {
        return mobileJson({ error: "Highlight not found" }, 404);
      }

      // Track view
      await trackHighlightView(highlightId);

      return mobileJson({
        success: true,
        highlight
      });
    } else {
      // Get all active highlights
      const highlights = await getActiveHighlights(merchant.id);

      return mobileJson({
        success: true,
        highlights,
        count: highlights.length
      });
    }

  } catch (error) {
    return handleMobileError(error);
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return mobileJson({ error: "Method not allowed" }, 405);
  }

  try {
    const merchant = await requireMerchant(request);
    const body = await request.json();
    const { action, highlightId } = body;

    if (!highlightId) {
      return mobileJson({ error: "Highlight ID is required" }, 400);
    }

    // Verify highlight belongs to merchant
    const highlight = await getHighlightById(merchant.id, highlightId);
    if (!highlight) {
      return mobileJson({ error: "Highlight not found" }, 404);
    }

    if (action === "click") {
      await trackHighlightClick(highlightId);
      
      return mobileJson({
        success: true,
        message: "Click tracked",
        highlight: {
          ...highlight,
          clickCount: highlight.clickCount + 1
        }
      });
    }

    return mobileJson({ error: "Invalid action" }, 400);

  } catch (error) {
    return handleMobileError(error);
  }
};