"use client";
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

interface JourneyAnalyticsMetrics {
  totalEnrolled?: number;
  active?: number;
  completed?: number;
  dropped?: number;
  conversionRate?: number;
}

interface JourneyCustomer {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface JourneyAnalyticsResponse {
  journey?: {
    id: string;
    name?: string | null;
  };
  metrics?: JourneyAnalyticsMetrics;
  customers?: JourneyCustomer[];
  error?: string;
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function JourneyAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<JourneyAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/journeys/${id}/analytics`, { cache: 'no-store' });
        const json: JourneyAnalyticsResponse = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? 'Failed to load analytics');
        }
        if (active) {
          setData(json);
        }
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err, 'Failed to load analytics'));
          setData(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [id]);

  const metrics = useMemo(() => data?.metrics ?? {}, [data]);
  const customers = useMemo(() => data?.customers ?? [], [data]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (error || !data) return <div className="p-6">{error ?? 'Failed to load analytics'}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{data.journey?.name ?? 'Journey analytics'}</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Stat title="Enrolled" value={metrics.totalEnrolled ?? 0} />
        <Stat title="Active" value={metrics.active ?? 0} />
        <Stat title="Completed" value={metrics.completed ?? 0} />
        <Stat title="Dropped" value={metrics.dropped ?? 0} />
        <Stat title="Conversion" value={`${metrics.conversionRate ?? 0}%`} />
      </div>

      <div className="rounded border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="p-3">Customer</th>
              <th className="p-3">Email</th>
              <th className="p-3">Phone</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(customer => {
              const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
              return (
                <tr key={customer.id} className="border-b">
                  <td className="p-3">{name || customer.id}</td>
                  <td className="p-3">{customer.email ?? '—'}</td>
                  <td className="p-3">{customer.phone ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

