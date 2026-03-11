'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Search, RefreshCw, Eye, EyeOff, Trash2, Send, Edit2, Workflow,
  ShoppingCart, Package, CreditCard, CheckCircle, UserPlus, RotateCcw, Layers,
} from 'lucide-react';

interface PredefinedTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  definition: any;
  isActive: boolean;
  isDefault: boolean;
  assignedTo: string[] | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreOption {
  id: string;
  name: string;
  shopifyDomain: string | null;
}

const CATEGORIES = [
  { value: 'abandoned_cart', label: 'Abandoned Cart Recovery', icon: ShoppingCart, color: 'bg-orange-100 text-orange-700' },
  { value: 'product_view', label: 'Product View Follow-up', icon: Eye, color: 'bg-blue-100 text-blue-700' },
  { value: 'cart_reminder', label: 'Cart Reminder', icon: ShoppingCart, color: 'bg-yellow-100 text-yellow-700' },
  { value: 'checkout', label: 'Checkout Nudge', icon: CreditCard, color: 'bg-purple-100 text-purple-700' },
  { value: 'order_confirmation', label: 'Order Confirmation', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  { value: 'welcome', label: 'Welcome / Onboarding', icon: UserPlus, color: 'bg-teal-100 text-teal-700' },
  { value: 're_engagement', label: 'Re-engagement', icon: RotateCcw, color: 'bg-pink-100 text-pink-700' },
  { value: 'custom', label: 'Custom', icon: Layers, color: 'bg-gray-100 text-gray-700' },
];

const DEFAULT_DEFINITIONS: Record<string, any> = {
  abandoned_cart: {
    nodes: [
      { id: 'trigger', type: 'trigger', data: { label: 'Cart Abandoned', triggerType: 'CHECKOUT_ABANDONED' }, position: { x: 250, y: 0 } },
      { id: 'delay1', type: 'delay', data: { label: 'Wait 1 Hour', delay: 60 }, position: { x: 250, y: 120 } },
      { id: 'msg1', type: 'message', data: { label: 'Send Recovery Message', message: 'Hi {{name}}, you left items in your cart! Complete your purchase now.' }, position: { x: 250, y: 240 } },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'delay1' },
      { id: 'e2', source: 'delay1', target: 'msg1' },
    ],
  },
  product_view: {
    nodes: [
      { id: 'trigger', type: 'trigger', data: { label: 'Product Viewed', triggerType: 'PRODUCT_VIEWED' }, position: { x: 250, y: 0 } },
      { id: 'delay1', type: 'delay', data: { label: 'Wait 2 Hours', delay: 120 }, position: { x: 250, y: 120 } },
      { id: 'msg1', type: 'message', data: { label: 'Send Follow-up', message: 'Hi {{name}}, still interested in {{product}}? It\'s selling fast!' }, position: { x: 250, y: 240 } },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'delay1' },
      { id: 'e2', source: 'delay1', target: 'msg1' },
    ],
  },
  order_confirmation: {
    nodes: [
      { id: 'trigger', type: 'trigger', data: { label: 'Order Placed', triggerType: 'ORDER_PLACED' }, position: { x: 250, y: 0 } },
      { id: 'msg1', type: 'message', data: { label: 'Send Confirmation', message: 'Thank you {{name}}! Your order #{{order_id}} has been confirmed.' }, position: { x: 250, y: 120 } },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'msg1' },
    ],
  },
  welcome: {
    nodes: [
      { id: 'trigger', type: 'trigger', data: { label: 'New Customer', triggerType: 'CUSTOMER_CREATED' }, position: { x: 250, y: 0 } },
      { id: 'msg1', type: 'message', data: { label: 'Welcome Message', message: 'Welcome to our store, {{name}}! We\'re thrilled to have you. Enjoy 10% off your first order!' }, position: { x: 250, y: 120 } },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'msg1' },
    ],
  },
};

