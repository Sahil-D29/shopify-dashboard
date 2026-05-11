export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';
import {
  createDomain,
  isResendConfigured,
  ResendApiError,
  ResendNotConfiguredError,
} from '@/lib/email/resend';

const VALID_REGIONS = new Set(['us-east-1', 'eu-west-1', 'sa-east-1', 'ap-northeast-1']);

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

export async function GET(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', domains: [] },
        { status: 401 },
      );
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    const where = storeFilter.allowAll
      ? undefined
      : storeFilter.storeId
        ? { storeId: storeFilter.storeId }
        : { storeId: '__none__' };

    const domains = await prisma.emailDomain.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      success: true,
      domains,
      resendConfigured: isResendConfigured(),
    });
  } catch (error) {
    console.error('[Email Domains][GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load domains',
        details: getErrorMessage(error),
        domains: [],
      },
      { status: 200 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userContext = await getUserContext(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedStoreId = await getCurrentStoreId(request);
    const storeFilter = buildStoreFilter(userContext, requestedStoreId || undefined);

    let storeId: string | null;
    if (storeFilter.allowAll) {
      storeId = requestedStoreId || userContext.storeId || null;
    } else {
      storeId = storeFilter.storeId || null;
    }
    if (!storeId) {
      return NextResponse.json({ error: 'Store context required' }, { status: 400 });
    }

    if (!isResendConfigured()) {
      return NextResponse.json(
        {
          error:
            'Email sending is not configured. Set RESEND_API_KEY in your Render environment variables to enable domain management.',
        },
        { status: 400 },
      );
    }

    let body: { name?: string; region?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const name = body.name?.trim().toLowerCase();
    if (!name || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(name)) {
      return NextResponse.json(
        { error: 'Provide a valid domain name (e.g. mail.example.com)' },
        { status: 400 },
      );
    }
    const region = body.region && VALID_REGIONS.has(body.region) ? body.region : 'us-east-1';

    const existing = await prisma.emailDomain.findUnique({
      where: { storeId_name: { storeId, name } },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'This domain is already added to your store' },
        { status: 409 },
      );
    }

    let resendDomain;
    try {
      resendDomain = await createDomain({ name, region: region as any });
    } catch (error) {
      if (error instanceof ResendNotConfiguredError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error instanceof ResendApiError) {
        return NextResponse.json(
          { error: error.message, resendCode: error.resendCode },
          { status: error.status === 422 ? 400 : 502 },
        );
      }
      throw error;
    }

    const created = await prisma.emailDomain.create({
      data: {
        storeId,
        name,
        region,
        resendDomainId: resendDomain.id,
        status: statusToEnum(resendDomain.status),
        dnsRecords: (resendDomain.records ?? []) as any,
        createdBy: userContext.userId,
        lastCheckedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, domain: created }, { status: 201 });
  } catch (error) {
    console.error('[Email Domains][POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add domain', details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
