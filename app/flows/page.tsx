'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Workflow,
  Plus,
  MessageSquare,
  CheckCircle2,
  Clock,
  Send,
  ArrowRight,
} from 'lucide-react';

interface Flow {
  id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
  category: string;
  totalSent: number;
  totalCompleted: number;
  createdAt: string;
  _count?: { responses: number };
}

type FilterTab = 'all' | 'DRAFT' | 'PUBLISHED';

export default function FlowsPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  useEffect(() => {
    fetchFlows();
  }, []);

  async function fetchFlows() {
    try {
      const res = await fetch('/api/flows');
      if (res.ok) {
        const data = await res.json();
        setFlows(data.flows || data || []);
      }
    } catch (err) {
      console.error('Failed to fetch flows:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredFlows =
    activeTab === 'all'
      ? flows
      : flows.filter((f) => f.status === activeTab);

  const statusConfig: Record<
    string,
    { label: string; className: string }
  > = {
    DRAFT: {
      label: 'Draft',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    PUBLISHED: {
      label: 'Published',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    DEPRECATED: {
      label: 'Deprecated',
      className: 'bg-gray-100 text-gray-500 border-gray-200',
    },
  };

  const categoryColors: Record<string, string> = {
    Survey: 'bg-blue-50 text-blue-700 border-blue-200',
    'Lead Generation': 'bg-violet-50 text-violet-700 border-violet-200',
    'Appointment Booking': 'bg-pink-50 text-pink-700 border-pink-200',
    Feedback: 'bg-orange-50 text-orange-700 border-orange-200',
    Custom: 'bg-slate-50 text-slate-600 border-slate-200',
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'DRAFT', label: 'Draft' },
    { key: 'PUBLISHED', label: 'Published' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              WhatsApp Flows
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Create interactive experiences for your customers
            </p>
          </div>
          <Button
            onClick={() => router.push('/flows/create')}
            className="bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Flow
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {tab.key !== 'all' && (
                <span
                  className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs ${
                    activeTab === tab.key
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {flows.filter((f) =>
                    tab.key === 'all' ? true : f.status === tab.key
                  ).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse border-gray-100">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-gray-200" />
                      <div className="h-3 w-1/2 rounded bg-gray-100" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-5 w-16 rounded-full bg-gray-100" />
                    <div className="h-5 w-20 rounded-full bg-gray-100" />
                  </div>
                  <div className="h-px bg-gray-100" />
                  <div className="flex justify-between">
                    <div className="h-3 w-20 rounded bg-gray-100" />
                    <div className="h-3 w-20 rounded bg-gray-100" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredFlows.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
              <Workflow className="h-8 w-8 text-indigo-600" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-gray-900">
              No flows yet
            </h3>
            <p className="mt-2 max-w-sm text-center text-sm text-gray-500">
              Create your first WhatsApp Flow to build interactive experiences
              that engage your customers.
            </p>
            <Button
              onClick={() => router.push('/flows/create')}
              className="mt-6 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Flow
            </Button>
          </div>
        )}

        {/* Flow Cards Grid */}
        {!loading && filteredFlows.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFlows.map((flow) => {
              const status = statusConfig[flow.status] || statusConfig.DRAFT;
              const catColor =
                categoryColors[flow.category] || categoryColors.Custom;
              const responseCount = flow._count?.responses ?? 0;

              return (
                <Card
                  key={flow.id}
                  onClick={() => router.push(`/flows/${flow.id}/builder`)}
                  className="group cursor-pointer border-gray-100 transition-all duration-200 hover:border-indigo-200 hover:shadow-md"
                >
                  <CardContent className="p-6">
                    {/* Top row: icon + name + arrow */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 transition-colors group-hover:bg-indigo-100">
                          <MessageSquare className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-gray-900">
                            {flow.name}
                          </h3>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="h-3 w-3" />
                            {new Date(flow.createdAt).toLocaleDateString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              }
                            )}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                    </div>

                    {/* Badges */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-medium ${status.className}`}
                      >
                        {status.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-medium ${catColor}`}
                      >
                        {flow.category}
                      </Badge>
                      {responseCount > 0 && (
                        <Badge
                          variant="outline"
                          className="border-gray-200 bg-gray-50 text-[11px] font-medium text-gray-600"
                        >
                          {responseCount} response{responseCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="my-4 h-px bg-gray-100" />

                    {/* Analytics row */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Send className="h-3.5 w-3.5 text-blue-400" />
                        <span className="font-medium text-gray-700">
                          {flow.totalSent ?? 0}
                        </span>
                        sent
                      </span>
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="font-medium text-gray-700">
                          {flow.totalCompleted ?? 0}
                        </span>
                        completed
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
