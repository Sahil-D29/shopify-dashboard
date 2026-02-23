'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Search, RefreshCw } from 'lucide-react';

interface Template {
  name: string;
  status: string;
  category: string;
  language: string;
  id?: string;
  storeId: string;
  storeName: string;
  components?: any[];
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [totalStores, setTotalStores] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => { fetchTemplates(); }, []);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/templates', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        setTotalStores(data.totalStores || 0);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  }

  const statusColor = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'APPROVED': return 'bg-green-100 text-green-700';
      case 'PENDING': return 'bg-yellow-100 text-yellow-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const catColor = (c: string) => {
    switch (c?.toUpperCase()) {
      case 'MARKETING': return 'bg-purple-100 text-purple-700';
      case 'UTILITY': return 'bg-blue-100 text-blue-700';
      case 'AUTHENTICATION': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const filtered = templates.filter(t => {
    if (search && !t.name?.toLowerCase().includes(search.toLowerCase()) && !t.storeName?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'all' && t.status?.toUpperCase() !== filterStatus) return false;
    if (filterCategory !== 'all' && t.category?.toUpperCase() !== filterCategory) return false;
    return true;
  });

  const approved = templates.filter(t => t.status?.toUpperCase() === 'APPROVED').length;
  const pending = templates.filter(t => t.status?.toUpperCase() === 'PENDING').length;
  const rejected = templates.filter(t => t.status?.toUpperCase() === 'REJECTED').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Templates</h1>
          <p className="text-gray-500 text-sm">Manage templates across {totalStores} configured stores</p>
        </div>
        <Button variant="outline" onClick={fetchTemplates} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Total Templates</div>
            <div className="text-2xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Approved</div>
            <div className="text-2xl font-bold text-green-600">{approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Pending</div>
            <div className="text-2xl font-bold text-yellow-600">{pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Rejected</div>
            <div className="text-2xl font-bold text-red-600">{rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search templates or stores..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="MARKETING">Marketing</SelectItem>
            <SelectItem value="UTILITY">Utility</SelectItem>
            <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-gray-400 p-8 text-center">Loading templates...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-gray-400">No templates found</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((tpl, idx) => (
            <Card key={`${tpl.storeId}-${tpl.name}-${idx}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-medium">{tpl.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{tpl.storeName}</div>
                  </div>
                  <Badge className={statusColor(tpl.status)}>{tpl.status || 'Unknown'}</Badge>
                </div>
                <div className="flex gap-2">
                  <Badge className={catColor(tpl.category)}>{tpl.category || 'N/A'}</Badge>
                  <Badge variant="outline">{tpl.language || 'en'}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
