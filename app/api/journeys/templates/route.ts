export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

import { loadJourneyTemplates } from '@/lib/journeys/templates';
import type { JourneyTemplate } from '@/lib/types/journey-template';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const templates = loadJourneyTemplates();
    console.log('[API] Loaded templates:', templates.map(template => template.id));
    return NextResponse.json(templates satisfies JourneyTemplate[]);
  } catch (error) {
    console.error('[API] Failed to load templates:', error);
    return NextResponse.json([], { status: 500 });
  }
}


