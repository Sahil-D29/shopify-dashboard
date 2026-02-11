import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/logger';
import { MemberStatus } from '@prisma/client';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await context.params;
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { inviter: { select: { email: true, name: true } } },
    });

    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Invalid or expired invitation' }, { status: 400 });
    }
    if (invitation.acceptedAt) {
      return NextResponse.json({ success: false, error: 'Invitation has already been accepted' }, { status: 400 });
    }
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ success: false, error: 'Invitation has expired' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'Email does not match invitation' }, { status: 400 });
    }

    await prisma.storeMember.upsert({
      where: {
        userId_storeId: { userId: user.id, storeId: invitation.storeId },
      },
      update: { status: MemberStatus.ACTIVE },
      create: {
        userId: user.id,
        storeId: invitation.storeId,
        role: invitation.role,
        status: MemberStatus.ACTIVE,
        invitedBy: invitation.invitedBy,
        joinedAt: new Date(),
      },
    });

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    await logActivity({
      userId: user.id,
      storeId: invitation.storeId,
      action: 'invitation_accepted',
      resourceId: invitation.id,
      details: { invitationId: invitation.id, role: invitation.role },
    });

    const member = await prisma.storeMember.findUnique({
      where: { userId_storeId: { userId: user.id, storeId: invitation.storeId } },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    return NextResponse.json({
      success: true,
      teamMember: member
        ? {
            userId: member.userId,
            role: member.role.toLowerCase(),
            permissions: (member.permissions as unknown[]) ?? [],
            addedAt: member.joinedAt.toISOString(),
            addedBy: member.invitedBy,
            status: member.status.toLowerCase(),
            user: member.user,
          }
        : null,
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
