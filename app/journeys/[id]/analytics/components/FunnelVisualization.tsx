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
    <div className="mt-6 space-y-4">
      {steps.map((step, index) => {
        const widthPercent = Math.max(12, Math.round((step.customers / maxCustomers) * 100));
        const gradient = TYPE_GRADIENT[step.type] || TYPE_GRADIENT.goal;

        return (
          <Fragment key={step.id}>
            <div className="flex items-center gap-4">
              <div className="w-32 shrink-0 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#B9AA9F]">
                  Step {index + 1}
                </p>
                <p className="text-sm font-semibold text-[#5B4B3F]">{step.title}</p>
              </div>
              <div className="flex-1">
                <div className="h-3 overflow-hidden rounded-full bg-[#F2ECE6]">
                  <div
                    className={cn('h-full rounded-full bg-gradient-to-r shadow-sm transition-all duration-300', gradient)}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
              <div className="w-20 text-right text-sm font-semibold text-[#6F6256]">
                {step.customers.toLocaleString()}
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

