'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Pencil, Check, X, MessageSquare, Megaphone, Users, Store, Plus, Eye, EyeOff, Trash2 } from 'lucide-react';

interface Plan {
  id: string;
  planId: string;
  name: string;
  price: number;
  priceINR: number | null;
  billingCycle: string;
  messagesPerMonth: number;
  campaignsPerMonth: number;
  stores: number;
  teamMembersPerStore: number;
  analytics: string;
  support: string;
  whatsappAutomation: boolean;
  customTemplates: boolean;
  advancedSegmentation: boolean;
  isVisible: boolean;
  isActive: boolean;
  displayOrder: number;
}

const emptyForm = {
  planId: '',
  name: '',
  price: '',
  priceINR: '',
  billingCycle: 'monthly',
  messagesPerMonth: '1000',
  campaignsPerMonth: '5',
  stores: '1',
  teamMembersPerStore: '3',
  analytics: 'basic',
  support: 'email',
  whatsappAutomation: false,
  customTemplates: false,
  advancedSegmentation: false,
  isVisible: true,
  isActive: true,
  displayOrder: '0',
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => { fetchPlans(); }, []);

  async function fetchPlans() {
    try {
      const res = await fetch('/api/admin/plans', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingPlan(null);
    setIsCreating(true);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan);
    setIsCreating(false);
    setForm({
      planId: plan.planId,
      name: plan.name,
      price: String(plan.price),
      priceINR: plan.priceINR ? String(plan.priceINR) : '',
      billingCycle: plan.billingCycle,
      messagesPerMonth: String(plan.messagesPerMonth),
      campaignsPerMonth: String(plan.campaignsPerMonth),
      stores: String(plan.stores),
      teamMembersPerStore: String(plan.teamMembersPerStore),
      analytics: plan.analytics,
      support: plan.support,
      whatsappAutomation: plan.whatsappAutomation,
      customTemplates: plan.customTemplates,
      advancedSegmentation: plan.advancedSegmentation,
      isVisible: plan.isVisible,
      isActive: plan.isActive,
      displayOrder: String(plan.displayOrder),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        planId: form.planId,
        name: form.name,
        price: parseFloat(form.price),
        priceINR: form.priceINR ? parseFloat(form.priceINR) : null,
        billingCycle: form.billingCycle,
        messagesPerMonth: parseInt(form.messagesPerMonth),
        campaignsPerMonth: parseInt(form.campaignsPerMonth),
        stores: parseInt(form.stores),
        teamMembersPerStore: parseInt(form.teamMembersPerStore),
        analytics: form.analytics,
        support: form.support,
        whatsappAutomation: form.whatsappAutomation,
        customTemplates: form.customTemplates,
        advancedSegmentation: form.advancedSegmentation,
        isVisible: form.isVisible,
        isActive: form.isActive,
        displayOrder: parseInt(form.displayOrder || '0'),
      };

      const url = isCreating ? '/api/admin/plans' : `/api/admin/plans/${editingPlan!.id}`;
      const method = isCreating ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setDialogOpen(false);
        fetchPlans();
      } else {
        const err = await res.json();
        alert(err.error || `Failed to ${isCreating ? 'create' : 'update'} plan`);
      }
    } catch (err) {
      alert(`Failed to ${isCreating ? 'create' : 'update'} plan`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility(plan: Plan) {
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isVisible: !plan.isVisible }),
      });
      if (res.ok) fetchPlans();
    } catch (err) {
      console.error('Failed to toggle visibility:', err);
    }
  }

  async function deletePlan(plan: Plan) {
    if (!confirm(`Are you sure you want to deactivate "${plan.name}"? It will be hidden from all users.`)) return;
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) fetchPlans();
    } catch (err) {
      console.error('Failed to delete plan:', err);
    }
  }

  const fmtLimit = (v: number) => v === -1 ? 'Unlimited' : v.toLocaleString();

  if (loading) return <div className="p-6 text-gray-400">Loading plans...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan Management</h1>
          <p className="text-gray-500 text-sm">Create, edit, and manage subscription plans</p>
        </div>
        <Button onClick={openCreate} style={{ backgroundColor: '#5459AC' }}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans.map(plan => (
          <Card key={plan.id} className={`relative ${!plan.isActive ? 'opacity-50' : ''} ${!plan.isVisible ? 'border-dashed' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {!plan.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                  {!plan.isVisible && plan.isActive && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleVisibility(plan)} title={plan.isVisible ? 'Hide plan' : 'Show plan'}>
                    {plan.isVisible ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deletePlan(plan)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {plan.priceINR ? `₹${Number(plan.priceINR).toLocaleString('en-IN')}` : `$${Number(plan.price)}`}
                </span>
                <span className="text-gray-500">/{plan.billingCycle}</span>
              </div>
              {plan.priceINR && (
                <span className="text-sm text-gray-400">${Number(plan.price)} USD</span>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-400" />
                <span>{fmtLimit(plan.messagesPerMonth)} messages/mo</span>
              </div>
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-gray-400" />
                <span>{fmtLimit(plan.campaignsPerMonth)} campaigns/mo</span>
              </div>
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-gray-400" />
                <span>{fmtLimit(plan.stores)} stores</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <span>{fmtLimit(plan.teamMembersPerStore)} team/store</span>
              </div>
              <div className="pt-2 border-t space-y-1">
                <div className="flex items-center gap-2">
                  {plan.whatsappAutomation ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-gray-300" />}
                  <span>WhatsApp Automation</span>
                </div>
                <div className="flex items-center gap-2">
                  {plan.customTemplates ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-gray-300" />}
                  <span>Custom Templates</span>
                </div>
                <div className="flex items-center gap-2">
                  {plan.advancedSegmentation ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-gray-300" />}
                  <span>Advanced Segmentation</span>
                </div>
              </div>
              <div className="pt-2 flex gap-2 flex-wrap">
                <Badge variant="outline">{plan.analytics} analytics</Badge>
                <Badge variant="outline">{plan.support} support</Badge>
                <Badge variant="outline">Order: {plan.displayOrder}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? 'Create New Plan' : `Edit Plan: ${editingPlan?.name}`}</DialogTitle>
            <DialogDescription>{isCreating ? 'Set up a new subscription plan.' : 'Update plan pricing and features.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isCreating && (
              <div>
                <label className="text-sm font-medium">Plan ID (unique identifier)</label>
                <Input value={form.planId || ''} onChange={e => setForm({ ...form, planId: e.target.value })} placeholder="e.g., starter, growth, enterprise" className="mt-1" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Plan Name</label>
              <Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Price (USD)</label>
                <Input type="number" value={form.price || ''} onChange={e => setForm({ ...form, price: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Price (INR)</label>
                <Input type="number" value={form.priceINR || ''} onChange={e => setForm({ ...form, priceINR: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Billing Cycle</label>
                <Select value={form.billingCycle || 'monthly'} onValueChange={v => setForm({ ...form, billingCycle: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Display Order</label>
                <Input type="number" value={form.displayOrder || '0'} onChange={e => setForm({ ...form, displayOrder: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Messages/Month (-1 = unlimited)</label>
                <Input type="number" value={form.messagesPerMonth || ''} onChange={e => setForm({ ...form, messagesPerMonth: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Campaigns/Month (-1 = unlimited)</label>
                <Input type="number" value={form.campaignsPerMonth || ''} onChange={e => setForm({ ...form, campaignsPerMonth: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Stores (-1 = unlimited)</label>
                <Input type="number" value={form.stores || ''} onChange={e => setForm({ ...form, stores: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Team per Store (-1 = unlimited)</label>
                <Input type="number" value={form.teamMembersPerStore || ''} onChange={e => setForm({ ...form, teamMembersPerStore: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Analytics Level</label>
                <Select value={form.analytics || 'basic'} onValueChange={v => setForm({ ...form, analytics: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Support Level</label>
                <Select value={form.support || 'email'} onValueChange={v => setForm({ ...form, support: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="dedicated">Dedicated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium">Feature Toggles</label>
              {[
                { key: 'whatsappAutomation', label: 'WhatsApp Automation' },
                { key: 'customTemplates', label: 'Custom Templates' },
                { key: 'advancedSegmentation', label: 'Advanced Segmentation' },
              ].map(f => (
                <div key={f.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form[f.key] || false}
                    onChange={e => setForm({ ...form, [f.key]: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">{f.label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">Visibility & Status</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isVisible ?? true}
                  onChange={e => setForm({ ...form, isVisible: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Visible to customers</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive ?? true}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Active (can be subscribed to)</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#5459AC' }}>
              {saving ? 'Saving...' : isCreating ? 'Create Plan' : 'Update Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
