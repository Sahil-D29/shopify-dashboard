"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

let registered = false;

export function ensureChartJsRegistered() {
  if (registered) {
    return;
  }

  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Legend,
    ArcElement,
    Filler
  );

  ChartJS.defaults.font.family = 'var(--font-sans, Inter, sans-serif)';
  ChartJS.defaults.color = '#475569';
  ChartJS.defaults.plugins.legend.labels.boxWidth = 16;
  registered = true;
}


