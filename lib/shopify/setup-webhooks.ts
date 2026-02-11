import { shopifyClient } from '@/lib/shopify/client';
import { readJsonObject, writeJsonObject } from '@/lib/utils/json-object';

interface StoredWebhook {
  id: string | number;
  topic: string;
  address: string;
  createdAt: string;
}

interface ShopifyConfigStore {
  webhooks: StoredWebhook[];
}

const CONFIG_FILE = 'shopify-config.json';

export async function setupShopifyWebhooks() {
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    throw new Error('NEXTAUTH_URL (or APP_BASE_URL / NEXT_PUBLIC_APP_URL) not configured. Cannot register Shopify webhooks.');
  }

  const address = `${baseUrl.replace(/\/$/, '')}/api/webhooks/shopify`;
  const desired = [
    { topic: 'orders/create', address },
    { topic: 'checkouts/create', address },
    { topic: 'customers/create', address },
  ];

  const config = readJsonObject<Record<string, unknown>>(CONFIG_FILE, { webhooks: [] }) as unknown as ShopifyConfigStore;
  const registered = [...config.webhooks];

  for (const webhook of desired) {
    const already = registered.find(item => item.topic === webhook.topic && item.address === webhook.address);
    if (already) continue;

    const payload = await shopifyClient.request<{ webhook: { id: number } }>('/webhooks.json', {
      method: 'POST',
      body: JSON.stringify({ webhook: { topic: webhook.topic, address: webhook.address, format: 'json' } }),
    });

    const id = payload?.webhook?.id;
    registered.push({
      id: id ?? `pending_${webhook.topic}`,
      topic: webhook.topic,
      address: webhook.address,
      createdAt: new Date().toISOString(),
    });
  }

  writeJsonObject<Record<string, unknown>>(CONFIG_FILE, { webhooks: registered } as unknown as Record<string, unknown>);

  return registered;
}

