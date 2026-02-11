export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import type { WhatsAppActionConfig, WhatsAppBodyField } from '@/lib/types/whatsapp-config';
import { getTemplates } from '@/lib/whatsapp/templates-store';
import { renderTemplateWithVariables, countTemplateCharacters } from '@/lib/whatsapp/template-utils';

interface PreviewRenderRequest {
  templateId?: string;
  templateName?: string;
  bodyFields?: WhatsAppBodyField[];
  variables?: Record<string, string>;
  config?: WhatsAppActionConfig;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PreviewRenderRequest;
    const { templateId, templateName, bodyFields, variables = {}, config } = body;

    // Get template
    const templates = getTemplates();
    let template = templateId ? templates.find(t => t.id === templateId) : null;
    if (!template && templateName) {
      template = templates.find(t => t.name === templateName);
    }

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found.' },
        { status: 404 },
      );
    }

    // Use bodyFields if provided, otherwise use template body
    let bodyContent = template.body || template.content || '';
    if (bodyFields && bodyFields.length > 0) {
      bodyContent = bodyFields
        .map(field => field.value?.trim())
        .filter(Boolean)
        .join('\n\n');
    }

    // Create template for rendering
    const templateForRender = {
      ...template,
      body: bodyContent,
      content: bodyContent,
    };

    // Use variables from config if provided
    let variableValues = variables;
    if (config?.variableMappings) {
      variableValues = {};
      config.variableMappings.forEach(mapping => {
        const key = mapping.variable.replace(/^\{\{|\}\}$/g, '');
        variableValues[mapping.variable] = mapping.fallbackValue || '';
        variableValues[key] = mapping.fallbackValue || '';
      });
      // Merge with provided variables (they take precedence)
      variableValues = { ...variableValues, ...variables };
    }

    // Render template
    const rendered = renderTemplateWithVariables(templateForRender, variableValues);
    const characterCount = countTemplateCharacters(templateForRender, variableValues);

    return NextResponse.json({
      rendered,
      characterCount,
      template: {
        id: template.id,
        name: template.name,
        category: template.category,
        language: template.language,
        status: template.status,
      },
      variables: {
        provided: Object.keys(variables),
        required: template.variables || [],
        mapped: Object.keys(variableValues),
      },
    });
  } catch (error) {
    console.error('[preview-render]', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to render preview.',
      },
      { status: 500 },
    );
  }
}

