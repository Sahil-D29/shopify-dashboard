import { NextRequest } from 'next/server';
import { getTenantStoreId, validateTenantAccess } from './tenant-middleware';
import { auth } from '@/lib/auth';

/**
 * Get the current store ID from the request
 * Used in API routes to get tenant context
 */
export async function getCurrentStoreId(request: Request | NextRequest): Promise<string | null> {
  return await getTenantStoreId(request as Request);
}

/**
 * Require store ID in API route
 * Throws error if store ID is not found
 */
export async function requireStoreId(request: Request | NextRequest): Promise<string> {
  const storeId = await getCurrentStoreId(request);
  
  if (!storeId) {
    throw new Error('Store ID is required');
  }
  
  return storeId;
}

/**
 * Validate user has access to the store
 * Returns store ID if valid, throws error otherwise
 */
export async function requireStoreAccess(
  request: Request | NextRequest
): Promise<string> {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  
  const storeId = await requireStoreId(request);
  
  const hasAccess = await validateTenantAccess(session.user.id, storeId);
  
  if (!hasAccess) {
    throw new Error('Access denied to this store');
  }
  
  return storeId;
}

/**
 * Helper to filter data by store ID
 */
export function filterByStoreId<T extends { storeId?: string }>(
  data: T[],
  storeId: string
): T[] {
  return data.filter(item => item.storeId === storeId);
}

/**
 * Helper to ensure data has store ID
 */
export function ensureStoreId<T extends { storeId?: string }>(
  item: T,
  storeId: string
): T & { storeId: string } {
  return {
    ...item,
    storeId,
  };
}

