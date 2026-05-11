'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Loader2,
  Send as SendIcon,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  Edit3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';

type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  status: CampaignStatus;
  scheduleType: 'IMMEDIATE' | 'SCHEDULED';
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  failedCount: number;
  createdAt: string;
}

const STATUS_META: Record<
  CampaignStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Edit3 },
  SCHEDULED: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700', icon: Clock },
  SENDING: { label: 'Sending', color: 'bg-yellow-100 text-yellow-700', icon: SendIcon },
  COMPLETED: { label: 'Sent', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: Pause },
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const PAGE_SIZE = 50;

export default function EmailCampaignsPage() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [offset, setOffset] = useState(0);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/email/campaigns?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data?.campaigns) {
        throw new Error(data?.error ?? 'Failed to load campaigns');
      }
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      setTotal(data.total ?? 0);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load campaigns'));
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, offset, toast]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  const filters: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'DRAFT', label: 'Drafts' },
    { value: 'SCHEDULED', label: 'Scheduled' },
    { value: 'SENDING', label: 'Sending' },
    { value: 'COMPLETED', label: 'Sent' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  const pageStart = offset + 1;
  const pageEnd = Math.min(offset + campaigns.length, total);
  const hasPrev = offset > 0;
  const hasNext = offset + campaigns.length < total;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create, schedule, and send email broadcasts to your audience.
          </p>
        </div>
        <Link href="/email/campaigns/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map(opt => (
          <button
            key={opt.value}
            onClick={() => {
              setStatusFilter(opt.value);
              setOffset(0);
            }}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
              statusFilter === opt.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Mail className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="mb-3">
              {statusFilter === 'all'
                ? 'No campaigns yet.'
                : `No campaigns with status "${statusFilter}".`}
            </p>
            {statusFilter === 'all' && (
              <Link href="/email/campaigns/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Campaign
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recipients
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Open Rate
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Click Rate
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map(c => {
                const meta = STATUS_META[c.status];
                const Icon = meta.icon;
                const sent = c.sentCount || 0;
                const openRate = sent > 0 ? ((c.openedCount / sent) * 100).toFixed(1) : '—';
                const clickRate =
                  sent > 0 ? ((c.clickedCount / sent) * 100).toFixed(1) : '—';
                const dateLabel = c.completedAt
                  ? `Sent ${new Date(c.completedAt).toLocaleDateString()}`
                  : c.scheduledAt
                    ? `Scheduled ${new Date(c.scheduledAt).toLocaleDateString()}`
                    : `Created ${new Date(c.createdAt).toLocaleDateString()}`;
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/email/campaigns/${c.id}`}
                        className="text-gray-900 hover:text-indigo-600 font-medium"
                      >
                        {c.name}
                      </Link>
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {c.subject}
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
                      {c.totalRecipients > 0 ? c.totalRecipients.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {openRate === '—' ? '—' : `${openRate}%`}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {clickRate === '—' ? '—' : `${clickRate}%`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{dateLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {campaigns.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            <div>
              Showing {pageStart}-{pageEnd} of {total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={!hasPrev}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={!hasNext}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
