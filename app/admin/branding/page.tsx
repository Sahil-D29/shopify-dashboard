'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { Loader2, Save, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/hooks/useToast';

interface Settings {
  appName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  supportEmail: string;
  supportPhone: string;
  supportUrl: string;
  helpDocsUrl: string;
  primaryColor: string;
  accentColor: string;
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function AdminBrandingPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings>({
    appName: 'dorza.io',
    tagline: '',
    logoUrl: '',
    faviconUrl: '',
    supportEmail: '',
    supportPhone: '',
    supportUrl: '',
    helpDocsUrl: '',
    primaryColor: '#1a1a2e',
    accentColor: '#e94560',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/app-settings', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load settings');
      if (data?.settings) setSettings(data.settings);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load settings'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/app-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to save');
      toast.success('Branding saved — refresh any open tabs to see changes');
      if (data?.settings) setSettings(data.settings);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save settings'));
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
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Palette className="h-6 w-6" />
            App Branding & Support
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Customize the product name, logo, and customer support information shown to all
            store users.
          </p>
        </div>
        <Button type="submit" disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Product Identity</h2>
          <div>
            <Label htmlFor="appName">App Name *</Label>
            <Input
              id="appName"
              value={settings.appName}
              onChange={e => setSettings({ ...settings, appName: e.target.value })}
              placeholder="dorza.io"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Shown in the sidebar header, browser tab title, and auth pages.
            </p>
          </div>
          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={settings.tagline}
              onChange={e => setSettings({ ...settings, tagline: e.target.value })}
              placeholder="Shopify Marketing Automation"
            />
            <p className="text-xs text-gray-500 mt-1">
              Used as the meta description in HTML &lt;title&gt; tags and SEO previews.
            </p>
          </div>
          <div>
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              type="url"
              value={settings.logoUrl}
              onChange={e => setSettings({ ...settings, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-gray-500 mt-1">
              Square or wide image (~32×32 to 200×40). Shown next to the app name in the sidebar.
            </p>
          </div>
          <div>
            <Label htmlFor="faviconUrl">Favicon URL</Label>
            <Input
              id="faviconUrl"
              type="url"
              value={settings.faviconUrl}
              onChange={e => setSettings({ ...settings, faviconUrl: e.target.value })}
              placeholder="https://example.com/favicon.ico"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Customer Support</h2>
          <div>
            <Label htmlFor="supportEmail">Support Email</Label>
            <Input
              id="supportEmail"
              type="email"
              value={settings.supportEmail}
              onChange={e => setSettings({ ...settings, supportEmail: e.target.value })}
              placeholder="support@yourdomain.com"
            />
          </div>
          <div>
            <Label htmlFor="supportPhone">Support Phone</Label>
            <Input
              id="supportPhone"
              type="tel"
              value={settings.supportPhone}
              onChange={e => setSettings({ ...settings, supportPhone: e.target.value })}
              placeholder="+1 555 123 4567"
            />
          </div>
          <div>
            <Label htmlFor="supportUrl">Help Center URL</Label>
            <Input
              id="supportUrl"
              type="url"
              value={settings.supportUrl}
              onChange={e => setSettings({ ...settings, supportUrl: e.target.value })}
              placeholder="https://help.yourdomain.com"
            />
          </div>
          <div>
            <Label htmlFor="helpDocsUrl">Documentation URL</Label>
            <Input
              id="helpDocsUrl"
              type="url"
              value={settings.helpDocsUrl}
              onChange={e => setSettings({ ...settings, helpDocsUrl: e.target.value })}
              placeholder="https://docs.yourdomain.com"
            />
          </div>
          <p className="text-xs text-gray-500">
            Each support link appears in the bottom of the sidebar for all users. Blank fields are
            hidden.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Theme Colors</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={e => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="h-9 w-12 rounded border border-gray-200 cursor-pointer"
                />
                <Input
                  id="primaryColor"
                  value={settings.primaryColor}
                  onChange={e => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="accentColor">Accent Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={e => setSettings({ ...settings, accentColor: e.target.value })}
                  className="h-9 w-12 rounded border border-gray-200 cursor-pointer"
                />
                <Input
                  id="accentColor"
                  value={settings.accentColor}
                  onChange={e => setSettings({ ...settings, accentColor: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Persisted now; full theme rollout to the UI will land in a follow-up.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h2 className="font-semibold text-blue-900 mb-2">Per-store sidebar controls</h2>
          <p className="text-sm text-blue-900">
            To enable/disable specific sidebar items for a particular store, open{' '}
            <strong>Admin → Stores → [store] → Sidebar Features</strong>.
          </p>
        </div>
      </div>
    </form>
  );
}
