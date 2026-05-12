'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, Clock, XCircle, Pause } from 'lucide-react';
import { useToast } from '@/lib/hooks/useToast';
import { CrossSellForm, CrossSellFormValues } from '@/components/email/CrossSellForm';
import { cn } from '@/lib/utils';

interface Log {
  id: string;
  shopifyOrderId: string;
  customerEmail: string;
  customerName: string | null;
  status: 'SCHEDULED' | 'SENT' | 'FAILED' | 'CANCELLED' | 'SKIPPED';
  scheduledFor: string;
  sentAt: string | null;
  errorMessage: string | null;
  matchedProductIds: string[];
  createdAt: string;
}

interface Rule {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  sourceProductIds: string[];
  targetProductIds: string[];
  emailDelayHours: number;
  subject: string;
  fromName: string;
  fromEmail: string;
  htmlBody: string;
  jsonDesign: unknown | null;
  triggerCount: number;
  sentCount: number;
  createdAt: string;
}

const LOG_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  SKIPPED: 'bg-yellow-100 text-yellow-700',
};

const LOG_STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  SCHEDULED: Clock,
  SENT: CheckCircle2,
  FAILED: XCircle,
  CANCELLED: Pause,
  SKIPPED: Pause,
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function CrossSellRuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [rule, setRule] = useState<Rule | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email/cross-sell/${id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load rule');
      setRule(data.rule);
      setLogs(Array.isArray(data.recentLogs) ? data.recentLogs : []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load rule'));
      router.push('/email/cross-sell');
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    try {
      const res = await fetch(`/api/email/cross-sell/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to delete');
      toast.success('Rule deleted');
      router.push('/email/cross-sell');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete rule'));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!rule) return null;

  const initial: CrossSellFormValues = {
    id: rule.id,
    name: rule.name,
    description: rule.description ?? '',
    status: rule.status,
    sourceProductIds: rule.sourceProductIds,
    targetProductIds: rule.targetProductIds,
    emailDelayHours: rule.emailDelayHours,
    subject: rule.subject,
    fromName: rule.fromName,
    fromEmail: rule.fromEmail,
    htmlBody: rule.htmlBody,
    jsonDesign: rule.jsonDesign,
  };

  return (
    <div className="space-y-6">
      <CrossSellForm mode="edit" initial={initial} onDelete={handleDelete} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Activity</h2>
          <div className="text-xs text-gray-500">
            Triggered <strong>{rule.triggerCount.toLocaleString()}</strong> · Sent{' '}
            <strong>{rule.sentCount.toLocaleString()}</strong>
          </div>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No orders have matched this rule yet.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scheduled / Sent
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => {
                const Icon = LOG_STATUS_ICONS[log.status] ?? Clock;
                return (
                  <tr key={log.id} className="text-sm">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{log.customerEmail}</div>
                      {log.customerName && (
                        <div className="text-xs text-gray-500">{log.customerName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                      {log.shopifyOrderId}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
                          LOG_STATUS_COLORS[log.status] ?? 'bg-gray-100 text-gray-600',
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {log.status}
                      </span>
                      {log.errorMessage && (
                        <div className="text-xs text-red-600 mt-1 line-clamp-1" title={log.errorMessage}>
                          {log.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {log.sentAt
                        ? `Sent ${new Date(log.sentAt).toLocaleString()}`
                        : `Scheduled ${new Date(log.scheduledFor).toLocaleString()}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
