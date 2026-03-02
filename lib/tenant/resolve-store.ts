import { NextRequest } from 'next/server';
import { getStoreIdFromRequest } from './tenant-utils';
import { prisma } from '@/lib/prisma';
import { getDecryptedToken } from '@/lib/shopify-token';
import { getClientCredentialsToken } from '@/lib/shopify/cc-token-provider';

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

export interface ResolvedStore {
  shop: string;
  token: string;
  apiVersion: string;
  storeId: string;
}

/**
 * Resolve the current tenant's Shopify store from the request context.
 *
 * Priority:
 * 1. Store ID from cookie/header/query → look up in Prisma → use stored OAuth token
 * 2. Fallback to SHOPIFY_STORE_DOMAIN env var + Client Credentials token (own store)
 *
 * Returns null if no store could be resolved.
 */
export async function resolveStore(request: NextRequest): Promise<ResolvedStore | null> {
  // 1. Try tenant context (merchant's store from cookie/header)
  const storeId = getStoreIdFromRequest(request);

  if (storeId) {
    try {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, shopifyDomain: true, accessToken: true, isActive: true },
      });

      if (store && store.isActive && store.shopifyDomain && store.accessToken) {
        const token = getDecryptedToken(store);
        if (token) {
          return {
            shop: store.shopifyDomain,
            token,
            apiVersion: API_VERSION,
            storeId: store.id,
          };
        }
      }
    } catch (err) {
      console.error('[resolveStore] DB lookup failed for storeId:', storeId, err);
    }
  }

  // 2. Fallback: own store via env + Client Credentials
  const envShop = process.env.SHOPIFY_STORE_DOMAIN;
  if (envShop) {
    try {
      const token = await getClientCredentialsToken(envShop);
      return {
        shop: envShop,
        token,
        apiVersion: API_VERSION,
        storeId: 'env-default',
      };
    } catch (err) {
      console.error('[resolveStore] Client Credentials fallback failed:', err);
    }
  }

  return null;
}
