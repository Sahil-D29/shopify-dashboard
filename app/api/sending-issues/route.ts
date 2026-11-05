import { automationStatus } from '@/lib/journey-engine/automation';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStoreId } from '@/lib/tenant/api-helpers';
import { listSendingIssues, IssueQueryError } from '@/lib/whatsapp/sending-issues';
export async function GET(request: NextRequest) {
  const storeId = await getCurrentStoreId(request);
  if (!storeId) return NextResponse.json({ error: 'Authorized store required' }, { status: 401 });
  try { const result = await listSendingIssues(storeId, request.nextUrl.searchParams); const automation = await automationStatus(storeId, request.nextUrl.searchParams.get('kind') === 'journey' ? request.nextUrl.searchParams.get('id') ?? undefined : undefined); if (!automation.enabled || automation.stale || automation.error) result.blockers.unshift({ id: 'automation-health', kind: 'journey', resourceId: '', resourceName: 'Automation scheduler', at: new Date().toISOString(), historical: false, issues: [{ code: !automation.enabled ? 'SCHEDULER_DISABLED' : automation.stale ? 'SCHEDULER_STALE' : 'AUTOMATION_TICK_FAILED', message: !automation.enabled ? 'Scheduled automation is disabled.' : 'Scheduled automation needs attention.', action: 'Contact support to restore the scheduler. Do not manually resend pending messages.', customerFixable: false, retryable: false, referenceId: 'automation-whatsapp' }] });
    return NextResponse.json({ ...result, automation }); }
  catch (error) { return NextResponse.json({ error: error instanceof IssueQueryError ? error.message : 'Unable to load sending issues. Please try again.' }, { status: error instanceof IssueQueryError ? error.status : 500 }); }
}
