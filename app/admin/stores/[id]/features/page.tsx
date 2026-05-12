'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Save,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';

interface Store {
  id: string;
  storeName: string;
  shopifyDomain: string;
}

interface Flags {
  storeId: string;
  disabledItems: string[];
  notes: string;
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function AdminStoreFeaturesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [store, setStore] = useState<Store | null>(null);
  const [catalog, setCatalog] = useState<Record<string, string>>({});
  const [allKeys, setAllKeys] = useState<string[]>([]);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stores/${id}/features`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load');
      setStore(data.store);
      setCatalog(data.catalog ?? {});
      setAllKeys(Array.isArray(data.allKeys) ? data.allKeys : []);
      setDisabled(new Set<string>(data.flags?.disabledItems ?? []));
      setNotes(data.flags?.notes ?? '');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load feature flags'));
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(key: string) {
    setDisabled(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function enableAll() {
    setDisabled(new Set());
  }

  function disableAll() {
    setDisabled(new Set(allKeys));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/stores/${id}/features`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disabledItems: Array.from(disabled),
          notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to save');
      toast.success(
        'Feature flags saved — users of this store will see the new sidebar on next page load',
      );
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!store) return null;

  const enabledCount = allKeys.length - disabled.size;

  // Group keys: regular items vs email submenu (prefix email_*)
  const emailKeys = allKeys.filter(k => k.startsWith('email_'));
  const regularKeys = allKeys.filter(k => !k.startsWith('email_'));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/admin/stores/${id}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Store
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sidebar Features</h1>
            <p className="mt-1 text-sm text-gray-500">
              {store.storeName} · <code>{store.shopifyDomain}</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={enableAll} className="gap-2">
            <Eye className="h-4 w-4" />
            Enable All
          </Button>
          <Button variant="outline" onClick={disableAll} className="gap-2">
            <EyeOff className="h-4 w-4" />
            Disable All
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <strong>{enabledCount}</strong> of <strong>{allKeys.length}</strong> sidebar items
        currently enabled for this store. Disabled items are completely hidden — users see no
        navigation entry and can't reach the page via the sidebar (URLs may still resolve unless
        you also remove access via permissions).
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Main Navigation" keys={regularKeys} catalog={catalog} disabled={disabled} toggle={toggle} />
        <Panel title="Email Marketing" keys={emailKeys} catalog={catalog} disabled={disabled} toggle={toggle} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
        <label htmlFor="notes" className="text-sm font-medium text-gray-700">
          Admin Notes (internal)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Why are these features disabled for this store? Plan downgrade, trial restriction, etc."
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}

function Panel({
  title,
  keys,
  catalog,
  disabled,
  toggle,
}: {
  title: string;
  keys: string[];
  catalog: Record<string, string>;
  disabled: Set<string>;
  toggle: (key: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {keys.map(key => {
          const enabled = !disabled.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors',
                !enabled && 'opacity-60',
              )}
            >
              {enabled ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <Square className="h-5 w-5 text-gray-300 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{catalog[key] ?? key}</div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">{key}</div>
              </div>
              <span
                className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
                )}
              >
                {enabled ? 'Enabled' : 'Hidden'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
