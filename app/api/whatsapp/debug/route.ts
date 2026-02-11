export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTemplates } from '@/lib/whatsapp/templates-store';
import type { WhatsAppTemplate } from '@/lib/types/whatsapp-config';

interface DebugTemplateSummary {
  id: string;
  name: string;
  status: WhatsAppTemplate['status'];
  metaTemplateId?: string;
}

interface MetaTemplateSummary {
  name?: string;
  status?: string;
  id?: string;
}

interface DebugResponse {
  environment: {
    wabaIdConfigured: boolean;
    phoneNumberIdConfigured: boolean;
    accessTokenConfigured: boolean;
    wabaId: string;
    phoneNumberId: string;
    tokenLength: number;
  };
  storage: {
    templatesCount: number;
    templates: DebugTemplateSummary[];
  };
  metaApi?: {
    status: number;
    ok: boolean;
    templatesInMeta: number;
    metaTemplates: MetaTemplateSummary[];
    error?: unknown;
  };
}

interface MetaTemplatesResponse {
  data?: MetaTemplateSummary[];
  error?: unknown;
}

export async function GET() {
  try {
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    const templates = getTemplates();

    const debug: DebugResponse = {
      environment: {
        wabaIdConfigured: Boolean(wabaId),
        phoneNumberIdConfigured: Boolean(phoneNumberId),
        accessTokenConfigured: Boolean(accessToken),
        wabaId: wabaId ? `${wabaId.substring(0, 10)}...` : 'Not set',
        phoneNumberId: phoneNumberId ? `${phoneNumberId.substring(0, 10)}...` : 'Not set',
        tokenLength: accessToken?.length ?? 0,
      },
      storage: {
        templatesCount: templates.length,
        templates: templates.map(template => ({
          id: template.id,
          name: template.name,
          status: template.status,
          metaTemplateId: template.metaTemplateId,
        })),
      },
    };

    if (wabaId && accessToken) {
      try {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${wabaId}/message_templates?limit=10`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        const data = (await response.json()) as MetaTemplatesResponse;

        debug.metaApi = {
          status: response.status,
          ok: response.ok,
          templatesInMeta: data.data?.length ?? 0,
          metaTemplates: data.data ?? [],
          error: data.error,
        };
      } catch (metaError) {
        debug.metaApi = {
          status: 0,
          ok: false,
          templatesInMeta: 0,
          metaTemplates: [],
          error: metaError instanceof Error ? metaError.message : metaError,
        };
      }
    }

    return NextResponse.json(debug);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate debug info';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


