'use client';

import { cn } from '@/lib/utils';
import type { TriggerType } from './types';

interface TriggerTypeSelectorProps {
  value: TriggerType;
  onChange: (value: TriggerType) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ value: TriggerType; label: string; description: string }> = [
  { value: 'event', label: 'Event', description: 'Fire when a specific action occurs.' },
  { value: 'segment', label: 'Segment', description: 'Trigger when users enter a segment.' },
  { value: 'api', label: 'API', description: 'Start journeys programmatically.' },
  { value: 'legacy', label: 'Legacy', description: 'Use legacy trigger configuration.' },
];

export function TriggerTypeSelector({ value, onChange, disabled }: TriggerTypeSelectorProps) {
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Trigger Type
          </h3>
          <p className="text-xs text-slate-500">
            Choose how this journey should start.
          </p>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {OPTIONS.map(option => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex h-full flex-col gap-2 rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                isSelected
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/40',
              )}
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs text-slate-500">{option.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

TriggerTypeSelector.displayName = 'TriggerTypeSelector';

