export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatHours(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value < 1) {
    return `${Math.round(value * 60)} mins`;
  }
  return `${value.toFixed(1)} hrs`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}


