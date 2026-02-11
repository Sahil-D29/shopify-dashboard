import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Permission definitions
export const PERMISSIONS = {
  ADMIN: ['*'], // All permissions
  
  STORE_OWNER: [
    'dashboard:view',
    'customers:view',
    'customers:export',
    'orders:view',
    'products:view',
    'campaigns:view',
    'campaigns:create',
    'campaigns:edit',
    'campaigns:delete',
    'campaigns:send',
    'segments:view',
    'segments:create',
    'segments:edit',
    'segments:delete',
    'journeys:view',
    'journeys:create',
    'journeys:edit',
    'journeys:delete',
    'journeys:activate',
    'settings:view',
    'settings:edit',
    'team:view',
    'team:invite',
    'team:remove',
    'analytics:view',
  ],
  
  USER: [
    'dashboard:view',
    'customers:view',
    'orders:view',
    'products:view',
    'campaigns:view',
    'segments:view',
    'journeys:view',
    'analytics:view',
  ]
} as const;

export type UserRole = keyof typeof PERMISSIONS;
export type Permission = string;

/**
 * Get current session
 */
export async function getCurrentSession() {
  return await auth();
}

/**
 * Require authentication
 */
export async function requireAuth() {
  const session = await getCurrentSession();
  
  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      ),
      session: null,
    };
  }
  
  return { session, error: null };
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  userRole: UserRole | string,
  requiredPermission: string
): boolean {
  // Handle admin role with wildcard
  if (userRole === 'ADMIN') {
    return true;
  }
  
  const userPermissions = PERMISSIONS[userRole as UserRole] || [];
  
  // Check for wildcard or specific permission
  return (userPermissions as readonly ('*' | string)[]).includes('*') || (userPermissions as readonly string[]).includes(requiredPermission);
}

/**
 * Require specific permission (use in API routes)
 */
export async function requirePermission(permission: string) {
  const { session, error } = await requireAuth();
  if (error) return { session: null, error };
  
  // Get user role from session
  // Note: You may need to add role to your user model
  const userRole = (session!.user as any).role || 'USER';
  
  if (!hasPermission(userRole, permission)) {
    return {
      session: null,
      error: NextResponse.json(
        { 
          error: 'Forbidden - Insufficient permissions',
          required: permission,
          role: userRole,
        },
        { status: 403 }
      ),
    };
  }
  
  return { session, error: null };
}

/**
 * Require specific role(s)
 */
export async function requireRole(allowedRoles: string[]) {
  const { session, error } = await requireAuth();
  if (error) return { session: null, error };
  
  const userRole = (session!.user as any).role || 'USER';
  
  if (!allowedRoles.includes(userRole)) {
    return {
      session: null,
      error: NextResponse.json(
        { 
          error: 'Forbidden - Role not allowed',
          required: allowedRoles,
          current: userRole,
        },
        { status: 403 }
      ),
    };
  }
  
  return { session, error: null };
}

/**
 * Get user permissions
 */
export function getUserPermissions(userRole: UserRole | string): string[] {
  if (userRole === 'ADMIN') {
    return ['*'];
  }
  
  return [...(PERMISSIONS[userRole as UserRole] || [])];
}


