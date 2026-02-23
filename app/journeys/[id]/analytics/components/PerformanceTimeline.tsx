"use client";

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

import { cn } from '@/lib/utils';

const LineChart = dynamic(
  async () => {
    try {
      const mod = await import('react-chartjs-2');
      return { default: mod.Line };
    } catch (error) {
      console.error('[PerformanceTimeline] Failed to load chart component', error);
      return {
        default: () => <div className="text-sm text-muted-foreground">Unable to load chart.</div>,
      };
    }
  },
  {
    ssr: false,
    loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading chart…</div>,
  },
);

type TimelinePoint = {
  date: string;
  started: number;
  completed: number;
  goalAchieved: number;
};

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface PerformanceTimelineProps {
  data: TimelinePoint[];
  className?: string;
}

export function PerformanceTimeline({ data, className }: PerformanceTimelineProps) {
  const chartData = useMemo(() => {
    if (!data.length) return null;

    const labels = data.map(point => point.date);

    return {
      labels,
      datasets: [
        {
          label: 'Customers Entered',
          data: data.map(point => point.started),
          borderColor: '#B58154',
          backgroundColor: 'rgba(181,129,84,0.14)',
          tension: 0.35,
          fill: true,
          pointRadius: 3,
        },
        {
          label: 'Completed Journey',
          data: data.map(point => point.completed),
          borderColor: '#4C6458',
          backgroundColor: 'rgba(76,100,88,0.12)',
          tension: 0.35,
          fill: true,
          pointRadius: 3,
        },
        {
          label: 'Goals Achieved',
          data: data.map(point => point.goalAchieved),
          borderColor: '#C17B63',
          backgroundColor: 'rgba(193,123,99,0.12)',
          tension: 0.35,
          fill: true,
          pointRadius: 3,
        },
      ],
    };
  }, [data]);

  return (
    <div className={cn('rounded-2xl border border-[#E8E4DE] bg-white/90 p-4 shadow-sm sm:rounded-3xl sm:p-6', className)}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#4A4139] sm:text-lg">Journey Performance Trend</h2>
          <p className="text-xs text-[#8B7F76] sm:text-sm">Daily view of enrollments, completions, and goals achieved.</p>
        </div>
      </header>

      <div className="mt-4 h-48 sm:mt-6 sm:h-64">
        {chartData ? (
          <LineChart
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  ticks: { color: '#8B7F76' },
                  grid: { color: 'rgba(203, 185, 168, 0.25)' },
                },
                x: {
                  ticks: { color: '#B9AA9F' },
                  grid: { display: false },
                },
              },
              plugins: {
                legend: {
                  position: 'top' as const,
                  labels: { color: '#6F6256', usePointStyle: true, pointStyle: 'circle' },
                },
                tooltip: {
                  callbacks: {
                    label: context => `${context.dataset.label}: ${context.parsed.y?.toLocaleString?.() ?? context.parsed.y}`,
                  },
                },
              },
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[#E0D8CF] bg-white text-sm text-[#8B7F76]">
            Not enough data yet.
          </div>
        )}
      </div>
    </div>
  );
}

