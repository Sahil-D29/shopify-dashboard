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
import { Tag, Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  discountType: string;
  value: number;
  applicablePlans: string[];
  assignedStoreId: string | null;
  isRecurring: boolean;
  validUntil: string | null;
  usageLimit: number | null;
  usageCount: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Plan {
  id: string;
  planId: string;
  name: string;
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: '',
    discountType: 'PERCENTAGE',
    value: '',
    applicablePlans: [] as string[],
    validUntil: '',
    usageLimit: '',
    description: '',
    assignedStoreId: '',
    isRecurring: false,
  });

  useEffect(() => {
    fetchCoupons();
    fetchPlans();
  }, []);

  async function fetchCoupons() {
    try {
      const res = await fetch('/api/admin/coupons', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCoupons(data);
      }
    } catch (err) {
      console.error('Failed to fetch coupons:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlans() {
    try {
      const res = await fetch('/api/billing/plans');
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    }
  }

  function openCreateDialog() {
    setEditingCoupon(null);
    setForm({
      code: '', discountType: 'PERCENTAGE', value: '', applicablePlans: [],
      validUntil: '', usageLimit: '', description: '', assignedStoreId: '', isRecurring: false,
    });
    setDialogOpen(true);
  }

  function openEditDialog(coupon: Coupon) {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      value: String(coupon.value),
      applicablePlans: coupon.applicablePlans || [],
      validUntil: coupon.validUntil ? coupon.validUntil.split('T')[0] : '',
      usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : '',
      description: coupon.description || '',
      assignedStoreId: coupon.assignedStoreId || '',
      isRecurring: coupon.isRecurring,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = {
        code: form.code.toUpperCase(),
        discountType: form.discountType,
        value: parseFloat(form.value),
        applicablePlans: form.applicablePlans,
        validUntil: form.validUntil || null,
        usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
        description: form.description || null,
        assignedStoreId: form.assignedStoreId || null,
        isRecurring: form.isRecurring,
      };

      const url = editingCoupon ? `/api/admin/coupons/${editingCoupon.id}` : '/api/admin/coupons';
      const method = editingCoupon ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setDialogOpen(false);
        fetchCoupons();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save coupon');
      }
    } catch (err) {
      alert('Failed to save coupon');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCoupon(coupon: Coupon) {
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: coupon.isActive ? 'inactive' : 'active' }),
      });
      if (res.ok) fetchCoupons();
    } catch (err) {
      console.error('Failed to toggle coupon:', err);
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!confirm(`Delete coupon "${coupon.code}"?`)) return;
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) fetchCoupons();
    } catch (err) {
      console.error('Failed to delete coupon:', err);
    }
  }

  function togglePlan(planId: string) {
    setForm(prev => ({
      ...prev,
      applicablePlans: prev.applicablePlans.includes(planId)
        ? prev.applicablePlans.filter(p => p !== planId)
        : [...prev.applicablePlans, planId],
    }));
  }

  const filtered = coupons.filter(c => {
    if (search && !c.code.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus === 'active' && !c.isActive) return false;
    if (filterStatus === 'inactive' && c.isActive) return false;
    if (filterType !== 'all' && c.discountType !== filterType) return false;
    return true;
  });

  const activeCoupons = coupons.filter(c => c.isActive).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + c.usageCount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupon Management</h1>
          <p className="text-gray-500 text-sm">Create and manage discount coupons</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2" style={{ backgroundColor: '#5459AC' }}>
          <Plus className="h-4 w-4" /> Create Coupon
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Total Coupons</div>
            <div className="text-2xl font-bold">{coupons.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Active</div>
            <div className="text-2xl font-bold text-green-600">{activeCoupons}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Inactive</div>
            <div className="text-2xl font-bold text-gray-400">{coupons.length - activeCoupons}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Total Redemptions</div>
            <div className="text-2xl font-bold text-blue-600">{totalRedemptions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="PERCENTAGE">Percentage</SelectItem>
            <SelectItem value="FIXED">Fixed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading coupons...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No coupons found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium">Code</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Value</th>
                    <th className="text-left p-3 font-medium">Usage</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Expiry</th>
                    <th className="text-left p-3 font-medium">Recurring</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(coupon => (
                    <tr key={coupon.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-mono font-semibold">{coupon.code}</td>
                      <td className="p-3">
                        <Badge variant="outline">{coupon.discountType}</Badge>
                      </td>
                      <td className="p-3">
                        {coupon.discountType === 'PERCENTAGE' ? `${coupon.value}%` : `$${coupon.value}`}
                      </td>
                      <td className="p-3">
                        {coupon.usageCount}{coupon.usageLimit ? `/${coupon.usageLimit}` : ''}
                      </td>
                      <td className="p-3">
                        <Badge className={coupon.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-500">
                        {coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString() : 'No expiry'}
                      </td>
                      <td className="p-3">
                        {coupon.isRecurring ? <Badge variant="outline" className="text-blue-600">Yes</Badge> : 'No'}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(coupon)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleCoupon(coupon)}>
                            {coupon.isActive
                              ? <ToggleRight className="h-4 w-4 text-green-600" />
                              : <ToggleLeft className="h-4 w-4 text-gray-400" />
                            }
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteCoupon(coupon)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
            <DialogDescription>
              {editingCoupon ? 'Update coupon details below.' : 'Fill in the details to create a new coupon.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Coupon Code</label>
              <Input
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. SAVE20"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Discount Type</label>
                <Select value={form.discountType} onValueChange={v => setForm({ ...form, discountType: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    <SelectItem value="FIXED">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Value</label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={e => setForm({ ...form, value: e.target.value })}
                  placeholder={form.discountType === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 5.00'}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Applicable Plans</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {plans.map(plan => (
                  <Button
                    key={plan.planId}
                    type="button"
                    variant={form.applicablePlans.includes(plan.planId) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => togglePlan(plan.planId)}
                    style={form.applicablePlans.includes(plan.planId) ? { backgroundColor: '#5459AC' } : {}}
                  >
                    {plan.name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Valid Until</label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={e => setForm({ ...form, validUntil: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Usage Limit</label>
                <Input
                  type="number"
                  value={form.usageLimit}
                  onChange={e => setForm({ ...form, usageLimit: e.target.value })}
                  placeholder="Unlimited"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Assigned Store ID (optional)</label>
              <Input
                value={form.assignedStoreId}
                onChange={e => setForm({ ...form, assignedStoreId: e.target.value })}
                placeholder="Leave empty for all stores"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isRecurring}
                onChange={e => setForm({ ...form, isRecurring: e.target.checked })}
                className="rounded"
              />
              <label className="text-sm">Apply on every billing cycle (recurring)</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.code || !form.value} style={{ backgroundColor: '#5459AC' }}>
              {saving ? 'Saving...' : editingCoupon ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
