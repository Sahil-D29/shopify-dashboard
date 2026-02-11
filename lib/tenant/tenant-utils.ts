import { NextRequest } from 'next/server';

/**
 * Extract store ID from request
 */
export function getStoreIdFromRequest(request: NextRequest): string | null {
  // Try header first
  const storeIdHeader = request.headers.get('x-store-id');
  if (storeIdHeader) {
    return storeIdHeader;
  }

  // Try cookie
  const cookies = request.cookies;
  const storeIdCookie = cookies.get('current_store_id');
  if (storeIdCookie) {
    return storeIdCookie.value;
  }

  // Try query parameter
  const storeIdParam = request.nextUrl.searchParams.get('storeId');
  if (storeIdParam) {
    return storeIdParam;
  }

  return null;
}

/**
 * Validate user has access to store
 */
export async function validateStoreAccess(
  userId: string,
  storeId: string
): Promise<boolean> {
  try {
    const { readStoreRegistry } = await import('@/lib/store-registry');
    const stores = await readStoreRegistry();
    
    const store = stores.find(s => s.id === storeId);
    if (!store || store.status !== 'active') {
      return false;
    }

    // TODO: Check user permissions from user data
    // For now, if store exists and is active, allow access
    return true;
  } catch (error) {
    console.error('Error validating store access:', error);
    return false;
  }
}

/**
 * Get default store ID (for fallback)
 */
export async function getDefaultStoreId(): Promise<string | null> {
  try {
    const { readStoreRegistry } = await import('@/lib/store-registry');
    const stores = await readStoreRegistry();
    
    const activeStore = stores.find(s => s.status === 'active');
    return activeStore?.id || stores[0]?.id || null;
  } catch (error) {
    console.error('Error getting default store ID:', error);
    return null;
  }
}

