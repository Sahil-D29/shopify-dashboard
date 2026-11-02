export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { getJourneyById, updateJourney } from '@/lib/journey-engine/storage';
type Context = { params: Promise<{ id: string; nodeId: string }> };
async function locate(request: NextRequest, context: Context) {
  const storeId = await getCurrentStoreId(request);
  if (!storeId) return { error: NextResponse.json({ error: 'Authorized store required' }, { status: 401 }) };
  const { id, nodeId } = await context.params;
  const journey = await getJourneyById(id);
  if (!journey || journey.storeId !== storeId) return { error: NextResponse.json({ error: 'Journey not found' }, { status: 404 }) };
  const node = journey.nodes.find(node => node.id === nodeId);
  if (!node) return { error: NextResponse.json({ error: 'Node not found' }, { status: 404 }) };
  return { journey, node };
}
export async function GET(request: NextRequest, context: Context) {
  const found = await locate(request, context);
  if (found.error) return found.error;
  const draft = (found.node!.data?.meta as any)?.whatsappActionDraft;
  return draft ? NextResponse.json(draft) : NextResponse.json({ error: 'Draft not found' }, { status: 404 });
}
export async function POST(request: NextRequest, context: Context) {
  const found = await locate(request, context);
  if (found.error) return found.error;
  const body = await request.json();
  if (!body.config || typeof body.config !== 'object' || Array.isArray(body.config)) return NextResponse.json({ error: 'Draft configuration required' }, { status: 400 });
  const draft = { config: body.config, metadata: { savedAt: new Date().toISOString() } };
  const node = found.node!;
  node.data = { ...node.data, meta: { ...node.data?.meta, whatsappActionDraft: draft } };
  await updateJourney({ ...found.journey!, updatedAt: new Date().toISOString() });
  return NextResponse.json({ success: true, ...draft });
}
export async function DELETE(request: NextRequest, context: Context) {
  const found = await locate(request, context);
  if (found.error) return found.error;
  const meta = { ...found.node!.data?.meta };
  delete meta.whatsappActionDraft;
  found.node!.data = { ...found.node!.data, meta };
  await updateJourney({ ...found.journey!, updatedAt: new Date().toISOString() });
  return NextResponse.json({ success: true });
}
