export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { listSendingIssues, IssueQueryError } from '@/lib/whatsapp/sending-issues';
export async function GET(request: NextRequest) {
  const storeId = await getCurrentStoreId(request);
  if (!storeId) return NextResponse.json({ error: 'Authorized store required' }, { status: 401 });
  try { return NextResponse.json(await listSendingIssues(storeId, request.nextUrl.searchParams)); }
  catch (error) { return NextResponse.json({ error: error instanceof IssueQueryError ? error.message : 'Unable to load sending issues. Please try again.' }, { status: error instanceof IssueQueryError ? error.status : 500 }); }
}
