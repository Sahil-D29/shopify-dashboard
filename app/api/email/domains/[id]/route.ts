export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import {
  deleteDomain,
  getDomain,
  isResendConfigured,
  ResendApiError,
  ResendNotConfiguredError,
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

async function loadAccessible(
  request: NextRequest,
  id: string,
): Promise<
  | { ok: true; storeFilter: { allowAll: boolean; storeId?: string }; domain: any }
  | { ok: false; response: NextResponse }
> {
  const userContext = await getUserContext(request);
  if (!userContext) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const requestedStoreId = await getCurrentStoreId(request);
  const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);
  const domain = await prisma.emailDomain.findUnique({ where: { id } });
  if (!domain) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Domain not found' }, { status: 404 }),
    };
  }
  if (!storeFilter.allowAll && domain.storeId !== storeFilter.storeId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
    };
  }
  return { ok: true, storeFilter, domain };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await loadAccessible(request, id);
    if (!result.ok) return result.response;

    // Optionally refresh from Resend on each GET so DNS status stays current
    const refresh = request.nextUrl.searchParams.get('refresh') === 'true';
    if (refresh && result.domain.resendDomainId && isResendConfigured()) {
      try {
        const remote = await getDomain(result.domain.resendDomainId);
        const status = statusToEnum(remote.status);
        const updated = await prisma.emailDomain.update({
          where: { id },
          data: {
            status,
            dnsRecords: (remote.records ?? []) as any,
            lastCheckedAt: new Date(),
            verifiedAt:
              status === 'VERIFIED' && !result.domain.verifiedAt ? new Date() : result.domain.verifiedAt,
          },
        });
        return NextResponse.json({ success: true, domain: updated });
      } catch (error) {
        console.warn('[Domains][GET refresh] Failed:', getErrorMessage(error));
      }
    }

    return NextResponse.json({ success: true, domain: result.domain });
  } catch (error) {
    console.error('[Email Domains][GET id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load domain', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await loadAccessible(request, id);
    if (!result.ok) return result.response;

    let body: { isDefault?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (body.isDefault === true) {
      // Atomic swap: clear other defaults in this store, then set this one
      await prisma.$transaction([
        prisma.emailDomain.updateMany({
          where: { storeId: result.domain.storeId, isDefault: true },
          data: { isDefault: false },
        }),
        prisma.emailDomain.update({ where: { id }, data: { isDefault: true } }),
      ]);
    } else if (body.isDefault === false) {
      await prisma.emailDomain.update({ where: { id }, data: { isDefault: false } });
    }

    const domain = await prisma.emailDomain.findUnique({ where: { id } });
    return NextResponse.json({ success: true, domain });
  } catch (error) {
    console.error('[Email Domains][PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update domain', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await loadAccessible(request, id);
    if (!result.ok) return result.response;

    // Best-effort: delete from Resend too (only if configured + has remote id)
    if (result.domain.resendDomainId && isResendConfigured()) {
      try {
        await deleteDomain(result.domain.resendDomainId);
      } catch (error) {
        // 404 is fine (already gone); log others but proceed with local delete
        if (!(error instanceof ResendApiError && error.status === 404)) {
          console.warn('[Domains][DELETE] Resend delete failed:', getErrorMessage(error));
        }
      }
    }

    await prisma.emailDomain.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Email Domains][DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete domain', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
