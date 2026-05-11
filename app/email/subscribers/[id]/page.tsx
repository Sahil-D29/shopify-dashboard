'use client';

import { use, useCallback, useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save, Trash2, UserMinus, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';

interface Subscriber {
  id: string;
  storeId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'BOUNCED' | 'COMPLAINED' | 'PENDING';
  source: 'SHOPIFY' | 'MANUAL' | 'CSV_IMPORT' | 'SIGNUP_FORM' | 'API';
  tags: string[];
  shopifyCustomerId: string | null;
  syncedFromShopifyAt: string | null;
  suppressionReason: string | null;
  subscribedAt: string;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  SUBSCRIBED: 'bg-green-100 text-green-700',
  UNSUBSCRIBED: 'bg-gray-100 text-gray-600',
  BOUNCED: 'bg-orange-100 text-orange-700',
  COMPLAINED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
};

const STATUS_LABELS: Record<string, string> = {
  SUBSCRIBED: 'Subscribed',
  UNSUBSCRIBED: 'Unsubscribed',
  BOUNCED: 'Bounced',
  COMPLAINED: 'Complained',
  PENDING: 'Pending',
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : '—';

export default function SubscriberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email/subscribers/${id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load subscriber');
      setSubscriber(data.subscriber);
      setFirstName(data.subscriber.firstName ?? '');
      setLastName(data.subscriber.lastName ?? '');
      setTagsInput((data.subscriber.tags ?? []).join(', '));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load subscriber'));
      router.push('/email/subscribers');
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!subscriber) return;
    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      const res = await fetch(`/api/email/subscribers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          tags,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to update');
      toast.success('Subscriber updated');
      setSubscriber(data.subscriber);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update subscriber'));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusToggle() {
    if (!subscriber) return;
    const newStatus = subscriber.status === 'SUBSCRIBED' ? 'UNSUBSCRIBED' : 'SUBSCRIBED';
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/email/subscribers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to change status');
      toast.success(newStatus === 'UNSUBSCRIBED' ? 'Unsubscribed' : 'Re-subscribed');
      setSubscriber(data.subscriber);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to change status'));
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleDelete() {
    if (!subscriber) return;
    if (!window.confirm(`Permanently delete ${subscriber.email}? This cannot be undone.`))
      return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/email/subscribers/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to delete');
      toast.success('Subscriber deleted');
      router.push('/email/subscribers');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete subscriber'));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!subscriber) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/email/subscribers">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{subscriber.email}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  STATUS_COLORS[subscriber.status] ?? 'bg-gray-100 text-gray-600',
                )}
              >
                {STATUS_LABELS[subscriber.status] ?? subscriber.status}
              </span>
              <span className="text-xs text-gray-500">Source: {subscriber.source}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleStatusToggle}
            disabled={statusBusy}
            className="gap-2"
          >
            {statusBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : subscriber.status === 'SUBSCRIBED' ? (
              <UserMinus className="h-4 w-4" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
            {subscriber.status === 'SUBSCRIBED' ? 'Unsubscribe' : 'Re-subscribe'}
          </Button>
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={deleting}
            className="gap-2 text-red-600 hover:text-red-700"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Profile</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="vip, newsletter"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 text-sm">
            <h2 className="font-semibold text-gray-900 mb-2">Details</h2>
            <Row label="Subscribed" value={formatDate(subscriber.subscribedAt)} />
            <Row label="Unsubscribed" value={formatDate(subscriber.unsubscribedAt)} />
            <Row label="Created" value={formatDate(subscriber.createdAt)} />
            <Row label="Updated" value={formatDate(subscriber.updatedAt)} />
            <Row
              label="Shopify Customer ID"
              value={subscriber.shopifyCustomerId ?? '—'}
            />
            <Row
              label="Last Synced"
              value={formatDate(subscriber.syncedFromShopifyAt)}
            />
            {subscriber.suppressionReason && (
              <Row label="Suppression Reason" value={subscriber.suppressionReason} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 text-right break-all">{value}</span>
    </div>
  );
}
