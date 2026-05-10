"use client";

import { useMemo } from 'react';
import { Calendar, Filter, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { AnalyticsFilters } from '@/lib/journey-engine/analytics';

interface AnalyticsFiltersPanelProps {
  filters: AnalyticsFilters;
  onChange: (filters: AnalyticsFilters) => void;
  segments?: Array<{ id: string; name: string }>;
  isLoading?: boolean;
}

export function AnalyticsFiltersPanel({ filters, onChange, segments, isLoading }: AnalyticsFiltersPanelProps) {
  const hasFilters = useMemo(
    () => Boolean(filters.from || filters.to || filters.status || filters.goalAchieved || filters.segmentId),
    [filters]
  );

  const handleInputChange = (key: keyof AnalyticsFilters, value: string | undefined) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <aside className="rounded-3xl border border-[#E8E4DE] bg-white/85 p-6 shadow-sm backdrop-blur">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-[#F6F1EB] p-2 text-[#8B7F76]">
            <Filter className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#6F6256]">Filters</h2>
            <p className="text-xs text-[#8B7F76]">Refine analytics by time range, status, or segments.</p>
          </div>
        </div>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-[#8B7F76] hover:bg-[#F6F1EB]"
            onClick={() => onChange({})}
            disabled={isLoading}
          >
            <X className="mr-1 h-3 w-3" /> Clear
          </Button>
        ) : null}
      </header>

      <div className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField
            label="From"
            value={filters.from}
            onChange={value => handleInputChange('from', value || undefined)}
            disabled={isLoading}
          />
          <DateField
            label="To"
            value={filters.to}
            onChange={value => handleInputChange('to', value || undefined)}
            disabled={isLoading}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-[#8B7F76]">Status</Label>
            <Select
              value={filters.status}
              onValueChange={value => handleInputChange('status', value === 'all' ? undefined : (value as AnalyticsFilters['status']))}
              disabled={isLoading}
            >
              <SelectTrigger className="h-10 rounded-xl border-[#E8E4DE] bg-white text-[#4A4139]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="exited">Exited</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-[#8B7F76]">Goal</Label>
            <Select
              value={filters.goalAchieved}
              onValueChange={value => handleInputChange('goalAchieved', value === 'all' ? undefined : (value as 'yes' | 'no'))}
              disabled={isLoading}
            >
              <SelectTrigger className="h-10 rounded-xl border-[#E8E4DE] bg-white text-[#4A4139]">
                <SelectValue placeholder="All customers" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all">All customers</SelectItem>
                <SelectItem value="yes">Achieved goal</SelectItem>
                <SelectItem value="no">Goal pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-[0.2em] text-[#8B7F76]">Entry segment</Label>
          <Select
            value={filters.segmentId}
            onValueChange={value => handleInputChange('segmentId', value === 'all' ? undefined : value)}
            disabled={!segments?.length || isLoading}
          >
            <SelectTrigger className="h-10 rounded-xl border-[#E8E4DE] bg-white text-[#4A4139]">
              <SelectValue placeholder={segments?.length ? 'All segments' : 'No segments available'} />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">All segments</SelectItem>
              {segments?.map(segment => (
                <SelectItem key={segment.id} value={segment.id}>
                  {segment.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </aside>
  );
}

function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value?: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-[0.2em] text-[#8B7F76]">{label}</Label>
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B9AA9F]" />
        <Input
          type="date"
          value={value ?? ''}
          onChange={event => onChange(event.target.value || null)}
          className="h-10 rounded-xl border-[#E8E4DE] bg-white pl-10 pr-4 text-sm text-[#4A4139]"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

