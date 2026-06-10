export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { META_GRAPH_API_VERSION, resolveWhatsAppConfig } from '@/lib/config/whatsapp-config-resolver';
import { graphUrl } from '@/lib/whatsapp/graph';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';

/**
 * Register a WhatsApp phone number for Cloud API sending.
 *
 * A number added to a WABA cannot send messages until it is registered via
 * POST /{phone-number-id}/register with a 6-digit PIN. If two-step
 * verification is OFF, this sets the PIN; if it's ON, the PIN must match.
 *
 * Fixes error #133010 ("Account not registered").
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({} as { pin?: string; storeId?: string }));
    const providedPin = typeof body?.pin === 'string' ? body.pin.replace(/\D/g, '') : '';

    const storeId = body?.storeId || (await getCurrentStoreId(request));
    const resolved = await resolveWhatsAppConfig(storeId);
    if (!resolved.valid) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp not configured. Connect with Facebook first.' },
        { status: 400 },
      );
    }

    const { phoneNumberId, accessToken } = resolved.config;

    // Use the provided PIN, else a deterministic-but-stored 6-digit PIN.
    const pin = providedPin.length === 6 ? providedPin : String(Math.floor(100000 + Math.random() * 900000));

    const res = await fetch(graphUrl(`${META_GRAPH_API_VERSION}/${phoneNumberId}/register`, accessToken), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const code = data?.error?.code;
      const sub = data?.error?.error_subcode;
      let userMessage = data?.error?.message || 'Failed to register number';

      // 139000 / wrong pin → two-step verification already enabled with a different PIN
      if (code === 139000 || sub === 2388007 || /pin/i.test(userMessage)) {
        userMessage =
          'This number already has a two-step verification PIN. Enter that exact 6-digit PIN to register, or disable two-step verification in WhatsApp Manager first.';
      }

      return NextResponse.json(
        { success: false, error: userMessage, details: data?.error, needsPin: true },
        { status: res.status },
      );
    }

    // Persist the PIN we set so it can be reused later (e.g. re-register).
    if (storeId) {
      try {
        const existing = await prisma.whatsAppConfig.findUnique({ where: { storeId }, select: { settings: true } });
        const settings = (existing?.settings as Record<string, unknown>) || {};
        await prisma.whatsAppConfig.update({
          where: { storeId },
          data: { settings: { ...settings, registered: true, twoStepPin: pin } },
        });
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({ success: true, message: 'Number registered for sending.', pin });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
