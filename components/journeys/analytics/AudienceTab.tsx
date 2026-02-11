"use client";

import { Card } from '@/components/ui/card';
import type {
  AudienceSegmentBreakdown,
  AudienceGeographyBreakdown,
  AudienceDeviceBreakdown,
  AudienceCohortPoint,
} from '@/lib/types/analytics';
import { DoughnutChart } from './charts/DoughnutChart';
import { formatNumber, formatPercent } from './utils';

interface AudienceTabProps {
  segments: AudienceSegmentBreakdown[];
  geography: AudienceGeographyBreakdown[];
  devices: AudienceDeviceBreakdown[];
  cohorts: AudienceCohortPoint[];
}

export function AudienceTab({ segments, geography, devices, cohorts }: AudienceTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-6 lg:grid-cols-[1.3fr,1fr]">
        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Top Segments</h3>
          {segments.length === 0 ? (
            <p className="text-sm text-slate-500">No segment data available yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-[1.2fr,1fr]">
              <div className="space-y-3">
                {segments.map(segment => (
                  <div
                    key={segment.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{segment.label}</p>
                      <p className="text-xs text-slate-500">{formatNumber(segment.users)} users</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{formatPercent(segment.percentage)}</span>
                  </div>
                ))}
              </div>
              <DoughnutChart labels={segments.map(item => item.label)} values={segments.map(item => item.users)} />
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Device Mix</h3>
          {devices.length === 0 ? (
            <p className="text-sm text-slate-500">No device data available yet.</p>
          ) : (
            <div className="space-y-3">
              {devices.map(device => (
                <div key={device.device} className="flex items-center justify-between text-sm text-slate-600">
                  <span className="capitalize text-slate-500">{device.device}</span>
                  <span className="text-slate-900">
                    {formatNumber(device.users)} · {formatPercent(device.percentage)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Geography</h3>
          {geography.length === 0 ? (
            <p className="text-sm text-slate-500">No geography data available yet.</p>
          ) : (
            <div className="space-y-2">
              {geography.map(country => (
                <div
                  key={country.country}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600"
                >
                  <span>{country.country}</span>
                  <span className="text-slate-900">
                    {formatNumber(country.users)} · {formatPercent(country.percentage)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Cohort Retention</h3>
          {cohorts.length === 0 ? (
            <p className="text-sm text-slate-500">Not enough cohort data yet.</p>
          ) : (
            <div className="space-y-2">
              {cohorts.map(cohort => (
                <div key={cohort.cohort} className="space-y-1 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>{cohort.cohort}</span>
                    <span className="font-semibold text-slate-900">{formatPercent(cohort.retention)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${Math.min(cohort.retention, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}


