'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Eye,
  EyeOff,
  Loader2,
  Save,
  Search,
  SlidersHorizontal,
  Store as StoreIcon,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';

type Mode = 'EVERYONE' | 'HIDDEN' | 'SELECTED';
type Group = 'main' | 'email' | 'settings';

interface CatalogItem {
  key: string;
  label: string;
  group: Group;
  href: string;
  routePrefixes: string[];
  parentKey?: string;
}

interface VisibilityRule {
  itemKey: string;
  mode: Mode;
  allowedStoreIds: string[];
  allowedUserIds: string[];
  notes: string;
}

interface StoreOption {
  id: string;
  storeName: string;
  shopifyDomain: string;
  isActive: boolean;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  status: string;
}

interface TargetPickerProps {
  title: string;
  icon: ReactNode;
  query: string;
  onQueryChange: (value: string) => void;
  selectedIds: string[];
  options: Array<{ id: string; primary: string; secondary: string; muted?: string }>;
  onToggle: (id: string) => void;
}

const MODE_LABELS: Record<Mode, string> = {
  EVERYONE: 'Show everyone',
  HIDDEN: 'Hide everyone',
  SELECTED: 'Selected users/stores',
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const createDefaultRule = (itemKey: string): VisibilityRule => ({
  itemKey,
  mode: 'EVERYONE',
  allowedStoreIds: [],
  allowedUserIds: [],
  notes: '',
});

export default function AdminSidebarVisibilityPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [rules, setRules] = useState<Record<string, VisibilityRule>>({});
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [storeQueries, setStoreQueries] = useState<Record<string, string>>({});
  const [userQueries, setUserQueries] = useState<Record<string, string>>({});

  const hydrateRules = useCallback((items: CatalogItem[], savedRules: VisibilityRule[]) => {
    const next: Record<string, VisibilityRule> = {};
    for (const item of items) next[item.key] = createDefaultRule(item.key);
    for (const rule of savedRules) {
      if (!next[rule.itemKey]) continue;
      next[rule.itemKey] = {
        itemKey: rule.itemKey,
        mode: rule.mode ?? 'EVERYONE',
        allowedStoreIds: Array.isArray(rule.allowedStoreIds) ? rule.allowedStoreIds : [],
        allowedUserIds: Array.isArray(rule.allowedUserIds) ? rule.allowedUserIds : [],
        notes: rule.notes ?? '',
      };
    }
    return next;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sidebar-visibility', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load sidebar visibility');

      const items = Array.isArray(data.catalog) ? data.catalog : [];
      setCatalog(items);
      setRules(hydrateRules(items, Array.isArray(data.rules) ? data.rules : []));
      setStores(Array.isArray(data.stores) ? data.stores : []);
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load sidebar visibility'));
    } finally {
      setLoading(false);
    }
  }, [hydrateRules, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(
    () => ({
      main: catalog.filter(item => item.group === 'main'),
      email: catalog.filter(item => item.group === 'email'),
      settings: catalog.filter(item => item.group === 'settings'),
    }),
    [catalog],
  );

  const counts = useMemo(() => {
    const values = Object.values(rules);
    return {
      everyone: values.filter(rule => rule.mode === 'EVERYONE').length,
      hidden: values.filter(rule => rule.mode === 'HIDDEN').length,
      selected: values.filter(rule => rule.mode === 'SELECTED').length,
    };
  }, [rules]);

  function updateRule(itemKey: string, patch: Partial<VisibilityRule>) {
    setRules(prev => ({
      ...prev,
      [itemKey]: {
        ...(prev[itemKey] ?? createDefaultRule(itemKey)),
        ...patch,
      },
    }));
  }

  function toggleSelectedId(itemKey: string, field: 'allowedStoreIds' | 'allowedUserIds', id: string) {
    const current = rules[itemKey] ?? createDefaultRule(itemKey);
    const selected = new Set(current[field]);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    updateRule(itemKey, { [field]: Array.from(selected) } as Partial<VisibilityRule>);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/sidebar-visibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: Object.values(rules) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to save sidebar visibility');

      setRules(hydrateRules(catalog, Array.isArray(data.rules) ? data.rules : []));
      toast.success('Sidebar visibility saved');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save sidebar visibility'));
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <SlidersHorizontal className="h-4 w-4" />
            System
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Sidebar Visibility</h1>
          <p className="mt-1 text-sm text-gray-500">
            Control merchant app sidebar items globally, or allow only selected stores and users.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard icon={<Eye className="h-4 w-4" />} label="Show everyone" value={counts.everyone} tone="green" />
        <SummaryCard icon={<EyeOff className="h-4 w-4" />} label="Hide everyone" value={counts.hidden} tone="gray" />
        <SummaryCard icon={<Users className="h-4 w-4" />} label="Selected access" value={counts.selected} tone="blue" />
      </div>

      <VisibilityPanel
        title="Main Navigation"
        items={grouped.main}
        rules={rules}
        stores={stores}
        users={users}
        storeQueries={storeQueries}
        userQueries={userQueries}
        onStoreQueryChange={(itemKey, value) =>
          setStoreQueries(prev => ({ ...prev, [itemKey]: value }))
        }
        onUserQueryChange={(itemKey, value) =>
          setUserQueries(prev => ({ ...prev, [itemKey]: value }))
        }
        onUpdate={updateRule}
        onToggle={toggleSelectedId}
      />

      <VisibilityPanel
        title="Email Marketing"
        items={grouped.email}
        rules={rules}
        stores={stores}
        users={users}
        storeQueries={storeQueries}
        userQueries={userQueries}
        onStoreQueryChange={(itemKey, value) =>
          setStoreQueries(prev => ({ ...prev, [itemKey]: value }))
        }
        onUserQueryChange={(itemKey, value) =>
          setUserQueries(prev => ({ ...prev, [itemKey]: value }))
        }
        onUpdate={updateRule}
        onToggle={toggleSelectedId}
      />

      <VisibilityPanel
        title="Settings Sections"
        items={grouped.settings}
        rules={rules}
        stores={stores}
        users={users}
        storeQueries={storeQueries}
        userQueries={userQueries}
        onStoreQueryChange={(itemKey, value) =>
          setStoreQueries(prev => ({ ...prev, [itemKey]: value }))
        }
        onUserQueryChange={(itemKey, value) =>
          setUserQueries(prev => ({ ...prev, [itemKey]: value }))
        }
        onUpdate={updateRule}
        onToggle={toggleSelectedId}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: 'green' | 'gray' | 'blue';
}) {
  const toneClass = {
    green: 'bg-green-50 text-green-700 border-green-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  }[tone];

  return (
    <div className={cn('rounded-lg border p-4', toneClass)}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{label}</div>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function VisibilityPanel({
  title,
  items,
  rules,
  stores,
  users,
  storeQueries,
  userQueries,
  onStoreQueryChange,
  onUserQueryChange,
  onUpdate,
  onToggle,
}: {
  title: string;
  items: CatalogItem[];
  rules: Record<string, VisibilityRule>;
  stores: StoreOption[];
  users: UserOption[];
  storeQueries: Record<string, string>;
  userQueries: Record<string, string>;
  onStoreQueryChange: (itemKey: string, value: string) => void;
  onUserQueryChange: (itemKey: string, value: string) => void;
  onUpdate: (itemKey: string, patch: Partial<VisibilityRule>) => void;
  onToggle: (
    itemKey: string,
    field: 'allowedStoreIds' | 'allowedUserIds',
    id: string,
  ) => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {items.map(item => {
          const rule = rules[item.key] ?? createDefaultRule(item.key);
          const selected = rule.mode === 'SELECTED';
          const storeQuery = storeQueries[item.key] ?? '';
          const userQuery = userQueries[item.key] ?? '';
          const storeOptions = stores
            .filter(store =>
              `${store.storeName} ${store.shopifyDomain}`.toLowerCase().includes(storeQuery.toLowerCase()),
            )
            .map(store => ({
              id: store.id,
              primary: store.storeName,
              secondary: store.shopifyDomain,
              muted: store.isActive ? undefined : 'Inactive',
            }));
          const userOptions = users
            .filter(user =>
              `${user.name} ${user.email}`.toLowerCase().includes(userQuery.toLowerCase()),
            )
            .map(user => ({
              id: user.id,
              primary: user.name,
              secondary: user.email,
              muted: user.status,
            }));

          return (
            <div key={item.key} className="p-5">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(220px,1fr)_220px_minmax(260px,1fr)]">
                <div className={cn('min-w-0', item.parentKey && 'pl-5')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-gray-900">{item.label}</div>
                    {item.parentKey && <Badge variant="outline">Child</Badge>}
                    {rule.mode === 'HIDDEN' && <Badge variant="secondary">Hidden</Badge>}
                    {rule.mode === 'SELECTED' && (
                      <Badge variant="outline">
                        {rule.allowedStoreIds.length + rule.allowedUserIds.length} selected
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs font-mono text-gray-500">{item.key}</div>
                  <div className="mt-1 text-xs text-gray-500">{item.href}</div>
                </div>

                <Select
                  value={rule.mode}
                  onValueChange={mode => onUpdate(item.key, { mode: mode as Mode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EVERYONE">{MODE_LABELS.EVERYONE}</SelectItem>
                    <SelectItem value="HIDDEN">{MODE_LABELS.HIDDEN}</SelectItem>
                    <SelectItem value="SELECTED">{MODE_LABELS.SELECTED}</SelectItem>
                  </SelectContent>
                </Select>

                <Textarea
                  value={rule.notes}
                  onChange={event => onUpdate(item.key, { notes: event.target.value })}
                  rows={2}
                  placeholder="Internal notes"
                  className="min-h-[40px] resize-y text-sm"
                />
              </div>

              {selected && (
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <TargetPicker
                    title="Allowed stores"
                    icon={<StoreIcon className="h-4 w-4" />}
                    query={storeQuery}
                    onQueryChange={value => onStoreQueryChange(item.key, value)}
                    selectedIds={rule.allowedStoreIds}
                    options={storeOptions}
                    onToggle={id => onToggle(item.key, 'allowedStoreIds', id)}
                  />
                  <TargetPicker
                    title="Allowed users"
                    icon={<Users className="h-4 w-4" />}
                    query={userQuery}
                    onQueryChange={value => onUserQueryChange(item.key, value)}
                    selectedIds={rule.allowedUserIds}
                    options={userOptions}
                    onToggle={id => onToggle(item.key, 'allowedUserIds', id)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TargetPicker({
  title,
  icon,
  query,
  onQueryChange,
  selectedIds,
  options,
  onToggle,
}: TargetPickerProps) {
  const selected = new Set(selectedIds);

  return (
    <div className="rounded-lg border border-gray-200">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          {icon}
          {title}
        </div>
        <span className="text-xs text-gray-500">{selectedIds.length} selected</span>
      </div>
      <div className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder="Search"
            className="pl-8"
          />
        </div>
        <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-gray-100">
          {options.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-500">No matches</div>
          ) : (
            options.map(option => (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-3 border-b border-gray-50 px-3 py-2 last:border-b-0 hover:bg-gray-50"
              >
                <Checkbox
                  checked={selected.has(option.id)}
                  onCheckedChange={() => onToggle(option.id)}
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {option.primary}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {option.secondary}
                  </span>
                </span>
                {option.muted && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {option.muted}
                  </span>
                )}
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
