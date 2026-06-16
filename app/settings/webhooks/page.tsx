'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useTenant } from '@/lib/tenant/tenant-context';
import {
  Plus, Copy, RefreshCw, Trash2, Pencil, Webhook, ArrowLeft, Activity, Loader2,
} from 'lucide-react';

const DATA_TYPES = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'events', label: 'Events' },
  { key: 'facebook_fbp', label: 'Facebook FBP' },
];

// Inbound event names a third party can send (mirrors the reference UI).
const EVENT_CATALOG = [
  'visitor', 'view', 'product_view', 'category_view',
  'addtocart', 'removefromcart', 'checkout',
  'orders/create', 'orders/paid', 'orders/updated', 'orders/fulfilled', 'hiu_tagged',
];

interface WebhookItem {
  id: string;
  name: string;
  description?: string | null;
  dataTypes: string[];
  events: string[];
  isActive: boolean;
  url: string;
  publicId: string;
  secret?: string;
  lastReceivedAt?: string | null;
  receivedCount: number;
  failureCount: number;
}

const emptyForm = { id: '', name: '', description: '', dataTypes: [] as string[], events: [] as string[], isActive: true };

export default function WebhooksPage() {
  const { currentStore } = useTenant();
  const storeId = currentStore?.id || '';
  const headers = { 'Content-Type': 'application/json', 'x-store-id': storeId };

  const [items, setItems] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [revealedSecret, setRevealedSecret] = useState<{ name: string; secret: string } | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<WebhookItem | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await fetch('/api/integrations/webhooks', { headers, cache: 'no-store' });
      const data = await res.json();
      setItems(data.webhooks || []);
    } catch {
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setForm({ ...emptyForm });
    setIsCreating(true);
    setDialogOpen(true);
  }
  function openEdit(w: WebhookItem) {
    setForm({ id: w.id, name: w.name, description: w.description || '', dataTypes: w.dataTypes, events: w.events, isActive: w.isActive });
    setIsCreating(false);
    setDialogOpen(true);
  }

  function toggleIn(list: string[], key: string) {
    return list.includes(key) ? list.filter(k => k !== key) : [...list, key];
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const url = isCreating ? '/api/integrations/webhooks' : `/api/integrations/webhooks/${form.id}`;
      const method = isCreating ? 'POST' : 'PUT';
      const res = await fetch(url, { method, headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to save'); return; }
      setDialogOpen(false);
      if (isCreating && data.webhook?.secret) {
        setRevealedSecret({ name: data.webhook.name, secret: data.webhook.secret });
      }
      toast.success(isCreating ? 'Webhook created' : 'Webhook updated');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function regenerate(w: WebhookItem) {
    if (!confirm(`Regenerate token for "${w.name}"? The old token will stop working immediately.`)) return;
    const res = await fetch(`/api/integrations/webhooks/${w.id}/regenerate-token`, { method: 'POST', headers });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed to regenerate'); return; }
    setRevealedSecret({ name: w.name, secret: data.secret });
  }

  async function remove(w: WebhookItem) {
    if (!confirm(`Delete webhook "${w.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/integrations/webhooks/${w.id}`, { method: 'DELETE', headers });
    if (!res.ok) { toast.error('Failed to delete'); return; }
    toast.success('Webhook deleted');
    await load();
  }

  async function toggleActive(w: WebhookItem) {
    const res = await fetch(`/api/integrations/webhooks/${w.id}`, {
      method: 'PUT', headers, body: JSON.stringify({ isActive: !w.isActive }),
    });
    if (res.ok) load();
  }

  async function openDeliveries(w: WebhookItem) {
    setDeliveriesFor(w);
    setDeliveries([]);
    const res = await fetch(`/api/integrations/webhooks/${w.id}/deliveries`, { headers, cache: 'no-store' });
    const data = await res.json();
    if (res.ok) setDeliveries(data.deliveries || []);
  }

  function copy(text: string, what: string) {
    navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`));
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Webhook className="h-6 w-6" /> Webhook Integrations</h1>
          <p className="text-sm text-muted-foreground">Receive contacts &amp; events from third-party systems. Data flows into Contacts, Segments, Journeys and Analytics.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> New Webhook</Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No webhooks yet. Create one to start ingesting third-party data.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {items.map(w => (
            <Card key={w.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{w.name}</CardTitle>
                    {w.isActive ? <Badge className="bg-green-600">Active</Badge> : <Badge variant="secondary">Disabled</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={w.isActive} onCheckedChange={() => toggleActive(w)} />
                    <Button variant="ghost" size="sm" onClick={() => openDeliveries(w)} title="Recent deliveries"><Activity className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(w)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => regenerate(w)} title="Regenerate token"><RefreshCw className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(w)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{w.url}</code>
                  <Button variant="outline" size="sm" onClick={() => copy(w.url, 'URL')}><Copy className="h-3 w-3 mr-1" /> Copy URL</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {w.dataTypes.map(d => <Badge key={d} variant="outline">{d}</Badge>)}
                  {w.events.map(e => <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Received: {w.receivedCount} · Failures: {w.failureCount}
                  {w.lastReceivedAt ? ` · Last: ${new Date(w.lastReceivedAt).toLocaleString()}` : ''}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? 'New Webhook' : 'Edit Webhook'}</DialogTitle>
            <DialogDescription>Dorza generates the ingest URL + token. Configure what this integration accepts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Storefront pixel" className="mt-1" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium">Data types to receive</Label>
              <div className="flex gap-4 mt-2">
                {DATA_TYPES.map(d => (
                  <label key={d.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded" checked={form.dataTypes.includes(d.key)}
                      onChange={() => setForm({ ...form, dataTypes: toggleIn(form.dataTypes, d.key) })} />
                    <span className="text-sm">{d.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Events</Label>
              <p className="text-xs text-muted-foreground">Leave empty to accept any event name.</p>
              <div className="grid grid-cols-2 gap-1 mt-2 max-h-44 overflow-y-auto pr-1">
                {EVENT_CATALOG.map(ev => (
                  <label key={ev} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded" checked={form.events.includes(ev)}
                      onChange={() => setForm({ ...form, events: toggleIn(form.events, ev) })} />
                    <span className="text-sm">{ev}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <Label>Active</Label>
              <Switch checked={form.isActive} onCheckedChange={c => setForm({ ...form, isActive: c })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isCreating ? 'Create' : 'Update'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret reveal (shown once) */}
      <Dialog open={!!revealedSecret} onOpenChange={(o) => !o && setRevealedSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Token for “{revealedSecret?.name}”</DialogTitle>
            <DialogDescription>Copy this now — it is shown only once. Send it as <code>Authorization: Bearer &lt;token&gt;</code>.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-muted px-2 py-2 text-xs">{revealedSecret?.secret}</code>
            <Button size="sm" onClick={() => revealedSecret && copy(revealedSecret.secret, 'Token')}><Copy className="h-3 w-3 mr-1" /> Copy</Button>
          </div>
          <DialogFooter><Button onClick={() => setRevealedSecret(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliveries */}
      <Dialog open={!!deliveriesFor} onOpenChange={(o) => !o && setDeliveriesFor(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recent deliveries — {deliveriesFor?.name}</DialogTitle>
            <DialogDescription>Last 50 received payloads.</DialogDescription>
          </DialogHeader>
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No deliveries yet.</p>
          ) : (
            <div className="space-y-2">
              {deliveries.map(d => (
                <div key={d.id} className="rounded border p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{d.eventType}</span>
                    <span className={d.status === 'PROCESSED' ? 'text-green-600' : d.status === 'FAILED' ? 'text-red-500' : 'text-muted-foreground'}>{d.status}</span>
                  </div>
                  <div className="text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</div>
                  {d.error && <div className="text-red-500">{d.error}</div>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
