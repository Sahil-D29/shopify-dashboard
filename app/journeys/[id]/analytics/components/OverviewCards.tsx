import { BadgeCheck, BarChartBig, Flame, Gauge, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

type Overview = {
  totalEntered: number;
  active: number;
  completed: number;
  dropped: number;
  goalConversionRate: number;
};

type TimelinePoint = {
  date: string;
  started: number;
  completed: number;
  goalAchieved: number;
};

interface OverviewCardsProps {
  overview: Overview;
  timeline: TimelinePoint[];
}

const CARDS = [
  {
    key: 'totalEntered' as const,
    title: 'Customers Entered',
    icon: Users,
    gradient: 'from-[#EBD9CC] via-[#E2C8B4] to-[#D6B295]',
    accent: 'text-[#7A5F4B]'
  },
  {
    key: 'active' as const,
    title: 'Currently Active',
    icon: Gauge,
    gradient: 'from-[#EDE3D7] via-[#E1D1BE] to-[#C5A98D]',
    accent: 'text-[#725647]'
  },
  {
    key: 'completed' as const,
    title: 'Completed Journey',
    icon: BadgeCheck,
    gradient: 'from-[#E9E1D7] via-[#DDD0C0] to-[#CBB097]',
    accent: 'text-[#6C5747]'
  },
  {
    key: 'dropped' as const,
    title: 'Dropped Off',
    icon: Flame,
    gradient: 'from-[#F1E6DC] via-[#E8D3BC] to-[#D4A37E]',
    accent: 'text-[#874E2D]'
  },
  {
    key: 'goalConversionRate' as const,
    title: 'Conversion Rate',
    icon: BarChartBig,
    gradient: 'from-[#E6E2DD] via-[#D7CEC3] to-[#C0AB95]',
    accent: 'text-[#5F4B3F]',
    suffix: '%'
  }
];

export function OverviewCards({ overview, timeline }: OverviewCardsProps) {
  const latest = timeline.at(-1);
  const previous = timeline.length > 1 ? timeline.at(-2) : undefined;

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {CARDS.map(card => {
        const Icon = card.icon;
        const value = overview[card.key];
        const delta = computeDelta(card.key, latest, previous, overview);
        const trendLabel = formatDelta(delta);

        return (
          <article
            key={card.key}
            className={cn(
              'relative overflow-hidden rounded-3xl border border-[#E8E4DE] bg-gradient-to-br p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
              card.gradient
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-[#6F6256]/70">{card.title}</span>
                <span className={cn('text-3xl font-semibold tracking-tight', card.accent)}>
                  {formatNumber(value)}
                  {card.suffix}
                </span>
              </div>
              <div className="rounded-2xl bg-white/40 p-2 text-[#6F6256]">
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <footer className="mt-5 flex items-center gap-2 text-xs text-[#6F6256]/80">
              <span className={cn('font-medium', delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-500' : 'text-[#6F6256]')}>
                {trendLabel}
              </span>
              <span>vs previous period</span>
            </footer>
          </article>
        );
      })}
    </section>
  );
}

function computeDelta(
  key: keyof Overview,
  latest?: TimelinePoint,
  previous?: TimelinePoint,
  overview?: Overview
) {
  if (!latest || !previous) {
    return 0;
  }

  switch (key) {
    case 'totalEntered':
      return latest.started - previous.started;
    case 'completed':
      return latest.completed - previous.completed;
    case 'goalConversionRate':
      if (!overview) return 0;
      const prevConversion = previous.started ? (previous.goalAchieved / previous.started) * 100 : 0;
      return Number((overview.goalConversionRate - prevConversion).toFixed(1));
    case 'active':
      return (latest.started - latest.completed) - (previous.started - previous.completed);
    case 'dropped':
      return 0;
    default:
      return 0;
  }
}

function formatDelta(delta: number) {
  if (delta === 0) return 'No change';
  const absolute = Math.abs(delta);
  return `${delta > 0 ? '+' : '-'}${absolute.toLocaleString()}`;
}

function formatNumber(value: number) {
  if (value === null || value === undefined) return '—';
  if (value < 1000) return value.toLocaleString();
  if (value < 10000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value / 1000)}k`;
}

