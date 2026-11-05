import { prisma } from '@/lib/prisma';
import { ShopifyClient } from '@/lib/shopify/client';

export async function journeyShopifyClient(storeId?: string) {
  if (!storeId) throw new Error('A verified store is required for journey Shopify access');
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  if (!store.shopifyDomain || !store.accessToken) throw new Error('Connect Shopify for this store');
  const { getDecryptedToken } = await import('@/lib/shopify-token');
  return new ShopifyClient({ apiVersion: '2026-07', shop: store.shopifyDomain, accessToken: getDecryptedToken({ accessToken: store.accessToken }) });
}
