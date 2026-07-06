/**
 * Sandbox / Demo mode.
 *
 * A store is in sandbox when it has no working WhatsApp Business connection (or
 * when globally forced via WHATSAPP_SANDBOX=true). In sandbox, WhatsApp sends are
 * simulated instead of calling Meta — so the whole product (campaigns, journeys,
 * cart recovery, test sends) can be exercised end-to-end without a WhatsApp
 * account. This is what lets an app reviewer test every feature without their own
 * Facebook/WhatsApp Business Account.
 *
 * Because it keys off the per-store WhatsApp config, connected merchants keep
 * sending real messages; only unconnected stores run simulated.
 */
import { resolveWhatsAppConfig } from '@/lib/config/whatsapp-config-resolver';

export async function isWhatsAppSandbox(storeId?: string | null): Promise<boolean> {
  if (process.env.WHATSAPP_SANDBOX === 'true') return true;
  if (!storeId) return false; // system/legacy context uses env credentials
  const resolved = await resolveWhatsAppConfig(storeId);
  return !resolved.valid;
}

export function sandboxMessageId(): string {
  return `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
