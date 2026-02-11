export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { TemplateValidator } from '@/lib/utils/template-validator';
import { getTemplates, setTemplates } from '@/lib/whatsapp/templates-store';
import type { TemplateButton, WhatsAppTemplate } from '@/lib/types/whatsapp-config';

interface SubmitRequestBody {
  wabaId?: string;
  accessToken?: string;
}

type MetaComponent =
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
      buttons: Array<
        | { type: 'URL'; text: string; url: string }
        | { type: 'PHONE_NUMBER'; text: string; phone_number: string }
        | { type: 'QUICK_REPLY'; text: string }
      >;
    };

type MetaButtons = Extract<MetaComponent, { type: 'BUTTONS' }>['buttons'];

interface MetaSubmitPayload {
  name: string;
  language: string;
  category: string;
  components: MetaComponent[];
}

interface MetaSubmitError {
  message?: string;
  error_user_msg?: string;
  code?: number;
  error_subcode?: number;
}

interface MetaSubmitResponse {
  id?: string;
  status?: string;
  error?: MetaSubmitError;
}

const VALID_CATEGORIES = new Set(['MARKETING', 'UTILITY', 'AUTHENTICATION']);

function withDefault<T>(value: T | undefined, fallback: T): T {
  return value === undefined || value === null ? fallback : value;
}

