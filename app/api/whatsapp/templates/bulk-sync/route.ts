export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTemplates, setTemplates } from '@/lib/whatsapp/templates-store';
import type { WhatsAppTemplate } from '@/lib/types/whatsapp-config';

interface BulkSyncRequestBody {
  templates?: WhatsAppTemplate[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BulkSyncRequestBody;
    const templates = body.templates;

    if (!Array.isArray(templates)) {
      return NextResponse.json({ error: 'Templates must be an array' }, { status: 400 });
    }

    const existingTemplates = getTemplates();
    const localOnlyTemplates = existingTemplates.filter(template => !template.metaTemplateId);
    const mergedTemplates: WhatsAppTemplate[] = [...localOnlyTemplates, ...templates];

    setTemplates(mergedTemplates);

    return NextResponse.json({
      success: true,
      count: templates.length,
      total: mergedTemplates.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to store templates';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const templates = getTemplates();
    return NextResponse.json({
      templates,
      count: templates.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch templates';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

