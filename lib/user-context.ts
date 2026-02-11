import { auth } from '@/lib/auth';
import { findUserById } from '@/lib/fileAuth';
import { findUserById as findStoreUserById } from '@/lib/store-users';
import { getTenantStoreId } from '@/lib/tenant/tenant-middleware';
import { NextRequest } from 'next/server';

export type UserRole = 'ADMIN' | 'STORE_OWNER' | 'USER';

export interface UserContext {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  storeId?: string | null;
  assignedStoreId?: string | null;
  canAccessSettings: boolean;
  canAccessAdminPanel: boolean;
}

/**
 * Get user context from session
 * This includes role, store assignments, and permissions
 */
export async function getUserContext(request?: NextRequest): Promise<UserContext | null> {
  try {
    let session = null;
    try {
      session = await auth();
    } catch (error) {
      console.error('[UserContext] Error getting session:', error);
      if (error instanceof Error) {
        console.error('[UserContext] Session error details:', {
          message: error.message,
          stack: error.stack,
        });
      }
      return null;
    }
    
    if (!session?.user?.id) {
      console.log('[UserContext] No session or user ID found');
      return null;
    }

    // Get current store ID early so we can use StoreMember.role for this store (super admin-assigned role)
    let currentStoreId: string | null = null;
    if (request) {
      try {
        currentStoreId = await getTenantStoreId(request);
      } catch {
        // Store ID not available from request
      }
    }

    // Try to get user from main users file first (Prisma)
    let user = null;
    try {
      user = await findUserById(session.user.id);
      
      // If not found by ID, try by email
      if (!user && session.user.email) {
        const { findUserByEmail } = await import('@/lib/fileAuth');
        user = await findUserByEmail(session.user.email);
        if (user) {
          console.log('[UserContext] Found user by email:', session.user.email);
        }
      }
    } catch (error) {
      console.error('[UserContext] Error finding user by ID:', error);
      // Try by email as fallback
      if (session.user.email) {
        try {
          const { findUserByEmail } = await import('@/lib/fileAuth');
          user = await findUserByEmail(session.user.email);
          if (user) {
            console.log('[UserContext] Found user by email (fallback):', session.user.email);
          }
        } catch (emailError) {
          console.error('[UserContext] Error finding user by email:', emailError);
        }
      }
    }
    
    // If not found, try store users
    let storeUser = null;
    if (!user) {
      try {
        storeUser = await findStoreUserById(session.user.id);
      } catch (e) {
        console.error('[UserContext] Error finding store user:', e);
        // Store user lookup failed, continue with main user
      }
    }

    // Determine role - check both user files
    let role: UserRole = 'USER';
    let storeId: string | null = null;
    let assignedStoreId: string | null = null;

    // Helper function to normalize role values (case-insensitive)
    const normalizeRole = (roleValue: any): string => {
      if (!roleValue) return '';
      return String(roleValue).toLowerCase().trim();
    };

    // Enhanced role mapping function
    const mapRoleToSystemRole = (rawRole: string): UserRole => {
      const normalized = normalizeRole(rawRole);
      const roleUpper = normalized.toUpperCase();
      
      // Super admin variations
      if (roleUpper === 'SUPER_ADMIN' || roleUpper === 'SUPERADMIN' || normalized === 'super_admin') {
        return 'ADMIN';
      }
      // Admin variations
      if (roleUpper === 'ADMIN' || normalized === 'admin' || normalized === 'administrator') {
        return 'ADMIN';
      }
      // Store owner variations
      if (roleUpper === 'STORE_OWNER' || 
          roleUpper === 'STOREOWNER' || 
          normalized === 'store_owner' || 
          normalized === 'storeowner' || 
          normalized === 'owner' ||
          normalized === 'store owner') {
        return 'STORE_OWNER';
      }
      // Manager maps to STORE_OWNER for settings access
      if (roleUpper === 'MANAGER' || normalized === 'manager') {
        return 'STORE_OWNER';
      }
      
      // Default to USER
      return 'USER';
    };

    if (user) {
      // Check if user has role field
      const rawRole = (user as any).role;
      const userRole = normalizeRole(rawRole);
      
      // Debug logging
      console.log('[UserContext] Main user found:', {
        userId: user.id,
        email: user.email,
        rawRole: rawRole,
        normalizedRole: userRole,
      });
      
      // Use enhanced role mapping
      role = mapRoleToSystemRole(rawRole);
      
      if (role === 'STORE_OWNER') {
        storeId = (user as any).storeId || user.shopifyStoreId || null;
      } else if (role === 'USER') {
        assignedStoreId = (user as any).assignedStoreId || user.shopifyStoreId || null;
      }
      
      console.log('[UserContext] Mapped role:', role);
    } else if (storeUser) {
      // Store user has role field - roles: 'admin', 'manager', 'builder', 'viewer'
      const storeUserRole = normalizeRole(storeUser.role);
      
      // Debug logging
      console.log('[UserContext] Store user found:', {
        userId: storeUser.id,
        email: storeUser.email,
        role: storeUserRole,
        rawRole: storeUser.role,
        storeId: storeUser.storeId,
      });
      
      // Map store user roles to system roles using the same mapping function
      role = mapRoleToSystemRole(storeUserRole);
      
      if (role === 'STORE_OWNER') {
        storeId = storeUser.storeId || null;
      } else if (role === 'USER') {
        assignedStoreId = storeUser.storeId || null;
      }
      
      console.log('[UserContext] Store user mapped role:', role);
    } else {
      console.warn('[UserContext] No user found in main users or store users:', {
        sessionUserId: session.user.id,
        sessionUserEmail: session.user.email,
      });
    }

    // For ADMIN: can access all stores, use currentStoreId or first available
    // For STORE_OWNER: use their storeId
    // For USER: use their assignedStoreId
    const effectiveStoreId = 
      role === 'ADMIN' 
        ? (currentStoreId || storeId || assignedStoreId)
        : role === 'STORE_OWNER'
        ? (storeId || currentStoreId)
        : (assignedStoreId || currentStoreId);

    // Determine permissions based on role
    const canAccessSettings = role === 'ADMIN' || role === 'STORE_OWNER';
    const canAccessAdminPanel = role === 'ADMIN';

    const userContext = {
      userId: session.user.id,
      email: session.user.email || '',
      name: session.user.name || '',
      role,
      storeId: effectiveStoreId,
      assignedStoreId: assignedStoreId || storeId,
      canAccessSettings,
      canAccessAdminPanel,
    };

    // Debug logging
    console.log('[UserContext] Final user context:', {
      userId: userContext.userId,
      email: userContext.email,
      role: userContext.role,
      canAccessSettings: userContext.canAccessSettings,
      canAccessAdminPanel: userContext.canAccessAdminPanel,
      storeId: userContext.storeId,
    });

    return userContext;
  } catch (error) {
    console.error('[UserContext] Error getting user context:', error);
    // Log full error details for debugging
    if (error instanceof Error) {
      console.error('[UserContext] Error stack:', error.stack);
      console.error('[UserContext] Error message:', error.message);
    }
    return null;
  }
}

