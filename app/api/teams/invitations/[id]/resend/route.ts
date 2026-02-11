import { NextRequest, NextResponse } from 'next/server';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { getBaseUrl } from '@/lib/utils/getBaseUrl';

function normalizeRole(role: string | undefined): string {
  if (!role) return '';
  return role.toUpperCase().replace(/_/g, '');
}

function canAccessTeam(role: string | undefined): boolean {
  if (!role) return false;
  const n = normalizeRole(role);
  return ['ADMIN', 'SUPERADMIN', 'MANAGER', 'OWNER', 'STOREOWNER'].includes(n);
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userContext = await getUserContext(_request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccessTeam(userContext.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const invitation = await prisma.invitation.findUnique({
      where: { id },
    });
    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Invitation not found' }, { status: 404 });
    }
    if (invitation.acceptedAt) {
      return NextResponse.json({ success: false, error: 'Invitation already accepted' }, { status: 400 });
    }
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ success: false, error: 'Invitation expired' }, { status: 400 });
    }

    const currentStoreId = await getCurrentStoreId(_request);
    const storeFilter = buildStoreFilter(userContext, currentStoreId || invitation.storeId);
    if (!storeFilter.allowAll && storeFilter.storeId !== invitation.storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.invitation.update({
      where: { id },
      data: { token, expiresAt },
    });

    const baseUrl = getBaseUrl();
    const invitationLink = `${baseUrl}/accept-invitation?token=${token}`;

    return NextResponse.json({
      success: true,
      message: 'Invitation resent',
      invitationLink,
    });
  } catch (error) {
    console.error('Resend invitation API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
