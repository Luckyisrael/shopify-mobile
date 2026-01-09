
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
