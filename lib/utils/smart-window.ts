/**
 * Smart Window — 24-hour free messaging window detection and smart sending.
 *
 * Meta allows free-form text messages within 24 hours of a customer's last
 * inbound message. Outside this window, only pre-approved templates can be sent
 * (at higher cost). This utility decides the cheapest/best way to send.
 */
import { prisma } from '@/lib/prisma';
import { getWhatsAppConfig } from '@/lib/config/whatsapp-env';

export interface SmartSendResult {
  success: boolean;
  usedFreeForm: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Check if a customer is currently within the 24-hour free messaging window.
 */
export async function isInFreeWindow(
  contactId?: string,
  storeId?: string,
  windowExpiresAt?: Date | null,
): Promise<boolean> {
  // If we have an explicit window expiry, check it
  if (windowExpiresAt) {
    return windowExpiresAt.getTime() > Date.now();
  }

  // Fallback: check Contact.lastMessageAt
  if (contactId && storeId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, storeId },
      select: { lastMessageAt: true },
    });

    if (contact?.lastMessageAt) {
      return (Date.now() - contact.lastMessageAt.getTime()) < 24 * 60 * 60 * 1000;
    }
  }

  return false;
}

/**
 * Find contact by phone number for window checking.
 */
export async function findContactByPhone(
  phone: string,
  storeId: string,
): Promise<{ id: string; lastMessageAt: Date | null } | null> {
  // Normalize phone — strip non-digits
  const normalizedPhone = phone.replace(/[\s\-+()]/g, '');
  if (!normalizedPhone) return null;

  const contact = await prisma.contact.findFirst({
    where: {
      storeId,
      phone: { contains: normalizedPhone },
    },
    select: { id: true, lastMessageAt: true },
  });

  return contact;
}

/**
 * Send a message using the smart window strategy:
 * - If customer is within 24hr window → send free-form text (no template cost)
 * - If outside window and template is configured → send template
 * - If outside window and no template → skip (return success: false)
 */
export async function sendWithSmartWindow(params: {
  phone: string;
  freeFormBody: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: Array<Record<string, unknown>>;
  storeId: string;
  contactId?: string;
  windowExpiresAt?: Date | null;
}): Promise<SmartSendResult> {
  const config = getWhatsAppConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    return { success: false, usedFreeForm: false, error: 'WhatsApp not configured' };
  }

  const formatted = params.phone.replace(/[\s\-+()]/g, '');
  if (!formatted) {
    return { success: false, usedFreeForm: false, error: 'Invalid phone' };
  }

  // Check if customer is in 24hr free window
  const inWindow = await isInFreeWindow(
    params.contactId,
    params.storeId,
    params.windowExpiresAt,
  );

  if (inWindow) {
    // ─── Send FREE-FORM text (no template cost!) ────────
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formatted,
            type: 'text',
            text: { preview_url: false, body: params.freeFormBody },
          }),
        },
      );
      const data = (await res.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message?: string };
      };
      if (res.ok && data.messages?.[0]?.id) {
        return { success: true, usedFreeForm: true, messageId: data.messages[0].id };
      }
      return { success: false, usedFreeForm: true, error: data.error?.message ?? 'Send failed' };
    } catch (e) {
      return { success: false, usedFreeForm: true, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ─── Outside window: send via TEMPLATE ────────
  if (params.templateName) {
    try {
      const templatePayload: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formatted,
        type: 'template',
        template: {
          name: params.templateName,
          language: { code: params.templateLanguage || 'en' },
          ...(params.templateComponents && params.templateComponents.length > 0
            ? { components: params.templateComponents }
            : {}),
        },
      };

      const res = await fetch(
        `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templatePayload),
        },
      );
      const data = (await res.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message?: string };
      };
      if (res.ok && data.messages?.[0]?.id) {
        return { success: true, usedFreeForm: false, messageId: data.messages[0].id };
      }
      return { success: false, usedFreeForm: false, error: data.error?.message ?? 'Template send failed' };
    } catch (e) {
      return { success: false, usedFreeForm: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // No template configured and outside window — skip
  return { success: false, usedFreeForm: false, error: 'Outside 24hr window and no template configured' };
}

/**
 * Estimate how many customers are currently in the free messaging window
 * for a given store and segment.
 */
export async function countInWindowCustomers(storeId: string): Promise<{
  total: number;
  inWindow: number;
  outOfWindow: number;
}> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [total, inWindow] = await Promise.all([
    prisma.contact.count({ where: { storeId } }),
    prisma.contact.count({
      where: {
        storeId,
        lastMessageAt: { gte: cutoff },
      },
    }),
  ]);

  return {
    total,
    inWindow,
    outOfWindow: total - inWindow,
  };
}
