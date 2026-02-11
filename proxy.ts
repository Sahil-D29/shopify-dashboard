import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";
import { tenantMiddleware } from "@/lib/tenant/tenant-middleware";

const SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
// Auth.js uses secure cookie name only for HTTPS; use request URL so localhost works
function getSessionCookieName(request: NextRequest): string {
  try {
    const url = new URL(request.url);
    return url.protocol === "https:" ? "__Secure-authjs.session-token" : "authjs.session-token";
  } catch {
    return "authjs.session-token";
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/auth");
  const isAdminLogin = pathname === "/admin/login";
  const isAdminRoute = pathname.startsWith("/admin");
  const isApiAdmin = pathname.startsWith("/api/admin");
  const isApiAuth = pathname.startsWith("/api/auth");
  const isApiAdminAuth = pathname.startsWith("/api/admin/auth");
  const isApiHealth = pathname.startsWith("/api/health");
  const isApiWebhook = pathname.startsWith("/api/webhooks");
  const isApiCron = pathname.startsWith("/api/cron");
  const isPublicApi = pathname.startsWith("/api/public");

  if (isApiAuth || isApiHealth || isApiWebhook || isApiCron || isPublicApi || isApiAdminAuth) {
    return NextResponse.next();
  }

  // Admin UI and Admin API: require admin_session (so API returns JSON, not redirect HTML)
  if (isAdminRoute || isApiAdmin) {
    if (isAdminLogin) return NextResponse.next();
    const adminToken = request.cookies.get("admin_session")?.value;
    if (!adminToken) return NextResponse.redirect(new URL("/admin/login", request.url));
    const secretString = process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secretString) return NextResponse.redirect(new URL("/admin/login", request.url));
    try {
      const secret = new TextEncoder().encode(secretString);
      const { payload } = await jwtVerify(adminToken, secret);
      if (payload.type !== "admin") throw new Error("Invalid");
      return NextResponse.next();
    } catch {
      const res = NextResponse.redirect(new URL("/admin/login", request.url));
      res.cookies.delete("admin_session");
      return res;
    }
  }

  let token: unknown = null;
  if (SECRET) {
    const cookieName = getSessionCookieName(request);
    try {
      token = await getToken({
        req: request,
        secret: SECRET,
        secureCookie: request.nextUrl.protocol === "https:",
        cookieName,
      });
    } catch {
      // ignore
    }
  }

  const isAuthenticated = !!token;

  if (isAuthPage) {
    if (isAuthenticated) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const signInUrl = new URL("/auth/signin", request.url);
    const fullPath = pathname + (request.nextUrl.search || "");
    const defaultCallback = pathname === "/" || pathname.startsWith("/auth") ? "/dashboard" : fullPath;
    signInUrl.searchParams.set("callbackUrl", defaultCallback);
    const res = NextResponse.redirect(signInUrl);
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  }

  // Authenticated: redirect root to dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const tenantResponse = await tenantMiddleware(request);
  if (tenantResponse) {
    tenantResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return tenantResponse;
  }

  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public|.*\\..*).*)"],
};
