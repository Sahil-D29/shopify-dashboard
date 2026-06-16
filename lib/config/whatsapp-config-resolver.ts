/**
 * Unified WhatsApp config resolver.
 * Checks DB (per-store WhatsAppConfig from Embedded Signup) first,
 * falls back to environment variables.
 */

import { prisma } from '@/lib/prisma';
import { getAppSecretProof } from '@/lib/whatsapp/graph';

export const META_GRAPH_API_VERSION = 'v21.0';

export interface ResolvedWhatsAppConfig {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  /** HMAC-SHA256(accessToken) keyed with META_APP_SECRET — Meta requires this on server calls. Null if no app secret set. */
  appSecretProof: string | null;
  source: 'db' | 'env';
}

export type ResolveResult =
  | { valid: true; config: ResolvedWhatsAppConfig }
  | { valid: false; error: string };

export async function resolveWhatsAppConfig(storeId?: string | null): Promise<ResolveResult> {
  // When a specific store is in context, use ONLY that store's own WhatsApp
  // config. Never fall back to the global env credentials — doing so would make
  // every store (including brand-new ones) appear connected to the same number.
  if (storeId) {
    const dbResult = await resolveFromDb(storeId);
    if (dbResult) return { valid: true, config: dbResult };
    return {
      valid: false,
      error: 'WhatsApp is not configured for this store. Connect it in Settings > WhatsApp.',
    };
  }

  // No tenant context (system/legacy calls) — env fallback is allowed.
  const envResult = resolveFromEnv();
  if (envResult) return { valid: true, config: envResult };

  return { valid: false, error: 'WhatsApp environment variables not configured.' };
}

async function resolveFromDb(storeId: string): Promise<ResolvedWhatsAppConfig | null> {
  try {
    const dbConfig = await prisma.whatsAppConfig.findUnique({
      where: { storeId },
    });

    if (!dbConfig?.isConfigured || !dbConfig.phoneNumberId || !dbConfig.businessAccountId || !dbConfig.accessToken) {
      return null;
    }

    let token = dbConfig.accessToken;
    try {
      const { isEncrypted, decrypt } = await import('@/lib/encryption');
      if (isEncrypted(token)) {
        token = decrypt(token);
      }
    } catch {
      // encryption module unavailable (missing ENCRYPTION_KEY) — use token as-is
    }

    return {
      phoneNumberId: dbConfig.phoneNumberId,
      wabaId: dbConfig.businessAccountId,
      accessToken: token,
      appSecretProof: getAppSecretProof(token),
      source: 'db',
    };
  } catch (error) {
    console.error('[whatsapp-config-resolver] DB lookup failed:', error);
    return null;
  }
}

function resolveFromEnv(): ResolvedWhatsAppConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !wabaId || !accessToken) return null;

  return { phoneNumberId, wabaId, accessToken, appSecretProof: getAppSecretProof(accessToken), source: 'env' };
}
