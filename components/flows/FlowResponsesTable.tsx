'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Phone,
} from 'lucide-react';

interface FlowResponse {
  id: string;
  phone: string;
  screenId: string;
  responseData: Record<string, unknown>;
  completedAt: string | null;
  createdAt: string;
  contact?: {
    name?: string;
    phone?: string;
  } | null;
}

interface FlowResponsesTableProps {
  flowId: string;
}

export function FlowResponsesTable({ flowId }: FlowResponsesTableProps) {
  const [responses, setResponses] = useState<FlowResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchResponses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/flows/${flowId}/responses?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResponses(data.responses || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch responses:', err);
    } finally {
      setLoading(false);
    }
  }, [flowId, page, searchQuery]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  const handleExportCSV = () => {
    if (responses.length === 0) return;

    const headers = ['Phone', 'Screen', 'Completed', 'Submitted At', 'Response Data'];
    const rows = responses.map((r) => [
      r.phone,
      r.screenId,
      r.completedAt ? 'Yes' : 'No',
      new Date(r.createdAt).toLocaleString(),
      JSON.stringify(r.responseData),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-${flowId}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-gray-100 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold text-gray-900">
            Flow Responses
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by phone..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-56 pl-9 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={responses.length === 0}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex animate-pulse items-center gap-4">
                <div className="h-4 w-28 rounded bg-gray-200" />
                <div className="h-4 w-20 rounded bg-gray-100" />
                <div className="h-4 w-16 rounded bg-gray-100" />
                <div className="h-4 flex-1 rounded bg-gray-50" />
              </div>
            ))}
          </div>
        ) : responses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
              <Phone className="h-6 w-6 text-gray-400" />
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900">No responses yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Responses will appear here once users interact with your flow
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="text-xs font-semibold">Phone</TableHead>
                    <TableHead className="text-xs font-semibold">Screen</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Submitted</TableHead>
                    <TableHead className="text-xs font-semibold">Response Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.map((response) => (
                    <TableRow key={response.id} className="hover:bg-gray-50/50">
                      <TableCell className="text-sm font-medium text-gray-900">
                        {response.contact?.name || response.phone}
                        {response.contact?.name && (
                          <span className="ml-1 text-xs text-gray-400">{response.phone}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="text-[11px] bg-indigo-50 text-indigo-600"
                        >
                          {response.screenId}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {response.completedAt ? (
                          <Badge className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
                            <CheckCircle2 className="h-3 w-3" />
                            Completed
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="gap-1 bg-amber-50 text-amber-700 text-[11px]"
                          >
                            <Clock className="h-3 w-3" />
                            In Progress
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {new Date(response.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <pre className="truncate text-[11px] text-gray-500 font-mono">
                          {JSON.stringify(response.responseData)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
