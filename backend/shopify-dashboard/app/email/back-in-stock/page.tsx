'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BellRing,
  Search,
  Package,
  Users,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

const EMAIL_API = process.env.NEXT_PUBLIC_EMAIL_API || 'http://localhost:5000/api/email';

interface WaitlistItem {
  productId: string;
  productTitle: string;
  productImage?: string;
  variantId?: string;
  variantTitle?: string;
  subscriberCount: number;
  currentInventory: number;
  lastNotified?: string;
  status: string;
}

export default function BackInStockPage() {
  const [waitlist, setWaitlist] = useState<WaitlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [checking, setChecking] = useState(false);

  const fetchWaitlist = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${EMAIL_API}/back-in-stock/waitlist?storeId=tsg-api.myshopify.com`);
      if (res.ok) {
        const data = await res.json();
        setWaitlist(data.waitlist || []);
      }
    } catch (err) {
      console.error('Failed to fetch waitlist:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWaitlist();
  }, [fetchWaitlist]);

  async function handleCheckInventory() {
    setChecking(true);
    try {
      const res = await fetch(`${EMAIL_API}/back-in-stock/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: 'tsg-api.myshopify.com' }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Checked ${data.checked || 0} products. ${data.notified || 0} notifications sent.`);
        fetchWaitlist();
      }
    } catch {
      toast.error('Failed to check inventory');
    } finally {
      setChecking(false);
    }
  }

  async function handleNotify(productId: string) {
    try {
      const res = await fetch(`${EMAIL_API}/back-in-stock/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, storeId: 'tsg-api.myshopify.com' }),
      });
      if (res.ok) {
        toast.success('Notifications sent!');
        fetchWaitlist();
      }
    } catch {
      toast.error('Failed to send notifications');
    }
  }

  const filtered = waitlist.filter(w => w.productTitle.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-700 to-emerald-800 shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.85) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="relative flex flex-col gap-4 px-8 py-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 text-white">
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <BellRing className="h-8 w-8" />
                Back-in-Stock Alerts
              </h1>
              <p className="text-sm text-cyan-100">Automatically notify customers when products are restocked</p>
            </div>
            <Button onClick={handleCheckInventory} disabled={checking} className="bg-white text-teal-700 hover:bg-teal-50">
              <RefreshCw className={cn('h-4 w-4 mr-2', checking && 'animate-spin')} />
              {checking ? 'Checking...' : 'Check Inventory'}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-5 w-5 text-gray-500" />
              <p className="text-sm text-gray-500">Products Watched</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{waitlist.length}</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-blue-500" />
              <p className="text-sm text-gray-500">Total Waitlisted</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{waitlist.reduce((sum, w) => sum + w.subscriberCount, 0)}</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <p className="text-sm text-gray-500">In Stock Now</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{waitlist.filter(w => w.currentInventory > 0).length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-9" />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <BellRing className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium text-gray-700">No waitlisted products</p>
              <p className="text-sm">Customers will be added when they sign up for back-in-stock alerts</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Product</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Waitlisted</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Inventory</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Status</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <TableRow key={item.productId} className="hover:bg-gray-50">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {item.productImage ? (
                          <img src={item.productImage} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-300" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.productTitle}</p>
                          {item.variantTitle && <p className="text-xs text-gray-500">{item.variantTitle}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm font-semibold text-gray-900">{item.subscriberCount}</TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge className={cn('text-xs', item.currentInventory > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                        {item.currentInventory > 0 ? `${item.currentInventory} in stock` : 'Out of stock'}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {item.lastNotified ? (
                        <span className="text-xs text-gray-500">Notified {new Date(item.lastNotified).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-xs text-gray-400">Never notified</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {item.currentInventory > 0 && (
                        <Button size="sm" variant="outline" onClick={() => handleNotify(item.productId)}>
                          <Send className="h-4 w-4 mr-1" /> Notify
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
