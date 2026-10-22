import type { EventSource } from '@/lib/types/event-source';
import { cn } from '@/lib/utils';

interface EventSourceBadgesProps {
  sources?: EventSource[];
  className?: string;
  limit?: number;
}

export function EventSourceBadges({ sources = [], className, limit = 2 }: EventSourceBadgesProps) {
  if (!sources.length) return null;
  const visible = sources.slice(0, limit);
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      {visible.map(source => (
        <span
          key={`${source.kind}:${source.id}`}
          title={`Received from webhook: ${source.name}`}
          className="inline-flex max-w-[150px] items-center truncate rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-sky-700"
        >
          {source.name}
        </span>
      ))}
      {sources.length > limit ? (
        <span className="text-[9px] font-medium text-muted-foreground">+{sources.length - limit}</span>
      ) : null}
    </span>
  );
}

export const eventSourceSuffix = (sources?: EventSource[]): string =>
  sources?.length ? ` — ${sources.map(source => source.name).join(', ')}` : '';
