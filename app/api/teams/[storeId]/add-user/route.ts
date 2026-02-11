import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prisma } from '@/lib/prisma';
import { StoreRole } from '@prisma/client';
import crypto from 'crypto';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ storeId: string }> }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const params = context.params;
    const resolvedParams = (await params);
    const requestedStoreId = resolvedParams.storeId;
    
    // Get user context for authentication and store filtering
    const userContext = await getUserContext(req);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[API] Adding user, requested by:', userContext.email);

    // Normalize role for checking
    const normalizedRole = userContext.role ? userContext.role.toUpperCase().replace(/_/g, '') : '';
    const canAdd = ['ADMIN', 'SUPERADMIN', 'MANAGER'].includes(normalizedRole);
    
    console.log('[API] User role:', userContext.role, 'Normalized:', normalizedRole, 'Can add:', canAdd);
    
    if (!canAdd) {
      return NextResponse.json({ 
        error: 'Forbidden - Only admins can add users',
        message: `Your role (${userContext.role || 'none'}) does not have permission to add team members`
      }, { status: 403 });
    }

    // Build store filter to verify user has access to the requested store
    const currentStoreId = await getCurrentStoreId(req);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || requestedStoreId || undefined);
    
    // Verify user has access to the requested store
    if (!storeFilter.allowAll && storeFilter.storeId && storeFilter.storeId !== requestedStoreId) {
      console.log('[API] Store access denied');
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

    const authorizedStoreId = storeFilter.allowAll ? requestedStoreId : (storeFilter.storeId || requestedStoreId);

    let body: { email?: string; role?: string };
    try {
      body = await req.json();
    } catch (error) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    const { email, role: newRole } = body;
    if (!email || !newRole) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { id: authorizedStoreId },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      const existingMember = await prisma.storeMember.findUnique({
        where: {
          userId_storeId: {
            userId: existingUser.id,
            storeId: authorizedStoreId,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json({ error: 'User is already a team member' }, { status: 400 });
      }
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        storeId: authorizedStoreId,
        email: email.toLowerCase(),
        acceptedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingInvitation) {
      return NextResponse.json({ error: 'User is already in the pending list' }, { status: 400 });
    }

    // Get inviter user
    const inviter = await prisma.user.findUnique({
      where: { email: userContext.email },
    });

    if (!inviter) {
      return NextResponse.json({ error: 'Inviter not found' }, { status: 404 });
    }

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        storeId: authorizedStoreId,
        email: email.toLowerCase(),
        role: newRole as StoreRole,
        invitedBy: inviter.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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

    console.log('[API] User added to pending list:', email);

    return NextResponse.json({
      success: true,
      message: 'User added successfully. They will get access when they sign in.',
      user: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: 'pending',
      },
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
