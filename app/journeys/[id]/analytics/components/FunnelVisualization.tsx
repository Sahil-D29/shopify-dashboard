import { Fragment } from 'react';

import { cn } from '@/lib/utils';

export interface FunnelStep {
  id: string;
  title: string;
  type: string;
  customers: number;
}

interface FunnelVisualizationProps {
  steps: FunnelStep[];
  total: number;
}

const TYPE_GRADIENT: Record<string, string> = {
  trigger: 'from-[#CBB097] to-[#B18C6D]',
  action: 'from-[#D5BBA3] to-[#BE9670]',
  condition: 'from-[#E3CDB8] to-[#B0855A]',
  delay: 'from-[#D9C9BA] to-[#A88972]',
  goal: 'from-[#CDB9A8] to-[#96785F]',
};

export function FunnelVisualization({ steps, total }: FunnelVisualizationProps) {
  if (!steps.length) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-[#E0D8CF] bg-white/60 p-8 text-center text-sm text-[#8B7F76]">
        Not enough journey activity to render the funnel yet.
      </div>
    );
  }

  const maxCustomers = Math.max(...steps.map(step => step.customers), total || 1);

  return (
    <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
      {steps.map((step, index) => {
        const widthPercent = Math.max(12, Math.round((step.customers / maxCustomers) * 100));
        const gradient = TYPE_GRADIENT[step.type] || TYPE_GRADIENT.goal;

        return (
          <Fragment key={step.id}>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-20 shrink-0 space-y-0.5 sm:w-32 sm:space-y-1">
                <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#B9AA9F] sm:text-[11px]">
                  Step {index + 1}
                </p>
                <p className="truncate text-xs font-semibold text-[#5B4B3F] sm:text-sm">{step.title}</p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="h-2.5 overflow-hidden rounded-full bg-[#F2ECE6] sm:h-3">
                  <div
                    className={cn('h-full rounded-full bg-gradient-to-r shadow-sm transition-all duration-300', gradient)}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
              <div className="w-14 text-right text-xs font-semibold text-[#6F6256] sm:w-20 sm:text-sm">
                {step.customers.toLocaleString()}
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