function toUpperCaseButtonType(button: TemplateButton): TemplateButton['type'] {
  return (typeof button.type === 'string' ? button.type : '').toUpperCase() as TemplateButton['type'];
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

function convertTemplateButtons(buttons: TemplateButton[]): MetaButtons {
  return buttons.map(button => {
    const label = button.text ?? button.label ?? '';
    const type = toUpperCaseButtonType(button);

    if (type === 'URL') {
      if (!isValidButtonUrl(button.url)) {
        throw new Error('URL button requires a valid URL');
      }
      return {
        type: 'URL' as const,
        text: label,
        url: button.url,
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
    if (!Number.isNaN(numeric) && numeric > 0) {
      return `{{${numeric}}}`;
    }

    return `{{${variableName}}}`;
  });

  for (let i = 0; i < orderedValues.length; i += 1) {
    if (typeof orderedValues[i] === 'undefined') {
      orderedValues[i] = '';
    }
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

  if (sampleValues && sampleValues.length > 0) {
    return [sampleValues];
  }

  return undefined;
}

function buildComponents(template: WhatsAppTemplate): MetaComponent[] {
  const components: MetaComponent[] = [];
  const variableIndex = buildVariableIndex(template);

  if (template.header?.content) {
    const header = convertToNumericPlaceholders(template.header.content, template, variableIndex);

    const headerComponent: MetaComponent = {
      type: 'HEADER',
      format: template.header.type ?? 'TEXT',
    };

    if (template.header.type === 'TEXT') {
      const examples = header.orderedValues.filter(value => value.trim().length > 0);
      (headerComponent as MetaComponent & { text?: string }).text = header.text;
      if (examples.length > 0) {
        (headerComponent as MetaComponent & { example?: { header_text: string[][] } }).example = {
          header_text: [examples],
        };
      }
    }

    components.push(headerComponent);
  }

  const body = convertToNumericPlaceholders(template.body, template, variableIndex);
  if (!body.text || body.text.trim().length === 0) {
    throw new Error('Body text is required and cannot be empty');
  }

  const bodyComponent: MetaComponent = {
    type: 'BODY',
    text: body.text,
  };

  const bodyExample = buildBodyExample(template, body.orderedValues);
  if (bodyExample) {
    bodyComponent.example = { body_text: bodyExample };
  }

  components.push(bodyComponent);

  if (template.footer) {
    components.push({
      type: 'FOOTER',
      text: template.footer,
    });
  }

  if (template.buttons && template.buttons.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: convertTemplateButtons(template.buttons),
    });
  }

  return components;
}

function buildMetaPayload(template: WhatsAppTemplate): MetaSubmitPayload {
  const language = toMetaLanguageCode(template.language);

  if (!VALID_CATEGORIES.has(template.category)) {
    throw new Error(`Invalid category. Must be one of: ${Array.from(VALID_CATEGORIES).join(', ')}`);
  }

  const components = buildComponents(template);

  return {
    name: String(template.name).toLowerCase(),
    language,
    category: template.category,
    components,
  };
}

function parseRequestBody(body: unknown): SubmitRequestBody {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const payload = body as SubmitRequestBody;
  return {
    wabaId: payload.wabaId,
    accessToken: payload.accessToken,
  };
}

function buildUserMessage(error: MetaSubmitError | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.error_subcode === 2388293) {
    return 'Your template has too many variables for the amount of text. Add more words to your message or reduce the number of variables.';
  }
  if (error.code === 100) {
    return 'Invalid template format. Please check all fields.';
  }
  if (error.code === 190) {
    return 'Authentication failed. Your access token may have expired.';
  }
  if (error.message && error.message.includes('already exists')) {
    return 'A template with this name already exists. Please use a different name.';
  }
  return error.error_user_msg ?? error.message ?? fallback;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const templates = getTemplates();
    const template = templates.find(item => item.id === id);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const validation = TemplateValidator.validateTemplate({
      name: template.name,
      body: template.body ?? '',
      variables: template.variables ?? [],
      header: template.header ? { type: template.header.type, content: template.header.content ?? '' } : undefined,
      footer: template.footer,
      buttons: template.buttons?.map(button => ({
        type: String(button.type).toUpperCase() as 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY',
        text: button.text ?? button.label ?? '',
        url: button.url,
        phoneNumber: button.phoneNumber ?? button.phone,
      })),
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Template validation failed',
          validationErrors: validation.errors,
          validationWarnings: validation.warnings,
          suggestion: TemplateValidator.getSuggestion({
            body: template.body ?? '',
            variables: template.variables ?? [],
          }),
        },
        { status: 400 },
      );
    }

    const requestBody = parseRequestBody(await request.json().catch(() => ({})));
    const wabaId = requestBody.wabaId ?? process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    const accessToken = requestBody.accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN;

    if (!wabaId || !accessToken) {
      return NextResponse.json(
        {
          error: 'WhatsApp credentials not configured. Provide wabaId and accessToken in request body or set env vars.',
        },
        { status: 400 },
      );
    }

    const metaPayload = buildMetaPayload(template);

    const response = await fetch(`https://graph.facebook.com/v18.0/${wabaId}/message_templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metaPayload),
    });

    const result = (await response.json()) as MetaSubmitResponse;

    if (!response.ok) {
      const errorMessage = withDefault(result.error?.message, 'Failed to submit template to Meta');
      const userFriendlyMessage = buildUserMessage(result.error, errorMessage);

      return NextResponse.json(
        {
          error: errorMessage,
          userMessage: userFriendlyMessage,
          details: result.error,
          payload: metaPayload,
          errorCode: result.error?.code,
          errorSubcode: result.error?.error_subcode,
        },
        { status: response.status },
      );
    }

    const nextTemplate: WhatsAppTemplate = {
      ...template,
      status: String(result.status ?? template.status).toUpperCase() as WhatsAppTemplate['status'],
      metaTemplateId: result.id ?? template.metaTemplateId,
      submittedAt: Date.now(),
      updatedAt: new Date().toISOString(),
    };

    const index = templates.findIndex(item => item.id === id);
    templates[index] = nextTemplate;
    setTemplates(templates);

    return NextResponse.json({
      success: true,
      template: nextTemplate,
      metaId: result.id,
      metaStatus: result.status,
      message: 'Template submitted successfully! It will be reviewed by Meta within 24 hours.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit template';
    return NextResponse.json(
      {
        error: message,
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 },
    );
  }
}
