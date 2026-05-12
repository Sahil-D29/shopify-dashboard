'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Loader2,
  ArrowRightLeft,
  Play,
  Pause,
  Edit3,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';

interface Rule {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  sourceProductIds: string[];
  targetProductIds: string[];
  emailDelayHours: number;
  subject: string;
  triggerCount: number;
  sentCount: number;
  createdAt: string;
}

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  PAUSED: { label: 'Paused', color: 'bg-yellow-100 text-yellow-700', icon: Pause },
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Edit3 },
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function CrossSellPage() {
  const toast = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email/cross-sell', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data?.rules) {
        throw new Error(data?.error ?? 'Failed to load rules');
      }
      setRules(Array.isArray(data.rules) ? data.rules : []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load rules'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cross-Sell Rules</h1>
          <p className="mt-1 text-sm text-gray-500">
            Automatically email customers product recommendations after they buy.
          </p>
        </div>
        <Link href="/email/cross-sell/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Rule
          </Button>
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <p className="font-semibold mb-1">How it works</p>
        <p>
          When Shopify <code>orders/create</code> fires, active rules whose Source Product IDs
          match the order schedule a cross-sell email for the customer (after the configured
          delay). Configure the webhook at <strong>Shopify Admin → Notifications → Webhooks</strong>{' '}
          → <code className="bg-white px-1.5 py-0.5 rounded">orders/create</code> →{' '}
          <code className="bg-white px-1.5 py-0.5 rounded">
            /api/email/webhooks/shopify-order
          </code>
          . Cron <code>/api/cron/email-cross-sell-runner</code> sends scheduled emails every
          minute.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
          <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No cross-sell rules yet</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Create your first rule. Pick which products trigger it (or leave empty to trigger on
            any order), the delay before sending, and the email template.
          </p>
          <Link href="/email/cross-sell/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Rule
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rule
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delay
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source / Target
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Triggered
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map(rule => {
                const meta = STATUS_META[rule.status];
                const Icon = meta.icon;
                return (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/email/cross-sell/${rule.id}`}
                        className="text-gray-900 hover:text-indigo-600 font-medium"
                      >
                        {rule.name}
                      </Link>
                      <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                        {rule.subject}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
                          meta.color,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {rule.emailDelayHours}h
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {rule.sourceProductIds.length === 0
                        ? 'Any → '
                        : `${rule.sourceProductIds.length} → `}
                      {rule.targetProductIds.length}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {rule.triggerCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {rule.sentCount.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
