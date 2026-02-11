export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBaseUrl } from "@/lib/utils/getBaseUrl";

function clearAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const names = [
    "auth-token",
    "next-auth.session-token",
    "next-auth.csrf-token",
    "next-auth.callback-url",
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.csrf-token",
    "__Secure-next-auth.callback-url",
    "__Host-next-auth.session-token",
    "__Host-next-auth.csrf-token",
    "authjs.session-token",
    "authjs.callback-url",
    "authjs.csrf-token",
    "__Secure-authjs.session-token",
    "__Secure-authjs.callback-url",
    "__Secure-authjs.csrf-token",
    "__Host-authjs.csrf-token",
    "__Host-authjs.callback-url",
  ];
  for (const name of names) {
    cookieStore.delete({ name, path: "/" });
  }
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    clearAuthCookies(cookieStore);
    return NextResponse.json({ success: true, message: "Signed out successfully" });
  } catch (error) {
    console.error("Sign out error:", error);
    return NextResponse.json({ success: false, message: "Failed to sign out" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    clearAuthCookies(cookieStore);

    const callbackUrl =
      request.nextUrl.searchParams.get("callbackUrl") ||
      request.nextUrl.searchParams.get("redirect") ||
      "/auth/signin";
    const baseUrl = getBaseUrl();
    const url = callbackUrl.startsWith("http") ? callbackUrl : `${baseUrl}${callbackUrl.startsWith("/") ? callbackUrl : "/" + callbackUrl}`;

    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Sign out error:", error);
    const baseUrl = getBaseUrl();
    return NextResponse.redirect(new URL("/auth/signin", baseUrl));
  }
}
