export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import {
  createJourneyDefinitionFromTemplate,
  loadJourneyTemplates,
  saveJourneyDefinition,
} from '@/lib/journeys/templates';

export const runtime = 'nodejs';

const resolveParams = async (params: { id: string } | Promise<{ id: string }>): Promise<{ id: string }> =>
  (params instanceof Promise ? params : Promise.resolve(params));

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templates = loadJourneyTemplates();
    console.log('[API] Available templates:', templates.map(template => template.id));
    const template = templates.find(item => item.id === id);
    if (!template) {
      console.error('[API] Template not found:', id);
      return NextResponse.json({ error: `Template '${id}' not found` }, { status: 404 });
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

