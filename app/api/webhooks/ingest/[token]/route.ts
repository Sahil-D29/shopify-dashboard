export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt, isEncrypted } from '@/lib/encryption';
import { processInboundWebhook, type IngestPayload } from '@/lib/webhooks/ingest';

const MAX_BODY_BYTES = 1_000_000; // ~1MB cap

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function presentedSecret(request: NextRequest): string {
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return request.nextUrl.searchParams.get('token')?.trim() || '';
}

/**
 * POST /api/webhooks/ingest/[token]
 *
 * Public inbound ingestion endpoint. `[token]` is the integration's non-secret
 * publicId (in the URL). The caller must ALSO present the secret token via
 * `Authorization: Bearer <secret>` (or `?token=<secret>`). Always responds fast;
 * processing failures are logged, not surfaced as 5xx to the sender.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: publicId } = await params;

  const integration = await prisma.webhookIntegration.findUnique({
    where: { publicId },
    select: { id: true, storeId: true, dataTypes: true, events: true, isActive: true, secretEnc: true },
  });

  if (!integration) {
    return NextResponse.json({ error: 'Unknown webhook' }, { status: 404 });
  }
  if (!integration.isActive) {
    return NextResponse.json({ error: 'Webhook is disabled' }, { status: 403 });
  }

  // Verify the secret.
  let expectedSecret = integration.secretEnc;
  try {
    if (isEncrypted(expectedSecret)) expectedSecret = decrypt(expectedSecret);
  } catch {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  const provided = presentedSecret(request);
  if (!provided || !timingSafeEqual(provided, expectedSecret)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Read + size-guard the body.
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let body: IngestPayload;
  try {
    body = raw ? (JSON.parse(raw) as IngestPayload) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = await processInboundWebhook(
    {
      id: integration.id,
      storeId: integration.storeId,
      dataTypes: integration.dataTypes,
      events: integration.events,
    },
    body,
  );

  // Log the delivery + update counters (non-fatal).
  try {
    await prisma.$transaction([
      prisma.webhookEvent.create({
        data: {
          integrationId: integration.id,
          storeId: integration.storeId,
          eventType: result.eventType,
          payload: body as any,
          contactId: result.contactId ?? null,
          status: result.status,
          error: result.error ?? null,
        },
      }),
      prisma.webhookIntegration.update({
        where: { id: integration.id },
        data: result.ok
          ? { receivedCount: { increment: 1 }, lastReceivedAt: new Date() }
          : { failureCount: { increment: 1 } },
      }),
    ]);
  } catch (err) {
    console.error('[ingest] failed to log delivery:', err);
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true, eventType: result.eventType, contactId: result.contactId });
}

/** Simple verification challenge for setup (echo a `challenge` query param). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: publicId } = await params;
  const exists = await prisma.webhookIntegration.findUnique({
    where: { publicId },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: 'Unknown webhook' }, { status: 404 });
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) return new NextResponse(challenge);
  return NextResponse.json({ ok: true });
}
