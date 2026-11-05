import { resolveWhatsAppConfig, META_GRAPH_API_VERSION } from '@/lib/config/whatsapp-config-resolver';
import { graphUrl } from './graph';
import { normalizePhone, isValidPhone } from './normalize-phone';
import { issue, providerIssue, SendValidationError, configurationIssue } from './issues';
import { buildTemplatePayload, type MetaTemplateDefinition, type TemplateInput } from './template-payload';

async function fetchDefinitions(storeId: string, name?: string): Promise<MetaTemplateDefinition[]> {
  if (!storeId) throw new SendValidationError([issue('STORE_REQUIRED', 'Select a store before sending.', 'storeId')]);
  const resolved = await resolveWhatsAppConfig(storeId);
  if (!resolved.valid) throw new SendValidationError([configurationIssue(resolved)]);
  const config = resolved.config;
  let url: string | undefined = graphUrl(META_GRAPH_API_VERSION + '/' + config.wabaId + '/message_templates', config.accessToken, {
    fields: 'id,name,category,language,status,parameter_format,components', limit: '100', ...(name ? { name } : {}),
  });
  const definitions: MetaTemplateDefinition[] = [];
  while (url) {
    const response: Response = await fetch(url, { headers: { Authorization: 'Bearer ' + config.accessToken }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const result: any = await response.json();
    if (!response.ok || result.error) throw new SendValidationError([providerIssue(result.error)]);
    definitions.push(...(result.data ?? []));
    url = result.paging?.next;
    if (url) {
      const next: URL = new URL(url);
      if (next.hostname !== 'graph.facebook.com' || next.protocol !== 'https:') throw new SendValidationError([providerIssue(undefined)]);
      if (config.appSecretProof) next.searchParams.set('appsecret_proof', config.appSecretProof);
      url = next.toString();
    }
  }
  return definitions;
}
function selectDefinition(definitions: MetaTemplateDefinition[], input: TemplateInput) {
  if (!input.templateName && !input.templateId) throw new SendValidationError([issue('TEMPLATE_REQUIRED', 'Select an approved WhatsApp template.', 'templateId')]);
  const metaId = input.templateId?.replace(/^meta_/, '');
  const strictId = !!input.templateId && (/^meta_/.test(input.templateId) || /^\d+$/.test(input.templateId));
  const matches = definitions.filter(t => (strictId ? t.id === metaId : t.name === input.templateName || t.id === metaId)
    && (!input.templateName || t.name === input.templateName) && (!input.templateLanguage || t.language === input.templateLanguage));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) throw new SendValidationError([issue('LANGUAGE_REQUIRED', 'Select the template language.', 'templateLanguage')]);
  throw new SendValidationError([issue('TEMPLATE_NOT_FOUND', 'This template or language is unavailable in this store. Refresh templates and select again.', 'templateId')]);
}
export async function resolveTemplate(storeId: string, input: TemplateInput): Promise<MetaTemplateDefinition> {
  if (!input.templateName && !input.templateId) throw new SendValidationError([issue('TEMPLATE_REQUIRED', 'Select an approved WhatsApp template.', 'templateId')]);
  return selectDefinition(await fetchDefinitions(storeId, input.templateName), input);
}
/** One fresh Meta snapshot per issue-list request; never a cross-store global cache. */
export function createTemplateChecker(storeId: string) {
  let definitions: Promise<MetaTemplateDefinition[]> | undefined;
  return async (input: TemplateInput) => {
    if (!input.templateName && !input.templateId) throw new SendValidationError([issue('TEMPLATE_REQUIRED', 'Select an approved WhatsApp template.', 'templateId')]);
    definitions ??= fetchDefinitions(storeId);
    return buildTemplatePayload(selectDefinition(await definitions, input), input, {}, true);
  };
}

export async function prepareTemplate(storeId: string, input: TemplateInput, context = {}, preflight = false) {
  const template = await resolveTemplate(storeId, input);
  return buildTemplatePayload(template, input, context, preflight);
}

export async function sendTemplate(storeId: string, phone: string, input: TemplateInput, context = {}, definition?: MetaTemplateDefinition) {
  const formattedPhone = normalizePhone(phone);
  if (!/^[1-9]\d{7,14}$/.test(formattedPhone) || !isValidPhone(formattedPhone)) throw new SendValidationError([issue('INVALID_PHONE', 'Provide a valid recipient WhatsApp number with country code.', 'phone')]);
  const template = definition ? buildTemplatePayload(definition, input, context) : await prepareTemplate(storeId, input, context);
  const resolved = await resolveWhatsAppConfig(storeId);
  if (!resolved.valid) throw new SendValidationError([configurationIssue(resolved)]);
  const { config } = resolved;
  let response: Response;
  try { response = await fetch(graphUrl(`${META_GRAPH_API_VERSION}/${config.phoneNumberId}/messages`, config.accessToken), {
    method: 'POST', signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: formattedPhone, type: 'template', template }),
  });
  } catch { throw new SendValidationError([{ ...issue('SEND_OUTCOME_UNKNOWN', 'The provider request timed out or lost its connection. Delivery is uncertain.'), customerFixable: false, action: 'Contact support with this reference before resending.', referenceId: crypto.randomUUID() }]); }
  const result = await response.json();
  if (!response.ok || result.error) throw new SendValidationError([providerIssue(result.error)]);
  if (!result.messages?.[0]?.id) throw new SendValidationError([providerIssue(undefined)]);
  return { success: true, messageId: result.messages[0].id as string, phoneNumber: formattedPhone, template };
}
