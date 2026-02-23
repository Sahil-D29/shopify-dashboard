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
    <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
      {CARDS.map(card => {
        const Icon = card.icon;
        const value = overview[card.key];
        const delta = computeDelta(card.key, latest, previous, overview);
        const trendLabel = formatDelta(delta);

        return (
          <article
            key={card.key}
            className={cn(
              'relative overflow-hidden rounded-2xl border border-[#E8E4DE] bg-gradient-to-br p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:rounded-3xl sm:p-5',
              card.gradient
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1 sm:gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#6F6256]/70 sm:text-xs">{card.title}</span>
                <span className={cn('text-xl font-semibold tracking-tight sm:text-3xl', card.accent)}>
                  {formatNumber(value)}
                  {card.suffix}
                </span>
              </div>
              <div className="rounded-xl bg-white/40 p-1.5 text-[#6F6256] sm:rounded-2xl sm:p-2">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
            <footer className="mt-3 flex items-center gap-1.5 text-[10px] text-[#6F6256]/80 sm:mt-5 sm:gap-2 sm:text-xs">
              <span className={cn('font-medium', delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-500' : 'text-[#6F6256]')}>
                {trendLabel}
              </span>
              <span className="hidden sm:inline">vs previous period</span>
              <span className="sm:hidden">vs prev</span>
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

