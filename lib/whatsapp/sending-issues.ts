import { validateJourney } from '@/lib/journey-engine/validation';
import { prisma } from '@/lib/prisma';
import { errorIssues } from '@/lib/whatsapp/issues';
import { legacyIssues, type IssueRecord } from '@/lib/whatsapp/issue-records';
import { createTemplateChecker } from '@/lib/whatsapp/template-send';
import { campaignTemplateInput } from '@/lib/whatsapp/campaign-config';

export class IssueQueryError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function listSendingIssues(storeId: string, query: URLSearchParams) {
  if (!storeId) throw new IssueQueryError('Authorized store required', 401);
  const kind = query.get('kind');
  const id = query.get('id');
  if ((id && !['campaign', 'journey'].includes(kind ?? '')) || (kind && !['campaign', 'journey'].includes(kind))) throw new IssueQueryError('Invalid issue filter', 400);
  const page = Math.max(1, Math.min(1000, Math.floor(Number(query.get('page')) || 1)));
  const pageSize = 20;
  const take = page * pageSize;
  try {
    const campaigns = kind === 'journey' ? [] : await prisma.campaign.findMany({ where: { storeId, ...(id ? { id } : {}) }, orderBy: { updatedAt: 'desc' } });
    const journeys = kind === 'campaign' ? [] : await prisma.journeyDoc.findMany({ where: { storeId, ...(id ? { id } : {}) }, orderBy: { updatedAt: 'desc' } });
    if (id && !campaigns.length && !journeys.length) throw new IssueQueryError('Resource not found', 404);
    const campaignIds = campaigns.map(c => c.id);
    const enrollments = journeys.length ? await prisma.journeyEnrollmentDoc.findMany({ where: { journeyId: { in: journeys.map(j => j.id) } }, select: { id: true, journeyId: true, customerId: true } }) : [];
    const campaignWhere = { campaignId: { in: campaignIds }, status: 'FAILED' as const };
    const journeyWhere = { enrollmentId: { in: enrollments.map(e => e.id) }, OR: [
      { data: { path: ['eventType'], equals: 'node_error' } }, { data: { path: ['eventType'], equals: 'delivery_failed' } },
    ] };
    const messageWhere = { storeId, direction: 'OUTBOUND' as const, status: 'FAILED' as const };
    const [campaignFailures, journeyFailures, campaignTotal, journeyTotal, messageFailures, messageTotal] = await Promise.all([
      prisma.campaignLog.findMany({ where: campaignWhere, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take }),
      prisma.journeyActivityDoc.findMany({ where: journeyWhere, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take }),
      prisma.campaignLog.count({ where: campaignWhere }), prisma.journeyActivityDoc.count({ where: journeyWhere }),
      kind ? Promise.resolve([]) : prisma.message.findMany({ where: messageWhere, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take,
        select: { id: true, contactId: true, templateName: true, errorMessage: true, templateData: true, createdAt: true } }),
      kind ? Promise.resolve(0) : prisma.message.count({ where: messageWhere }),
    ]);
    const records: IssueRecord[] = campaignFailures.map(log => ({ id: log.id, kind: 'campaign', resourceId: log.campaignId,
      resourceName: campaigns.find(c => c.id === log.campaignId)!.name, recipient: (log.metadata as any)?.phone ?? log.customerId,
      templateName: (log.metadata as any)?.templateName, at: log.createdAt.toISOString(), historical: true, issues: legacyIssues(log.error, { ...(log.metadata as any ?? {}), referenceId: log.id }) }));
    for (const log of journeyFailures) {
      const enrollment = enrollments.find(e => e.id === log.enrollmentId)!;
      const data = log.data as any;
      const journey = journeys.find(j => j.id === enrollment.journeyId)!;
      records.push({ id: log.id, kind: 'journey', resourceId: journey.id, resourceName: (journey.data as any)?.name ?? 'Journey',
        recipient: enrollment.customerId, nodeId: data.data?.nodeId, templateName: data.data?.templateName,
        at: log.createdAt.toISOString(), historical: true, issues: legacyIssues(data.data?.error, { ...data.data, referenceId: log.id }) });
    }
    for (const message of messageFailures) {
      const metadata = message.templateData as any;
      const issues = legacyIssues(message.errorMessage, { ...metadata, referenceId: message.id });
      records.push({ id: message.id, kind: 'message', resourceId: message.id, resourceName: 'WhatsApp message',
        recipient: message.contactId, templateName: message.templateName ?? undefined, at: message.createdAt.toISOString(), historical: true, issues });
    }
    records.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
    const blockers: IssueRecord[] = [];
    const checkTemplate = createTemplateChecker(storeId);
    // Definitions are persisted; rechecking them makes corrected blockers disappear without deleting failure history.
    const candidates = [...campaigns.filter(c => !['COMPLETED', 'CANCELLED'].includes(c.status)).map(c => ({ kind: 'campaign' as const, resource: c })),
      ...journeys.filter(j => j.status !== 'ARCHIVED').map(j => ({ kind: 'journey' as const, resource: j }))];
    for (const candidate of candidates.slice(0, id ? 1 : 20)) {
      const { resource } = candidate;
      if (candidate.kind === 'journey') {
        const validation = await validateJourney((resource as any).data, storeId, checkTemplate);
        for (const item of validation.errors) blockers.push({ id: 'config:' + resource.id + ':' + item.id, kind: 'journey', resourceId: resource.id,
          resourceName: (resource as any).data.name ?? 'Journey', nodeId: item.nodeId, at: resource.updatedAt.toISOString(), historical: false,
          issues: [item.issue ?? { code: item.id, message: item.title, action: item.suggestion ?? item.description ?? 'Open the journey builder and resolve this blocker.', retryable: false, customerFixable: true, nodeId: item.nodeId }] });
        continue;
      }
      const checks = [{ input: campaignTemplateInput(resource), nodeId: undefined as string | undefined }];
      for (const check of checks) {
        try { await checkTemplate(check.input); }
        catch (error) { blockers.push({ id: `config:${resource.id}:${check.nodeId ?? ''}`, kind: candidate.kind, resourceId: resource.id,
          resourceName: (resource as any).name ?? (resource as any).data?.name ?? 'Journey', at: resource.updatedAt.toISOString(),
          nodeId: check.nodeId, historical: false, issues: errorIssues(error) }); }
      }
    }
    return { records: records.slice((page - 1) * pageSize, take), blockers, page, pageSize,
      total: campaignTotal + journeyTotal + messageTotal, configurationChecksLimited: candidates.length > 20 && !id };
  } catch (error) { throw error; }
}
