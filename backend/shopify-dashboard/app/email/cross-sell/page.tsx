'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRightLeft,
  Plus,
  Trash2,
  Package,
  ArrowRight,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';

const EMAIL_API = process.env.NEXT_PUBLIC_EMAIL_API || 'http://localhost:5000/api/email';

interface CrossSellRule {
  id: string;
  name: string;
  triggerProductId: string;
  triggerProductTitle: string;
  recommendedProducts: Array<{
    id: string;
    title: string;
    image?: string;
    price?: string;
  }>;
  enabled: boolean;
  priority: number;
  createdAt: string;
}

export default function CrossSellRulesPage() {
  const [rules, setRules] = useState<CrossSellRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [triggerProduct, setTriggerProduct] = useState('');
  const [recommendedIds, setRecommendedIds] = useState('');

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${EMAIL_API}/cross-sell/rules?storeId=tsg-api.myshopify.com`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error('Failed to fetch rules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  async function handleCreate() {
    if (!newName.trim() || !triggerProduct.trim()) {
      toast.error('Name and trigger product are required');
      return;
    }
    try {
      const res = await fetch(`${EMAIL_API}/cross-sell/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          triggerProductId: triggerProduct,
          recommendedProductIds: recommendedIds.split(',').map(s => s.trim()).filter(Boolean),
          storeId: 'tsg-api.myshopify.com',
        }),
      });
      if (res.ok) {
        toast.success('Cross-sell rule created!');
        setShowCreate(false);
        setNewName('');
        setTriggerProduct('');
        setRecommendedIds('');
        fetchRules();
      }
    } catch {
      toast.error('Failed to create rule');
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    try {
      const res = await fetch(`${EMAIL_API}/cross-sell/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (res.ok) {
        toast.success(enabled ? 'Rule disabled' : 'Rule enabled');
        fetchRules();
      }
    } catch {
      toast.error('Failed to update rule');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this cross-sell rule?')) return;
    try {
      const res = await fetch(`${EMAIL_API}/cross-sell/rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Rule deleted');
        fetchRules();
      }
    } catch {
      toast.error('Failed to delete rule');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-600 via-rose-700 to-red-800 shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.85) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="relative flex flex-col gap-4 px-8 py-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 text-white">
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <ArrowRightLeft className="h-8 w-8" />
                Cross-Sell Rules
              </h1>
              <p className="text-sm text-pink-100">Recommend products based on customer purchases</p>
            </div>
            <Button onClick={() => setShowCreate(!showCreate)} className="bg-white text-rose-700 hover:bg-rose-50">
              <Plus className="h-4 w-4 mr-2" /> New Rule
            </Button>
          </div>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Create Cross-Sell Rule</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Rule Name *</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Phone Case → Screen Protector" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Trigger Product ID *</label>
                <Input value={triggerProduct} onChange={(e) => setTriggerProduct(e.target.value)} placeholder="Shopify product ID" />
                <p className="text-xs text-gray-400 mt-1">When a customer buys this product, recommend the products below</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Recommended Product IDs</label>
                <Input value={recommendedIds} onChange={(e) => setRecommendedIds(e.target.value)} placeholder="Comma-separated product IDs" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} className="bg-blue-600 text-white hover:bg-blue-700">Create Rule</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Rules List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-600" />
          </div>
        ) : rules.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ArrowRightLeft className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium text-gray-700">No cross-sell rules</p>
              <p className="text-sm">Create rules to automatically recommend products to customers</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <div key={rule.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
                      <Badge className={cn('text-xs', rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {rule.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggle(rule.id, rule.enabled)} className="text-gray-400 hover:text-gray-600">
                        {rule.enabled ? <ToggleRight className="h-6 w-6 text-green-500" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                      <button onClick={() => handleDelete(rule.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs text-gray-500 mb-1">When customer buys:</p>
                      <p className="text-sm font-medium text-gray-900">{rule.triggerProductTitle || rule.triggerProductId}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 shrink-0" />
                    <div className="flex-1 rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs text-gray-500 mb-1">Recommend:</p>
                      {rule.recommendedProducts.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {rule.recommendedProducts.map((p) => (
                            <div key={p.id} className="flex items-center gap-2 bg-white rounded px-2 py-1 border text-xs">
                              {p.image && <img src={p.image} alt="" className="h-6 w-6 rounded object-cover" />}
                              <span className="font-medium text-gray-900">{p.title}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">No products configured</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
