export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import type { WhatsAppActionConfig } from '@/lib/types/whatsapp-config';
import { writeJsonFile } from '@/lib/utils/json-storage';

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

const DRAFTS_FILE = 'whatsapp-config-drafts.json';

function getDataDir(): string {
  const projectRoot = process.cwd();
  const dataDir = path.join(projectRoot, 'data');
  if (process.env.VERCEL !== '1') {
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }
  return dataDir;
}

function getDrafts(): Record<string, { config: WhatsAppActionConfig; metadata: DraftMetadata }> {
  try {
    if (process.env.VERCEL === '1') {
      return {};
    }
    const dataDir = getDataDir();
    const filePath = path.join(dataDir, DRAFTS_FILE);
    
    if (!fs.existsSync(filePath)) {
      return {};
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.trim()) {
      return {};
    }
    
    const data = JSON.parse(content);
    if (typeof data !== 'object' || Array.isArray(data)) {
      console.error(`Invalid JSON format in ${DRAFTS_FILE}, expected object`);
      return {};
    }
    
    return data as Record<string, { config: WhatsAppActionConfig; metadata: DraftMetadata }>;
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
  
  if (process.env.VERCEL === '1') {
    return;
  }
  
  try {
    const dataDir = getDataDir();
    const filePath = path.join(dataDir, DRAFTS_FILE);
    const tempPath = path.join(dataDir, `${DRAFTS_FILE}.tmp`);
    
    const jsonContent = JSON.stringify(drafts, null, 2);
    fs.writeFileSync(tempPath, jsonContent, 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    console.error(`Error writing ${DRAFTS_FILE}:`, error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { id, nodeId } = await params;
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

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { id, nodeId } = await params;
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

