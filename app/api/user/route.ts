export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserContext } from '@/lib/user-context';
import { findUserByEmail } from '@/lib/fileAuth';

export async function GET(request: NextRequest) {
  try {
    console.log('[API /user] Fetching user data...');
    
    // Get session
    const session = await auth();
    
    if (!session || !session.user) {
      console.warn('[API /user] No session found');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[API /user] Session found:', {
      email: session.user.email,
      id: session.user.id
    });

    // Try to get user context first (includes role mapping)
    let userContext = null;
    try {
      userContext = await getUserContext(request);
      console.log('[API /user] User context:', userContext);
    } catch (error) {
      console.error('[API /user] Error getting user context:', error);
    }

    // If user context is available, use it
    if (userContext) {
      return NextResponse.json({
        success: true,
        user: {
          id: userContext.userId,
          email: userContext.email,
          name: userContext.name,
          role: userContext.role, // This is the mapped role (ADMIN, STORE_OWNER, USER)
        },
        role: userContext.role,
        canAccessSettings: userContext.canAccessSettings,
        canAccessAdminPanel: userContext.canAccessAdminPanel,
      });
    }

    // Fallback: Try to get user from fileAuth
    try {
      const user = await findUserByEmail(session.user.email || '');
      
      if (user) {
        console.log('[API /user] User found in fileAuth:', {
          id: user.id,
          email: user.email,
          role: (user as any).role
        });

        return NextResponse.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: (user as any).name || user.email,
            role: (user as any).role || 'USER', // Raw role from database
          },
          role: (user as any).role || 'USER',
        });
      }
    } catch (error) {
      console.error('[API /user] Error finding user:', error);
    }

    // Final fallback: Return session user
    return NextResponse.json({
      success: true,
      user: {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.name || session.user.email || '',
        role: 'USER', // Default role
      },
      role: 'USER',
    });
  } catch (error) {
    console.error('[API /user] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

