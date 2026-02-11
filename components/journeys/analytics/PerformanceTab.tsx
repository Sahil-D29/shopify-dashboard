"use client";

import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { NodePerformance, MessagePerformance } from '@/lib/types/analytics';
import { BarChart } from './charts/BarChart';
import { formatNumber, formatPercent, formatHours } from './utils';

interface PerformanceTabProps {
  nodePerformance: NodePerformance[];
  messagePerformance: MessagePerformance[];
}

export function PerformanceTab({ nodePerformance, messagePerformance }: PerformanceTabProps) {
  const topNodes = nodePerformance.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Node Performance</h3>
            <p className="text-sm text-slate-500">Conversion and drop-off across journey nodes</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Node</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Reached</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Conversion</TableHead>
                  <TableHead className="text-right">Drop-off</TableHead>
                  <TableHead className="text-right">Avg Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nodePerformance.map(node => (
                  <TableRow key={node.nodeId}>
                    <TableCell className="font-medium text-slate-900">{node.nodeName}</TableCell>
                    <TableCell className="capitalize text-slate-500">{node.nodeType}</TableCell>
                    <TableCell className="text-right text-slate-700">{formatNumber(node.usersReached)}</TableCell>
                    <TableCell className="text-right text-slate-700">{formatNumber(node.usersCompleted)}</TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {formatPercent(node.conversionRate ?? 0)}
                    </TableCell>
                    <TableCell className="text-right text-rose-500">{formatPercent(node.dropOffRate)}</TableCell>
                    <TableCell className="text-right text-slate-500">{formatHours(node.averageTimeSpent ?? 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Top Performing Nodes</h3>
            <p className="text-sm text-slate-500">Highest conversion rates</p>
          </div>
          <BarChart
            labels={topNodes.map(node => node.nodeName)}
            values={topNodes.map(node => node.conversionRate ?? 0)}
            datasetLabel="Conversion Rate"
            className="mt-2"
          />
        </Card>
      </section>

      <section>
        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Message Performance</h3>
            <p className="text-sm text-slate-500">Channel level engagement metrics</p>
          </div>
          {messagePerformance.length === 0 ? (
            <p className="text-sm text-slate-500">No messaging data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Opened</TableHead>
                    <TableHead className="text-right">Clicked</TableHead>
                    <TableHead className="text-right">Replies</TableHead>
                    <TableHead className="text-right">Delivery Rate</TableHead>
                    <TableHead className="text-right">Open Rate</TableHead>
                    <TableHead className="text-right">Click Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messagePerformance.map(channel => (
                    <TableRow key={channel.channel}>
                      <TableCell className="capitalize text-slate-900">{channel.channel}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatNumber(channel.sent)}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatNumber(channel.delivered)}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatNumber(channel.opened ?? 0)}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatNumber(channel.clicked ?? 0)}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatNumber(channel.replied ?? 0)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatPercent(channel.deliveryRate)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatPercent(channel.openRate ?? 0)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatPercent(channel.clickRate ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}


