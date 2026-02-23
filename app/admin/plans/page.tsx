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
import { Package, Pencil, Check, X, MessageSquare, Megaphone, Users, Store } from 'lucide-react';

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
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  function openEdit(plan: Plan) {
    setEditingPlan(plan);
    setForm({
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
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editingPlan) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/plans/${editingPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
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
        }),
      });
      if (res.ok) {
        setDialogOpen(false);
        fetchPlans();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update plan');
      }
    } catch (err) {
      alert('Failed to update plan');
    } finally {
      setSaving(false);
    }
  }

  const fmtLimit = (v: number) => v === -1 ? 'Unlimited' : v.toLocaleString();

  if (loading) return <div className="p-6 text-gray-400">Loading plans...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plan Management</h1>
        <p className="text-gray-500 text-sm">Manage subscription plans and pricing</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans.map(plan => (
          <Card key={plan.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">${Number(plan.price)}</span>
                <span className="text-gray-500">/{plan.billingCycle}</span>
              </div>
              {plan.priceINR && (
                <div className="text-sm text-gray-500">₹{Number(plan.priceINR)} INR</div>
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
              <div className="pt-2 flex gap-2">
                <Badge variant="outline">{plan.analytics} analytics</Badge>
                <Badge variant="outline">{plan.support} support</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Plan: {editingPlan?.name}</DialogTitle>
            <DialogDescription>Update plan pricing and features.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#5459AC' }}>
              {saving ? 'Saving...' : 'Update Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
