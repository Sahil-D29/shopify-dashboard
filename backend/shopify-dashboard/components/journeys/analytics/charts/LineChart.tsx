"use client";

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { ChartData, ChartOptions } from 'chart.js';
import type { TimelinePoint } from '@/lib/types/analytics';
import { ensureChartJsRegistered } from './register';

const Line = dynamic(
  async () => {
    try {
      const mod = await import('react-chartjs-2');
      return { default: mod.Line };
    } catch (error) {
      console.error('[analytics][LineChart] Failed to load chart component', error);
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

interface LineChartProps {
  data: TimelinePoint[];
  className?: string;
  height?: number;
}

export function LineChart({ data, className, height = 260 }: LineChartProps) {
  ensureChartJsRegistered();

  const chartData = useMemo<ChartData<'line'>>(
    () => ({
      labels: data.map(point => point.date),
      datasets: [
        {
          label: 'Started',
          data: data.map(point => point.started),
          borderColor: '#6366F1',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          tension: 0.35,
          fill: true,
          pointRadius: 3,
        },
        {
          label: 'Completed',
          data: data.map(point => point.completed),
          borderColor: '#22C55E',
          backgroundColor: 'rgba(34, 197, 94, 0.10)',
          tension: 0.35,
          fill: true,
          pointRadius: 3,
        },
        {
          label: 'Goal Achieved',
          data: data.map(point => point.goalAchieved),
          borderColor: '#F97316',
          backgroundColor: 'rgba(249, 115, 22, 0.08)',
          tension: 0.35,
          fill: true,
          pointRadius: 3,
        },
      ],
    }),
    [data],
  );

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          intersect: false,
          mode: 'index',
        },
      },
      interaction: {
        intersect: false,
        mode: 'nearest',
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.25)' },
        },
      },
    }),
    [],
  );

  return (
    <div className={className} style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
}


