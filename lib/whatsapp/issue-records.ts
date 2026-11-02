import { providerIssue, type SendIssue } from './issues';

export interface IssueRecord {
  id: string;
  kind: 'campaign' | 'journey';
  resourceId: string;
  resourceName: string;
  recipient?: string;
  templateName?: string;
  nodeId?: string;
  at: string;
  historical: boolean;
  issues: SendIssue[];
}

export function legacyIssues(error?: string | null, metadata?: any): SendIssue[] {
  if (Array.isArray(metadata?.issues) && metadata.issues.length) return metadata.issues;
  const code = metadata?.errorCode ?? error?.match(/(?:#|\b)(\d{3,6})\b/)?.[1];
  // Do not turn an old, ambiguous description into a claimed specific diagnosis.
  return [providerIssue({ code, message: error, fbtrace_id: metadata?.referenceId })];
}

export function issueHref(record: Pick<IssueRecord, 'kind' | 'resourceId' | 'nodeId'>, item: SendIssue) {
  if (item.href) return item.href;
  if (item.field === 'phone') return '/customers';
  if (item.field === 'segmentIds') return '/segments';
  return record.kind === 'campaign' ? `/campaigns/${record.resourceId}/edit?step=3`
    : `/journeys/${record.resourceId}/builder${record.nodeId ? `?nodeId=${encodeURIComponent(record.nodeId)}&field=${encodeURIComponent(item.field ?? '')}` : ''}`;
}
