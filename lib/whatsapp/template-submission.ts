import type { TemplateButton, WhatsAppTemplate } from '@/lib/types/whatsapp-config';

export const META_TEMPLATE_FIELDS =
  'id,name,status,category,language,components,rejected_reason';

export type MetaTemplateButton =
  | { type: 'URL'; text: string; url: string; example?: string[] }
  | { type: 'PHONE_NUMBER'; text: string; phone_number: string }
  | { type: 'QUICK_REPLY'; text: string };

export type MetaTemplateComponent =
  | {
      type: 'HEADER';
      format: string;
      text?: string;
      example?: { header_text: string[][] };
    }
  | {
      type: 'BODY';
      text: string;
      example?: { body_text: string[][] };
    }
  | {
      type: 'FOOTER';
      text: string;
    }
  | {
      type: 'BUTTONS';
      buttons: MetaTemplateButton[];
    };

export interface MetaSubmitPayload {
  name: string;
  language: string;
  category: string;
  components: MetaTemplateComponent[];
}

export interface DynamicUrlValidation {
  dynamic: boolean;
  error?: string;
  prefix?: string;
}

const VALID_CATEGORIES = new Set(['MARKETING', 'UTILITY', 'AUTHENTICATION']);
const DYNAMIC_URL_TOKEN = '{{1}}';

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateDynamicUrlButton(
  url: string | undefined,
  urlExample: string | undefined,
): DynamicUrlValidation {
  const value = String(url ?? '').trim();
  const placeholderMatches = value.match(/\{\{[^{}]+\}\}/g) ?? [];

  if (placeholderMatches.length === 0) return { dynamic: false };

  if (
    placeholderMatches.length !== 1 ||
    placeholderMatches[0] !== DYNAMIC_URL_TOKEN ||
    !value.endsWith(DYNAMIC_URL_TOKEN)
  ) {
    return {
      dynamic: true,
      error: 'Dynamic URL buttons must contain exactly one {{1}} placeholder at the end of the URL.',
    };
  }

  const prefix = value.slice(0, -DYNAMIC_URL_TOKEN.length);
  if (!isHttpsUrl(prefix)) {
    return {
      dynamic: true,
      prefix,
      error: 'Dynamic URL buttons must use an HTTPS URL before {{1}}.',
    };
  }

  const example = String(urlExample ?? '').trim();
  if (!example) {
    return {
      dynamic: true,
      prefix,
      error: 'A full HTTPS example URL is required for a dynamic URL button.',
    };
  }

  if (!isHttpsUrl(example)) {
    return {
      dynamic: true,
      prefix,
      error: 'The dynamic URL example must be a valid HTTPS URL.',
    };
  }

  if (example.includes('{{') || !example.startsWith(prefix) || example.length <= prefix.length) {
    return {
      dynamic: true,
      prefix,
      error: `The dynamic URL example must start with ${prefix} and include a real value after it.`,
    };
  }

  return { dynamic: true, prefix };
}

function toMetaLanguageCode(language: string | undefined): string {
  if (!language) return 'en_US';
  if (language === 'en') return 'en_US';
  if (language.length === 2) return language;
  return language;
}

function isValidButtonUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidPhoneNumber(phoneNumber: string | undefined): phoneNumber is string {
  return typeof phoneNumber === 'string' && /^\+?[1-9]\d{1,14}$/.test(phoneNumber);
}

function toUpperCaseButtonType(button: TemplateButton): TemplateButton['type'] {
  return (typeof button.type === 'string' ? button.type : '').toUpperCase() as TemplateButton['type'];
}

function convertTemplateButtons(buttons: TemplateButton[]): MetaTemplateButton[] {
  return buttons.map(button => {
    const label = button.text ?? button.label ?? '';
    const type = toUpperCaseButtonType(button);

    if (type === 'URL') {
      if (!isValidButtonUrl(button.url)) {
        throw new Error('URL button requires a valid URL');
      }

      const dynamicUrl = validateDynamicUrlButton(button.url, button.urlExample);
      if (dynamicUrl.error) throw new Error(dynamicUrl.error);

      return {
        type: 'URL' as const,
        text: label,
        url: button.url,
        ...(dynamicUrl.dynamic ? { example: [String(button.urlExample).trim()] } : {}),
      };
    }

    if (type === 'PHONE_NUMBER') {
      const phoneNumber = button.phoneNumber ?? button.phone;
      if (!isValidPhoneNumber(phoneNumber)) {
        throw new Error('PHONE_NUMBER button requires a valid phone number');
      }
      return {
        type: 'PHONE_NUMBER' as const,
        text: label,
        phone_number: phoneNumber,
      };
    }

    return {
      type: 'QUICK_REPLY' as const,
      text: label,
    };
  });
}

