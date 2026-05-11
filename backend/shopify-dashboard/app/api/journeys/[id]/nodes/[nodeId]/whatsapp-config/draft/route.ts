import { NextRequest, NextResponse } from 'next/server';

import type { WhatsAppActionConfig } from '@/lib/types/whatsapp-config';
import { readJsonFile, writeJsonFile } from '@/lib/utils/json-storage';

type Params = { id: string; nodeId: string };

interface DraftMetadata {
  savedBy?: string;
  savedAt: string;
  changes?: string[];
}

interface DraftPayload {
  config: WhatsAppActionConfig;
  metadata?: DraftMetadata;
}

function resolveParams(params: Params | Promise<Params>): Promise<Params> {
  return params instanceof Promise ? params : Promise.resolve(params);
}

const DRAFTS_FILE = 'whatsapp-config-drafts.json';

function getDrafts(): Record<string, { config: WhatsAppActionConfig; metadata: DraftMetadata }> {
  try {
    return readJsonFile<Record<string, { config: WhatsAppActionConfig; metadata: DraftMetadata }>>(DRAFTS_FILE);
  } catch {
    return {};
  }
}

function saveDraft(key: string, config: WhatsAppActionConfig, metadata?: DraftMetadata): void {
  const drafts = getDrafts();
  drafts[key] = {
    config,
    metadata: {
      savedBy: metadata?.savedBy || 'system',
      savedAt: metadata?.savedAt || new Date().toISOString(),
      changes: metadata?.changes || [],
    },
  };
  writeJsonFile(DRAFTS_FILE, drafts);
}

export async function POST(request: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id, nodeId } = await resolveParams(params);
    const journeyId = id;
    const body = (await request.json()) as DraftPayload;

    if (!body.config) {
      return NextResponse.json({ error: 'Configuration is required.' }, { status: 400 });
    }

    const draftKey = `${journeyId}_${nodeId}`;
    const metadata: DraftMetadata = {
      savedBy: request.headers.get('x-user-id') || 'anonymous',
      savedAt: new Date().toISOString(),
      changes: body.metadata?.changes || [],
    };

    saveDraft(draftKey, body.config, metadata);

    return NextResponse.json({
      success: true,
      draftKey,
      savedAt: metadata.savedAt,
    });
  } catch (error) {
    console.error('[whatsapp-config/draft][POST]', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save draft.',
      },
      { status: 500 },
    );
  }
}

export async function GET(_request: NextRequest, { params }: { params: Params | Promise<Params> }) {
  try {
    const { id, nodeId } = await resolveParams(params);
    const journeyId = id;
    const draftKey = `${journeyId}_${nodeId}`;

    const drafts = getDrafts();
    const draft = drafts[draftKey];

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });
    }

    return NextResponse.json({
      config: draft.config,
      metadata: draft.metadata,
    });
  } catch (error) {
    console.error('[whatsapp-config/draft][GET]', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to load draft.',
      },
      { status: 500 },
    );
  }
}

