'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTenant } from '@/lib/tenant/tenant-context';
import { issueHref, type IssueRecord } from '@/lib/whatsapp/issue-records';

export default function SendIssuesPanel({ kind, resourceId, failuresOnly = false }: { kind?: 'campaign' | 'journey'; resourceId?: string; failuresOnly?: boolean }) {
  const { currentStore } = useTenant();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ records: IssueRecord[]; blockers: IssueRecord[]; total: number; configurationChecksLimited?: boolean }>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(undefined);
    const params = new URLSearchParams({ page: String(page) });
    if (kind) params.set('kind', kind);
    if (resourceId) params.set('id', resourceId);
    fetch(`/api/sending-issues?${params}`, { signal: controller.signal, headers: currentStore?.id ? { 'x-store-id': currentStore.id } : {} })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; })
      .then(setData).catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, resourceId, currentStore?.id, page, revision]);
  const records = [...(failuresOnly ? [] : data?.blockers ?? []), ...(data?.records ?? [])];
  return <section className="rounded-xl border border-amber-200 bg-white p-5 space-y-4" aria-label="Sending issues">
    <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">{failuresOnly ? 'Failed messages' : 'Sending issues'}</h2>
      <button type="button" className="text-sm underline" disabled={loading} onClick={() => setRevision(n => n + 1)}>Recheck issues</button></div>
    {loading && <p role="status" className="text-sm">Checking message configuration and delivery errors…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!loading && !error && !records.length && <p className="text-sm text-gray-600">No sending issues found.</p>}
    {records.map(record => <article key={record.id} className="rounded-lg border p-4 space-y-2 text-sm">
      <div className="font-medium">{record.resourceName} · {record.historical ? 'Past failure' : 'Configuration needs attention'}</div>
      <div className="text-gray-500">{new Date(record.at).toLocaleString()}{record.recipient ? ` · Recipient: ${record.recipient}` : ''}{record.templateName ? ` · ${record.templateName}` : ''}{record.nodeId ? ` · Node: ${record.nodeId}` : ''}</div>
      {record.issues.map((item, i) => <div key={i} className="space-y-1"><p className="text-red-700">{item.message} <span className="text-gray-500">({item.code})</span></p>
        <p>{item.action}</p>{item.field && <p className="text-gray-600">Field: {item.field}</p>}
        {item.customerFixable && <Link className="inline-block underline font-medium" href={issueHref(record, item)}>Open settings to fix</Link>}
        {item.customerFixable && item.details && <details className="text-xs text-gray-600"><summary>Provider details</summary><p className="mt-1 break-words">{item.details}</p></details>}
        {item.referenceId && <p className="text-xs text-gray-500">Reference: {item.referenceId}</p>}
      </div>)}
    </article>)}
    {!!data?.total && <div className="flex gap-4 items-center text-sm"><button disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} · {data.total} recorded failures</span><button disabled={page * 20 >= data.total || loading} onClick={() => setPage(p => p + 1)}>Next</button></div>}
    {data?.configurationChecksLimited && <p className="text-xs text-gray-500">Configuration checks cover the 20 most recently updated campaigns and journeys. Open an individual campaign or journey to check its settings.</p>}
    {!failuresOnly && !!data?.total && <p className="text-xs text-gray-500">Fixing settings does not resend past messages. Duplicate a completed campaign for a new send.</p>}
  </section>;
}
