'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Plus, Search, Loader2, UserMinus, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';

interface Subscriber {
  id: string;
  storeId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'BOUNCED' | 'COMPLAINED' | 'PENDING';
  source: 'SHOPIFY' | 'MANUAL' | 'CSV_IMPORT' | 'SIGNUP_FORM' | 'API';
  tags: string[];
  shopifyCustomerId: string | null;
  syncedFromShopifyAt: string | null;
  subscribedAt: string;
  unsubscribedAt: string | null;
  createdAt: string;
}

interface ListResponse {
  success: boolean;
  subscribers: Subscriber[];
  total: number;
  limit: number;
  offset: number;
  counts: Record<string, number>;
  error?: string;
}

const STATUS_COLORS: Record<string, string> = {
  SUBSCRIBED: 'bg-green-100 text-green-700',
  UNSUBSCRIBED: 'bg-gray-100 text-gray-600',
  BOUNCED: 'bg-orange-100 text-orange-700',
  COMPLAINED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
};

const STATUS_LABELS: Record<string, string> = {
  SUBSCRIBED: 'Subscribed',
  UNSUBSCRIBED: 'Unsubscribed',
  BOUNCED: 'Bounced',
  COMPLAINED: 'Complained',
  PENDING: 'Pending',
};

const SOURCE_LABELS: Record<string, string> = {
  SHOPIFY: 'Shopify',
  MANUAL: 'Manual',
  CSV_IMPORT: 'CSV',
  SIGNUP_FORM: 'Form',
  API: 'API',
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const PAGE_SIZE = 50;

export default function EmailSubscribersPage() {
  const toast = useToast();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [offset, setOffset] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addingEmail, setAddingEmail] = useState('');
  const [addingFirstName, setAddingFirstName] = useState('');
  const [addingLastName, setAddingLastName] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/email/subscribers?${params.toString()}`, {
        cache: 'no-store',
      });
      const data: ListResponse = await res.json().catch(() => ({}) as ListResponse);
      if (!res.ok && !data?.subscribers) {
        throw new Error(data?.error ?? 'Failed to load subscribers');
      }
      setSubscribers(Array.isArray(data.subscribers) ? data.subscribers : []);
      setTotal(data.total ?? 0);
      setCounts(data.counts ?? {});
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load subscribers'));
      setSubscribers([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, offset, toast]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void fetchSubscribers();
    }, 250);
    return () => clearTimeout(handle);
  }, [fetchSubscribers]);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/email/subscribers/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Sync failed');
      toast.success(
        `Sync complete: ${data.imported ?? 0} new, ${data.updated ?? 0} updated`,
      );
      setOffset(0);
      void fetchSubscribers();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to sync from Shopify'));
    } finally {
      setSyncing(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addingEmail.trim()) return;
    setAddBusy(true);
    try {
      const res = await fetch('/api/email/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: addingEmail.trim(),
          firstName: addingFirstName.trim() || null,
          lastName: addingLastName.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to add subscriber');
      toast.success('Subscriber added');
      setAddOpen(false);
      setAddingEmail('');
      setAddingFirstName('');
      setAddingLastName('');
      setOffset(0);
      void fetchSubscribers();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to add subscriber'));
    } finally {
      setAddBusy(false);
    }
  }

  async function handleUnsubscribe(sub: Subscriber) {
    if (!window.confirm(`Unsubscribe ${sub.email}?`)) return;
    setBusyId(sub.id);
    try {
      const res = await fetch(`/api/email/subscribers/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'UNSUBSCRIBED' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to unsubscribe');
      toast.success('Unsubscribed');
      void fetchSubscribers();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to unsubscribe'));
    } finally {
      setBusyId(null);
    }
  }

  const statusOptions: Array<{ value: string; label: string }> = [
    { value: 'all', label: `All (${total})` },
    { value: 'SUBSCRIBED', label: `Subscribed (${counts.SUBSCRIBED ?? 0})` },
    { value: 'UNSUBSCRIBED', label: `Unsubscribed (${counts.UNSUBSCRIBED ?? 0})` },
    { value: 'BOUNCED', label: `Bounced (${counts.BOUNCED ?? 0})` },
    { value: 'COMPLAINED', label: `Complained (${counts.COMPLAINED ?? 0})` },
  ];

  const pageStart = offset + 1;
  const pageEnd = Math.min(offset + subscribers.length, total);
  const hasPrev = offset > 0;
  const hasNext = offset + subscribers.length < total;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Subscribers</h1>
          <p className="mt-1 text-sm text-gray-500">
            {loading ? 'Loading…' : `${total} subscriber${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncing ? 'Syncing…' : 'Sync from Shopify'}
          </Button>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Subscriber
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => {
              setStatusFilter(opt.value);
              setOffset(0);
            }}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
              statusFilter === opt.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          placeholder="Search by email or name…"
          className="pl-9"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : subscribers.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Mail className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="mb-2">
              {total === 0 && search === '' && statusFilter === 'all'
                ? 'No subscribers yet.'
                : 'No subscribers match your filters.'}
            </p>
            {total === 0 && (
              <p className="text-sm">
                Click <strong>Sync from Shopify</strong> to import your existing customers, or{' '}
                <strong>Add Subscriber</strong> manually.
              </p>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Added
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subscribers.map(sub => {
                const name = [sub.firstName, sub.lastName].filter(Boolean).join(' ') || '—';
                return (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/email/subscribers/${sub.id}`}
                        className="text-gray-900 hover:text-indigo-600 font-medium"
                      >
                        {sub.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          STATUS_COLORS[sub.status] ?? 'bg-gray-100 text-gray-600',
                        )}
                      >
                        {STATUS_LABELS[sub.status] ?? sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {SOURCE_LABELS[sub.source] ?? sub.source}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {sub.status === 'SUBSCRIBED' && (
                        <button
                          onClick={() => handleUnsubscribe(sub)}
                          disabled={busyId === sub.id}
                          className="text-xs text-gray-500 hover:text-red-600 inline-flex items-center gap-1 disabled:opacity-50"
                          aria-label={`Unsubscribe ${sub.email}`}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          Unsubscribe
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {subscribers.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            <div>
              Showing {pageStart}-{pageEnd} of {total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={!hasPrev}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={!hasNext}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {addOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !addBusy && setAddOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg mb-4">Add Subscriber</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={addingEmail}
                  onChange={e => setAddingEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={addingFirstName}
                    onChange={e => setAddingFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={addingLastName}
                    onChange={e => setAddingLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                  disabled={addBusy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addBusy} className="gap-2">
                  {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {addBusy ? 'Adding…' : 'Add Subscriber'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
