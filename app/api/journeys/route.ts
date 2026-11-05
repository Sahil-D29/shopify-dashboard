export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

import type { JourneyDefinition, JourneyConfig, JourneyStats } from '@/lib/types/journey';
import { getJourneys, updateJourney } from '@/lib/journey-engine/storage';
import { ensureStoreId, getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getUserContext, buildStoreFilter } from '@/lib/user-context';

export const runtime = 'nodejs';

interface JourneyCreatePayload {
  id?: string;
  name?: string;
  description?: string;
  templateId?: string;
  createdFromTemplate?: string | null;
  settings?: JourneyDefinition['settings'];
  config?: JourneyConfig;
  stats?: JourneyStats;
  nodes?: JourneyDefinition['nodes'];
  edges?: JourneyDefinition['edges'];
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unexpected server error';

const defaultJourneySettings = (): JourneyDefinition['settings'] => ({
  entry: { frequency: 'once' },
  exit: { onGoal: true },
  timezone: 'UTC',
  allowReentry: false,
  reentryCooldownDays: 0,
  testMode: false,
  testPhoneNumbers: [],
});

const defaultJourneyStats = (): JourneyStats => ({
  totalEnrollments: 0,
  activeEnrollments: 0,
  completedEnrollments: 0,
  goalConversionRate: 0,
});

export async function GET(request: NextRequest) {
  try {
    // Get user context for role-based access
    const userContext = await getUserContext(request);
    
    if (!userContext) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized',
          journeys: [] 
        },
        { status: 401 }
      );
    }

    // Get store ID from request
    const requestedStoreId = await getCurrentStoreId(request);
    
    if (!requestedStoreId) return NextResponse.json({ error: 'Authorized store required' }, { status: 401 });
    const journeys = (await getJourneys()).filter(j => j.storeId === requestedStoreId);

    return NextResponse.json({ 
      success: true,
      journeys 
    });
  } catch (error) {
    console.error('[Journeys][GET] Error:', error);
    // Return 200 with empty array to prevent frontend crashes
    return NextResponse.json({ 
      success: false,
      error: getErrorMessage(error),
      journeys: []
    }, { status: 200 });
  }
}

function normalisePayload(payload: JourneyCreatePayload): JourneyDefinition {
  const nowIso = new Date().toISOString();
  const id = payload.id ?? uuid();

  const settings = {
    ...defaultJourneySettings(),
    ...payload.settings,
    entry: {
      frequency: payload.settings?.entry?.frequency ?? 'once',
      segmentId: payload.settings?.entry?.segmentId,
      maxEntries: payload.settings?.entry?.maxEntries,
    },
    exit: {
      onGoal: payload.settings?.exit?.onGoal ?? true,
      autoExitAfterDays: payload.settings?.exit?.autoExitAfterDays,
    },
    timezone: payload.settings?.timezone ?? payload.config?.timezone ?? 'UTC',
  };

  const config: JourneyConfig = {
    reEntryRules: payload.config?.reEntryRules ?? { allow: false, cooldownDays: 0 },
    maxEnrollments: payload.config?.maxEnrollments ?? null,
    timezone: payload.config?.timezone ?? settings.timezone,
    ...payload.config,
  };

  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const edges = Array.isArray(payload.edges) ? payload.edges : [];

  return {
    id,
    name: payload.name ?? 'Untitled Journey',
    description: payload.description ?? '',
    status: 'DRAFT',
    createdAt: nowIso,
    updatedAt: nowIso,
    settings,
    config,
    stats: payload.stats ?? defaultJourneyStats(),
    createdFromTemplate: payload.templateId ?? payload.createdFromTemplate ?? null,
    nodes,
    edges,
    // storeId will be added in POST handler
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get user context
    const userContext = await getUserContext(request);
    
    if (!userContext) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get store ID based on role
    const requestedStoreId = await getCurrentStoreId(request);
    if (!requestedStoreId) return NextResponse.json({ error: 'Authorized store required' }, { status: 401 });
    const storeId = requestedStoreId;

    let body: JourneyCreatePayload;
    try {
      body = (await request.json()) as JourneyCreatePayload;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    const newJourney = normalisePayload({ ...body, id: uuid() });
    // Ensure storeId is added
    const journeyWithStore = ensureStoreId(newJourney, storeId);
    await updateJourney(journeyWithStore);

    return NextResponse.json({
      success: true,
      journey: journeyWithStore
    }, { status: 201 });
  } catch (error) {
    console.error('[Journeys][POST] Error:', error);
    return NextResponse.json({ 
      success: false,
      error: getErrorMessage(error) 
    }, { status: 500 });
  }
}

