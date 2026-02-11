import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prisma } from '@/lib/prisma';
import { MemberStatus } from '@prisma/client';

function normalizeRole(role: string | undefined): string {
  if (!role) return '';
  // Remove underscores and convert to uppercase
  return role.toUpperCase().replace(/_/g, '');
}

function canAccessTeam(role: string | undefined): boolean {
  if (!role) return false;
  const normalized = normalizeRole(role);
  // Normalize removes underscores and converts to uppercase
  // So 'STORE_OWNER' becomes 'STOREOWNER', 'SUPER_ADMIN' becomes 'SUPERADMIN', etc.
  const allowed = ['ADMIN', 'SUPERADMIN', 'MANAGER', 'OWNER', 'STOREOWNER'];
  return allowed.includes(normalized);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const params = context.params;
    const resolvedParams = (await params);
    const requestedStoreId = resolvedParams.storeId;
    
    console.log('\n=== Team API GET Request ===');
    console.log('Requested Store ID:', requestedStoreId);
    
    // Get user context for authentication and store filtering
    const userContext = await getUserContext(req);
    if (!userContext) {
      console.log('❌ No user context found');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in' },
        { status: 401 }
      );
    }

    console.log('✓ User:', userContext.email);
    console.log('✓ Role:', userContext.role);
    console.log('✓ Store ID:', userContext.storeId);
    console.log('✓ Assigned Store ID:', userContext.assignedStoreId);
    
    // Check role permissions for team management
    const normalizedRole = normalizeRole(userContext.role);
    const hasAccess = canAccessTeam(userContext.role);
    
    console.log('   Normalized role:', normalizedRole);
    console.log('   Has team access:', hasAccess);
    
    if (!hasAccess) {
      console.log('❌ Permission denied - insufficient role');
      console.log('   User role:', userContext.role);
      console.log('   Normalized:', normalizedRole);
      console.log('   Required: ADMIN, SUPER_ADMIN, MANAGER, OWNER, STORE_OWNER');
      
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: `Your role (${userContext.role || 'none'}) cannot access team management. Required roles: admin, super_admin, manager, owner, or store_owner.`,
          requiredRoles: ['admin', 'super_admin', 'manager', 'owner', 'store_owner'],
          userRole: userContext.role
        },
        { status: 403 }
      );
    }

    // Build store filter to verify user has access to the requested store
    const currentStoreId = await getCurrentStoreId(req);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || requestedStoreId || undefined);
    
    // Determine the effective store ID to use
    let effectiveStoreId: string;
    const isDefaultRequest = requestedStoreId === 'default';
    
    if (storeFilter.allowAll) {
      // Admin can access any store
      effectiveStoreId = requestedStoreId;
    } else if (storeFilter.storeId) {
      // User has a specific store assigned
      if (isDefaultRequest) {
        // If requesting 'default' but user has a store, use their store
        effectiveStoreId = storeFilter.storeId;
      } else {
        // User is requesting a specific store - verify it matches their assigned store
        effectiveStoreId = requestedStoreId;
        if (effectiveStoreId !== storeFilter.storeId) {
          console.log('❌ Store access denied');
          console.log('   Requested store:', requestedStoreId);
          console.log('   User authorized store:', storeFilter.storeId);
          
          return NextResponse.json(
            { 
              error: 'Forbidden',
              message: 'You do not have access to this store',
            },
            { status: 403 }
          );
        }
      }
    } else {
      // User doesn't have a specific store assigned
      // Allow 'default' or any store they request (they might be setting up)
      effectiveStoreId = requestedStoreId;
    }

    console.log('✓ Permission granted');
    console.log('✓ Store access verified');
    console.log('   Requested store ID:', requestedStoreId);
    console.log('   Effective store ID:', effectiveStoreId);
    console.log('   User store filter:', storeFilter);

    // Ensure we have a valid store ID
    if (!effectiveStoreId || effectiveStoreId.trim() === '') {
      console.error('❌ Invalid store ID:', effectiveStoreId);
      return NextResponse.json(
        { 
          error: 'Invalid store ID',
          message: 'Store ID is required'
        },
        { status: 400 }
      );
    }

    // Find store by ID
    const store = await prisma.store.findUnique({
      where: { id: effectiveStoreId },
    });

    if (!store) {
      console.log('Store not found, returning empty team structure');
      return NextResponse.json({ 
        team: {
          storeId: effectiveStoreId,
          members: [],
          pendingUsers: []
        }
      });
    }

    // Load team members from database
    const members = await prisma.storeMember.findMany({
      where: {
        storeId: effectiveStoreId,
        status: MemberStatus.ACTIVE,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Load pending invitations
    const pendingInvitations = await prisma.invitation.findMany({
      where: {
        storeId: effectiveStoreId,
        acceptedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        inviter: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    // Transform to legacy format for compatibility
    const transformedMembers = members.map(m => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt.toISOString(),
    }));

    const transformedPending = pendingInvitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      addedBy: inv.inviter.email,
      addedAt: inv.createdAt.toISOString(),
      status: 'pending',
    }));

    console.log('✓ Team loaded');
    console.log('  Store ID:', effectiveStoreId);
    console.log('  Members:', transformedMembers.length);
    console.log('  Pending:', transformedPending.length);
    console.log('=== Request Complete ===\n');

    return NextResponse.json({ 
      team: {
        storeId: effectiveStoreId,
        members: transformedMembers,
        pendingUsers: transformedPending
      }
    });

  } catch (error) {
    console.error('❌ Error in Team API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
