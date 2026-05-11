import { NextRequest, NextResponse } from 'next/server';

import {
  createJourneyDefinitionFromTemplate,
  loadJourneyTemplates,
  saveJourneyDefinition,
} from '@/lib/journeys/templates';

export const runtime = 'nodejs';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templates = loadJourneyTemplates();
    console.log('[API] Available templates:', templates.map(template => template.id));
    const template = templates.find(item => item.id === params.id);
    if (!template) {
      console.error('[API] Template not found:', params.id);
      return NextResponse.json({ error: `Template '${params.id}' not found` }, { status: 404 });
    }

    console.log('[API] Using template:', template.id, template.name);
    const journey = createJourneyDefinitionFromTemplate(template, { name: template.name });
    saveJourneyDefinition(journey);

    return NextResponse.json({ journeyId: journey.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create journey from template';
    console.error('[API] Failed to create journey from template:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

