/**
 * Shopify token check - verify one store's access token and update SystemHealth.
 * Called by GET /api/cron/shopify-token-check (Vercel Cron or external cron).
 */
import { prisma } from '@/lib/prisma';

export async function runShopifyTokenCheck(): Promise<{ valid: boolean; reason?: string }> {
  const store = await prisma.store.findFirst({
    where: { isActive: true },
    take: 1,
  });

  if (!store?.accessToken) {
    await updateSystemHealthShopify(false, null);
    return { valid: false, reason: 'No store or token' };
  }

  const now = new Date();
  try {
    const domain = store.shopifyDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const url = `https://${domain}/admin/api/2024-10/graphql.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: '{ shop { name } }' }),
    });

    const data = await res.json().catch(() => ({}));
    const valid = !!(data?.data?.shop?.name);
    await updateSystemHealthShopify(valid, valid ? now : null);
    return { valid, reason: valid ? undefined : 'Invalid response' };
  } catch (e) {
    await updateSystemHealthShopify(false, null);
    return { valid: false, reason: e instanceof Error ? e.message : 'API call failed' };
  }
}

async function updateSystemHealthShopify(tokenValid: boolean, lastSuccessfulSync: Date | null): Promise<void> {
  const existing = await prisma.systemHealth.findFirst();
  const data = {
    shopifyLastTokenCheck: new Date(),
    shopifyTokenValid: tokenValid,
    shopifyLastSuccessfulSync: lastSuccessfulSync ?? undefined,
    lastUpdated: new Date(),
  };
  if (existing) {
    await prisma.systemHealth.updateMany({ data });
  } else {
    await prisma.systemHealth.create({
      data: {
        ...data,
        campaignWorkerStatus: 'STOPPED',
        journeyWorkerStatus: 'STOPPED',
      },
    });
  }
}
