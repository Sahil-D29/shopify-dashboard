'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  UserCheck,
  Search,
  Plus,
  RefreshCw,
  Mail,
  Phone,
  Users,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  Ban,
  Trash2,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';

const EMAIL_API = process.env.NEXT_PUBLIC_EMAIL_API || 'http://localhost:5000/api/email';
const CHANNEL_COLORS = ['#3b82f6', '#10b981', '#8b5cf6'];

interface Subscriber {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  source: string;
  phone?: string;
  whatsappOptIn?: boolean;
  subscribedAt: string;
  tags?: string[];
}

interface SubscriberStats {
  total: number;
  subscribed: number;
  unsubscribed: number;
  suppressed: number;
}

export default function EmailSubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<SubscriberStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');

  const fetchSubscribers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        storeId: 'tsg-api.myshopify.com',
      });
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`${EMAIL_API}/subscribers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSubscribers(data.subscribers || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch subscribers:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${EMAIL_API}/subscribers/stats?storeId=tsg-api.myshopify.com`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchSubscribers();
    fetchStats();
  }, [fetchSubscribers, fetchStats]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`${EMAIL_API}/subscribers/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: 'tsg-api.myshopify.com' }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Synced ${data.synced || 0} subscribers from Shopify`);
        fetchSubscribers();
        fetchStats();
      }
    } catch {
      toast.error('Failed to sync subscribers');
    } finally {
      setSyncing(false);
    }
  }

  async function handleAdd() {
    if (!newEmail.trim()) return;
    try {
      const res = await fetch(`${EMAIL_API}/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          firstName: newFirstName,
          lastName: newLastName,
          storeId: 'tsg-api.myshopify.com',
        }),
      });
      if (res.ok) {
        toast.success('Subscriber added');
        setNewEmail('');
        setNewFirstName('');
        setNewLastName('');
        setShowAddForm(false);
        fetchSubscribers();
        fetchStats();
      }
    } catch {
      toast.error('Failed to add subscriber');
    }
  }

  async function handleSuppress(id: string) {
    try {
      const res = await fetch(`${EMAIL_API}/subscribers/${id}/suppress`, { method: 'POST' });
      if (res.ok) {
        toast.success('Subscriber suppressed');
        fetchSubscribers();
        fetchStats();
      }
    } catch {
      toast.error('Failed to suppress subscriber');
    }
  }

  const emailOnly = subscribers.filter(s => s.status === 'subscribed' && !s.whatsappOptIn).length;
  const whatsappOnly = subscribers.filter(s => s.whatsappOptIn && s.status !== 'subscribed').length;
  const bothChannels = subscribers.filter(s => s.status === 'subscribed' && s.whatsappOptIn).length;
  const totalActive = stats?.subscribed || subscribers.filter(s => s.status === 'subscribed').length;

  const channelData = [
    { name: 'Email Only', value: emailOnly || 1 },
    { name: 'WhatsApp Only', value: whatsappOnly || 0 },
    { name: 'Both Channels', value: bothChannels || 0 },
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800 shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.85) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="relative flex flex-col gap-4 px-8 py-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 text-white">
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <UserCheck className="h-8 w-8" />
                Email Subscribers
              </h1>
              <p className="text-sm text-emerald-100">Manage your email subscriber list and channel preferences</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSync} disabled={syncing} className="bg-white text-teal-700 hover:bg-teal-50">
                <RefreshCw className={cn('h-4 w-4 mr-2', syncing && 'animate-spin')} />
                {syncing ? 'Syncing...' : 'Sync from Shopify'}
              </Button>
              <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Subscriber
              </Button>
            </div>
          </div>
        </div>

        {/* Channel Breakdown Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-gray-500" />
              <p className="text-sm text-gray-500">Total</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats?.total || subscribers.length}</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-5 w-5 text-blue-500" />
              <p className="text-sm text-gray-500">Email Subscribers</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{totalActive}</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-5 w-5 text-green-500" />
              <p className="text-sm text-gray-500">WhatsApp Subs</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{whatsappOnly + bothChannels}</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-5 w-5 text-purple-500" />
              <p className="text-sm text-gray-500">Both Channels</p>
            </div>
            <p className="text-2xl font-bold text-purple-600">{bothChannels}</p>
          </div>
          {/* Mini Donut */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-3 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40} innerRadius={25}>
                  {channelData.map((_, idx) => (
                    <Cell key={idx} fill={CHANNEL_COLORS[idx % CHANNEL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Add New Subscriber</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-500 font-medium mb-1 block">Email *</label>
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 font-medium mb-1 block">First Name</label>
                <Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="First name" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 font-medium mb-1 block">Last Name</label>
                <Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="Last name" />
              </div>
              <Button onClick={handleAdd} className="bg-blue-600 text-white hover:bg-blue-700">Add</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Filters & Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search subscribers..."
                  className="pl-9 w-64"
                />
              </div>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {['all', 'subscribed', 'unsubscribed', 'suppressed'].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setPage(1); }}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-md transition-colors capitalize',
                      statusFilter === s ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : subscribers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <UserCheck className="h-12 w-12 mb-2" />
              <p>No subscribers found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Email</TableHead>
                      <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Name</TableHead>
                      <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Channels</TableHead>
                      <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Status</TableHead>
                      <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Source</TableHead>
                      <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Subscribed</TableHead>
                      <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100">
                    {subscribers.map((sub) => (
                      <TableRow key={sub.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="px-6 py-4 text-sm font-medium text-gray-900">{sub.email}</TableCell>
                        <TableCell className="px-6 py-4 text-sm text-gray-700">
                          {[sub.firstName, sub.lastName].filter(Boolean).join(' ') || '—'}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex gap-1">
                            {sub.status === 'subscribed' && (
                              <Badge className="bg-blue-100 text-blue-700 text-xs">Email</Badge>
                            )}
                            {sub.whatsappOptIn && (
                              <Badge className="bg-green-100 text-green-700 text-xs">WhatsApp</Badge>
                            )}
                            {sub.status !== 'subscribed' && !sub.whatsappOptIn && (
                              <span className="text-xs text-gray-400">None</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge className={cn(
                            'rounded-full px-3 py-1 text-xs font-semibold',
                            sub.status === 'subscribed' ? 'bg-green-100 text-green-700' :
                            sub.status === 'unsubscribed' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          )}>
                            {sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-sm text-gray-500 capitalize">{sub.source}</TableCell>
                        <TableCell className="px-6 py-4 text-sm text-gray-500">
                          {sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          {sub.status === 'subscribed' && (
                            <button onClick={() => handleSuppress(sub.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Suppress">
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
