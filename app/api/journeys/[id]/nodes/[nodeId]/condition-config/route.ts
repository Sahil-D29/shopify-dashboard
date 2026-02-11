export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import type { JourneyDefinition, JourneyNode } from '@/lib/types/journey';
import type { ConditionConfig } from '@/lib/types/condition-config';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';

type Params = { id: string; nodeId: string };

function ensureNodeData(node: JourneyNode) {
  if (!node.data) node.data = {};
  return node;
}

function isConditionConfig(payload: unknown): payload is ConditionConfig {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as ConditionConfig;
  return (
    typeof candidate.type === 'string' &&
    !!candidate.rootGroup &&
    Array.isArray((candidate.rootGroup as ConditionConfig['rootGroup']).conditions)
  );
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { id, nodeId } = await params;
  const journeys = readJsonFile<JourneyDefinition>('journeys.json');
  const journey = journeys.find(item => item.id === id);
  if (!journey) {
    return NextResponse.json({ error: 'Journey not found.' }, { status: 404 });
  }

  const node = (journey.nodes || []).find(item => item.id === nodeId);
  if (!node) {
    return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
  }

  const config = node.data?.conditionConfig as ConditionConfig | undefined;
  if (!config) {
    return NextResponse.json({ error: 'Condition configuration not found.' }, { status: 404 });
  }

  return NextResponse.json({ config });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id, nodeId } = await params;
    const payload = (await request.json()) as unknown;

    if (!isConditionConfig(payload)) {
      return NextResponse.json(
        { error: 'Invalid condition configuration payload.' },
        { status: 400 },
      );
    }

    const journeys = readJsonFile<JourneyDefinition>('journeys.json');
    const journeyIndex = journeys.findIndex(item => item.id === id);
    if (journeyIndex === -1) {
      return NextResponse.json({ error: 'Journey not found.' }, { status: 404 });
    }

    const journey = journeys[journeyIndex];
    const nodes = journey.nodes || [];
    const nodeIndex = nodes.findIndex(item => item.id === nodeId);

    if (nodeIndex === -1) {
      return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
    }

    const node = ensureNodeData({ ...nodes[nodeIndex] });
    node.data = {
      ...node.data,
      conditionConfig: payload,
      isConfigured: true,
      meta: {
        ...(node.data?.meta ?? {}),
        conditionType: payload.type,
        isConfigured: true,
      },
    };

    const updatedJourney: JourneyDefinition = {
      ...journey,
      nodes: [
        ...nodes.slice(0, nodeIndex),
        node,
        ...nodes.slice(nodeIndex + 1),
      ],
      updatedAt: new Date().toISOString(),
    };

    const nextJourneys = [
      ...journeys.slice(0, journeyIndex),
      updatedJourney,
      ...journeys.slice(journeyIndex + 1),
    ];

    writeJsonFile('journeys.json', nextJourneys);

    return NextResponse.json({ success: true, journeyId: id, nodeId });
  } catch (error) {
    console.error('[journeys][condition-config][POST]', error);
    return NextResponse.json({ error: getErrorMessage(error) || 'Failed to persist condition configuration.' }, { status: 500 });
  }
}