export default function JourneyTemplatesPage() {
  const [templates, setTemplates] = useState<PredefinedTemplate[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Create/Edit Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PredefinedTemplate | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('abandoned_cart');
  const [formDefinition, setFormDefinition] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  // Assign Dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningTemplate, setAssigningTemplate] = useState<PredefinedTemplate | null>(null);
  const [assignMode, setAssignMode] = useState<'all' | 'selected'>('all');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [storeSearch, setStoreSearch] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<any>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.set('category', filterCategory);
      const res = await fetch(`/api/admin/predefined-templates?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  const fetchStores = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stores', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStores((data.stores || []).map((s: any) => ({
          id: s.id,
          name: s.name || s.shopifyDomain || s.id,
          shopifyDomain: s.shopifyDomain,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch stores:', err);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  useEffect(() => { fetchStores(); }, [fetchStores]);

  const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

  // Create / Edit
  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormCategory('abandoned_cart');
    setFormDefinition(JSON.stringify(DEFAULT_DEFINITIONS.abandoned_cart, null, 2));
    setFormIsDefault(false);
    setDialogOpen(true);
  };

  const openEditDialog = (tpl: PredefinedTemplate) => {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormDescription(tpl.description || '');
    setFormCategory(tpl.category);
    setFormDefinition(JSON.stringify(tpl.definition, null, 2));
    setFormIsDefault(tpl.isDefault);
    setDialogOpen(true);
  };

  const handleCategoryChange = (cat: string) => {
    setFormCategory(cat);
    if (!editingTemplate && DEFAULT_DEFINITIONS[cat]) {
      setFormDefinition(JSON.stringify(DEFAULT_DEFINITIONS[cat], null, 2));
    }
  };

  const handleSave = async () => {
    if (!formName.trim() || !formCategory) return;
    let definition: any;
    try {
      definition = JSON.parse(formDefinition);
    } catch {
      alert('Invalid JSON in definition field');
      return;
    }

    setSaving(true);
    try {
      const url = editingTemplate
        ? `/api/admin/predefined-templates/${editingTemplate.id}`
        : '/api/admin/predefined-templates';
      const method = editingTemplate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          category: formCategory,
          definition,
          isDefault: formIsDefault,
        }),
      });

      if (res.ok) {
        setDialogOpen(false);
        fetchTemplates();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to save template');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Toggle active
  const toggleActive = async (tpl: PredefinedTemplate) => {
    try {
      const res = await fetch(`/api/admin/predefined-templates/${tpl.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !tpl.isActive }),
      });
      if (res.ok) fetchTemplates();
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  // Delete (soft)
  const handleDelete = async (tpl: PredefinedTemplate) => {
    if (!confirm(`Delete template "${tpl.name}"? This will deactivate it.`)) return;
    try {
      const res = await fetch(`/api/admin/predefined-templates/${tpl.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) fetchTemplates();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Assign
  const openAssignDialog = (tpl: PredefinedTemplate) => {
    setAssigningTemplate(tpl);
    setAssignMode('all');
    setSelectedStoreIds([]);
    setStoreSearch('');
    setAssignResult(null);
    setAssignDialogOpen(true);
  };

  const toggleStoreSelection = (storeId: string) => {
    setSelectedStoreIds(prev =>
      prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
    );
  };

  const handleAssign = async () => {
    if (!assigningTemplate) return;
    if (assignMode === 'selected' && selectedStoreIds.length === 0) {
      alert('Please select at least one store');
      return;
    }

    setAssigning(true);
    setAssignResult(null);
    try {
      const res = await fetch(`/api/admin/predefined-templates/${assigningTemplate.id}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeIds: assignMode === 'all' ? 'all' : selectedStoreIds,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAssignResult(data);
      } else {
        alert(data.error || 'Failed to assign template');
      }
    } catch (err) {
      console.error('Assign error:', err);
      alert('Failed to assign template');
    } finally {
      setAssigning(false);
    }
  };

  const filtered = templates.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeCount = templates.filter(t => t.isActive).length;
  const defaultCount = templates.filter(t => t.isDefault).length;

  const filteredStores = stores.filter(s => {
    if (!storeSearch) return true;
    const q = storeSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.shopifyDomain || '').toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="h-6 w-6" />
            Journey Templates
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Create and push predefined journey templates to client stores for onboarding
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTemplates} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" /> Create Template
          </Button>
        </div>
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
            <div className="text-sm text-gray-500">Active</div>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Default (Auto-assign)</div>
            <div className="text-2xl font-bold text-blue-600">{defaultCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Categories</div>
            <div className="text-2xl font-bold">{new Set(templates.map(t => t.category)).size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={v => setFilterCategory(v)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Table */}
      {loading ? (
        <div className="text-gray-400 p-8 text-center">Loading templates...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Workflow className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No journey templates yet</p>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" /> Create Your First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(tpl => {
                const catInfo = getCategoryInfo(tpl.category);
                const CatIcon = catInfo.icon;
                return (
                  <TableRow key={tpl.id} className={!tpl.isActive ? 'opacity-50' : ''}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{tpl.name}</div>
                        {tpl.description && (
                          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{tpl.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={catInfo.color + ' gap-1'}>
                        <CatIcon className="h-3 w-3" />
                        {catInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={tpl.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {tpl.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tpl.isDefault && <Badge className="bg-blue-100 text-blue-700">Default</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(tpl.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" title="Edit" onClick={() => openEditDialog(tpl)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title={tpl.isActive ? 'Deactivate' : 'Activate'} onClick={() => toggleActive(tpl)}>
                          {tpl.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" title="Assign to Stores" onClick={() => openAssignDialog(tpl)} className="text-blue-600 hover:text-blue-800">
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Delete" onClick={() => handleDelete(tpl)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Journey Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? 'Update the template details' : 'Define a predefined journey template for client onboarding'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g., Abandoned Cart Recovery" />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Brief description of what this template does" />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formIsDefault}
                onChange={e => setFormIsDefault(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isDefault" className="text-sm font-normal cursor-pointer">
                Auto-assign to new stores (default template)
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Journey Definition (JSON) *</Label>
              <Textarea
                value={formDefinition}
                onChange={e => setFormDefinition(e.target.value)}
                className="font-mono text-xs min-h-[250px]"
                placeholder='{"nodes": [...], "edges": [...]}'
              />
              <p className="text-xs text-gray-400">
                Define nodes (trigger, delay, message, condition) and edges for the journey flow
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Template to Stores</DialogTitle>
            <DialogDescription>
              Push &quot;{assigningTemplate?.name}&quot; to client stores as a journey draft
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <Label>Assignment Mode</Label>
              <div className="flex gap-3">
                <Button
                  variant={assignMode === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAssignMode('all')}
                >
                  All Stores ({stores.length})
                </Button>
                <Button
                  variant={assignMode === 'selected' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAssignMode('selected')}
                >
                  Select Stores
                </Button>
              </div>
            </div>

            {assignMode === 'selected' && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search stores..."
                    value={storeSearch}
                    onChange={e => setStoreSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="border rounded-lg max-h-[250px] overflow-y-auto">
                  {filteredStores.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">No stores found</div>
                  ) : (
                    filteredStores.map(store => (
                      <label
                        key={store.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStoreIds.includes(store.id)}
                          onChange={() => toggleStoreSelection(store.id)}
                          className="rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{store.name}</div>
                          {store.shopifyDomain && (
                            <div className="text-xs text-gray-400 truncate">{store.shopifyDomain}</div>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {selectedStoreIds.length > 0 && (
                  <p className="text-xs text-gray-500">{selectedStoreIds.length} store(s) selected</p>
                )}
              </div>
            )}

            {/* Assignment Result */}
            {assignResult && (
              <div className="rounded-lg border bg-gray-50 p-4 space-y-1 text-sm">
                <p className="font-medium">Assignment Complete</p>
                <p className="text-green-700">Created: {assignResult.created || 0} journey draft(s)</p>
                {assignResult.already_exists > 0 && (
                  <p className="text-yellow-700">Already exists: {assignResult.already_exists} store(s)</p>
                )}
                {assignResult.errors > 0 && (
                  <p className="text-red-700">Errors: {assignResult.errors} store(s)</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              {assignResult ? 'Close' : 'Cancel'}
            </Button>
            {!assignResult && (
              <Button onClick={handleAssign} disabled={assigning} className="gap-2">
                <Send className="h-4 w-4" />
                {assigning ? 'Assigning...' : 'Assign Template'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
