import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { config } from "./config.server";
import { PLANS } from "./billing.constants";
import { PLAN_CONFIGS } from "./services/billing.server";
import { BillingReplacementBehavior } from "@shopify/shopify-app-react-router/server";
import { handleOnboarding } from "./onboarding.server";

const shopify = shopifyApp({
  apiKey: config.shopify.apiKey,
  apiSecretKey: config.shopify.apiSecret || "",
  apiVersion: ApiVersion.October25,
  scopes: config.shopify.scopes,
  appUrl: config.shopify.appUrl || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  billing: {
    [PLANS.PRO]: {
      amount: PLAN_CONFIGS[PLANS.PRO].amount,
      currencyCode: PLAN_CONFIGS[PLANS.PRO].currencyCode,
      interval: PLAN_CONFIGS[PLANS.PRO].interval,
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
    },
    [PLANS.ENTERPRISE]: {
      amount: PLAN_CONFIGS[PLANS.ENTERPRISE].amount,
      currencyCode: PLAN_CONFIGS[PLANS.ENTERPRISE].currencyCode,
      interval: PLAN_CONFIGS[PLANS.ENTERPRISE].interval,
      replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
    }
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      await shopify.registerWebhooks({ session });
      if (session.accessToken) {
        await handleOnboarding({ session: { ...session, accessToken: session.accessToken }, admin });
      }
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
