import { callShopifyGraphQL } from '@/lib/shopify-api';

const SHOPIFY_BILLING_TEST = process.env.SHOPIFY_BILLING_TEST === 'true';

// ─── Detection ──────────────────────────────────────────────────

/**
 * Determine if a store should be billed through Shopify Billing API.
 * True for stores installed from the Shopify App Store (have a real
 * myshopify.com domain and a valid access token).
 */
export function isShopifyBilledStore(store: {
  shopifyDomain?: string | null;
  accessToken?: string | null;
}): boolean {
  const domain = store.shopifyDomain || '';
  return (
    domain.endsWith('.myshopify.com') &&
    !domain.startsWith('default-') &&
    !!store.accessToken
  );
}

// ─── Managed Pricing (Shopify App Pricing) ─────────────────────

/**
 * Build the Shopify-hosted plan-selection URL for a Managed Pricing app.
 *
 * The app is enrolled in Shopify App Pricing (Managed Pricing), which is
 * mutually exclusive with the Billing API. Merchants pick a plan and approve
 * the charge on Shopify's hosted page, then Shopify redirects back to the
 * per-plan configured redirect URL with `?plan_handle=<handle>&shop=<domain>`.
 *
 * URL format:
 *   https://admin.shopify.com/store/{store_handle}/charges/{app_handle}/pricing_plans
 *
 * @param shopifyDomain e.g. "tsg-api.myshopify.com"
 * @returns the absolute pricing-plans URL
 */
export function buildManagedPricingUrl(shopifyDomain: string): string {
  const storeHandle = shopifyDomain.replace(/\.myshopify\.com$/, '');
  const appHandle = process.env.SHOPIFY_APP_HANDLE || '';
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}

// ─── GraphQL Mutations / Queries ────────────────────────────────

const APP_SUBSCRIPTION_CREATE = `
  mutation appSubscriptionCreate(
    $name: String!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $returnUrl: URL!
    $test: Boolean
  ) {
    appSubscriptionCreate(
      name: $name
      lineItems: $lineItems
      returnUrl: $returnUrl
      test: $test
    ) {
      appSubscription {
        id
        status
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

const APP_SUBSCRIPTION_CANCEL = `
  mutation appSubscriptionCancel($id: ID!) {
    appSubscriptionCancel(id: $id) {
      appSubscription {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const ACTIVE_SUBSCRIPTIONS_QUERY = `
  query {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        currentPeriodEnd
        lineItems {
          plan {
            pricingDetails {
              ... on AppRecurringPricing {
                price { amount currencyCode }
                interval
              }
            }
          }
        }
      }
    }
  }
`;

const SUBSCRIPTION_STATUS_QUERY = `
  query subscriptionStatus($id: ID!) {
    node(id: $id) {
      ... on AppSubscription {
        id
        name
        status
        createdAt
        currentPeriodEnd
      }
    }
  }
`;

// ─── Functions ──────────────────────────────────────────────────

/**
 * @deprecated The app is enrolled in Shopify Managed Pricing, which forbids the
 * Billing API ("Managed Pricing Apps cannot use the Billing API"). Use
 * {@link buildManagedPricingUrl} to redirect merchants to Shopify's hosted
 * pricing page instead. Kept for reference / potential future Billing-API mode.
 *
 * Create a Shopify app subscription (recurring charge).
 * Returns the confirmation URL that the merchant must visit to approve.
 */
export async function createShopifySubscription(params: {
  shop: string;
  accessToken: string;
  planName: string;
  priceUSD: number;
  returnUrl: string;
  test?: boolean;
}): Promise<{ confirmationUrl: string; subscriptionId: string }> {
  const { shop, accessToken, planName, priceUSD, returnUrl, test } = params;
  const isTest = test ?? SHOPIFY_BILLING_TEST;

  const variables = {
    name: planName,
    returnUrl,
    test: isTest,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: {
              amount: priceUSD,
              currencyCode: 'USD',
            },
            interval: 'EVERY_30_DAYS',
          },
        },
      },
    ],
  };

  const data = await callShopifyGraphQL(shop, APP_SUBSCRIPTION_CREATE, variables, accessToken);
  const result = data.appSubscriptionCreate;

  if (result.userErrors?.length > 0) {
    const errors = result.userErrors.map((e: any) => e.message).join(', ');
    throw new Error(`Shopify billing error: ${errors}`);
  }

  if (!result.confirmationUrl) {
    throw new Error('Shopify did not return a confirmation URL');
  }

  return {
    confirmationUrl: result.confirmationUrl,
    subscriptionId: result.appSubscription.id,
  };
}

/**
 * Check the status of a Shopify app subscription by its GID.
 */
export async function getShopifySubscriptionStatus(
  shop: string,
  accessToken: string,
  subscriptionId: string,
): Promise<{
  id: string;
  name: string;
  status: string;
  currentPeriodEnd?: string;
}> {
  const data = await callShopifyGraphQL(shop, SUBSCRIPTION_STATUS_QUERY, {
    id: subscriptionId,
  }, accessToken);

  if (!data.node) {
    throw new Error(`Subscription ${subscriptionId} not found`);
  }

  return data.node;
}

/**
 * Cancel a Shopify app subscription.
 */
export async function cancelShopifySubscription(
  shop: string,
  accessToken: string,
  subscriptionId: string,
): Promise<void> {
  const data = await callShopifyGraphQL(shop, APP_SUBSCRIPTION_CANCEL, {
    id: subscriptionId,
  }, accessToken);

  const result = data.appSubscriptionCancel;
  if (result.userErrors?.length > 0) {
    const errors = result.userErrors.map((e: any) => e.message).join(', ');
    throw new Error(`Shopify cancellation error: ${errors}`);
  }
}

/**
 * Get the currently active Shopify subscription for this app installation.
 */
export async function getActiveShopifySubscription(
  shop: string,
  accessToken: string,
): Promise<any | null> {
  const data = await callShopifyGraphQL(shop, ACTIVE_SUBSCRIPTIONS_QUERY, undefined, accessToken);

  const subs = data.currentAppInstallation?.activeSubscriptions || [];
  return subs.length > 0 ? subs[0] : null;
}

/**
 * Map Shopify subscription status to our internal SubscriptionStatus enum.
 */
export function mapShopifyStatus(
  shopifyStatus: string,
): 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'UNPAID' {
  switch (shopifyStatus.toUpperCase()) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'FROZEN':
      return 'PAST_DUE';
    case 'CANCELLED':
    case 'DECLINED':
    case 'EXPIRED':
      return 'CANCELLED';
    case 'PENDING':
      return 'UNPAID';
    default:
      return 'CANCELLED';
  }
}
