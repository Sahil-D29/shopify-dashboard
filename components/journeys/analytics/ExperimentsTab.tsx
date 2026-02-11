"use client";

import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ExperimentResult } from '@/lib/types/analytics';
import { formatNumber, formatPercent } from './utils';

interface ExperimentsTabProps {
  experiments: ExperimentResult[];
}

export function ExperimentsTab({ experiments }: ExperimentsTabProps) {
  const grouped = experiments.reduce<Record<string, ExperimentResult[]>>((acc, item) => {
    if (!acc[item.experimentId]) acc[item.experimentId] = [];
    acc[item.experimentId].push(item);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {Object.keys(grouped).length === 0 ? (
        <Card className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          No experiment data found. Add an A/B test node to start collecting results.
        </Card>
      ) : (
        Object.entries(grouped).map(([experimentId, variants]) => (
          <Card
            key={experimentId}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{variants[0]?.experimentName}</h3>
                <p className="text-sm text-slate-500">
                  Experiment node: <span className="font-medium text-slate-700">{variants[0]?.nodeId}</span>
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">Conversion Rate</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                    <TableHead className="text-right">Lift</TableHead>
                    <TableHead className="text-right">Winner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map(variant => (
                    <TableRow key={variant.variantId}>
                      <TableCell className="font-medium text-slate-900">{variant.variantName}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatNumber(variant.users)}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatNumber(variant.conversions)}</TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatPercent(variant.conversionRate)}
                      </TableCell>
                      <TableCell className="text-right text-slate-600">
                        {formatPercent(variant.confidence * 100)}
                      </TableCell>
                      <TableCell className="text-right text-slate-600">
                        {variant.lift ? `${(variant.lift * 100).toFixed(1)}%` : '—'}
                      </TableCell>
                      <TableCell className="text-right text-slate-900">
                        {variant.isWinner ? 'Yes' : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}


