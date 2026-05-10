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
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error('APP_BASE_URL or NEXT_PUBLIC_APP_URL not configured. Cannot register Shopify webhooks.');
  }

  const address = `${baseUrl.replace(/\/$/, '')}/api/webhooks/shopify`;
  const desired = [
    { topic: 'orders/create', address },
    { topic: 'checkouts/create', address },
    { topic: 'customers/create', address },
  ];

  const config = readJsonObject<ShopifyConfigStore>(CONFIG_FILE, { webhooks: [] });
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

  writeJsonObject<ShopifyConfigStore>(CONFIG_FILE, { webhooks: registered });

  return registered;
}

