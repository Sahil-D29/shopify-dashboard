import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    // Get cookie store
    const cookieStore = await cookies();
    
    // Delete legacy auth token
    cookieStore.delete("auth-token");
    
    // Delete NextAuth session cookies
    cookieStore.delete("next-auth.session-token");
    cookieStore.delete("next-auth.csrf-token");
    cookieStore.delete("next-auth.callback-url");
    cookieStore.delete("__Secure-next-auth.session-token");
    cookieStore.delete("__Secure-next-auth.csrf-token");
    cookieStore.delete("__Host-next-auth.csrf-token");
    
    return NextResponse.json({ 
      success: true, 
      message: "Signed out successfully" 
    });
  } catch (error) {
    console.error("Sign out error:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to sign out" 
    }, { status: 500 });
  }
}

export async function GET() {
  // Redirect to NextAuth signout for GET requests
  return NextResponse.redirect(
    new URL('/api/auth/signout', process.env.NEXTAUTH_URL || 'http://localhost:3002')
  );
}
