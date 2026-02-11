import { NextRequest, NextResponse } from 'next/server';

import { getTemplates } from '@/lib/whatsapp/templates-store';
import type { VariableMapping, WhatsAppTemplate } from '@/lib/types/whatsapp-config';

interface TestMessageRequestBody {
  templateId?: string;
  templateName?: string;
  language?: string;
  phoneNumber?: string;
  variableMappings?: VariableMapping[];
}

function normalisePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/[^+\d]/g, '');
}

function findTemplate(
  templates: WhatsAppTemplate[],
  templateId: string | undefined,
  templateName: string | undefined,
  language: string,
): WhatsAppTemplate | undefined {
  if (templateId) {
    const byId = templates.find(template => template.id === templateId);
    if (byId) return byId;
  }

  if (templateName) {
    return templates.find(template => template.name === templateName && template.language === language);
  }

  return undefined;
}

function findMissingVariables(
  variables: string[] | undefined,
  mappings: VariableMapping[] | undefined,
): string[] {
  if (!variables || variables.length === 0) return [];
  const mapByVariable = new Map(
    (mappings ?? []).map(mapping => [mapping.variable.replace(/^\{\{|\}\}$/g, ''), mapping]),
  );
  return variables.filter(variable => {
    const mapping = mapByVariable.get(variable);
    return !mapping || !mapping.fallbackValue;
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as TestMessageRequestBody;
    const { templateId, templateName, language, phoneNumber, variableMappings } = payload;

    if (!templateId && !templateName) {
      return NextResponse.json({ error: 'templateId or templateName is required.' }, { status: 400 });
    }
    if (!language) {
      return NextResponse.json({ error: 'language is required.' }, { status: 400 });
    }
    if (!phoneNumber) {
      return NextResponse.json({ error: 'phoneNumber is required.' }, { status: 400 });
    }

    const normalizedPhone = normalisePhoneNumber(phoneNumber);
    if (!/^\+?\d{8,15}$/.test(normalizedPhone)) {
      return NextResponse.json(
        {
          error: 'Invalid phone number format.',
          userMessage: 'Enter a valid WhatsApp number with country code, e.g., +14155552671.',
        },
        { status: 400 },
      );
    }

    const templates = getTemplates();
    const template = findTemplate(templates, templateId, templateName, language);

    if (!template) {
      return NextResponse.json(
        {
          error: 'Template not found.',
          userMessage: 'The selected template is no longer available. Refresh the gallery and choose again.',
        },
        { status: 404 },
      );
    }

    if (template.status !== 'APPROVED') {
      return NextResponse.json(
        {
          error: 'Template is not approved.',
          userMessage: 'Only approved templates can be used for test messages.',
        },
        { status: 409 },
      );
    }

    const missing = findMissingVariables(template.variables, variableMappings);

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: 'Missing variable mappings.',
          userMessage: 'Complete all variable mappings before sending a test message.',
          missing,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      messageId: `wamid.${Date.now().toString(36)}`,
      preview: {
        templateId: template.id,
        templateName: template.name,
        language,
        phoneNumber: normalizedPhone,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send test message.';
    return NextResponse.json(
      {
        error: message,
        userMessage: 'Unable to send test message right now. Try again shortly.',
      },
      { status: 500 },
    );
  }
}



