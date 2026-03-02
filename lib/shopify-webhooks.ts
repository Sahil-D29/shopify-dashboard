import { getBaseUrl } from '@/lib/utils/getBaseUrl';

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

/** Webhook topics we need for the app to function */
const REQUIRED_WEBHOOKS = [
  'orders/create',
  'orders/fulfilled',
  'orders/cancelled',
  'customers/create',
  'customers/update',
  'app/uninstalled',
] as const;

/**
 * Register all required webhooks for a Shopify store after OAuth.
 * Skips topics that are already registered.
 */
export async function registerWebhooks(
  shop: string,
  accessToken: string,
): Promise<{ registered: string[]; skipped: string[]; errors: string[] }> {
  const baseUrl = getBaseUrl();
  const callbackUrl = `${baseUrl}/api/webhooks/shopify`;

  const registered: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // First, list existing webhooks to avoid duplicates
  let existingTopics: Set<string> = new Set();
  try {
    const listRes = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } },
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      existingTopics = new Set(
        (listData.webhooks || []).map((w: { topic: string }) => w.topic),
      );
    }
  } catch (e) {
    console.warn('[Webhooks] Failed to list existing webhooks:', e);
  }

  // Register each missing topic
  for (const topic of REQUIRED_WEBHOOKS) {
    if (existingTopics.has(topic)) {
      skipped.push(topic);
      continue;
    }

    try {
      const res = await fetch(
        `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            webhook: {
              topic,
              address: callbackUrl,
              format: 'json',
            },
          }),
        },
      );

      if (res.ok) {
        registered.push(topic);
      } else {
        const errBody = await res.text();
        console.error(`[Webhooks] Failed to register ${topic}:`, errBody);
        errors.push(`${topic}: ${res.status}`);
      }
    } catch (e) {
      console.error(`[Webhooks] Error registering ${topic}:`, e);
      errors.push(`${topic}: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  console.log(
    `[Webhooks] shop=${shop} registered=${registered.length} skipped=${skipped.length} errors=${errors.length}`,
  );

  return { registered, skipped, errors };
}
