'use client';

import { Fragment } from 'react';
import { nanoid } from 'nanoid';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Rule } from './types';

interface RulesFrequencyProps {
  rules: Rule[];
  onChange: (rules: Rule[]) => void;
  disabled?: boolean;
}

const PRESETS: Array<{ label: string; count: number }> = [
  { label: 'Once', count: 1 },
  { label: 'Twice', count: 2 },
  { label: '3+ times', count: 3 },
];

export function RulesFrequency({ rules, onChange, disabled }: RulesFrequencyProps) {
  const updateRule = (id: string, patch: Partial<Rule>) => {
    onChange(rules.map(rule => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const addWindowRule = () => {
    onChange([
      ...rules,
      {
        id: nanoid(),
        type: 'withinWindow',
        window: { unit: 'days', value: 7 },
      },
    ]);
  };

  const removeRule = (id: string) => {
    onChange(rules.filter(rule => rule.id !== id));
  };

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Rules &amp; Frequency
        </h3>
        <p className="text-xs text-slate-500">
          Define how many times the event should occur and within which timeframe.
        </p>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(preset => (
          <Button
            key={preset.label}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() =>
              onChange([
                ...rules.filter(rule => rule.type !== 'count'),
                {
                  id: nanoid(),
                  type: 'count',
                  count: preset.count,
                },
              ])
            }
          >
            {preset.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={addWindowRule}
        >
          + Add Time Window
        </Button>
      </div>
      <div className="space-y-3">
        {rules.map(rule => (
          <Fragment key={rule.id}>
            {rule.type === 'count' ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <span className="text-sm text-slate-500">Occurred at least</span>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={rule.count ?? 1}
                  disabled={disabled}
                  onChange={event =>
                    updateRule(rule.id, { count: Number.parseInt(event.target.value, 10) || 1 })
                  }
                />
                <span className="text-sm text-slate-500">time(s)</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeRule(rule.id)}
                  disabled={disabled}
                >
                  Remove
                </Button>
              </div>
            ) : null}
            {rule.type === 'withinWindow' ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <span className="text-sm text-slate-500">Within the last</span>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={rule.window?.value ?? 7}
                  disabled={disabled}
                  onChange={event =>
                    updateRule(rule.id, {
                      window: {
                        unit: rule.window?.unit ?? 'days',
                        value: Number.parseInt(event.target.value, 10) || 1,
                      },
                    })
                  }
                />
                <Select
                  value={rule.window?.unit ?? 'days'}
                  disabled={disabled}
                  onValueChange={value =>
                    updateRule(rule.id, {
                      window: {
                        unit: value as NonNullable<Rule['window']>['unit'],
                        value: rule.window?.value ?? 7,
                      },
                    })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeRule(rule.id)}
                  disabled={disabled}
                >
                  Remove
                </Button>
              </div>
            ) : null}
            {rule.type === 'firstTime' ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <span className="text-sm text-slate-600">Only include users doing this for the first time</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeRule(rule.id)}
                  disabled={disabled}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </Fragment>
        ))}
        {rules.every(rule => rule.type !== 'firstTime') ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() =>
              onChange([
                ...rules,
                {
                  id: nanoid(),
                  type: 'firstTime',
                  firstTime: true,
                },
              ])
            }
          >
            First time only
          </Button>
        ) : null}
      </div>
    </section>
  );
}

RulesFrequency.displayName = 'RulesFrequency';


