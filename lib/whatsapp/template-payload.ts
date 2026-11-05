import { issue, SendValidationError } from './issues';

export interface MetaTemplateDefinition {
  id: string;
  name: string;
  language: string;
  status: string;
  parameter_format?: string;
  components: Array<{ type: string; format?: string; text?: string; buttons?: Array<{ type: string; text?: string; url?: string }> }>;
}
export interface TemplateInput {
  templateId?: string;
  templateName?: string;
  templateLanguage?: string;
  variables?: Record<string, unknown>;
  variableMappings?: Array<{ variable: string; dataSource?: string; property?: string; fallbackValue?: string }>;
  mediaUrl?: string;
  useDynamicMedia?: boolean;
  useCheckoutRecoveryUrl?: boolean;
  buttonActions?: Record<string, string>;
  components?: any[];
}
const token = (key: string) => key.replace(/^\{\{|\}\}$/g, '').trim();
const tokens = (text = '') => {
  const values = [...new Set(Array.from(text.matchAll(/\{\{([^{}]+)\}\}/g), match => match[1].trim()))];
  return values.every(key => /^\d+$/.test(key)) ? values.sort((a, b) => Number(a) - Number(b)) : values;
};
function readPath(value: any, path: string): unknown {
  return path.split('.').reduce((obj, key) => obj?.[key], value);
}
export function resolveValues(input: TemplateInput, context: Record<string, any> = {}): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input.variables ?? {})) result[token(key)] = value;
  for (const mapping of input.variableMappings ?? []) {
    const source = context[mapping.dataSource ?? 'customer'];
    const property = mapping.property ?? '';
    const snake = property.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    const value = mapping.dataSource === 'static' ? mapping.fallbackValue
      : readPath(source, property) ?? readPath(source, snake);
    result[token(mapping.variable)] = value == null || value === '' ? mapping.fallbackValue : value;
  }
  return result;
}

/** Build only the runtime parameters required by Meta's approved definition. */
export function buildTemplatePayload(template: MetaTemplateDefinition, input: TemplateInput, context: Record<string, any> = {}, preflight = false) {
  const errors = [];
  if (template.status !== 'APPROVED') errors.push(issue('TEMPLATE_NOT_APPROVED', `Template ${template.name} is ${template.status}. Select an approved template.`, 'templateId'));
  const values = resolveValues(input, context);
  const components: any[] = [];
  const supplied = input.components ?? [];
  const hasMapping = (key: string) => (input.variableMappings ?? []).some(m => token(m.variable) === key && (m.property || m.fallbackValue));
  function textParameters(text: string | undefined, section: string, existing: any[] = []) {
    return tokens(text).map((key, index) => {
      const value = values[`${section}.${key}`] ?? values[key] ?? existing.find(p => p.parameter_name === key)?.text ?? existing[index]?.text;
      if ((value == null || !String(value).trim() || /\{\{/.test(String(value))) && !(preflight && (hasMapping(key) || hasMapping(`${section}.${key}`)))) {
        errors.push(issue('MISSING_VARIABLE', `Provide ${section} variable {{${key}}}.`, `${section}.${key}`));
      }
      return { type: 'text', text: String(value ?? ''), ...(template.parameter_format === 'NAMED' ? { parameter_name: key } : {}) };
    });
  }
  for (const component of template.components ?? []) {
    const type = component.type.toUpperCase();
    const existing = supplied.find(c => c.type?.toUpperCase() === type);
    if (type === 'BODY' || (type === 'HEADER' && component.format === 'TEXT')) {
      const parameters = textParameters(component.text, type.toLowerCase(), existing?.parameters);
      if (parameters.length) components.push({ type: type.toLowerCase(), parameters });
    } else if (type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format ?? '')) {
      const mediaType = component.format!.toLowerCase();
      const media = existing?.parameters?.find((p: any) => p.type === mediaType)?.[mediaType];
      const product = context.product ?? context.triggerEvent?.product;
      const url = input.useDynamicMedia ? product?.image?.src ?? product?.image?.url ?? product?.image_url ?? product?.imageUrl : input.mediaUrl ?? media?.link;
      if (!(preflight && input.useDynamicMedia) && !media?.id && (!url || !/^https:\/\//i.test(url))) errors.push(issue('MISSING_MEDIA', `Provide an HTTPS ${mediaType} URL for the template header.`, 'mediaUrl'));
      components.push({ type: 'header', parameters: [{ type: mediaType, [mediaType]: media?.id ? { id: media.id } : { link: url } }] });
    } else if (type === 'HEADER' && component.format !== 'TEXT') {
      errors.push(issue('UNSUPPORTED_TEMPLATE', 'This template header requires a supported template type.', 'templateId'));
    } else if (type === 'BUTTONS') {
      component.buttons?.forEach((button, index) => {
        if (button.type === 'URL' && tokens(button.url).length) {
          let value = input.buttonActions?.[String(index)] ?? input.buttonActions?.[`url_${button.text}`] ?? input.buttonActions?.[`btn-${index}`]
            ?? supplied.find(c => c.type === 'button' && String(c.index) === String(index))?.parameters?.[0]?.text;
          const prefix = button.url?.split('{{')[0] ?? '';
          if (value?.startsWith(prefix) && prefix) value = value.slice(prefix.length);
          if (!(preflight && input.useCheckoutRecoveryUrl) && (!value?.trim() || /\{\{/.test(value))) errors.push(issue('MISSING_BUTTON_PARAMETER', `Provide the dynamic URL value for button ${index + 1}.`, `buttonActions.${index}`));
          components.push({ type: 'button', sub_type: 'url', index: String(index), parameters: [{ type: 'text', text: value ?? '' }] });
        } else if (!['URL', 'PHONE_NUMBER', 'QUICK_REPLY'].includes(button.type)) {
          errors.push(issue('UNSUPPORTED_TEMPLATE', `Button ${index + 1} requires an unsupported parameter type. Select another template.`, 'templateId'));
        }
      });
    }
  }
  if (errors.length) throw new SendValidationError(errors);
  return { name: template.name, language: { code: template.language }, ...(components.length ? { components } : {}) };
}
