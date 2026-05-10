'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FlaskConical,
  Plus,
  Trophy,
  Clock,
  Play,
  Pause,
  BarChart3,
  Users,
  Eye,
  MousePointerClick,
} from 'lucide-react';
import { toast } from 'sonner';

const EMAIL_API = process.env.NEXT_PUBLIC_EMAIL_API || 'http://localhost:5000/api/email';

interface ABTest {
  id: string;
  name: string;
  type: string;
  status: string;
  variants: Array<{
    id: string;
    name: string;
    subject?: string;
    weight: number;
    metrics?: {
      sent: number;
      opened: number;
      clicked: number;
      openRate: string;
      clickRate: string;
    };
  }>;
  winnerId?: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
};

export default function ABTestsPage() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('subject');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [splitPercent, setSplitPercent] = useState('50');

  const fetchTests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${EMAIL_API}/ab-tests?storeId=tsg-api.myshopify.com`);
      if (res.ok) {
        const data = await res.json();
        setTests(data.tests || []);
      }
    } catch (err) {
      console.error('Failed to fetch A/B tests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  async function handleCreate() {
    if (!newName.trim() || !variantA.trim() || !variantB.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      const res = await fetch(`${EMAIL_API}/ab-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          type: newType,
          variants: [
            { name: 'Variant A', subject: variantA, weight: parseInt(splitPercent) },
            { name: 'Variant B', subject: variantB, weight: 100 - parseInt(splitPercent) },
          ],
          storeId: 'tsg-api.myshopify.com',
        }),
      });
      if (res.ok) {
        toast.success('A/B test created!');
        setShowCreate(false);
        setNewName('');
        setVariantA('');
        setVariantB('');
        fetchTests();
      }
    } catch {
      toast.error('Failed to create A/B test');
    }
  }

  async function handleStart(id: string) {
    try {
      const res = await fetch(`${EMAIL_API}/ab-tests/${id}/start`, { method: 'POST' });
      if (res.ok) {
        toast.success('A/B test started!');
        fetchTests();
      }
    } catch {
      toast.error('Failed to start test');
    }
  }

  async function handlePickWinner(testId: string, variantId: string) {
    try {
      const res = await fetch(`${EMAIL_API}/ab-tests/${testId}/winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId }),
      });
      if (res.ok) {
        toast.success('Winner selected!');
        fetchTests();
      }
    } catch {
      toast.error('Failed to select winner');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 via-orange-700 to-red-800 shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.85) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="relative flex flex-col gap-4 px-8 py-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 text-white">
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <FlaskConical className="h-8 w-8" />
                A/B Testing
              </h1>
              <p className="text-sm text-amber-100">Test different subject lines and content to optimize engagement</p>
            </div>
            <Button onClick={() => setShowCreate(!showCreate)} className="bg-white text-orange-700 hover:bg-orange-50">
              <Plus className="h-4 w-4 mr-2" /> New A/B Test
            </Button>
          </div>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Create A/B Test</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Test Name *</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Subject Line Test - Summer Sale" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Test Type</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full bg-white border rounded-md px-3 py-2 text-sm">
                  <option value="subject">Subject Line</option>
                  <option value="content">Email Content</option>
                  <option value="sender">Sender Name</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Variant A *</label>
                <Input value={variantA} onChange={(e) => setVariantA(e.target.value)} placeholder="e.g., 50% OFF Everything!" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Variant B *</label>
                <Input value={variantB} onChange={(e) => setVariantB(e.target.value)} placeholder="e.g., Half Price Sale - Today Only!" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Split ({splitPercent}% / {100 - parseInt(splitPercent)}%)</label>
                <input type="range" min="10" max="90" value={splitPercent} onChange={(e) => setSplitPercent(e.target.value)} className="w-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} className="bg-blue-600 text-white hover:bg-blue-700">Create Test</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Test List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600" />
          </div>
        ) : tests.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FlaskConical className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium text-gray-700">No A/B tests yet</p>
              <p className="text-sm">Create your first test to start optimizing</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {tests.map((test) => (
              <div key={test.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{test.name}</h3>
                    <Badge className={cn('rounded-full px-3 py-1 text-xs font-semibold capitalize', STATUS_STYLES[test.status] || 'bg-gray-100 text-gray-700')}>
                      {test.status}
                    </Badge>
                    <Badge className="bg-indigo-100 text-indigo-700 text-xs capitalize">{test.type}</Badge>
                  </div>
                  <div className="flex gap-2">
                    {test.status === 'draft' && (
                      <Button size="sm" onClick={() => handleStart(test.id)} className="bg-green-600 text-white hover:bg-green-700">
                        <Play className="h-4 w-4 mr-1" /> Start
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {test.variants.map((v) => (
                    <div key={v.id} className={cn(
                      'rounded-lg border p-4 transition-all',
                      test.winnerId === v.id ? 'border-green-500 bg-green-50' : 'border-gray-200'
                    )}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          {v.name}
                          {test.winnerId === v.id && <Trophy className="h-4 w-4 text-green-600" />}
                        </h4>
                        <span className="text-xs text-gray-500">{v.weight}% of audience</span>
                      </div>
                      {v.subject && (
                        <p className="text-sm text-gray-600 mb-3 bg-gray-50 rounded px-3 py-2 font-mono">{v.subject}</p>
                      )}
                      {v.metrics && (
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <p className="text-xs text-gray-500">Sent</p>
                            <p className="text-lg font-bold text-gray-900">{v.metrics.sent}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Open Rate</p>
                            <p className="text-lg font-bold text-green-600">{v.metrics.openRate}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Click Rate</p>
                            <p className="text-lg font-bold text-blue-600">{v.metrics.clickRate}%</p>
                          </div>
                        </div>
                      )}
                      {test.status === 'running' && !test.winnerId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-3"
                          onClick={() => handlePickWinner(test.id, v.id)}
                        >
                          <Trophy className="h-4 w-4 mr-1" /> Select as Winner
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
