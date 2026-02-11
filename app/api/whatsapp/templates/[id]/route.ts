export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import type { WhatsAppTemplate, WhatsAppTemplateStatus } from '@/lib/types/whatsapp-config';

import { getTemplates, setTemplates } from '@/lib/whatsapp/templates-store';

type Params = { id: string };

interface PatchPayload {
  name?: string;
  description?: string;
  status?: string;
  category?: string;
  language?: string;
  content?: string;
  body?: string;
  footer?: string;
  variables?: string[];
  hasMediaHeader?: boolean;
  mediaType?: WhatsAppTemplate['mediaType'];
  mediaUrl?: string;
  hasButtons?: boolean;
  buttons?: WhatsAppTemplate['buttons'];
  sampleValues?: WhatsAppTemplate['sampleValues'];
  metaTemplateId?: string;
}

function normaliseStatus(status: string | undefined, fallback: WhatsAppTemplateStatus): WhatsAppTemplateStatus {
  if (!status) return fallback;
  const upper = status.toUpperCase();
  if (upper === 'APPROVED' || upper === 'PENDING' || upper === 'REJECTED') {
    return upper;
  }
  return fallback;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id } = await params;
    const template = getTemplates().find(item => item.id === id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id } = await params;
    const updates = (await request.json()) as PatchPayload;

    const templates = getTemplates();
    const index = templates.findIndex(item => item.id === id);
    if (index === -1) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const current = templates[index];
    const nextTemplate: WhatsAppTemplate = {
      ...current,
      ...updates,
      status: normaliseStatus(updates.status, current.status),
      updatedAt: new Date().toISOString(),
    };

    templates[index] = nextTemplate;
    setTemplates(templates);

    return NextResponse.json({ template: nextTemplate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id } = await params;
    const templates = getTemplates();
    const filteredTemplates = templates.filter(template => template.id !== id);
    setTemplates(filteredTemplates);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

