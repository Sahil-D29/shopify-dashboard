'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Megaphone, Search, RefreshCw, Send, CheckCircle, Eye, MousePointer } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  storeName: string;
  storeId: string;
  segmentName: string | null;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  scheduledAt: string | null;
  executedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  logCount: number;
  queueCount: number;
}

interface Stats {
  total: number;
  active: number;
  totalSent: number;
  totalDelivered: number;
  deliveryRate: number;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, totalSent: 0, totalDelivered: 0, deliveryRate: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => { fetchCampaigns(); }, []);

  async function fetchCampaigns() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/campaigns', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        setStats(data.stats || {});
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  }

  const statusColor = (s: string) => {
    switch (s) {
      case 'RUNNING': return 'bg-blue-100 text-blue-700';
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'FAILED': return 'bg-red-100 text-red-700';
      case 'SCHEDULED': case 'QUEUED': return 'bg-yellow-100 text-yellow-700';
      case 'DRAFT': return 'bg-gray-100 text-gray-500';
      case 'CANCELLED': return 'bg-gray-100 text-gray-400';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const typeColor = (t: string) => {
    switch (t) {
      case 'WHATSAPP': return 'bg-green-100 text-green-700';
      case 'EMAIL': return 'bg-blue-100 text-blue-700';
      case 'SMS': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const filtered = campaigns.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.storeName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaign Overview</h1>
          <p className="text-gray-500 text-sm">Monitor campaigns across all stores</p>
        </div>
        <Button variant="outline" onClick={fetchCampaigns} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500"><Megaphone className="h-4 w-4" /> Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 ">Active</div>
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500"><Send className="h-4 w-4" /> Sent</div>
            <div className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500"><CheckCircle className="h-4 w-4" /> Delivered</div>
            <div className="text-2xl font-bold text-green-600">{stats.totalDelivered.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Delivery Rate</div>
            <div className="text-2xl font-bold">{stats.deliveryRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search campaigns or stores..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="QUEUED">Queued</SelectItem>
            <SelectItem value="RUNNING">Running</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading campaigns...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No campaigns found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium">Campaign</th>
                    <th className="text-left p-3 font-medium">Store</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Sent</th>
                    <th className="text-right p-3 font-medium">Delivered</th>
                    <th className="text-right p-3 font-medium">Opened</th>
                    <th className="text-right p-3 font-medium">Clicked</th>
                    <th className="text-left p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium">{c.name}</div>
                        {c.segmentName && <div className="text-xs text-gray-400">Segment: {c.segmentName}</div>}
                      </td>
                      <td className="p-3 text-gray-600">{c.storeName}</td>
                      <td className="p-3"><Badge className={typeColor(c.type)}>{c.type}</Badge></td>
                      <td className="p-3"><Badge className={statusColor(c.status)}>{c.status}</Badge></td>
                      <td className="p-3 text-right">{c.totalSent.toLocaleString()}</td>
                      <td className="p-3 text-right text-green-600">{c.totalDelivered.toLocaleString()}</td>
                      <td className="p-3 text-right">{c.totalOpened.toLocaleString()}</td>
                      <td className="p-3 text-right">{c.totalClicked.toLocaleString()}</td>
                      <td className="p-3 text-gray-500 whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
