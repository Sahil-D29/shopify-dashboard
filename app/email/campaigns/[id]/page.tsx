'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  ArrowLeft,
  Send as SendIcon,
  Trash2,
  Pause,
  Mail,
  CheckCircle2,
  XCircle,
  MousePointerClick,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/useToast';
import { CampaignForm, CampaignFormValues } from '@/components/email/CampaignForm';
import { cn } from '@/lib/utils';

interface Campaign {
  id: string;
  storeId: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  preheaderText: string | null;
  htmlBody: string;
  jsonDesign: unknown | null;
  audienceMode: 'ALL_SUBSCRIBERS' | 'SEGMENTS';
  scheduleType: 'IMMEDIATE' | 'SCHEDULED';
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  complainedCount: number;
  failedCount: number;
  abTestEnabled: boolean;
  abTestPercent: number;
  abTestVariantSubject: string | null;
  abTestWinnerMetric: 'OPEN_RATE' | 'CLICK_RATE';
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  SCHEDULED: 'bg-blue-100 text-blue-700 border-blue-200',
  SENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  COMPLETED: 'bg-green-100 text-green-700 border-green-200',
  FAILED: 'bg-red-100 text-red-700 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email/campaigns/${id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load campaign');
      setCampaign(data.campaign);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load campaign'));
      router.push('/email/campaigns');
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-refresh while SENDING
  useEffect(() => {
    if (campaign?.status === 'SENDING') {
      const interval = setInterval(load, 3000);
      return () => clearInterval(interval);
    }
  }, [campaign?.status, load]);

  async function handleDelete() {
    if (!campaign) return;
    if (!window.confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/email/campaigns/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to delete');
      toast.success('Campaign deleted');
      router.push('/email/campaigns');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete'));
      setDeleting(false);
    }
  }

  async function handleCancel() {
    if (!campaign) return;
    if (!window.confirm('Cancel this scheduled campaign?')) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/email/campaigns/${id}/cancel`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to cancel');
      toast.success('Campaign cancelled');
      setCampaign(data.campaign);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to cancel'));
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!campaign) return null;

  // If the campaign hasn't been sent yet, show the editor form
  const showEditor =
    campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';

  if (showEditor) {
    const initial: CampaignFormValues = {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
      replyTo: campaign.replyTo ?? '',
      preheaderText: campaign.preheaderText ?? '',
      htmlBody: campaign.htmlBody,
      jsonDesign: campaign.jsonDesign,
      audienceMode: campaign.audienceMode,
      scheduleType: campaign.scheduleType,
      scheduledAt: campaign.scheduledAt
        ? new Date(campaign.scheduledAt).toISOString().slice(0, 16)
        : '',
      abTestEnabled: campaign.abTestEnabled,
      abTestPercent: campaign.abTestPercent,
      abTestVariantSubject: campaign.abTestVariantSubject ?? '',
      abTestWinnerMetric: campaign.abTestWinnerMetric,
    };
    return (
      <div className="space-y-6">
        {campaign.status === 'SCHEDULED' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-blue-900">
              <Clock className="h-4 w-4" />
              <span>
                Scheduled to send at{' '}
                <strong>
                  {campaign.scheduledAt
                    ? new Date(campaign.scheduledAt).toLocaleString()
                    : '—'}
                </strong>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
              className="gap-2"
            >
              {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
              Cancel Schedule
            </Button>
          </div>
        )}
        <CampaignForm mode="edit" initial={initial} campaignStatus={campaign.status} />
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={deleting}
            className="gap-2 text-red-600 hover:text-red-700"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete Campaign
          </Button>
        </div>
      </div>
    );
  }

  // Sent / sending / cancelled / failed: show a read-only report
  const openRate =
    campaign.sentCount > 0 ? (campaign.openedCount / campaign.sentCount) * 100 : 0;
  const clickRate =
    campaign.sentCount > 0 ? (campaign.clickedCount / campaign.sentCount) * 100 : 0;
  const bounceRate =
    campaign.sentCount > 0 ? (campaign.bouncedCount / campaign.sentCount) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/email/campaigns">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <span
                className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                  STATUS_COLORS[campaign.status],
                )}
              >
                {campaign.status === 'SENDING' && (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                )}
                {campaign.status}
              </span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-600">{campaign.subject}</span>
            </div>
          </div>
        </div>
        {campaign.status !== 'SENDING' && (
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={deleting}
            className="gap-2 text-red-600 hover:text-red-700"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          icon={Mail}
          label="Recipients"
          value={campaign.totalRecipients.toLocaleString()}
          subtitle={`${campaign.sentCount.toLocaleString()} sent`}
        />
        <Stat
          icon={CheckCircle2}
          label="Open Rate"
          value={`${openRate.toFixed(1)}%`}
          subtitle={`${campaign.openedCount.toLocaleString()} opened`}
          accent="green"
        />
        <Stat
          icon={MousePointerClick}
          label="Click Rate"
          value={`${clickRate.toFixed(1)}%`}
          subtitle={`${campaign.clickedCount.toLocaleString()} clicked`}
          accent="indigo"
        />
        <Stat
          icon={AlertTriangle}
          label="Bounce Rate"
          value={`${bounceRate.toFixed(1)}%`}
          subtitle={`${campaign.bouncedCount.toLocaleString()} bounced`}
          accent={bounceRate > 5 ? 'red' : 'gray'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Email Preview</h2>
          </div>
          <iframe
            srcDoc={campaign.htmlBody || '<p style="padding:24px;color:#999;">No content</p>'}
            title="Campaign preview"
            className="w-full h-[600px] border-0"
            sandbox="allow-same-origin"
          />
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-sm">
            <h2 className="font-semibold text-gray-900 mb-2">Details</h2>
            <Row label="From" value={`${campaign.fromName} <${campaign.fromEmail}>`} />
            {campaign.replyTo && <Row label="Reply-To" value={campaign.replyTo} />}
            <Row label="Subject" value={campaign.subject} />
            {campaign.preheaderText && (
              <Row label="Preheader" value={campaign.preheaderText} />
            )}
            <Row
              label="Started"
              value={campaign.startedAt ? new Date(campaign.startedAt).toLocaleString() : '—'}
            />
            <Row
              label="Completed"
              value={
                campaign.completedAt ? new Date(campaign.completedAt).toLocaleString() : '—'
              }
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-sm">
            <h2 className="font-semibold text-gray-900 mb-2">Delivery Breakdown</h2>
            <DeliveryRow icon={CheckCircle2} label="Delivered" value={campaign.deliveredCount} accent="green" />
            <DeliveryRow icon={Mail} label="Opened" value={campaign.openedCount} accent="blue" />
            <DeliveryRow icon={MousePointerClick} label="Clicked" value={campaign.clickedCount} accent="indigo" />
            <DeliveryRow icon={AlertTriangle} label="Bounced" value={campaign.bouncedCount} accent="orange" />
            <DeliveryRow icon={XCircle} label="Failed" value={campaign.failedCount} accent="red" />
          </div>

          {campaign.abTestEnabled && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-sm">
              <h2 className="font-semibold text-gray-900 mb-2">A/B Test</h2>
              <Row label="Variant A subject" value={campaign.subject} />
              <Row label="Variant B subject" value={campaign.abTestVariantSubject ?? '—'} />
              <Row label="Variant B %" value={`${campaign.abTestPercent}%`} />
              <Row label="Winner metric" value={campaign.abTestWinnerMetric.replace('_', ' ')} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  subtitle,
  accent = 'gray',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  accent?: 'gray' | 'green' | 'indigo' | 'red';
}) {
  const accentClasses: Record<string, string> = {
    gray: 'text-gray-700 bg-gray-100',
    green: 'text-green-700 bg-green-100',
    indigo: 'text-indigo-700 bg-indigo-100',
    red: 'text-red-700 bg-red-100',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn('p-2 rounded-lg', accentClasses[accent])}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 text-right break-all max-w-[60%]">{value}</span>
    </div>
  );
}

function DeliveryRow({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: 'green' | 'blue' | 'indigo' | 'orange' | 'red';
}) {
  const accentColors: Record<string, string> = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    indigo: 'text-indigo-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
  };
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-600">
        <Icon className={cn('h-4 w-4', accentColors[accent])} />
        <span>{label}</span>
      </div>
      <span className="font-medium text-gray-900">{value.toLocaleString()}</span>
    </div>
  );
}
