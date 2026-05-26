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

  const data = await callShopifyGraphQL(shop, APP_SUBSCRIPTION_CREATE, variables);
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
  });

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
  });

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
  const data = await callShopifyGraphQL(shop, ACTIVE_SUBSCRIPTIONS_QUERY);

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
