"use client";

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { ChartData, ChartOptions } from 'chart.js';
import { ensureChartJsRegistered } from './register';

const Doughnut = dynamic(
  async () => {
    try {
      const mod = await import('react-chartjs-2');
      return { default: mod.Doughnut };
    } catch (error) {
      console.error('[analytics][DoughnutChart] Failed to load chart component', error);
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

const DOUGHNUT_PALETTE = ['#6366F1', '#22C55E', '#F97316', '#0EA5E9', '#A855F7', '#F43F5E', '#EAB308'];

interface DoughnutChartProps {
  labels: string[];
  values: number[];
  className?: string;
}

export function DoughnutChart({ labels, values, className }: DoughnutChartProps) {
  ensureChartJsRegistered();

  const data = useMemo<ChartData<'doughnut'>>(
    () => ({
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, idx) => DOUGHNUT_PALETTE[idx % DOUGHNUT_PALETTE.length]),
          borderWidth: 0,
        },
      ],
    }),
    [labels, values],
  );

  const options = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
        },
      },
      cutout: '60%',
    }),
    [],
  );

  return (
    <div className={className} style={{ height: 220 }}>
      <Doughnut data={data} options={options} />
    </div>
  );
}


