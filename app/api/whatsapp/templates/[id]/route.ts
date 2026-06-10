export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

import type { WhatsAppTemplate, WhatsAppTemplateStatus } from '@/lib/types/whatsapp-config';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getDraftById, updateDraft, deleteDraft, getDrafts } from '@/lib/whatsapp/template-drafts';
import { META_GRAPH_API_VERSION, resolveWhatsAppConfig } from '@/lib/config/whatsapp-config-resolver';
import { graphUrl } from '@/lib/whatsapp/graph';

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
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id } = await params;
    const storeId = await getCurrentStoreId(request);
    const template = await getDraftById(storeId, id);
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

    const storeId = await getCurrentStoreId(request);
    if (!storeId) return NextResponse.json({ error: 'No store selected' }, { status: 400 });

    const current = await getDraftById(storeId, id);
    if (!current) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const next = await updateDraft(storeId, id, {
      ...updates,
      status: normaliseStatus(updates.status, current.status),
      updatedAt: new Date().toISOString(),
    } as Partial<WhatsAppTemplate>);

    return NextResponse.json({ template: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { id } = await params;
    const storeId = await getCurrentStoreId(request);
    if (!storeId) return NextResponse.json({ error: 'No store selected' }, { status: 400 });

    // Local draft → delete from DB.
    const draft = await getDraftById(storeId, id);
    if (draft) {
      await deleteDraft(storeId, id);
      return NextResponse.json({ success: true });
    }

    // Otherwise it's a Meta template — delete it on Meta by name (best effort).
    const all = await getDrafts(storeId); // (drafts only; the meta one isn't here)
    const byName = all.find(t => t.id === id)?.name;
    const resolved = await resolveWhatsAppConfig(storeId);
    if (resolved.valid) {
      // The list route ids Meta templates as `meta_<id>`; the name is what Meta deletes by.
      const name = byName || id.replace(/^meta_/, '');
      const url = graphUrl(
        `${META_GRAPH_API_VERSION}/${resolved.config.wabaId}/message_templates`,
        resolved.config.accessToken,
        { name },
      );
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${resolved.config.accessToken}` },
      });
      if (res.ok) return NextResponse.json({ success: true });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data?.error?.message || 'Failed to delete template on Meta' },
        { status: res.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
