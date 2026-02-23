"use client";

import { useMemo, useState } from 'react';
import { ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface NodeMetric {
  nodeId: string;
  name: string;
  type: string;
  customersReached: number;
  completionRate: number;
  avgTimeSpent: number | null;
  actions?: Record<string, number>;
}

type SortKey = 'customers' | 'completion' | 'avgTime';

interface NodePerformanceTableProps {
  metrics: NodeMetric[];
}

export function NodePerformanceTable({ metrics }: NodePerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('customers');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const sortedMetrics = [...metrics];
    sortedMetrics.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;

      switch (sortKey) {
        case 'completion':
          return (a.completionRate - b.completionRate) * direction;
        case 'avgTime':
          return ((a.avgTimeSpent ?? 0) - (b.avgTimeSpent ?? 0)) * direction;
        case 'customers':
        default:
          return (a.customersReached - b.customersReached) * direction;
      }
    });
    return sortedMetrics;
  }, [metrics, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  return (
    <div className="rounded-2xl border border-[#E8E4DE] bg-white/90 p-4 shadow-sm sm:rounded-3xl sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#4A4139] sm:text-lg">Node performance</h2>
          <p className="text-xs text-[#8B7F76] sm:text-sm">Understand how each step contributes to overall conversion.</p>
        </div>
      </header>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[#E8E4DE] sm:mt-5 sm:rounded-2xl">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-[#F6F1EB] text-left text-[10px] uppercase tracking-[0.25em] text-[#A29386] sm:text-[11px]">
            <tr>
              <th className="px-3 py-2.5 sm:px-4 sm:py-3">Node</th>
              <th className="px-3 py-2.5 sm:px-4 sm:py-3">Type</th>
              <th className="px-3 py-2.5 sm:px-4 sm:py-3">
                <SortButton label="Customers" active={sortKey === 'customers'} direction={sortDirection} onClick={() => handleSort('customers')} />
              </th>
              <th className="px-3 py-2.5 sm:px-4 sm:py-3">
                <SortButton label="Completion" active={sortKey === 'completion'} direction={sortDirection} onClick={() => handleSort('completion')} />
              </th>
              <th className="px-3 py-2.5 sm:px-4 sm:py-3">
                <SortButton label="Avg time" active={sortKey === 'avgTime'} direction={sortDirection} onClick={() => handleSort('avgTime')} />
              </th>
              <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Activity</th>
            </tr>
          </thead>
          <tbody>
            {!sorted.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8B7F76]">
                  No performance data available yet.
                </td>
              </tr>
            ) : (
              sorted.map(metric => (
                <tr key={metric.nodeId} className="border-t border-[#EFE8E1]">
                  <td className="px-4 py-4 font-medium text-[#4A4139]">{metric.name}</td>
                  <td className="px-4 py-4 capitalize text-[#8B7F76]">{metric.type}</td>
                  <td className="px-4 py-4 text-[#6F6256]">{metric.customersReached.toLocaleString()}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-[#F2ECE6]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#BE9670] to-[#A0764F]"
                          style={{ width: `${Math.min(100, metric.completionRate)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-[#5F4B3F]">{metric.completionRate.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[#6F6256]">{metric.avgTimeSpent ? `${metric.avgTimeSpent}m` : '—'}</td>
                  <td className="px-4 py-4 text-right text-xs text-[#8B7F76]">
                    {formatActions(metric.actions)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortButton({ label, active, direction, onClick }: { label: string; active: boolean; direction: 'asc' | 'desc'; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn('group flex items-center gap-1 px-0 py-0.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#A29386]',
        active ? 'text-[#5F4B3F]' : 'opacity-70 hover:opacity-100')}
    >
      {label}
      {active ? (
        direction === 'asc' ? <ArrowUpNarrowWide className="h-3 w-3" /> : <ArrowDownNarrowWide className="h-3 w-3" />
      ) : null}
    </Button>
  );
}

function formatActions(actions?: Record<string, number>) {
  if (!actions) return '—';
  const entries = Object.entries(actions).filter(([, count]) => count > 0);
  if (!entries.length) return '—';
  return entries
    .map(([action, count]) => `${readable(action)} (${count})`)
    .join(' • ');
}

function readable(eventType: string) {
  return eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

