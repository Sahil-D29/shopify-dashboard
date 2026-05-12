'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import {
  Loader2,
  BellRing,
  Plus,
  Trash2,
  Send as SendIcon,
  CheckCircle2,
  Clock,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';

interface Subscription {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  shopifyProductId: string;
  shopifyVariantId: string;
  productTitle: string;
  productImage: string | null;
  productUrl: string | null;
  variantTitle: string | null;
  status: 'PENDING' | 'NOTIFIED' | 'CANCELLED';
  notifiedAt: string | null;
  createdAt: string;
}

interface ProductGroup {
  shopifyProductId: string;
  productTitle: string;
  productImage: string | null;
  pendingCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  NOTIFIED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const STATUS_ICONS = {
  PENDING: Clock,
  NOTIFIED: CheckCircle2,
  CANCELLED: Trash2,
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const PAGE_SIZE = 50;

export default function BackInStockPage() {
  const toast = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [offset, setOffset] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Add form fields
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    shopifyProductId: '',
    shopifyVariantId: '',
    productTitle: '',
    productImage: '',
    productUrl: '',
    variantTitle: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/email/back-in-stock?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data?.subscriptions) {
        throw new Error(data?.error ?? 'Failed to load');
      }
      setSubscriptions(Array.isArray(data.subscriptions) ? data.subscriptions : []);
      setProductGroups(Array.isArray(data.productGroups) ? data.productGroups : []);
      setCounts(data.counts ?? {});
      setTotal(data.total ?? 0);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load subscriptions'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, offset, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch('/api/email/back-in-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          productImage: form.productImage || null,
          productUrl: form.productUrl || null,
          variantTitle: form.variantTitle || null,
          firstName: form.firstName || null,
          lastName: form.lastName || null,
          source: 'DASHBOARD',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to add');
      toast.success('Subscription added');
      setAddOpen(false);
      setForm({
        email: '',
        firstName: '',
        lastName: '',
        shopifyProductId: '',
        shopifyVariantId: '',
        productTitle: '',
        productImage: '',
        productUrl: '',
        variantTitle: '',
      });
      void fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to add subscription'));
    } finally {
      setAdding(false);
    }
  }

  async function handleTriggerVariant(variantId: string) {
    if (
      !window.confirm(
        `Send back-in-stock emails to everyone waiting for variant ${variantId}? Only do this once the product is actually restocked.`,
      )
    )
      return;
    setTriggering(variantId);
    try {
      const res = await fetch('/api/email/back-in-stock/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopifyVariantId: variantId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Trigger failed');
      toast.success(
        `Sent ${data.sent ?? 0} email${data.sent === 1 ? '' : 's'} (${data.failed ?? 0} failed)`,
      );
      void fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to trigger notifications'));
    } finally {
      setTriggering(null);
    }
  }

  async function handleTriggerAllForProduct(productId: string) {
    // Get all unique variantIds for PENDING subs of this product
    const variantsToTrigger = Array.from(
      new Set(
        subscriptions
          .filter(s => s.shopifyProductId === productId && s.status === 'PENDING')
          .map(s => s.shopifyVariantId),
      ),
    );
    if (variantsToTrigger.length === 0) return;
    if (
      !window.confirm(
        `Send back-in-stock emails for ${variantsToTrigger.length} variant${variantsToTrigger.length === 1 ? '' : 's'} of this product?`,
      )
    )
      return;
    setTriggering(productId);
    let totalSent = 0;
    let totalFailed = 0;
    for (const variantId of variantsToTrigger) {
      try {
        const res = await fetch('/api/email/back-in-stock/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shopifyVariantId: variantId }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          totalSent += data.sent ?? 0;
          totalFailed += data.failed ?? 0;
        }
      } catch {
        /* keep going */
      }
    }
    toast.success(`Sent ${totalSent} email${totalSent === 1 ? '' : 's'} (${totalFailed} failed)`);
    setTriggering(null);
    void fetchData();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this subscription?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/email/back-in-stock/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to delete');
      toast.success('Subscription removed');
      void fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete'));
    } finally {
      setDeleting(null);
    }
  }

  const filters: Array<{ value: string; label: string }> = [
    { value: 'all', label: `All (${total})` },
    { value: 'PENDING', label: `Pending (${counts.PENDING ?? 0})` },
    { value: 'NOTIFIED', label: `Notified (${counts.NOTIFIED ?? 0})` },
    { value: 'CANCELLED', label: `Cancelled (${counts.CANCELLED ?? 0})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Back-in-Stock Alerts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Customers waiting to be notified when products come back in stock.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Subscription
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <p className="font-semibold mb-1">Automatic triggers</p>
        <p>
          When Shopify <code>products/update</code> webhook reports a variant is back in stock,
          emails are sent automatically. Configure the webhook at{' '}
          <strong>Shopify Admin → Notifications → Webhooks</strong> pointing to{' '}
          <code className="bg-white px-1.5 py-0.5 rounded">
            /api/email/webhooks/shopify-inventory
          </code>
          . You can also trigger manually for any variant below.
        </p>
      </div>

      {/* Product groups (pending subscriptions per product) */}
      {productGroups.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Products with Pending Subscriptions</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {productGroups.map(g => (
              <div key={g.shopifyProductId} className="p-4 flex items-center gap-4">
                {g.productImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.productImage}
                    alt={g.productTitle}
                    className="w-12 h-12 rounded object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{g.productTitle}</p>
                  <p className="text-xs text-gray-500">
                    {g.pendingCount} pending subscription{g.pendingCount === 1 ? '' : 's'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTriggerAllForProduct(g.shopifyProductId)}
                  disabled={triggering === g.shopifyProductId}
                  className="gap-2"
                >
                  {triggering === g.shopifyProductId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <SendIcon className="h-3.5 w-3.5" />
                  )}
                  Notify All
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {filters.map(opt => (
          <button
            key={opt.value}
            onClick={() => {
              setStatusFilter(opt.value);
              setOffset(0);
            }}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
              statusFilter === opt.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <BellRing className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="mb-2">
              {total === 0
                ? 'No back-in-stock subscriptions yet.'
                : 'No subscriptions match this filter.'}
            </p>
            {total === 0 && (
              <p className="text-sm">
                Customers can subscribe via your Shopify storefront integration, or you can add
                them manually using the button above.
              </p>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subscribed
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subscriptions.map(sub => {
                const StatusIcon = STATUS_ICONS[sub.status];
                return (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{sub.email}</div>
                      {(sub.firstName || sub.lastName) && (
                        <div className="text-xs text-gray-500">
                          {[sub.firstName, sub.lastName].filter(Boolean).join(' ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900 line-clamp-1">
                        {sub.productTitle}
                      </div>
                      {sub.variantTitle && (
                        <div className="text-xs text-gray-500">{sub.variantTitle}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">
                        Variant: {sub.shopifyVariantId}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
                          STATUS_COLORS[sub.status],
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {sub.status}
                      </span>
                      {sub.notifiedAt && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(sub.notifiedAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {sub.status === 'PENDING' && (
                          <button
                            onClick={() => handleTriggerVariant(sub.shopifyVariantId)}
                            disabled={triggering === sub.shopifyVariantId}
                            className="text-xs text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            {triggering === sub.shopifyVariantId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <SendIcon className="h-3 w-3" />
                            )}
                            Notify
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(sub.id)}
                          disabled={deleting === sub.id}
                          className="text-xs text-gray-400 hover:bg-red-50 hover:text-red-600 px-2 py-1 rounded inline-flex items-center gap-1"
                        >
                          {deleting === sub.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {addOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !adding && setAddOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg mb-4">Add Back-in-Stock Subscription</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <Label htmlFor="email">Customer Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={e => setForm({ ...form, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="productTitle">Product Title *</Label>
                <Input
                  id="productTitle"
                  required
                  value={form.productTitle}
                  onChange={e => setForm({ ...form, productTitle: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="variantTitle">Variant Title</Label>
                <Input
                  id="variantTitle"
                  placeholder="e.g. Medium / Blue"
                  value={form.variantTitle}
                  onChange={e => setForm({ ...form, variantTitle: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="shopifyProductId">Shopify Product ID *</Label>
                  <Input
                    id="shopifyProductId"
                    required
                    value={form.shopifyProductId}
                    onChange={e => setForm({ ...form, shopifyProductId: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="shopifyVariantId">Shopify Variant ID *</Label>
                  <Input
                    id="shopifyVariantId"
                    required
                    value={form.shopifyVariantId}
                    onChange={e => setForm({ ...form, shopifyVariantId: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="productImage">Product Image URL</Label>
                <Input
                  id="productImage"
                  type="url"
                  value={form.productImage}
                  onChange={e => setForm({ ...form, productImage: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="productUrl">Product URL</Label>
                <Input
                  id="productUrl"
                  type="url"
                  value={form.productUrl}
                  onChange={e => setForm({ ...form, productUrl: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                  disabled={adding}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={adding} className="gap-2">
                  {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                  {adding ? 'Adding…' : 'Add Subscription'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
