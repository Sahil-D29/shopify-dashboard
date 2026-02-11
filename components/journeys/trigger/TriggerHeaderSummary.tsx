'use client';

import { Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { TriggerConfigState } from './types';

interface TriggerHeaderSummaryProps {
  state: TriggerConfigState;
  errors: string[];
  warnings: string[];
  onReset: () => void;
  onNameChange: (name: string, description?: string) => void;
  onStatusChange: (status: 'draft' | 'active') => void;
  onSave?: () => void;
}

export function TriggerHeaderSummary({
  state,
  errors,
  warnings,
  onReset,
  onNameChange,
  onStatusChange,
  onSave,
}: TriggerHeaderSummaryProps) {
  const summaryLabel =
    state.events.length > 0
      ? `${state.events.join(', ')}`
      : state.triggerType === 'event'
        ? 'Select an event to get started'
        : 'Configure trigger details';

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={state.isValid ? 'default' : 'secondary'}>
                {state.isValid ? 'Ready' : 'Incomplete'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {state.triggerType.toUpperCase()}
              </Badge>
              <Badge
                variant={state.status === 'active' ? 'default' : 'outline'}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() =>
                  onStatusChange(state.status === 'active' ? 'draft' : 'active')
                }
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onStatusChange(state.status === 'active' ? 'draft' : 'active');
                  }
                }}
              >
                {state.status === 'active' ? 'Active' : 'Draft'}
              </Badge>
            </div>
            <div className="flex flex-col gap-2">
              <Input
                value={state.name}
                onChange={event => onNameChange(event.target.value, state.description)}
                placeholder="Trigger name"
                className="text-base font-semibold text-slate-900"
              />
              <Textarea
                value={state.description ?? ''}
                onChange={event => onNameChange(state.name, event.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <p className="text-xs text-slate-500">{summaryLabel}</p>
            {hasErrors ? (
              <p className="text-xs font-medium text-rose-600">
                Fix {errors.length} validation issue{errors.length === 1 ? '' : 's'} before activating or saving.
              </p>
            ) : null}
            {!hasErrors && hasWarnings ? (
              <p className="text-xs text-amber-600">
                {warnings.length} warning{warnings.length === 1 ? '' : 's'} detected.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 self-end">
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
          <Button size="sm" disabled={!state.isValid} onClick={onSave}>
            Save Trigger
          </Button>
        </div>
      </div>
    </header>
  );
}

TriggerHeaderSummary.displayName = 'TriggerHeaderSummary';

