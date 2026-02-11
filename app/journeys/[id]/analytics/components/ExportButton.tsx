"use client";

import { Download } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface ExportButtonProps {
  journeyName: string;
  overview: {
    totalEntered: number;
    active: number;
    completed: number;
    dropped: number;
    goalConversionRate: number;
  };
  timeline: Array<{ date: string; started: number; completed: number; goalAchieved: number }>;
  nodeMetrics: Array<{
    nodeId: string;
    name: string;
    type: string;
    customersReached: number;
    completionRate: number;
    avgTimeSpent: number | null;
  }>;
}

export function ExportButton({ journeyName, overview, timeline, nodeMetrics }: ExportButtonProps) {
  const handleExport = (scope: 'overview' | 'timeline' | 'nodes') => {
    const filename = `${sanitizeFilename(journeyName)}-${scope}-${new Date().toISOString().split('T')[0]}.csv`;
    let csv = '';

    switch (scope) {
      case 'overview':
        csv = exportOverview(overview);
        break;
      case 'timeline':
        csv = exportTimeline(timeline);
        break;
      case 'nodes':
        csv = exportNodes(nodeMetrics);
        break;
      default:
        csv = '';
    }

    if (!csv) return;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="border-[#E8E4DE] bg-white text-[#4A4139] hover:bg-[#F6F1EB]">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => handleExport('overview')}>Overview metrics</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleExport('timeline')}>Timeline</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleExport('nodes')}>Node performance</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function exportOverview(overview: ExportButtonProps['overview']) {
  return toCsv([
    ['Metric', 'Value'],
    ['Total Entered', overview.totalEntered],
    ['Active', overview.active],
    ['Completed', overview.completed],
    ['Dropped', overview.dropped],
    ['Conversion Rate', `${overview.goalConversionRate}%`],
  ]);
}

function exportTimeline(timeline: ExportButtonProps['timeline']) {
  const rows: Array<Array<string | number>> = [['Date', 'Started', 'Completed', 'Goals Achieved']];
  timeline.forEach(point => rows.push([point.date, point.started, point.completed, point.goalAchieved]));
  return toCsv(rows);
}

function exportNodes(nodeMetrics: ExportButtonProps['nodeMetrics']) {
  const rows: Array<Array<string | number>> = [['Node', 'Type', 'Customers Reached', 'Completion Rate', 'Avg Time (m)']];
  nodeMetrics.forEach(metric => {
    rows.push([
      metric.name,
      metric.type,
      metric.customersReached,
      `${metric.completionRate}%`,
      metric.avgTimeSpent ?? '—',
    ]);
  });
  return toCsv(rows);
}

function toCsv(rows: Array<Array<string | number>>) {
  return rows
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
}

