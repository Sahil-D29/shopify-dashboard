'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  FlaskConical,
  Trophy,
  Plus,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';

interface VariantStats {
  variant: 'A' | 'B';
  subject: string;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
  clickRate: number;
}

interface AbTestSummary {
  id: string;
  name: string;
  status: string;
  completedAt: string | null;
  scheduledAt: string | null;
  abTestPercent: number;
  abTestWinnerMetric: 'OPEN_RATE' | 'CLICK_RATE';
  variants: VariantStats[];
  winner: 'A' | 'B' | null;
  winnerByMetric: number;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  SENDING: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function EmailAbTestsPage() {
  const toast = useToast();
  const [tests, setTests] = useState<AbTestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email/ab-tests', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data?.tests) {
        throw new Error(data?.error ?? 'Failed to load A/B tests');
      }
      setTests(Array.isArray(data.tests) ? data.tests : []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load A/B tests'));
      setTests([]);
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
          <h1 className="text-2xl font-bold text-gray-900">A/B Tests</h1>
          <p className="mt-1 text-sm text-gray-500">
            Compare subject line variants and their performance. A/B tests are configured
            inside each campaign's settings.
          </p>
        </div>
        <Link href="/email/campaigns/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Campaign with A/B Test
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : tests.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
          <FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No A/B tests yet</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Create a campaign and toggle on <strong>A/B Test</strong> in the campaign settings.
            You'll choose an alternative subject line, the % of audience to send the variant
            to, and the winning metric (open rate or click rate).
          </p>
          <Link href="/email/campaigns/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Campaign
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map(test => (
            <Link
              key={test.id}
              href={`/email/campaigns/${test.id}`}
              className="block bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-5 border-b flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900">{test.name}</h3>
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      STATUS_COLORS[test.status] ?? 'bg-gray-100 text-gray-600',
                    )}
                  >
                    {test.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    Winner metric: {test.abTestWinnerMetric.replace('_', ' ').toLowerCase()}
                  </span>
                </div>
                {test.winner ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-sm font-medium border border-amber-200">
                    <Trophy className="h-4 w-4" />
                    Variant {test.winner} won by {test.winnerByMetric.toFixed(1)}pp
                  </div>
                ) : test.status === 'COMPLETED' ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 text-gray-600 text-sm font-medium border border-gray-200">
                    Tie
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 inline-flex items-center gap-1">
                    Waiting for sends <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                {test.variants.map(v => (
                  <VariantCard
                    key={v.variant}
                    variant={v}
                    isWinner={test.winner === v.variant}
                    winnerMetric={test.abTestWinnerMetric}
                  />
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function VariantCard({
  variant,
  isWinner,
  winnerMetric,
}: {
  variant: VariantStats;
  isWinner: boolean;
  winnerMetric: 'OPEN_RATE' | 'CLICK_RATE';
}) {
  return (
    <div className={cn('p-5', isWinner && 'bg-amber-50/50')}>
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider',
            isWinner ? 'text-amber-700' : 'text-gray-500',
          )}
        >
          {isWinner && <CheckCircle2 className="h-3.5 w-3.5" />}
          Variant {variant.variant}
        </span>
        <span className="text-xs text-gray-500">{variant.sent.toLocaleString()} sent</span>
      </div>
      <p className="text-sm text-gray-900 mb-4 line-clamp-1" title={variant.subject}>
        {variant.subject || '(empty subject)'}
      </p>
      <div className="grid grid-cols-3 gap-3">
        <MetricBlock
          label="Open"
          value={`${variant.openRate.toFixed(1)}%`}
          subtitle={`${variant.opened}`}
          highlight={winnerMetric === 'OPEN_RATE' && isWinner}
        />
        <MetricBlock
          label="Click"
          value={`${variant.clickRate.toFixed(1)}%`}
          subtitle={`${variant.clicked}`}
          highlight={winnerMetric === 'CLICK_RATE' && isWinner}
        />
        <MetricBlock
          label="Bounce"
          value={variant.sent > 0 ? `${((variant.bounced / variant.sent) * 100).toFixed(1)}%` : '—'}
          subtitle={`${variant.bounced}`}
        />
      </div>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  subtitle,
  highlight,
}: {
  label: string;
  value: string;
  subtitle: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg p-3',
        highlight ? 'bg-amber-100' : 'bg-gray-50',
      )}
    >
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={cn('text-lg font-bold', highlight ? 'text-amber-800' : 'text-gray-900')}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
    </div>
  );
}
