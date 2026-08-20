import { NextRequest } from 'next/server';
import { ShopifyClient } from './client';
import { resolveStore } from '@/lib/tenant/resolve-store';
import { getStoreIdFromRequest } from '@/lib/tenant/tenant-utils';

/** Thrown when a specific store is selected but is not connected to Shopify. */
export class StoreNotConnectedError extends Error {
  constructor() {
    super('This store is not connected to Shopify. Connect it in Settings.');
    this.name = 'StoreNotConnectedError';
  }
}

export { ShopifyClient };

interface ShopifyConfig {
  shop: string;
  accessToken: string;
}

/**
 * Legacy browser-provided Shopify credentials are intentionally ignored.
 * API routes must resolve credentials server-side from the authorized store.
 */
export function getConfigFromRequest(request: Request): ShopifyConfig | null {
  void request;
  return null;
}

/**
 * @deprecated Use getShopifyClientAsync instead. The sync version cannot use
 * DB-based store resolution and only supports server-owned env configuration.
 */
export function getShopifyClient(request: Request): ShopifyClient {
  void request;
  return new ShopifyClient();
}

/**
 * Create a ShopifyClient using DB-based store resolution.
 * Priority: current_store_id cookie/header/query -> Prisma DB -> decrypted token.
 * Falls back only to server-owned env vars when no tenant store is selected.
 */
export async function getShopifyClientAsync(request: Request): Promise<ShopifyClient> {
  try {
    const store = await resolveStore(request as NextRequest);
    if (store) {
      return new ShopifyClient({ shop: store.shop, accessToken: store.token });
    }
  } catch (err) {
    console.error('[getShopifyClientAsync] resolveStore failed:', err);
  }

  if (getStoreIdFromRequest(request as NextRequest)) {
    throw new StoreNotConnectedError();
  }

  return new ShopifyClient();
}
