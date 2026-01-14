
/**
 * @swagger
 * /api/mobile/products:
 *   get:
 *     summary: Get Products
 *     description: Fetch products from Shopify Storefront API with pagination
 *     tags: [Products]
 *     security:
 *       - ShopDomain: []
 *     parameters:
 *       - in: query
 *         name: first
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 250
 *           default: 20
 *         description: Number of products to fetch
 *         example: 20
 *       - in: query
 *         name: after
 *         schema:
 *           type: string
 *         description: Cursor for pagination (from previous response)
 *         example: "eyJsYXN0X2lkIjoxMjM0NTY3ODkwfQ=="
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query to filter products
 *         example: "shirt"
 *       - in: query
 *         name: sortKey
 *         schema:
 *           type: string
 *           enum: [TITLE, PRICE, CREATED_AT, UPDATED_AT, BEST_SELLING, RELEVANCE]
 *           default: CREATED_AT
 *         description: Sort products by specified field
 *         example: "PRICE"
 *       - in: query
 *         name: reverse
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Reverse the sort order
 *         example: false
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pageInfo:
 *                   type: object
 *                   properties:
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPreviousPage:
 *                       type: boolean
 *                       example: false
 *                     endCursor:
 *                       type: string
 *                       example: "eyJsYXN0X2lkIjoxMjM0NTY3ODkwfQ=="
 *                     startCursor:
 *                       type: string
 *                       example: "eyJmaXJzdF9pZCI6MTIzNDU2Nzg5MH0="
 *       400:
 *         description: Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error or merchant not configured
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
import type { LoaderFunctionArgs } from "react-router";
import { getStorefrontClient, handleMobileError, mobileJson, requireMerchant } from "../services/mobile.server";



export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const merchant = await requireMerchant(request);
    const client = await getStorefrontClient(merchant.shop, merchant.storefrontToken!);

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limit = 10;

    const query = `#graphql
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              availableForSale
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;

    const { data, errors } = await client.request(query, {
      variables: {
        first: limit,
        after: cursor || null,
      },
    });

    if (errors) {
      console.error("Storefront API Errors:", errors);
      throw new Error("Failed to fetch products from Shopify");
    }

    // Shape the response
    const products = data?.products?.edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      availableForSale: edge.node.availableForSale,
      image: edge.node.images.edges[0]?.node?.url || null,
      price: {
        amount: edge.node.priceRange.minVariantPrice.amount,
        currencyCode: edge.node.priceRange.minVariantPrice.currencyCode,
      },
    })) || [];

    return mobileJson({
      products,
      pageInfo: data?.products?.pageInfo,
    });

  } catch (error) {
    return handleMobileError(error);
  }
};
