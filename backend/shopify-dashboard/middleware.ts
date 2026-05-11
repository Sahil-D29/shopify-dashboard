import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";
import { tenantMiddleware } from "@/lib/tenant/tenant-middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Define public routes that don't need authentication
  const isAuthPage = pathname.startsWith("/auth");
  const isAdminLogin = pathname === "/admin/login";
  const isAdminRoute = pathname.startsWith("/admin");
  const isApiAuth = pathname.startsWith("/api/auth");
  const isApiAdminAuth = pathname.startsWith("/api/admin/auth");
  const isApiHealth = pathname.startsWith("/api/health");
  const isApiWebhook = pathname.startsWith("/api/webhooks");
  const isPublicApi = pathname.startsWith("/api/public");
  
  // Allow public API routes (auth, health checks, webhooks)
  if (isApiAuth || isApiHealth || isApiWebhook || isPublicApi || isApiAdminAuth) {
    return NextResponse.next();
  }

  // ═══════════════════════════════════════════════════════
  // ADMIN ROUTES - Check admin_session cookie
  // ═══════════════════════════════════════════════════════
  if (isAdminRoute) {
    // Allow admin login page
    if (isAdminLogin) {
      return NextResponse.next();
    }

    // Check admin session cookie
    const adminToken = request.cookies.get('admin_session')?.value;

    if (!adminToken) {
      console.log(`[Middleware] Redirecting to admin login from ${pathname}`);
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    try {
      // Verify admin token using Edge-compatible jose library
      const secretString = process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET;
      
      if (!secretString) {
        console.error('[Middleware] ADMIN_JWT_SECRET or NEXTAUTH_SECRET is not configured');
        throw new Error('Admin authentication not configured');
      }
      
      const secret = new TextEncoder().encode(secretString);

      const { payload } = await jwtVerify(adminToken, secret);

      // Check if token type is 'admin'
      if (payload.type !== 'admin') {
        throw new Error('Invalid token type');
      }

      // Admin is authenticated, allow access
      return NextResponse.next();
    } catch (error) {
      console.log(`[Middleware] Invalid admin token, redirecting to admin login`);
      const response = NextResponse.redirect(new URL("/admin/login", request.url));
      response.cookies.delete('admin_session');
      return response;
    }
  }

  // ═══════════════════════════════════════════════════════
  // USER ROUTES - Check user session (NextAuth)
  // ═══════════════════════════════════════════════════════
  
  // Check for session cookie directly
  const sessionCookie = request.cookies.get('next-auth.session-token');
  const hasSessionCookie = !!sessionCookie?.value;
  
  // Get the NextAuth JWT token
  let token = null;
  try {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
      cookieName: 'next-auth.session-token',
    });
  } catch (error) {
    console.log('[Middleware] Error getting token:', error);
  }

  const isAuthenticated = !!token;

  console.log(`[Middleware] Path: ${pathname}, HasCookie: ${hasSessionCookie}, Authenticated: ${isAuthenticated}`);

  // If trying to access auth page
  if (isAuthPage) {
    // If authenticated, redirect to home
    if (isAuthenticated) {
      console.log(`[Middleware] Redirecting authenticated user from auth page to home`);
      return NextResponse.redirect(new URL("/", request.url));
    }
    // Allow access to auth pages for unauthenticated users
    return NextResponse.next();
  }

  // For all other pages, require authentication
  if (!isAuthenticated) {
    console.log(`[Middleware] Redirecting unauthenticated user to signin from ${pathname}`);
    const signInUrl = new URL("/auth/signin", request.url);
    // Don't set callbackUrl to prevent redirect loops
    if (pathname !== '/') {
      signInUrl.searchParams.set("callbackUrl", pathname);
    }
    
    // Create redirect response
    const response = NextResponse.redirect(signInUrl);
    
    // Add headers to prevent caching
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    
    return response;
  }

  // User is authenticated, apply tenant middleware
  const tenantResponse = await tenantMiddleware(request);
  if (tenantResponse) {
    tenantResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return tenantResponse;
  }

  // Fallback
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)  
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public|.*\\..*).*)"],
};
