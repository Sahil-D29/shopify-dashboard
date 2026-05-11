'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Trash2,
  Star,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';

interface DnsRecord {
  record: string;
  name: string;
  type: string;
  value: string;
  ttl?: string;
  priority?: number;
  status?: string;
}

interface Domain {
  id: string;
  storeId: string;
  name: string;
  region: string;
  resendDomainId: string | null;
  status: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'FAILED';
  isDefault: boolean;
  dnsRecords: DnsRecord[] | null;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  VERIFIED: 'bg-green-100 text-green-700 border-green-200',
  PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  FAILED: 'bg-red-100 text-red-700 border-red-200',
  NOT_STARTED: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
  VERIFIED: 'Verified',
  PENDING: 'Pending DNS verification',
  FAILED: 'Verification failed',
  NOT_STARTED: 'Not started',
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : '—';

export default function DomainDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [domain, setDomain] = useState<Domain | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedRow, setCopiedRow] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      try {
        if (!refresh) setLoading(true);
        else setRefreshing(true);
        const res = await fetch(
          `/api/email/domains/${id}${refresh ? '?refresh=true' : ''}`,
          { cache: 'no-store' },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? 'Failed to load domain');
        setDomain(data.domain);
      } catch (error) {
        toast.error(getErrorMessage(error, 'Failed to load domain'));
        router.push('/email/domains');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, router, toast],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  async function handleVerify() {
    if (!domain) return;
    setVerifying(true);
    try {
      const res = await fetch(`/api/email/domains/${id}/verify`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Verification failed');
      setDomain(data.domain);
      if (data.domain.status === 'VERIFIED') {
        toast.success('Domain verified — you can now send from this domain');
      } else if (data.domain.status === 'PENDING') {
        toast.info("DNS records not detected yet. They can take up to 72 hours to propagate.");
      } else {
        toast.warning(`Status: ${data.domain.status}`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Verification failed'));
    } finally {
      setVerifying(false);
    }
  }

  async function handleSetDefault() {
    if (!domain) return;
    setSettingDefault(true);
    try {
      const res = await fetch(`/api/email/domains/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to set default');
      setDomain(data.domain);
      toast.success(`${domain.name} is now your default sending domain`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to set default'));
    } finally {
      setSettingDefault(false);
    }
  }

  async function handleDelete() {
    if (!domain) return;
    if (!window.confirm(`Remove ${domain.name}? This also deletes it from Resend.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/email/domains/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to delete');
      toast.success('Domain removed');
      router.push('/email/domains');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete domain'));
      setDeleting(false);
    }
  }

  async function copyToClipboard(value: string, recordId: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedRow(recordId);
      setTimeout(() => setCopiedRow(null), 1500);
    } catch {
      toast.error('Clipboard write failed');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!domain) return null;

  const StatusIcon =
    domain.status === 'VERIFIED' ? ShieldCheck : domain.status === 'FAILED' ? ShieldAlert : Clock;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/email/domains">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{domain.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
                  STATUS_COLORS[domain.status],
                )}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {STATUS_LABELS[domain.status] ?? domain.status}
              </span>
              {domain.isDefault && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200">
                  <Star className="h-3 w-3" />
                  Default
                </span>
              )}
              <span className="text-xs text-gray-500">{domain.region}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => load(true)}
            disabled={refreshing}
            className="gap-2"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button onClick={handleVerify} disabled={verifying} className="gap-2">
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {verifying ? 'Verifying…' : 'Verify Now'}
          </Button>
          {domain.status === 'VERIFIED' && !domain.isDefault && (
            <Button
              variant="outline"
              onClick={handleSetDefault}
              disabled={settingDefault}
              className="gap-2"
            >
              {settingDefault ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
              Set Default
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={deleting}
            className="gap-2 text-red-600 hover:text-red-700"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-sm">
        <div className="flex items-start justify-between">
          <span className="text-gray-500">Added</span>
          <span className="text-gray-900">{formatDate(domain.createdAt)}</span>
        </div>
        <div className="flex items-start justify-between">
          <span className="text-gray-500">Last Checked</span>
          <span className="text-gray-900">{formatDate(domain.lastCheckedAt)}</span>
        </div>
        <div className="flex items-start justify-between">
          <span className="text-gray-500">Verified At</span>
          <span className="text-gray-900">{formatDate(domain.verifiedAt)}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold text-gray-900">DNS Records</h2>
          <p className="text-sm text-gray-500 mt-1">
            Add these records to your DNS provider (Cloudflare, GoDaddy, Route 53, etc.). DNS
            propagation can take a few minutes to 72 hours. Click "Verify Now" once the records
            are in place.
          </p>
        </div>
        {!domain.dnsRecords || domain.dnsRecords.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No DNS records have been generated yet. Click "Refresh" to fetch the latest from Resend.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name / Host
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {domain.dnsRecords.map((r, idx) => {
                  const rowId = `${r.record}-${idx}`;
                  const recordStatus = (r.status || '').toLowerCase();
                  return (
                    <tr key={rowId} className="text-sm">
                      <td className="px-4 py-3 align-top">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium font-mono">
                          {r.type}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">{r.record}</div>
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs">
                        <div className="flex items-start gap-2 max-w-md">
                          <code className="bg-gray-50 px-2 py-1 rounded break-all flex-1">
                            {r.name}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(r.name, `${rowId}-name`)}
                            className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                            aria-label="Copy host"
                          >
                            {copiedRow === `${rowId}-name` ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs">
                        <div className="flex items-start gap-2 max-w-md">
                          <code className="bg-gray-50 px-2 py-1 rounded break-all flex-1">
                            {r.value}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(r.value, `${rowId}-value`)}
                            className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                            aria-label="Copy value"
                          >
                            {copiedRow === `${rowId}-value` ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                            recordStatus === 'verified'
                              ? 'bg-green-100 text-green-700'
                              : recordStatus === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700',
                          )}
                        >
                          {r.status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
