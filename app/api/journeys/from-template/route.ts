export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import {
  createJourneyDefinitionFromTemplate,
  loadJourneyTemplates,
  saveJourneyDefinition,
} from '@/lib/journeys/templates';

interface FromTemplateRequestBody {
  templateId?: string;
  name?: string;
}

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FromTemplateRequestBody | undefined;
    const templateId = body?.templateId;
    const customName = body?.name;

    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
    }

    const templates = loadJourneyTemplates();
    const template = templates.find(item => item.id === templateId);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const journey = createJourneyDefinitionFromTemplate(template, {
      name: customName,
    });
    saveJourneyDefinition(journey);

    return NextResponse.json(
      {
        success: true,
        journeyId: journey.id,
        message: 'Journey created from template',
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create journey';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


