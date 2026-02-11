import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { verifyPassword } from "@/lib/fileAuth";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { authRateLimiter } from "@/lib/rate-limit";
import { handlers } from "@/lib/auth";

// Forward GET to NextAuth so OAuth (e.g. Google) and sign-in page work; only POST uses custom JWT below
export async function GET(req: NextRequest) {
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  // Check rate limit
  const rateLimitResponse = await authRateLimiter(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  try {
    const { email, password, rememberMe } = await req.json();

    console.log("Sign-in attempt for:", email);

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await verifyPassword(email, password);
    
    if (!user) {
      console.log("Invalid credentials for:", email);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    console.log("User authenticated:", user.email);

    // Create JWT token
    const secretString = process.env.NEXTAUTH_SECRET;
    
    if (!secretString) {
      console.error('NEXTAUTH_SECRET is not configured');
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }
    
    const secret = new TextEncoder().encode(secretString);
    
    const expirationTime = rememberMe ? "30d" : "7d";
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
    
    const token = await new SignJWT({ 
      userId: user.id, 
      email: user.email,
      name: user.name
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(expirationTime)
      .setIssuedAt()
      .sign(secret);

    console.log("Token generated successfully");

    // Set cookie - await cookies() in Next.js 15+
    const cookieStore = await cookies();
    cookieStore.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: maxAge,
      path: "/",
      sameSite: "lax"
    });

    return NextResponse.json({
      success: true,
      message: "Signed in successfully",
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email 
      }
    });
  } catch (error) {
    console.error("Signin error:", error);
    return NextResponse.json(
      { 
        error: "Failed to sign in",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

