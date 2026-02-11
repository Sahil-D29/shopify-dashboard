"use client";

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { ChartData, ChartOptions } from 'chart.js';
import { ensureChartJsRegistered } from './register';

const Bar = dynamic(
  async () => {
    try {
      const mod = await import('react-chartjs-2');
      return { default: mod.Bar };
    } catch (error) {
      console.error('[analytics][BarChart] Failed to load chart component', error);
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

interface BarChartProps {
  labels: string[];
  datasetLabel: string;
  values: number[];
  className?: string;
}

export function BarChart({ labels, datasetLabel, values, className }: BarChartProps) {
  ensureChartJsRegistered();

  const data = useMemo<ChartData<'bar'>>(
    () => ({
      labels,
      datasets: [
        {
          label: datasetLabel,
          data: values,
          backgroundColor: '#38BDF8',
          borderRadius: 8,
          maxBarThickness: 32,
        },
      ],
    }),
    [labels, datasetLabel, values],
  );

  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0, minRotation: 0 },
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
    <div className={className} style={{ height: 240 }}>
      <Bar data={data} options={options} />
    </div>
  );
}


