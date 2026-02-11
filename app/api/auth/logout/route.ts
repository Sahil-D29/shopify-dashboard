import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Custom logout endpoint that properly clears all authentication cookies
 * This is needed because NextAuth v5's default signout may not clear cookies properly
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    
    // Get all cookie names
    const allCookies = cookieStore.getAll();
    
    // List of auth-related cookie patterns to clear
    const authCookiePatterns = [
      'next-auth',
      'authjs',
      '__Secure-next-auth',
      '__Secure-authjs',
      '__Host-next-auth',
      '__Host-authjs',
      'auth-token',
      'session',
    ];
    
    // Clear all matching cookies
    for (const cookie of allCookies) {
      const shouldClear = authCookiePatterns.some(pattern => 
        cookie.name.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (shouldClear) {
        console.log(`[Logout] Clearing cookie: ${cookie.name}`);
        cookieStore.delete(cookie.name);
      }
    }
    
    // Also explicitly clear known NextAuth cookies
    const knownCookies = [
      'next-auth.session-token',
      'next-auth.callback-url',
      'next-auth.csrf-token',
      '__Secure-next-auth.session-token',
      '__Secure-next-auth.callback-url',
      '__Secure-next-auth.csrf-token',
      'authjs.session-token',
      'authjs.callback-url',
      'authjs.csrf-token',
      '__Secure-authjs.session-token',
      '__Secure-authjs.callback-url',
      '__Secure-authjs.csrf-token',
      'auth-token',
    ];
    
    for (const name of knownCookies) {
      try {
        cookieStore.delete(name);
      } catch (e) {
        // Cookie might not exist, that's fine
      }
    }
    
    console.log('[Logout] All auth cookies cleared successfully');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Logged out successfully',
      redirect: '/auth/signin'
    });
  } catch (error) {
    console.error('[Logout] Error clearing cookies:', error);
    return NextResponse.json(
      { success: false, message: 'Error during logout' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Redirect GET requests to POST
  return NextResponse.json(
    { message: 'Use POST method to logout' },
    { status: 405 }
  );
}

