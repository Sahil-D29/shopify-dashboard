'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Save } from 'lucide-react';
import { useToast } from '@/lib/hooks/useToast';

interface SubscriptionSettings {
  defaultSubscription: 'explicit_optin' | 'auto_optin';
  optOutKeywords: string[];
  optOutMessage: string;
  optInKeywords: string[];
  optInMessage: string;
}

export default function SubscriptionSettingsPage() {
  const [settings, setSettings] = useState<SubscriptionSettings>({
    defaultSubscription: 'explicit_optin',
    optOutKeywords: ['STOP', 'UNSUBSCRIBE', 'OPTOUT', 'QUIT'],
    optOutMessage: 'You have been unsubscribed from our WhatsApp messages. Reply START to resubscribe.',
    optInKeywords: ['START', 'SUBSCRIBE', 'YES'],
    optInMessage: 'Welcome! You\'re now subscribed to WhatsApp updates. Reply STOP to unsubscribe.',
  });
  const [newOptOutKeyword, setNewOptOutKeyword] = useState('');
  const [newOptInKeyword, setNewOptInKeyword] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/whatsapp/subscription');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || settings);
      }
    } catch (error) {
      console.error('[SubscriptionSettings] Failed to load', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/whatsapp/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error('Failed to save');

      toast.success('Subscription settings saved successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addOptOutKeyword = () => {
    if (newOptOutKeyword.trim() && !settings.optOutKeywords.includes(newOptOutKeyword.trim().toUpperCase())) {
      setSettings({
        ...settings,
        optOutKeywords: [...settings.optOutKeywords, newOptOutKeyword.trim().toUpperCase()],
      });
      setNewOptOutKeyword('');
    }
  };

  const removeOptOutKeyword = (keyword: string) => {
    setSettings({
      ...settings,
      optOutKeywords: settings.optOutKeywords.filter(k => k !== keyword),
    });
  };

  const addOptInKeyword = () => {
    if (newOptInKeyword.trim() && !settings.optInKeywords.includes(newOptInKeyword.trim().toUpperCase())) {
      setSettings({
        ...settings,
        optInKeywords: [...settings.optInKeywords, newOptInKeyword.trim().toUpperCase()],
      });
      setNewOptInKeyword('');
    }
  };

  const removeOptInKeyword = (keyword: string) => {
    setSettings({
      ...settings,
      optInKeywords: settings.optInKeywords.filter(k => k !== keyword),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscription Settings</h1>
        <p className="text-muted-foreground">
          Configure opt-in/opt-out keywords and confirmation messages
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default Subscription</CardTitle>
          <CardDescription>
            How users are subscribed to WhatsApp messages by default
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={settings.defaultSubscription === 'explicit_optin'}
                onChange={() => setSettings({ ...settings, defaultSubscription: 'explicit_optin' })}
              />
              <span className="text-sm">Require explicit opt-in</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={settings.defaultSubscription === 'auto_optin'}
                onChange={() => setSettings({ ...settings, defaultSubscription: 'auto_optin' })}
              />
              <span className="text-sm">Auto opt-in (with opt-out option)</span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opt-Out Keywords</CardTitle>
          <CardDescription>
            Case-insensitive keywords that trigger opt-out
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {settings.optOutKeywords.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="flex items-center gap-1">
                {keyword}
                <button
                  type="button"
                  onClick={() => removeOptOutKeyword(keyword)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add keyword..."
              value={newOptOutKeyword}
              onChange={(e) => setNewOptOutKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addOptOutKeyword()}
            />
            <Button onClick={addOptOutKeyword} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <Label>Opt-Out Confirmation Message</Label>
            <textarea
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              value={settings.optOutMessage}
              onChange={(e) => setSettings({ ...settings, optOutMessage: e.target.value })}
              placeholder="Message sent when user opts out..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opt-In Keywords</CardTitle>
          <CardDescription>
            Case-insensitive keywords that trigger opt-in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {settings.optInKeywords.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="flex items-center gap-1">
                {keyword}
                <button
                  type="button"
                  onClick={() => removeOptInKeyword(keyword)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add keyword..."
              value={newOptInKeyword}
              onChange={(e) => setNewOptInKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addOptInKeyword()}
            />
            <Button onClick={addOptInKeyword} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <Label>Opt-In Confirmation Message</Label>
            <textarea
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              value={settings.optInMessage}
              onChange={(e) => setSettings({ ...settings, optInMessage: e.target.value })}
              placeholder="Message sent when user opts in..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

