export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

import { validateWhatsAppConfig } from '@/lib/config/whatsapp-env';
import type { WhatsAppTemplateComponent } from '@/lib/types/whatsapp-config';

export const runtime = 'nodejs';

interface WhatsAppApiTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components?: WhatsAppTemplateComponent[];
}

interface WhatsAppTemplateResponse {
  data?: WhatsAppApiTemplate[];
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Failed to fetch templates';

export async function GET() {
  try {
    const validation = validateWhatsAppConfig();
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'WhatsApp not configured', details: validation.error },
        { status: 400 },
      );
    }

    const { config } = validation;
    if (!config.wabaId || !config.accessToken) {
      return NextResponse.json(
        { error: 'WhatsApp credentials are incomplete' },
        { status: 400 },
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.wabaId}/message_templates`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const data = (await response.json().catch(() => ({}))) as WhatsAppTemplateResponse;

    if (!response.ok) {
      console.error('[API] WhatsApp API Error:', data?.error ?? data);
      return NextResponse.json(
        { error: 'Failed to fetch templates', details: data?.error },
        { status: response.status },
      );
    }

    const allTemplates = Array.isArray(data.data) ? data.data : [];

    const approvedTemplates = allTemplates
      .filter(template => template.status === 'APPROVED')
      .map(template => ({
        id: template.id,
        name: template.name,
        language: template.language,
        category: template.category,
        status: template.status,
        components: template.components ?? [],
      }));

    return NextResponse.json({
      templates: approvedTemplates,
      total: allTemplates.length,
      approved: approvedTemplates.length,
    });
  } catch (error) {
    console.error('[API] Error fetching WhatsApp templates:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

