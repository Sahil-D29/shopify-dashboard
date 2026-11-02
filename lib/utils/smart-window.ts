import { prisma } from '@/lib/prisma';
import { resolveWhatsAppConfig, META_GRAPH_API_VERSION } from '@/lib/config/whatsapp-config-resolver';
import { graphUrl } from '@/lib/whatsapp/graph';
import { sendTemplate } from '@/lib/whatsapp/template-send';
import type { TemplateInput } from '@/lib/whatsapp/template-payload';
import { configurationIssue, errorIssues, issue, providerIssue, type SendIssue } from '@/lib/whatsapp/issues';
import { normalizePhone } from '@/lib/whatsapp/normalize-phone';
export interface SmartSendResult { success: boolean; usedFreeForm: boolean; messageId?: string; error?: string; issues?: SendIssue[] }
export async function isInFreeWindow(contactId?: string, storeId?: string, _windowExpiresAt?: Date | null): Promise<boolean> {
  if (!contactId || !storeId) return false;
  // Only an inbound customer message opens the service window. Outbound sends and read receipts do not.
  const inbound = await prisma.message.findFirst({ where: { storeId, contactId, direction: 'INBOUND', createdAt: { gt: new Date(Date.now() - 86400000) } }, select: { id: true } });
  return !!inbound;
}
export async function findContactByPhone(phone: string, storeId: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return prisma.contact.findFirst({ where: { storeId, phone: { in: [normalized, '+' + normalized] } }, select: { id: true, lastMessageAt: true } });
}
export async function sendWithSmartWindow(params: {
  phone: string; freeFormBody: string; templateName?: string; templateLanguage?: string;
  templateComponents?: Array<Record<string, unknown>>; storeId: string; contactId?: string;
  windowExpiresAt?: Date | null; templateInput?: TemplateInput; context?: Record<string, any>; forceTemplate?: boolean;
}): Promise<SmartSendResult> {
  const usedFreeForm = !params.forceTemplate && await isInFreeWindow(params.contactId, params.storeId);
  try {
    if (!usedFreeForm) {
      const sent = await sendTemplate(params.storeId, params.phone, { ...params.templateInput, templateName: params.templateName, templateLanguage: params.templateLanguage ?? params.templateInput?.templateLanguage, components: params.templateComponents }, params.context);
      return { success: true, usedFreeForm: false, messageId: sent.messageId };
    }
    const resolved = await resolveWhatsAppConfig(params.storeId);
    if (!resolved.valid) return { success: false, usedFreeForm, error: resolved.error, issues: [configurationIssue(resolved)] };
    const { config } = resolved;
    const response = await fetch(graphUrl(META_GRAPH_API_VERSION + '/' + config.phoneNumberId + '/messages', config.accessToken), {
      method: 'POST', headers: { Authorization: 'Bearer ' + config.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: normalizePhone(params.phone), type: 'text', text: { body: params.freeFormBody } }),
    });
    const result = await response.json();
    if (!response.ok || !result.messages?.[0]?.id) {
      const failure = providerIssue(result.error); return { success: false, usedFreeForm, error: failure.message, issues: [failure] };
    }
    return { success: true, usedFreeForm, messageId: result.messages[0].id };
  } catch (error) { const issues = errorIssues(error); return { success: false, usedFreeForm, error: issues[0].message, issues }; }
}
export async function countInWindowCustomers(storeId: string) {
  const [total, contacts] = await Promise.all([
    prisma.contact.count({ where: { storeId } }),
    prisma.message.findMany({ where: { storeId, direction: 'INBOUND', createdAt: { gt: new Date(Date.now() - 86400000) } }, distinct: ['contactId'], select: { contactId: true } }),
  ]);
  return { total, inWindow: contacts.length, outOfWindow: Math.max(0, total - contacts.length) };
}