/**
 * Get default store ID based on user role
 */
export function getDefaultStoreIdForRole(userContext: UserContext | null): string | null {
  if (!userContext) {
    return null;
  }

  if (userContext.role === 'ADMIN') {
    // Admin can access all stores, return null to indicate "all"
    return null;
  }

  if (userContext.role === 'STORE_OWNER') {
    return userContext.storeId || null;
  }

  // USER role
  return userContext.assignedStoreId || null;
}

/**
 * Build store filter based on user role
 */
export function buildStoreFilter(userContext: UserContext | null, requestedStoreId?: string | null): {
  storeId?: string;
  allowAll: boolean;
} {
  if (!userContext) {
    return { allowAll: false };
  }

  if (userContext.role === 'ADMIN') {
    // Admin can see all stores
    if (requestedStoreId) {
      return { storeId: requestedStoreId, allowAll: false };
    }
    return { allowAll: true };
  }

  if (userContext.role === 'STORE_OWNER') {
    // Store owner can only see their store
    return { storeId: userContext.storeId || undefined, allowAll: false };
  }

  // USER role - can only see assigned store
  return { storeId: userContext.assignedStoreId || undefined, allowAll: false };
}

/**
 * Get the current user's StoreMember role for a store (for team/role checks).
 * Only OWNER or global ADMIN can manage users and roles.
 */
export async function getStoreMemberRoleForStore(
  userId: string,
  storeId: string
): Promise<'OWNER' | 'MANAGER' | 'TEAM_MEMBER' | 'VIEWER' | null> {
  try {
    const { prisma } = await import('@/lib/prisma');
    const member = await prisma.storeMember.findUnique({
      where: { userId_storeId: { userId, storeId } },
      select: { role: true },
    });
    return member?.role ?? null;
  } catch {
    return null;
  }
}

/** Only OWNER (for this store) or global ADMIN can manage team (invite, change roles, remove). */
export async function canManageTeam(
  userContext: UserContext | null,
  storeId: string
): Promise<boolean> {
  if (!userContext) return false;
  if (userContext.role === 'ADMIN') return true;
  const storeRole = await getStoreMemberRoleForStore(userContext.userId, storeId);
  return storeRole === 'OWNER';
}


