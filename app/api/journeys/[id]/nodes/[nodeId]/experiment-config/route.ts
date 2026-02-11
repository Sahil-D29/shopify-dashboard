import { NextRequest, NextResponse } from 'next/server';

import type { JourneyDefinition, JourneyNode } from '@/lib/types/journey';
import type { ExperimentConfig, Variant } from '@/lib/types/experiment-config';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';

type Params = { id: string; nodeId: string };

function ensureNodeData(node: JourneyNode) {
  if (!node.data) node.data = {};
  return node;
}

function isExperimentConfig(payload: unknown): payload is ExperimentConfig {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as ExperimentConfig;
  return (
    typeof candidate.experimentName === 'string' &&
    Array.isArray(candidate.variants) &&
    candidate.variants.length > 0
  );
}

const mapVariantMeta = (variant: Variant) => ({
  id: variant.id,
  label: variant.name,
  weight: variant.trafficAllocation,
  color: variant.color,
  control: variant.isControl,
});

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id, nodeId } = await params;
    const payload = (await request.json()) as unknown;
    if (!isExperimentConfig(payload)) {
      return NextResponse.json({ error: 'Invalid experiment configuration payload.' }, { status: 400 });
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
      experimentConfig: payload,
      meta: {
        ...(nodeData.meta ?? {}),
        experimentConfig: payload,
        experimentType: payload.experimentType,
        experimentName: payload.experimentName,
        variants: payload.variants.map(mapVariantMeta),
        primaryGoalId: payload.primaryGoalId,
        goals: payload.goals,
        sampleSize: payload.sampleSize,
        winningCriteria: payload.winningCriteria,
        experimentSummary: payload.hypothesis ?? payload.description ?? '',
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

    return NextResponse.json({ success: true, nodeId });
  } catch (error) {
    console.error('[journeys][experiment-config][POST]', error);
    return NextResponse.json({ error: getErrorMessage(error) || 'Failed to persist experiment configuration.' }, { status: 500 });
  }
}