function buildVariableIndex(template: WhatsAppTemplate): Map<string, number> {
  const entries = new Map<string, number>();
  (template.variables ?? []).forEach((variable, index) => {
    entries.set(variable, index + 1);
  });
  return entries;
}

function convertToNumericPlaceholders(
  text: string | undefined,
  template: WhatsAppTemplate,
  variableIndex: Map<string, number>,
): { text: string; orderedValues: string[] } {
  if (!text) return { text: '', orderedValues: [] };

  const orderedValues: string[] = [];
  const converted = text.replace(/\{\{(\w+)\}\}/g, (_match, variableName: string) => {
    const index = variableIndex.get(variableName);
    if (index) {
      orderedValues[index - 1] = template.sampleValues?.[variableName] ?? '';
      return `{{${index}}}`;
    }

    const numeric = Number(variableName);
    if (!Number.isNaN(numeric) && numeric > 0) return `{{${numeric}}}`;
    return `{{${variableName}}}`;
  });

  for (let index = 0; index < orderedValues.length; index += 1) {
    if (typeof orderedValues[index] === 'undefined') orderedValues[index] = '';
  }

  return { text: converted, orderedValues };
}

function buildBodyExample(template: WhatsAppTemplate, orderedValues: string[]): string[][] | undefined {
  if (orderedValues.length > 0) {
    const filtered = orderedValues.filter(value => value.trim().length > 0);
    if (filtered.length > 0) return [filtered];
  }

  const sampleValues = template.variables
    ?.map(variable => template.sampleValues?.[variable] ?? `sample_${variable}`)
    .filter((value): value is string => Boolean(value && value.trim().length > 0));

  return sampleValues && sampleValues.length > 0 ? [sampleValues] : undefined;
}

function buildComponents(template: WhatsAppTemplate): MetaTemplateComponent[] {
  const components: MetaTemplateComponent[] = [];
  const variableIndex = buildVariableIndex(template);

  if (template.header?.content) {
    const header = convertToNumericPlaceholders(template.header.content, template, variableIndex);
    const headerComponent: MetaTemplateComponent = {
      type: 'HEADER',
      format: template.header.type ?? 'TEXT',
    };

    if (template.header.type === 'TEXT') {
      const examples = header.orderedValues.filter(value => value.trim().length > 0);
      headerComponent.text = header.text;
      if (examples.length > 0) headerComponent.example = { header_text: [examples] };
    }
    components.push(headerComponent);
  }

  const body = convertToNumericPlaceholders(template.body, template, variableIndex);
  if (!body.text || body.text.trim().length === 0) {
    throw new Error('Body text is required and cannot be empty');
  }

  const bodyComponent: MetaTemplateComponent = { type: 'BODY', text: body.text };
  const bodyExample = buildBodyExample(template, body.orderedValues);
  if (bodyExample) bodyComponent.example = { body_text: bodyExample };
  components.push(bodyComponent);

  if (template.footer) components.push({ type: 'FOOTER', text: template.footer });
  if (template.buttons?.length) {
    components.push({ type: 'BUTTONS', buttons: convertTemplateButtons(template.buttons) });
  }

  return components;
}

export function buildMetaPayload(template: WhatsAppTemplate): MetaSubmitPayload {
  if (!VALID_CATEGORIES.has(template.category)) {
    throw new Error(`Invalid category. Must be one of: ${Array.from(VALID_CATEGORIES).join(', ')}`);
  }

  return {
    name: String(template.name).toLowerCase(),
    language: toMetaLanguageCode(template.language),
    category: template.category,
    components: buildComponents(template),
  };
}

const REJECTION_REASON_MESSAGES: Record<string, string> = {
  INVALID_FORMAT: 'Invalid template format. Check variable placement and required examples for dynamic URLs.',
};

export function formatTemplateRejectionReason(reason: string): string {
  return REJECTION_REASON_MESSAGES[reason] ?? reason.replaceAll('_', ' ').toLowerCase();
}
