export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/user-context';

export async function GET(request: NextRequest) {
  try {
    console.log('[User Permissions API] Checking permissions...');
    
    let userContext = null;
    try {
      userContext = await getUserContext(request);
    } catch (error) {
      console.error('[User Permissions API] Error getting user context:', error);
      if (error instanceof Error) {
        console.error('[User Permissions API] Error details:', {
          message: error.message,
          stack: error.stack,
        });
      }
      // Return a safe response instead of crashing
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to get user context',
          permissions: {
            canAccessSettings: false,
            canAccessAdminPanel: false,
          }
        },
        { status: 200 } // Return 200 to prevent frontend crashes
      );
    }
    
    if (!userContext) {
      console.warn('[User Permissions API] No user context found - user not authenticated');
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized',
          permissions: {
            canAccessSettings: false,
            canAccessAdminPanel: false,
          }
        },
        { status: 401 }
      );
    }

    console.log('[User Permissions API] User context:', {
      userId: userContext.userId,
      email: userContext.email,
      role: userContext.role,
      canAccessSettings: userContext.canAccessSettings,
      canAccessAdminPanel: userContext.canAccessAdminPanel,
    });

    // Return both formats for compatibility
    const response = {
      success: true,
      // Format 1: Direct canAccess (for compatibility)
      canAccess: userContext.canAccessSettings,
      // Format 2: Nested permissions object
      permissions: {
        canAccessSettings: userContext.canAccessSettings,
        canAccessAdminPanel: userContext.canAccessAdminPanel,
        role: userContext.role,
      },
      // Format 3: Roles array (for compatibility)
      roles: [userContext.role],
      // Format 4: Full userContext for direct access
      userContext: {
        userId: userContext.userId,
        email: userContext.email,
        name: userContext.name,
        role: userContext.role,
        canAccessSettings: userContext.canAccessSettings,
        canAccessAdminPanel: userContext.canAccessAdminPanel,
      },
      user: {
        id: userContext.userId,
        email: userContext.email,
        name: userContext.name,
        role: userContext.role, // Add role to user object too
      }
    };

    console.log('[User Permissions API] Returning response:', response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[User Permissions API] Error:', error);
    // Log full error details
    if (error instanceof Error) {
      console.error('[User Permissions API] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get permissions',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        permissions: {
          canAccessSettings: false,
          canAccessAdminPanel: false,
        }
      },
      { status: 200 } // Return 200 to prevent frontend crashes
    );
  }
}


