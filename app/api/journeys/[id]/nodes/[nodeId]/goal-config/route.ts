import { NextRequest, NextResponse } from 'next/server';

import type { JourneyDefinition, JourneyNode } from '@/lib/types/journey';
import type { GoalConfig } from '@/lib/types/goal-config';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';

type Params = { id: string; nodeId: string };

function ensureNodeData(node: JourneyNode) {
  if (!node.data) node.data = {};
  return node;
}

function isGoalConfig(payload: unknown): payload is GoalConfig {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as GoalConfig;
  if (typeof candidate.goalType !== 'string') return false;
  if (typeof candidate.goalName !== 'string') return false;
  if (!candidate.attributionWindow || typeof candidate.attributionWindow.value !== 'number') return false;
  return true;
}

function buildGoalSummary(config: GoalConfig): string {
  const typeLabel = config.goalType.replace(/_/g, ' ');
  if (config.goalType === 'journey_completion') {
    return 'Marks journey completion';
  }
  if (config.goalType === 'segment_entry') {
    return `Segment entry: ${config.segmentId || 'segment'}`;
  }
  if (
    config.goalType === 'custom_event' ||
    config.goalType === 'shopify_event' ||
    config.goalType === 'whatsapp_engagement'
  ) {
    const eventName = config.eventName || 'event';
    return `${typeLabel} • ${eventName}`;
  }
  return typeLabel;
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
  const config = node.data?.goalConfig as GoalConfig | undefined;
  if (!config) {
    return NextResponse.json({ error: 'Goal configuration not found.' }, { status: 404 });
  }
  return NextResponse.json({ config });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id, nodeId } = await params;
    const body = (await request.json()) as unknown;
    const payload = (body as { config?: unknown })?.config ?? body;
    if (!isGoalConfig(payload)) {
      return NextResponse.json({ error: 'Invalid goal configuration payload.' }, { status: 400 });
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
    const nodeData = node.data ?? {};
    node.data = {
      ...nodeData,
      goalConfig: payload,
      isConfigured: true,
      meta: {
        ...(nodeData.meta ?? {}),
        goalConfig: payload,
        goalType: payload.goalType,
        goalSummary: buildGoalSummary(payload),
        goalCategory: payload.goalCategory,
        attributionWindow: payload.attributionWindow,
        exitAfterGoal: payload.exitAfterGoal,
        markAsCompleted: payload.markAsCompleted,
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
    console.error('[journeys][goal-config][POST]', error);
    return NextResponse.json({ error: getErrorMessage(error) || 'Failed to persist goal configuration.' }, { status: 500 });
  }
}



