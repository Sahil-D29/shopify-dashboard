export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import {
  getDomain,
  isResendConfigured,
  ResendApiError,
  ResendNotConfiguredError,
  verifyDomain,
} from '@/lib/email/resend';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function statusToEnum(status: string | undefined): 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'FAILED' {
  switch ((status ?? '').toLowerCase()) {
    case 'verified':
      return 'VERIFIED';
    case 'failed':
      return 'FAILED';
    case 'not_started':
      return 'NOT_STARTED';
    case 'pending':
    default:
      return 'PENDING';
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const domain = await prisma.emailDomain.findUnique({ where: { id } });
    if (!domain) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }
    if (!storeFilter.allowAll && domain.storeId !== storeFilter.storeId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (!domain.resendDomainId) {
      return NextResponse.json(
        { error: 'Domain is not linked to Resend yet' },
        { status: 400 },
      );
    }
    if (!isResendConfigured()) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY is not configured' },
        { status: 400 },
      );
    }

    try {
      await verifyDomain(domain.resendDomainId);
    } catch (error) {
      if (error instanceof ResendNotConfiguredError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error instanceof ResendApiError) {
        // Verify can return 422 if DNS is wrong; still re-fetch latest status
        if (error.status !== 422) {
          return NextResponse.json(
            { error: error.message, resendCode: error.resendCode },
            { status: 502 },
          );
        }
      } else {
        throw error;
      }
    }

    // Always re-fetch to capture the latest status + records
    const remote = await getDomain(domain.resendDomainId);
    const status = statusToEnum(remote.status);
    const updated = await prisma.emailDomain.update({
      where: { id },
      data: {
        status,
        dnsRecords: (remote.records ?? []) as any,
        lastCheckedAt: new Date(),
        verifiedAt: status === 'VERIFIED' && !domain.verifiedAt ? new Date() : domain.verifiedAt,
      },
    });

    return NextResponse.json({ success: true, domain: updated });
  } catch (error) {
    console.error('[Email Domains][VERIFY] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify domain', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
