/**
 * Per-store local template drafts, persisted in the database.
 *
 * Approved/pending/rejected templates live in Meta and are fetched live. Local
 * DRAFTS (created here but not yet submitted) need durable storage — the old
 * in-memory global store reset on every Render deploy and wasn't store-scoped.
 *
 * We persist drafts in `WhatsAppConfig.templates` (Json) keyed per store.
 */
import { prisma } from '@/lib/prisma';
import type { WhatsAppTemplate } from '@/lib/types/whatsapp-config';

export async function getDrafts(storeId?: string | null): Promise<WhatsAppTemplate[]> {
  if (!storeId) return [];
  try {
    const config = await prisma.whatsAppConfig.findUnique({
      where: { storeId },
      select: { templates: true },
    });
    const list = config?.templates;
    return Array.isArray(list) ? (list as unknown as WhatsAppTemplate[]) : [];
  } catch {
    return [];
  }
}

async function setDrafts(storeId: string, drafts: WhatsAppTemplate[]): Promise<void> {
  // JSON round-trip strips `undefined` values, which Prisma's Json input rejects
  // and which otherwise cause the write to silently not persist.
  const clean = JSON.parse(JSON.stringify(drafts));
  // Upsert so drafts can be saved even before a full WhatsApp connection exists.
  await prisma.whatsAppConfig.upsert({
    where: { storeId },
    create: { storeId, templates: clean, isConfigured: false },
    update: { templates: clean },
  });
}

export async function addDraft(storeId: string, draft: WhatsAppTemplate): Promise<WhatsAppTemplate> {
  const drafts = await getDrafts(storeId);
  drafts.unshift(draft);
  await setDrafts(storeId, drafts);
  return draft;
}

export async function getDraftById(storeId: string | null | undefined, id: string): Promise<WhatsAppTemplate | null> {
  const drafts = await getDrafts(storeId);
  return drafts.find(t => t.id === id) ?? null;
}

export async function updateDraft(
  storeId: string,
  id: string,
  patch: Partial<WhatsAppTemplate>,
): Promise<WhatsAppTemplate | null> {
  const drafts = await getDrafts(storeId);
  const idx = drafts.findIndex(t => t.id === id);
  if (idx === -1) return null;
  drafts[idx] = { ...drafts[idx], ...patch };
  await setDrafts(storeId, drafts);
  return drafts[idx];
}

export async function deleteDraft(storeId: string, id: string): Promise<boolean> {
  const drafts = await getDrafts(storeId);
  const next = drafts.filter(t => t.id !== id);
  if (next.length === drafts.length) return false;
  await setDrafts(storeId, next);
  return true;
}
