import db from "../db.server";
import { getStorefrontClient } from "./mobile.server";

// --- GraphQL Mutations ---

const CUSTOMER_CREATE_MUTATION = `
  mutation customerCreate($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer {
        id
        firstName
        lastName
        email
        phone
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
`;

const CUSTOMER_ACCESS_TOKEN_CREATE_MUTATION = `
  mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
    customerAccessTokenCreate(input: $input) {
      customerAccessToken {
        accessToken
        expiresAt
      }
      customerUserErrors {
        message
      }
    }
  }
`;

const CUSTOMER_ACCESS_TOKEN_DELETE_MUTATION = `
  mutation customerAccessTokenDelete($customerAccessToken: String!) {
    customerAccessTokenDelete(customerAccessToken: $customerAccessToken) {
      deletedAccessToken
      deletedCustomerAccessTokenId
      userErrors {
        message
      }
    }
  }
`;

const CUSTOMER_ACCESS_TOKEN_RENEW_MUTATION = `
  mutation customerAccessTokenRenew($customerAccessToken: String!) {
    customerAccessTokenRenew(customerAccessToken: $customerAccessToken) {
      customerAccessToken {
        accessToken
        expiresAt
      }
      userErrors {
        message
      }
    }
  }
`;

const CUSTOMER_QUERY = `
  query getCustomer($customerAccessToken: String!) {
    customer(customerAccessToken: $customerAccessToken) {
      id
      firstName
      lastName
      email
      phone
    }
  }
`;

// --- Service Functions ---

export async function createCustomer(
    merchantId: string,
    shopDomain: string,
    storefrontToken: string,
    input: { email: string; password: string; firstName?: string; lastName?: string }
) {
    const client = await getStorefrontClient(shopDomain, storefrontToken);

    const { data, errors } = await client.request(CUSTOMER_CREATE_MUTATION, {
        variables: { input }
    });

    if (errors && Array.isArray(errors)) {
        throw new Error(errors[0]?.message || "Failed to create customer");
    }

    const result = data?.customerCreate;
    if (result?.customerUserErrors?.length > 0) {
        throw new Error(result.customerUserErrors[0].message);
    }

    const customer = result?.customer;
    if (!customer) {
        throw new Error("Customer creation failed - no customer returned");
    }

    // Create local profile
    await db.customerProfile.upsert({
        where: { merchantId_shopifyCustomerId: { merchantId, shopifyCustomerId: customer.id } },
        create: {
            merchantId,
            shopifyCustomerId: customer.id,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
        },
        update: {
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            lastSeenAt: new Date(),
        }
    });

    return customer;
}

export async function loginCustomer(
    merchantId: string,
    shopDomain: string,
    storefrontToken: string,
    input: { email: string; password: string },
    pushToken?: string
) {
    const client = await getStorefrontClient(shopDomain, storefrontToken);

    // 1. Get Access Token
    const { data: tokenData } = await client.request(CUSTOMER_ACCESS_TOKEN_CREATE_MUTATION, {
        variables: { input: { email: input.email, password: input.password } }
    });

    const tokenResult = tokenData?.customerAccessTokenCreate;
    if (tokenResult?.customerUserErrors?.length > 0) {
        throw new Error(tokenResult.customerUserErrors[0].message);
    }

    const accessToken = tokenResult?.customerAccessToken?.accessToken;
    const expiresAt = tokenResult?.customerAccessToken?.expiresAt;

    if (!accessToken) throw new Error("Failed to retrieve access token");

    // 2. Fetch Customer Details (to get ID)
    const { data: customerData } = await client.request(CUSTOMER_QUERY, {
        variables: { customerAccessToken: accessToken }
    });

    const customer = customerData?.customer;
    if (!customer) throw new Error("Failed to fetch customer details");

    // 3. Persist Session locally
    await db.customerSession.create({
        data: {
            merchantId,
            shopifyCustomerId: customer.id,
            customerAccessToken: accessToken,
            expiresAt: new Date(expiresAt)
        }
    });

    // 4. Update Profile
    await db.customerProfile.upsert({
        where: { merchantId_shopifyCustomerId: { merchantId, shopifyCustomerId: customer.id } },
        create: {
            merchantId,
            shopifyCustomerId: customer.id,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
        },
        update: {
            lastSeenAt: new Date()
        }
    });

    // 5. Link Push Token if provided
    if (pushToken) {
        // Find the token first to ensure it belongs to this merchant (security)
        const existingToken = await db.pushToken.findFirst({
            where: { merchantId, token: pushToken }
        });

        if (existingToken) {
            await db.pushToken.update({
                where: { id: existingToken.id },
                data: { shopifyCustomerId: customer.id }
            });
        }
    }

    return {
        customer,
        accessToken,
        expiresAt
    };
}

export async function logoutCustomer(
    merchantId: string,
    shopDomain: string,
    storefrontToken: string,
    accessToken: string,
    pushToken?: string
) {
    const client = await getStorefrontClient(shopDomain, storefrontToken);

    // 1. Delete from Shopify
    await client.request(CUSTOMER_ACCESS_TOKEN_DELETE_MUTATION, {
        variables: { customerAccessToken: accessToken }
    });

    // 2. Delete local session
    await db.customerSession.deleteMany({
        where: { merchantId, customerAccessToken: accessToken }
    });

    // 3. Unlink Push Token
    if (pushToken) {
        const existingToken = await db.pushToken.findUnique({
            where: { merchantId_token: { merchantId, token: pushToken } }
        });

        if (existingToken) {
            await db.pushToken.update({
                where: { id: existingToken.id },
                data: { shopifyCustomerId: null }
            });
        }
    }

    return true;
}

export async function refreshCustomerToken(
    merchantId: string,
    shopDomain: string,
    storefrontToken: string,
    currentAccessToken: string
) {
    const client = await getStorefrontClient(shopDomain, storefrontToken);

    const { data, errors } = await client.request(CUSTOMER_ACCESS_TOKEN_RENEW_MUTATION, {
        variables: { customerAccessToken: currentAccessToken }
    });

    if (errors && Array.isArray(errors)) {
        throw new Error(errors[0]?.message || "Failed to refresh token");
    }

    const result = data?.customerAccessTokenRenew;
    if (result?.userErrors?.length > 0) {
        throw new Error(result.userErrors[0].message);
    }

    const newAccessToken = result?.customerAccessToken?.accessToken;
    const expiresAt = result?.customerAccessToken?.expiresAt;

    if (!newAccessToken) {
        throw new Error("Failed to refresh access token");
    }

    // Update local session
    await db.customerSession.updateMany({
        where: { 
            merchantId, 
            customerAccessToken: currentAccessToken 
        },
        data: {
            customerAccessToken: newAccessToken,
            expiresAt: new Date(expiresAt)
        }
    });

    return {
        accessToken: newAccessToken,
        expiresAt
    };
}

export async function getCustomerByToken(
    merchantId: string,
    shopDomain: string,
    storefrontToken: string,
    accessToken: string
) {
    const client = await getStorefrontClient(shopDomain, storefrontToken);

    const { data, errors } = await client.request(CUSTOMER_QUERY, {
        variables: { customerAccessToken: accessToken }
    });

    if (errors && Array.isArray(errors)) {
        throw new Error(errors[0]?.message || "Failed to fetch customer");
    }

    const customer = data?.customer;
    if (!customer) {
        throw new Error("Customer not found or token expired");
    }

    // Update last seen
    await db.customerProfile.updateMany({
        where: { 
            merchantId, 
            shopifyCustomerId: customer.id 
        },
        data: { lastSeenAt: new Date() }
    });

    return customer;
}