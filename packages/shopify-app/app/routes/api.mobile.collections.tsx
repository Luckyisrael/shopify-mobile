
/**
 * @swagger
 * /api/mobile/collections:
 *   get:
 *     summary: Get Collections
 *     description: Fetch product collections from Shopify Storefront API
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
 *         description: Number of collections to fetch
 *         example: 20
 *       - in: query
 *         name: after
 *         schema:
 *           type: string
 *         description: Cursor for pagination
 *         example: "eyJsYXN0X2lkIjoxMjM0NTY3ODkwfQ=="
 *     responses:
 *       200:
 *         description: Collections retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 collections:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Collection'
 *                 pageInfo:
 *                   type: object
 *                   properties:
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPreviousPage:
 *                       type: boolean
 *                     endCursor:
 *                       type: string
 *                     startCursor:
 *                       type: string
 *       500:
 *         description: Server error
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

    const limit = 10;

    const query = `#graphql
      query getCollections($first: Int!) {
        collections(first: $first) {
          edges {
            node {
              id
              title
              description
              image {
                url
              }
              products(first: 3) {
                 edges {
                    node {
                       id
                       title
                       images(first: 1) {
                         edges {
                           node { url }
                         }
                       }
                    }
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
      },
    });

    if (errors) {
      console.error("Storefront API Errors:", errors);
      throw new Error("Failed to fetch collections from Shopify");
    }

    const collections = data?.collections?.edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      description: edge.node.description,
      image: edge.node.image?.url || null,
      previewProducts: edge.node.products.edges.map((p: any) => ({
        id: p.node.id,
        title: p.node.title,
        image: p.node.images.edges[0]?.node?.url || null
      }))
    })) || [];

    return mobileJson({
      collections,
    });

  } catch (error) {
    return handleMobileError(error);
  }
};
