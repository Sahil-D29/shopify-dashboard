import { NextRequest, NextResponse } from 'next/server';

import type { JourneyDefinition, JourneyNode } from '@/lib/types/journey';
import type {
  DelayConfig,
  DelayType,
  Duration,
  TimeOfDay,
  WaitForAttributeConfig,
  WaitForEventConfig,
} from '@/lib/types/delay-config';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';

type Params = { id: string; nodeId: string };

function ensureNodeData(node: JourneyNode) {
  if (!node.data) node.data = {};
  return node;
}

function isDelayConfig(payload: unknown): payload is DelayConfig {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as DelayConfig;
  if (typeof candidate.delayType !== 'string') return false;
  if (!candidate.specificConfig || typeof candidate.specificConfig !== 'object') return false;
  return true;
}

function formatDuration(duration: Duration): string {
  const baseUnit = duration.unit;
  const unit = duration.value === 1 ? baseUnit.replace(/s$/, '') : baseUnit;
  return `${duration.value} ${unit}`;
}

function formatTimeOfDay(time: TimeOfDay, timezone?: string): string {
  const hour12 = time.hour % 12 || 12;
  const minute = String(time.minute).padStart(2, '0');
  const suffix = time.hour >= 12 ? 'PM' : 'AM';
  const tz = timezone && timezone !== 'customer' ? timezone : 'customer local time';
  return `${hour12}:${minute} ${suffix} (${tz})`;
}

function summariseDelayConfig(config: DelayConfig): string {
  switch (config.delayType as DelayType) {
    case 'fixed_time': {
      const { duration } = config.specificConfig as { duration: Duration };
      return `Wait ${formatDuration(duration)}`;
    }
    case 'wait_until_time': {
      const { time, timezone } = config.specificConfig as { time: TimeOfDay; timezone: string };
      return `Wait until ${formatTimeOfDay(time, timezone)}`;
    }
    case 'wait_for_event': {
      const { eventName, maxWaitTime } = config.specificConfig as {
        eventName?: string;
        maxWaitTime: Duration;
      };
      return `Wait for ${eventName || 'event'} (max ${formatDuration(maxWaitTime)})`;
    }
    case 'optimal_send_time': {
      const { window } = config.specificConfig as { window: { duration: Duration } };
      return `AI window ${formatDuration(window.duration)}`;
    }
    case 'wait_for_attribute': {
      const { attributePath, targetValue } = config.specificConfig as {
        attributePath: string;
        targetValue: unknown;
      };
      return `Wait for ${attributePath || 'attribute'} = ${String(targetValue ?? '?')}`;
    }
    default:
      return 'Delay';
  }
}

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
  const config = node.data?.delayConfig as DelayConfig | undefined;
  if (!config) {
    return NextResponse.json({ error: 'Delay configuration not found.' }, { status: 404 });
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
    if (!isDelayConfig(payload)) {
      return NextResponse.json({ error: 'Invalid delay configuration payload.' }, { status: 400 });
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
      delayConfig: payload,
      isConfigured: true,
      meta: {
        ...(node.data?.meta ?? {}),
        delayConfig: payload,
        delayType: payload.delayType,
        delaySummary: summariseDelayConfig(payload),
        quietHoursEnabled: Boolean(payload.quietHours?.enabled),
        skipWeekends: Boolean(payload.holidaySettings?.skipWeekends),
        throttled: Boolean(payload.throttling?.enabled),
        hasTimeoutBranch:
          (payload.delayType === 'wait_for_event' &&
            (payload.specificConfig as WaitForEventConfig).onTimeout === 'branch_to_timeout_path') ||
          (payload.delayType === 'wait_for_attribute' &&
            (payload.specificConfig as WaitForAttributeConfig).onTimeout === 'branch_to_timeout_path'),
        timeoutBranchLabel:
          payload.delayType === 'wait_for_event'
            ? (payload.specificConfig as WaitForEventConfig).timeoutBranchLabel
            : payload.delayType === 'wait_for_attribute'
              ? (payload.specificConfig as WaitForAttributeConfig).timeoutBranchLabel
              : undefined,
        isConfigured: true,
      } as Record<string, unknown>,
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
    const message = error instanceof Error ? error.message : 'Failed to persist delay configuration.';
    console.error('[journeys][delay-config][POST]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



