'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, CheckCircle, RefreshCw, Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

interface ErrorEntry {
  id: string;
  level: string;
  message: string;
  stack: string | null;
  context: any;
  userId: string | null;
  storeId: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

export default function ErrorLogsPage() {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unresolved, setUnresolved] = useState(0);
  const [distribution, setDistribution] = useState({ CRITICAL: 0, ERROR: 0, WARNING: 0, INFO: 0 });
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterResolved, setFilterResolved] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailError, setDetailError] = useState<ErrorEntry | null>(null);

  useEffect(() => { fetchErrors(); }, [page, filterLevel, filterResolved]);

  async function fetchErrors() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (filterLevel !== 'all') params.set('level', filterLevel);
      if (filterResolved !== 'all') params.set('resolved', filterResolved);

      const res = await fetch(`/api/admin/error-logs?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setErrors(data.errors || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setDistribution(data.distribution || {});
        setUnresolved(data.unresolved || 0);
      }
    } catch (err) {
      console.error('Failed to fetch error logs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function bulkAction(action: string) {
    if (selected.size === 0) return;
    try {
      await fetch('/api/admin/error-logs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      setSelected(new Set());
      fetchErrors();
    } catch (err) {
      console.error('Bulk action failed:', err);
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === errors.length) setSelected(new Set());
    else setSelected(new Set(errors.map(e => e.id)));
  }

  const levelColor = (l: string) => {
    switch (l) {
      case 'CRITICAL': return 'bg-red-100 text-red-700';
      case 'ERROR': return 'bg-orange-100 text-orange-700';
      case 'WARNING': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Error Logs</h1>
          <p className="text-gray-500 text-sm">{total} total errors, {unresolved} unresolved</p>
        </div>
        <Button variant="outline" onClick={() => { setPage(1); fetchErrors(); }} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Severity Distribution */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(distribution).map(([level, count]) => (
          <Card key={level} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setFilterLevel(level); setPage(1); }}>
            <CardContent className="pt-6">
              <Badge className={levelColor(level)}>{level}</Badge>
              <div className="text-2xl font-bold mt-2">{count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Bulk Actions */}
      <div className="flex gap-3 flex-wrap items-center">
        <Select value={filterLevel} onValueChange={v => { setFilterLevel(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
            <SelectItem value="WARNING">Warning</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterResolved} onValueChange={v => { setFilterResolved(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="false">Unresolved</SelectItem>
            <SelectItem value="true">Resolved</SelectItem>
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => bulkAction('resolve')} className="gap-1">
              <CheckCircle className="h-3 w-3" /> Mark Resolved ({selected.size})
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkAction('delete')} className="gap-1 text-red-600">
              <Trash2 className="h-3 w-3" /> Delete ({selected.size})
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading errors...</div>
          ) : errors.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No errors found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-3 w-10">
                      <input type="checkbox" checked={selected.size === errors.length && errors.length > 0} onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="text-left p-3 font-medium">Time</th>
                    <th className="text-left p-3 font-medium">Severity</th>
                    <th className="text-left p-3 font-medium">Message</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map(err => (
                    <tr key={err.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <input type="checkbox" checked={selected.has(err.id)} onChange={() => toggleSelect(err.id)} className="rounded" />
                      </td>
                      <td className="p-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(err.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3"><Badge className={levelColor(err.level)}>{err.level}</Badge></td>
                      <td className="p-3 max-w-sm truncate">{err.message}</td>
                      <td className="p-3">
                        {err.resolved
                          ? <Badge className="bg-green-100 text-green-700">Resolved</Badge>
                          : <Badge className="bg-gray-100 text-gray-500">Open</Badge>
                        }
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetailError(err)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailError} onOpenChange={() => setDetailError(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Error Details</DialogTitle>
            <DialogDescription>Full error information</DialogDescription>
          </DialogHeader>
          {detailError && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge className={levelColor(detailError.level)}>{detailError.level}</Badge>
                {detailError.resolved
                  ? <Badge className="bg-green-100 text-green-700">Resolved</Badge>
                  : <Badge className="bg-gray-100 text-gray-500">Open</Badge>
                }
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Message</label>
                <p className="text-sm mt-1">{detailError.message}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Timestamp</label>
                <p className="text-sm mt-1">{new Date(detailError.createdAt).toLocaleString()}</p>
              </div>
              {detailError.storeId && (
                <div>
                  <label className="text-xs font-medium text-gray-500">Store ID</label>
                  <p className="text-sm font-mono mt-1">{detailError.storeId}</p>
                </div>
              )}
              {detailError.stack && (
                <div>
                  <label className="text-xs font-medium text-gray-500">Stack Trace</label>
                  <pre className="text-xs mt-1 bg-gray-50 p-3 rounded overflow-x-auto max-h-60">{detailError.stack}</pre>
                </div>
              )}
              {detailError.context && (
                <div>
                  <label className="text-xs font-medium text-gray-500">Context</label>
                  <pre className="text-xs mt-1 bg-gray-50 p-3 rounded overflow-x-auto max-h-40">{JSON.stringify(detailError.context, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
