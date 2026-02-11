import { NextRequest, NextResponse } from 'next/server';

/**
 * Extract store ID from request (Edge-compatible, no Node.js APIs)
 */
function getStoreIdFromRequest(request: NextRequest): string | null {
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
 * Middleware to extract and validate store context from requests
 */
export async function tenantMiddleware(request: NextRequest): Promise<NextResponse | null> {
  // Skip middleware for public routes
  const publicRoutes = ['/auth', '/api/auth', '/admin/login', '/_next', '/favicon.ico'];
  const pathname = request.nextUrl.pathname;
  
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Extract store ID from various sources
  const storeId = getStoreIdFromRequest(request);

  // For API routes, add store ID to headers
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth')) {
    const response = NextResponse.next();
    
    if (storeId) {
      response.headers.set('x-store-id', storeId);
    }
    
    return response;
  }

  return NextResponse.next();
}

/**
 * Get store ID from request (for server-side use)
 */
export async function getTenantStoreId(request: Request | NextRequest): Promise<string | null> {
  // Try to get from header first
  const storeIdHeader = request.headers.get('x-store-id');
  if (storeIdHeader) {
    return storeIdHeader;
  }

  // Try to get from cookie
  const cookies = request.headers.get('cookie');
  if (cookies) {
    const match = cookies.match(/current_store_id=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  // Try to get from query parameter (for initial setup)
  const url = new URL(request.url);
  const storeIdParam = url.searchParams.get('storeId');
  if (storeIdParam) {
    return storeIdParam;
  }

  return null;
}

/**
 * Validate that user has access to the store
 * This function is only used in API routes (Node.js runtime), not in middleware
 */
export async function validateTenantAccess(
  userId: string,
  storeId: string
): Promise<boolean> {
  try {
    // Lazy import to avoid Edge Runtime issues
    // This function should only be called from API routes, not middleware
    const { readStoreRegistry } = await import('@/lib/store-registry');
    const stores = await readStoreRegistry();
    
    const store = stores.find(s => s.id === storeId);
    if (!store || store.status !== 'active') {
      return false;
    }

    // For now, if store exists and is active, allow access
    // Later, can check user permissions from user data
    return true;
  } catch (error) {
    console.error('Error validating tenant access:', error);
    return false;
  }
}

