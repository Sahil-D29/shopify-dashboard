"use client";

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  deltaLabel?: string;
  delta?: number;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ label, value, deltaLabel, delta, icon, className }: MetricCardProps) {
  let deltaText: string | null = null;
  let deltaClass = '';

  if (typeof delta === 'number') {
    const formatted = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
    if (delta > 0) {
      deltaClass = 'text-emerald-600';
    } else if (delta < 0) {
      deltaClass = 'text-rose-500';
    } else {
      deltaClass = 'text-slate-500';
    }
    deltaText = formatted;
  }

  return (
    <Card className={cn('flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
      <div className="flex items-center justify-between text-sm font-medium text-slate-500">
        <span>{label}</span>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      {deltaText && deltaLabel ? (
        <div className="text-xs text-slate-500">
          <span className={cn('font-medium', deltaClass)}>{deltaText}</span> {deltaLabel}
        </div>
      ) : null}
    </Card>
  );
}


