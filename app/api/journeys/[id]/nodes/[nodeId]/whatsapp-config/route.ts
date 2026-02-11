export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import type { JourneyDefinition, JourneyNode } from '@/lib/types/journey';
import type { WhatsAppActionConfig } from '@/lib/types/whatsapp-config';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';
import { validateWhatsAppConfig } from '@/lib/whatsapp/validate-config';

type Params = { id: string; nodeId: string };

function isWhatsAppConfig(payload: unknown): payload is WhatsAppActionConfig {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as WhatsAppActionConfig;
  return (
    typeof candidate.templateId === 'string' &&
    typeof candidate.templateName === 'string' &&
    Array.isArray(candidate.variableMappings) &&
    !!candidate.sendWindow &&
    Array.isArray(candidate.sendWindow.daysOfWeek) &&
    typeof candidate.sendWindow.startTime === 'string' &&
    typeof candidate.sendWindow.endTime === 'string' &&
    !!candidate.rateLimiting &&
    typeof candidate.rateLimiting.maxPerDay === 'number' &&
    typeof candidate.rateLimiting.maxPerWeek === 'number' &&
    !!candidate.failureHandling &&
    typeof candidate.failureHandling.retryCount === 'number' &&
    typeof candidate.failureHandling.retryDelay === 'number'
  );
}

function ensureNodeMeta(node: JourneyNode) {
  if (!node.data) node.data = {};
  if (!node.data.meta) node.data.meta = {};
  return node;
}

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { id, nodeId } = await params;
  const journeyId = id;

  const journeys = readJsonFile<JourneyDefinition>('journeys.json');
  const journey = journeys.find(item => item.id === journeyId);
  if (!journey) {
    return NextResponse.json({ error: 'Journey not found.' }, { status: 404 });
  }

  const node = (journey.nodes || []).find(item => item.id === nodeId);
  if (!node) {
    return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
  }

  const config =
    (node.data?.meta?.whatsappActionConfig as WhatsAppActionConfig | undefined) ??
    (node.data?.whatsappConfig as WhatsAppActionConfig | undefined);

  if (!config) {
    return NextResponse.json({ error: 'WhatsApp configuration not found.' }, { status: 404 });
  }

  return NextResponse.json({ config });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id, nodeId } = await params;
    const journeyId = id;
    const body = (await request.json()) as unknown;

    if (!isWhatsAppConfig(body)) {
      return NextResponse.json(
        { error: 'Invalid WhatsApp action configuration payload.' },
        { status: 400 },
      );
    }

    // Server-side validation before save (defense-in-depth)
    const validation = validateWhatsAppConfig(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Configuration validation failed.',
          firstInvalidStep: validation.firstInvalidStep,
          errors: validation.errors,
        },
        { status: 400 },
      );
    }

    const journeys = readJsonFile<JourneyDefinition>('journeys.json');
    const journeyIndex = journeys.findIndex(item => item.id === journeyId);

    if (journeyIndex === -1) {
      return NextResponse.json({ error: 'Journey not found.' }, { status: 404 });
    }

    const journey = journeys[journeyIndex];
    const nodes = journey.nodes || [];
    const nodeIndex = nodes.findIndex(item => item.id === nodeId);

    if (nodeIndex === -1) {
      return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
    }

    const node = ensureNodeMeta({ ...nodes[nodeIndex] });
    const nodeData = node.data ?? {};
    const nodeMeta = nodeData.meta ?? {};
    const previousConfig = (nodeMeta.whatsappActionConfig as WhatsAppActionConfig | undefined) ??
      (nodeData.whatsappConfig as WhatsAppActionConfig | undefined);

    // Audit metadata
    const savedBy = request.headers.get('x-user-id') || 'anonymous';
    const savedAt = new Date().toISOString();
    const changes: string[] = [];

    if (previousConfig) {
      if (previousConfig.templateId !== body.templateId) {
        changes.push(`Template changed from "${previousConfig.templateName}" to "${body.templateName}"`);
      }
      if (JSON.stringify(previousConfig.variableMappings) !== JSON.stringify(body.variableMappings)) {
        changes.push('Variable mappings updated');
      }
      if (previousConfig.mediaUrl !== body.mediaUrl || previousConfig.useDynamicMedia !== body.useDynamicMedia) {
        changes.push('Media configuration updated');
      }
      if (JSON.stringify(previousConfig.buttonActions) !== JSON.stringify(body.buttonActions)) {
        changes.push('Button actions updated');
      }
      if (JSON.stringify(previousConfig.sendWindow) !== JSON.stringify(body.sendWindow)) {
        changes.push('Send window updated');
      }
    } else {
      changes.push('Initial configuration saved');
    }

    node.data = {
      ...nodeData,
      meta: {
        ...nodeMeta,
        actionType: 'whatsapp',
        templateId: body.templateId,
        templateName: body.templateName,
        templateStatus: body.templateStatus,
        templateLanguage: body.templateLanguage,
        templateCategory: body.templateCategory,
        whatsappActionConfig: body,
        variableMappings: body.variableMappings,
        sendWindow: body.sendWindow,
        rateLimiting: body.rateLimiting,
        failureHandling: body.failureHandling,
        skipIfOptedOut: body.skipIfOptedOut,
        mediaUrl: body.mediaUrl,
        useDynamicMedia: body.useDynamicMedia,
        buttonActions: body.buttonActions,
        isConfigured: true,
        // Audit trail
        savedBy,
        savedAt,
        changes,
      },
      whatsappConfig: body,
    };

    const nextJourney: JourneyDefinition = {
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
      nextJourney,
      ...journeys.slice(journeyIndex + 1),
    ];

    writeJsonFile('journeys.json', nextJourneys);

    // Log audit trail
    console.log(`[AUDIT] WhatsApp config saved: journey=${journeyId}, node=${nodeId}, by=${savedBy}, changes=${changes.join(', ')}`);

    return NextResponse.json({
      success: true,
      journeyId,
      nodeId,
      savedAt,
      savedBy,
      changes,
    });
  } catch (error) {
    console.error('[journeys][whatsapp-config][POST]', error);
    return NextResponse.json({ error: getErrorMessage(error) || 'Failed to persist WhatsApp configuration.' }, { status: 500 });
  }
}


