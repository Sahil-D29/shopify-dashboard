"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity, ArrowLeft, BarChart3, CheckCircle2, Clock, Copy,
  ExternalLink, FileText, Loader2, Pause, Pencil, Play, Settings2,
  Target, Trash2, TrendingUp, Users, XCircle, AlertTriangle,
  ChevronRight, Search, ChevronLeft, ChevronRight as ChevronRightIcon,
  Zap, Timer, GitBranch, MessageSquare
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/hooks/useToast';

interface JourneyNode {
  id: string;
  type: string;
  subtype?: string;
  label?: string;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
  [key: string]: unknown;
}

interface JourneyEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

interface JourneyData {
  id: string;
  name: string;
  description?: string;
  status: string;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  config?: {
    reEntryRules?: { allow?: boolean; cooldownDays?: number };
    maxEnrollments?: number | null;
    timezone?: string;
  };
  settings?: Record<string, unknown>;
  stats?: {
    totalEnrollments: number;
    activeEnrollments: number;
    completedEnrollments: number;
    goalConversionRate: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface AnalyticsMetrics {
  totalEnrolled?: number;
  active?: number;
  completed?: number;
  dropped?: number;
  conversionRate?: number;
}

interface Enrollment {
  id: string;
  customerId: string;
  customerEmail?: string;
  customerPhone?: string;
  currentNode?: string;
  status: string;
  enteredAt: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

interface ActivityLog {
  id: string;
  enrollmentId?: string;
  timestamp: string;
  eventType: string;
  data?: Record<string, unknown>;
  customerEmail?: string;
  customerPhone?: string;
}

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 border-green-200',
  PAUSED: 'bg-amber-100 text-amber-700 border-amber-200',
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  ARCHIVED: 'bg-slate-100 text-slate-600 border-slate-200',
};

const enrollmentStatusStyles: Record<string, string> = {
  ACTIVE: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  exited: 'bg-gray-100 text-gray-600',
};

const logStatusStyles: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  SKIPPED: 'bg-gray-100 text-gray-600',
};

const nodeTypeIcons: Record<string, typeof Zap> = {
  trigger: Zap,
  action: MessageSquare,
  delay: Timer,
  wait: Timer,
  condition: GitBranch,
  decision: GitBranch,
  goal: Target,
  exit: XCircle,
  experiment: Activity,
};

const nodeTypeColors: Record<string, string> = {
  trigger: 'bg-green-100 text-green-700 border-green-200',
  action: 'bg-blue-100 text-blue-700 border-blue-200',
  delay: 'bg-gray-100 text-gray-600 border-gray-200',
  wait: 'bg-gray-100 text-gray-600 border-gray-200',
  condition: 'bg-amber-100 text-amber-700 border-amber-200',
  decision: 'bg-amber-100 text-amber-700 border-amber-200',
  goal: 'bg-orange-100 text-orange-700 border-orange-200',
  exit: 'bg-slate-100 text-slate-600 border-slate-200',
  experiment: 'bg-purple-100 text-purple-700 border-purple-200',
};

export default function JourneyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const id = params?.id;

  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [metrics, setMetrics] = useState<AnalyticsMetrics>({});
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentTotal, setEnrollmentTotal] = useState(0);
  const [enrollmentPage, setEnrollmentPage] = useState(1);
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState('all');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(enrollmentTotal / pageSize));

  // Load journey data
  useEffect(() => {
    if (!id) return;
    let active = true;

    const loadJourney = async () => {
      setLoading(true);
      try {
        const [journeyRes, analyticsRes] = await Promise.all([
          fetch(`/api/journeys/${id}`, { cache: 'no-store' }),
          fetch(`/api/journeys/${id}/analytics`, { cache: 'no-store' }),
        ]);

        if (journeyRes.ok) {
          const jData = await journeyRes.json();
          if (active) setJourney(jData.journey || jData);
        }

        if (analyticsRes.ok) {
          const aData = await analyticsRes.json();
          if (active) setMetrics(aData.metrics || aData.overview || {});
        }
      } catch (err) {
        console.error('Failed to load journey:', err);
        if (active) toast.error('Failed to load journey details');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadJourney();
    return () => { active = false; };
  }, [id, toast]);

  // Load enrollments when tab changes
  useEffect(() => {
    if (activeTab !== 'enrollments' || !id) return;
    loadEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id, enrollmentPage, enrollmentStatusFilter]);

  // Load activity when tab changes
  useEffect(() => {
    if (activeTab !== 'activity' || !id) return;
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  const loadEnrollments = async () => {
    setEnrollmentsLoading(true);
    try {
      const statusParam = enrollmentStatusFilter !== 'all' ? `&status=${enrollmentStatusFilter}` : '';
      const res = await fetch(`/api/journeys/${id}/enrollments?page=${enrollmentPage}&pageSize=${pageSize}${statusParam}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setEnrollments(data.data || []);
        setEnrollmentTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load enrollments:', err);
    } finally {
      setEnrollmentsLoading(false);
    }
  };

  const loadActivity = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/journeys/${id}/activity?limit=50`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setActivityLogs(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const filteredEnrollments = useMemo(() => {
    if (!enrollmentSearch.trim()) return enrollments;
    const q = enrollmentSearch.toLowerCase();
    return enrollments.filter(e =>
      e.customerEmail?.toLowerCase().includes(q) ||
      e.customerPhone?.includes(q) ||
      e.customerId?.toLowerCase().includes(q)
    );
  }, [enrollments, enrollmentSearch]);

  const handleStatusChange = useCallback(async (newStatus: 'ACTIVE' | 'PAUSED') => {
    if (!id) return;
    try {
      setActionLoading(newStatus);
      const endpoint = newStatus === 'ACTIVE' ? `/api/journeys/${id}/activate` : `/api/journeys/${id}/pause`;
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
      if (!res.ok) throw new Error('Failed');
      setJourney(prev => prev ? { ...prev, status: newStatus } : null);
      toast.success(newStatus === 'ACTIVE' ? 'Journey activated' : 'Journey paused');
    } catch {
      toast.error('Failed to update journey status');
    } finally {
      setActionLoading(null);
    }
  }, [id, toast]);

  const handleDuplicate = useCallback(async () => {
    if (!id) return;
    try {
      setActionLoading('duplicate');
      const res = await fetch(`/api/journeys/${id}/duplicate`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.journey) throw new Error('Failed');
      toast.success('Journey duplicated');
      router.push(`/journeys/${data.journey.id}/builder`);
    } catch {
      toast.error('Failed to duplicate journey');
    } finally {
      setActionLoading(null);
    }
  }, [id, router, toast]);

  const handleDelete = useCallback(async () => {
    if (!id || !confirm('Delete this journey? This action cannot be undone.')) return;
    try {
      setActionLoading('delete');
      const res = await fetch(`/api/journeys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Journey deleted');
      router.push('/journeys');
    } catch {
      toast.error('Failed to delete journey');
    } finally {
      setActionLoading(null);
    }
  }, [id, router, toast]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading journey details...</span>
        </div>
      </div>
    );
  }

  if (!journey) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <h2 className="text-lg font-semibold text-slate-800">Journey not found</h2>
        <Button variant="outline" asChild><Link href="/journeys">Back to Journeys</Link></Button>
      </div>
    );
  }

  const statusBadge = statusStyles[journey.status] || statusStyles.DRAFT;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/85 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
          {/* Top Row: Back + Title + Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="sm" className="shrink-0 text-slate-500 hover:text-slate-900" asChild>
                <Link href="/journeys"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-slate-900 truncate sm:text-2xl">{journey.name}</h1>
                  <Badge className={cn('border px-2 py-0.5 text-xs shrink-0', statusBadge)}>{journey.status}</Badge>
                </div>
                {journey.description && (
                  <p className="text-sm text-slate-500 truncate mt-0.5">{journey.description}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                <Link href={`/journeys/${id}/builder`}><Pencil className="mr-1 h-3 w-3" />Builder</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                <Link href={`/journeys/${id}/analytics`}><BarChart3 className="mr-1 h-3 w-3" />Analytics</Link>
              </Button>
              {journey.status === 'ACTIVE' ? (
                <Button variant="outline" size="sm" className="h-8 text-xs border-amber-300 text-amber-600 hover:bg-amber-50" onClick={() => handleStatusChange('PAUSED')} disabled={!!actionLoading}>
                  <Pause className="mr-1 h-3 w-3" />{actionLoading === 'PAUSED' ? '...' : 'Pause'}
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="h-8 text-xs border-green-300 text-green-600 hover:bg-green-50" onClick={() => handleStatusChange('ACTIVE')} disabled={!!actionLoading}>
                  <Play className="mr-1 h-3 w-3" />{actionLoading === 'ACTIVE' ? '...' : 'Activate'}
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleDuplicate} disabled={!!actionLoading}>
                <Copy className="mr-1 h-3 w-3" />Duplicate
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={handleDelete} disabled={!!actionLoading}>
                <Trash2 className="mr-1 h-3 w-3" />Delete
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
            <StatCard icon={Users} title="Enrolled" value={metrics.totalEnrolled ?? journey.stats?.totalEnrollments ?? 0} color="text-blue-600" bg="bg-blue-50" />
            <StatCard icon={Activity} title="Active" value={metrics.active ?? journey.stats?.activeEnrollments ?? 0} color="text-green-600" bg="bg-green-50" />
            <StatCard icon={CheckCircle2} title="Completed" value={metrics.completed ?? journey.stats?.completedEnrollments ?? 0} color="text-emerald-600" bg="bg-emerald-50" />
            <StatCard icon={XCircle} title="Failed" value={metrics.dropped ?? 0} color="text-red-600" bg="bg-red-50" />
            <StatCard icon={TrendingUp} title="Conversion" value={`${metrics.conversionRate ?? journey.stats?.goalConversionRate ?? 0}%`} color="text-purple-600" bg="bg-purple-50" />
            <StatCard icon={Target} title="Steps" value={journey.nodes.length} color="text-amber-600" bg="bg-amber-50" />
          </div>
        </div>
      </header>

      {/* Tabbed Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <div className="overflow-x-auto">
            <TabsList className="bg-white border border-slate-200 shadow-sm">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
              <TabsTrigger value="enrollments" className="text-xs sm:text-sm">Enrollments</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-5">
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
              {/* Journey Flow */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-slate-500" />
                    Journey Flow
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {journey.nodes.length === 0 ? (
                      <p className="text-sm text-slate-500 py-4 text-center">No nodes configured yet.</p>
                    ) : (
                      journey.nodes.slice(0, 12).map((node, idx) => {
                        const NodeIcon = nodeTypeIcons[node.type] || Zap;
                        const colorClass = nodeTypeColors[node.type] || 'bg-gray-100 text-gray-600 border-gray-200';
                        return (
                          <div key={node.id}>
                            <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 sm:p-3">
                              <div className={cn('rounded-lg border p-1.5 shrink-0', colorClass)}>
                                <NodeIcon className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-800 truncate">
                                  {node.label || node.data?.label as string || `${node.type}${node.subtype ? ` (${node.subtype})` : ''}`}
                                </p>
                                <p className="text-[10px] text-slate-500 capitalize">{node.type}</p>
                              </div>
                            </div>
                            {idx < journey.nodes.length - 1 && idx < 11 && (
                              <div className="flex justify-center py-0.5">
                                <div className="h-3 w-px bg-slate-300" />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    {journey.nodes.length > 12 && (
                      <p className="text-xs text-slate-500 text-center pt-1">
                        +{journey.nodes.length - 12} more steps
                      </p>
                    )}
                  </div>
                  <Button variant="outline" className="w-full mt-4 text-xs" asChild>
                    <Link href={`/journeys/${id}/builder`}>
                      <ExternalLink className="mr-1 h-3 w-3" />Open in Builder
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Journey Info */}
              <div className="space-y-5">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-slate-500" />
                      Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <InfoRow label="Status" value={
                        <Badge className={cn('border px-2 py-0.5 text-xs', statusBadge)}>{journey.status}</Badge>
                      } />
                      <InfoRow label="Nodes" value={`${journey.nodes.length} steps`} />
                      <InfoRow label="Connections" value={`${journey.edges.length} edges`} />
                      <InfoRow label="Re-entry" value={journey.config?.reEntryRules?.allow ? `Allowed (${journey.config.reEntryRules.cooldownDays || 0}d cooldown)` : 'Not allowed'} />
                      <InfoRow label="Max Enrollments" value={journey.config?.maxEnrollments ? journey.config.maxEnrollments.toLocaleString() : 'Unlimited'} />
                      <InfoRow label="Timezone" value={journey.config?.timezone || 'UTC'} />
                      {journey.createdAt && <InfoRow label="Created" value={new Date(journey.createdAt).toLocaleDateString()} />}
                      {journey.updatedAt && <InfoRow label="Last Updated" value={new Date(journey.updatedAt).toLocaleString()} />}
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" className="w-full justify-start text-sm" asChild>
                      <Link href={`/journeys/${id}/builder`}><Pencil className="mr-2 h-4 w-4 text-blue-500" />Edit in Builder</Link>
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-sm" asChild>
                      <Link href={`/journeys/${id}/analytics`}><BarChart3 className="mr-2 h-4 w-4 text-purple-500" />View Analytics</Link>
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-sm" onClick={handleDuplicate} disabled={!!actionLoading}>
                      <Copy className="mr-2 h-4 w-4 text-green-500" />Duplicate Journey
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Enrollments Tab */}
          <TabsContent value="enrollments" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">Enrollments ({enrollmentTotal})</CardTitle>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Search by email/phone..."
                        value={enrollmentSearch}
                        onChange={e => setEnrollmentSearch(e.target.value)}
                        className="pl-8 h-8 text-xs w-full sm:w-56"
                      />
                    </div>
                    <select
                      value={enrollmentStatusFilter}
                      onChange={e => { setEnrollmentStatusFilter(e.target.value); setEnrollmentPage(1); }}
                      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                      <option value="exited">Exited</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {enrollmentsLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading enrollments...
                  </div>
                ) : filteredEnrollments.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-500">
                    No enrollments found. Customers will appear here once they enter the journey.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <table className="w-full text-sm min-w-[600px]">
                        <thead>
                          <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                            <th className="px-3 py-2.5 font-medium">Customer</th>
                            <th className="px-3 py-2.5 font-medium">Status</th>
                            <th className="px-3 py-2.5 font-medium">Current Node</th>
                            <th className="px-3 py-2.5 font-medium">Enrolled At</th>
                            <th className="px-3 py-2.5 font-medium">Completed At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEnrollments.map(enrollment => (
                            <tr key={enrollment.id} className="border-b hover:bg-slate-50/50">
                              <td className="px-3 py-2.5">
                                <div>
                                  <p className="font-medium text-slate-800 text-xs">{enrollment.customerEmail || enrollment.customerId}</p>
                                  {enrollment.customerPhone && <p className="text-[10px] text-slate-500">{enrollment.customerPhone}</p>}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <Badge className={cn('text-[10px] px-1.5 py-0.5', enrollmentStatusStyles[enrollment.status] || 'bg-gray-100 text-gray-600')}>
                                  {enrollment.status}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-600">{enrollment.currentNode || '—'}</td>
                              <td className="px-3 py-2.5 text-xs text-slate-500">
                                {new Date(enrollment.enteredAt).toLocaleString()}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-500">
                                {enrollment.completedAt ? new Date(enrollment.completedAt).toLocaleString() : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-3 border-t">
                        <p className="text-xs text-slate-500">
                          Page {enrollmentPage} of {totalPages} ({enrollmentTotal} total)
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={enrollmentPage <= 1}
                            onClick={() => setEnrollmentPage(p => p - 1)}
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={enrollmentPage >= totalPages}
                            onClick={() => setEnrollmentPage(p => p + 1)}
                          >
                            <ChevronRightIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-500" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading activity...
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-500">
                    No activity yet. Events will appear here as customers move through the journey.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activityLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                        <div className="mt-0.5 shrink-0">
                          <div className={cn(
                            'rounded-full p-1.5',
                            log.eventType?.includes('fail') || log.eventType?.includes('error') ? 'bg-red-100 text-red-600'
                              : log.eventType?.includes('complet') ? 'bg-green-100 text-green-600'
                              : log.eventType?.includes('enter') || log.eventType?.includes('start') ? 'bg-blue-100 text-blue-600'
                              : 'bg-slate-100 text-slate-500'
                          )}>
                            <Activity className="h-3 w-3" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-medium text-slate-800">{formatEventType(log.eventType)}</p>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                            {log.customerEmail && <span>{log.customerEmail}</span>}
                            {log.customerPhone && <span>{log.customerPhone}</span>}
                            {log.data?.nodeId ? <span>Node: {String(log.data.nodeId)}</span> : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Journey Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Journey ID" value={<code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{journey.id}</code>} />
                  <InfoRow label="Status" value={<Badge className={cn('border px-2 py-0.5 text-xs', statusBadge)}>{journey.status}</Badge>} />
                  <InfoRow label="Total Nodes" value={`${journey.nodes.length}`} />
                  <InfoRow label="Total Edges" value={`${journey.edges.length}`} />
                  <InfoRow label="Re-entry" value={journey.config?.reEntryRules?.allow ? 'Allowed' : 'Not allowed'} />
                  {journey.config?.reEntryRules?.allow && (
                    <InfoRow label="Re-entry Cooldown" value={`${journey.config.reEntryRules.cooldownDays || 0} days`} />
                  )}
                  <InfoRow label="Max Enrollments" value={journey.config?.maxEnrollments ? `${journey.config.maxEnrollments}` : 'Unlimited'} />
                  <InfoRow label="Timezone" value={journey.config?.timezone || 'UTC'} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Trigger Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const triggerNode = journey.nodes.find(n => n.type === 'trigger');
                    if (!triggerNode) return <p className="text-sm text-slate-500">No trigger configured</p>;

                    return (
                      <div className="space-y-3">
                        <InfoRow label="Type" value={triggerNode.subtype || triggerNode.type} />
                        <InfoRow label="Node ID" value={<code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{triggerNode.id}</code>} />
                        {triggerNode.label && <InfoRow label="Label" value={triggerNode.label} />}
                      </div>
                    );
                  })()}
                  <Button variant="outline" className="w-full mt-4 text-sm" asChild>
                    <Link href={`/journeys/${id}/builder`}><Pencil className="mr-2 h-4 w-4" />Edit in Builder</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, title, value, color, bg }: { icon: typeof Users; title: string; value: number | string; color: string; bg: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 sm:rounded-xl sm:p-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={cn('rounded-lg p-1.5 shrink-0 sm:p-2', bg)}>
          <Icon className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', color)} />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 sm:text-xs">{title}</p>
          <p className="text-lg font-semibold text-slate-900 sm:text-xl">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-xs font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}

function formatEventType(eventType: string): string {
  return eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
