'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';

interface SystemSettings {
  systemName: string;
  supportEmail: string;
  supportPhone: string;
  maintenanceMode: boolean;
  featureFlags: {
    multiStore: boolean;
    userRoles: boolean;
    rfmSegmentation: boolean;
    predictiveAnalytics: boolean;
  };
  security: {
    sessionTimeout: number;
    require2FA: boolean;
    ipWhitelist: string[];
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireNumber: boolean;
  };
  api: {
    rateLimit: number;
    rateLimitWindow: number;
  };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (response.ok) {
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (path: string[], value: any) => {
    if (!settings) return;

    const newSettings = { ...settings };
    let current: any = newSettings;

    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }

    current[path[path.length - 1]] = value;
    setSettings(newSettings);
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            Configure system settings and preferences
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="system" className="space-y-4">
        <TabsList>
          <TabsTrigger value="system">System Configuration</TabsTrigger>
          <TabsTrigger value="features">Feature Flags</TabsTrigger>
          <TabsTrigger value="security">Security Settings</TabsTrigger>
          <TabsTrigger value="api">API Settings</TabsTrigger>
        </TabsList>

        {/* System Configuration */}
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                Basic system information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="systemName">System Name</Label>
                <Input
                  id="systemName"
                  value={settings.systemName}
                  onChange={(e) => updateSettings(['systemName'], e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => updateSettings(['supportEmail'], e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="supportPhone">Support Phone</Label>
                <Input
                  id="supportPhone"
                  value={settings.supportPhone}
                  onChange={(e) => updateSettings(['supportPhone'], e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="maintenanceMode">Maintenance Mode</Label>
                  <p className="text-sm text-gray-500">
                    Enable maintenance mode to restrict access
                  </p>
                </div>
                <Switch
                  id="maintenanceMode"
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) => updateSettings(['maintenanceMode'], checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Flags */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>
                Enable or disable system features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Multi-Store Support</Label>
                  <p className="text-sm text-gray-500">
                    Allow multiple Shopify stores per account
                  </p>
                </div>
                <Switch
                  checked={settings.featureFlags.multiStore}
                  onCheckedChange={(checked) =>
                    updateSettings(['featureFlags', 'multiStore'], checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>User Role Management</Label>
                  <p className="text-sm text-gray-500">
                    Enable role-based access control
                  </p>
                </div>
                <Switch
                  checked={settings.featureFlags.userRoles}
                  onCheckedChange={(checked) =>
                    updateSettings(['featureFlags', 'userRoles'], checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>RFM Segmentation (Beta)</Label>
                  <p className="text-sm text-gray-500">
                    Enable RFM customer segmentation
                  </p>
                </div>
                <Switch
                  checked={settings.featureFlags.rfmSegmentation}
                  onCheckedChange={(checked) =>
                    updateSettings(['featureFlags', 'rfmSegmentation'], checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Predictive Analytics (Beta)</Label>
                  <p className="text-sm text-gray-500">
                    Enable predictive analytics features
                  </p>
                </div>
                <Switch
                  checked={settings.featureFlags.predictiveAnalytics}
                  onCheckedChange={(checked) =>
                    updateSettings(['featureFlags', 'predictiveAnalytics'], checked)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure security and authentication settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  min="5"
                  max="480"
                  value={settings.security.sessionTimeout}
                  onChange={(e) =>
                    updateSettings(['security', 'sessionTimeout'], parseInt(e.target.value))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require 2FA for Admin</Label>
                  <p className="text-sm text-gray-500">
                    Force two-factor authentication for admin accounts
                  </p>
                </div>
                <Switch
                  checked={settings.security.require2FA}
                  onCheckedChange={(checked) =>
                    updateSettings(['security', 'require2FA'], checked)
                  }
                />
              </div>
              <div>
                <Label htmlFor="passwordMinLength">Minimum Password Length</Label>
                <Input
                  id="passwordMinLength"
                  type="number"
                  min="6"
                  max="32"
                  value={settings.security.passwordMinLength}
                  onChange={(e) =>
                    updateSettings(['security', 'passwordMinLength'], parseInt(e.target.value))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Uppercase in Password</Label>
                </div>
                <Switch
                  checked={settings.security.passwordRequireUppercase}
                  onCheckedChange={(checked) =>
                    updateSettings(['security', 'passwordRequireUppercase'], checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Number in Password</Label>
                </div>
                <Switch
                  checked={settings.security.passwordRequireNumber}
                  onCheckedChange={(checked) =>
                    updateSettings(['security', 'passwordRequireNumber'], checked)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Settings */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Settings</CardTitle>
              <CardDescription>
                Configure API rate limits and restrictions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="rateLimit">Rate Limit (requests)</Label>
                <Input
                  id="rateLimit"
                  type="number"
                  min="100"
                  value={settings.api.rateLimit}
                  onChange={(e) =>
                    updateSettings(['api', 'rateLimit'], parseInt(e.target.value))
                  }
                />
              </div>
              <div>
                <Label htmlFor="rateLimitWindow">Rate Limit Window (seconds)</Label>
                <Input
                  id="rateLimitWindow"
                  type="number"
                  min="60"
                  value={settings.api.rateLimitWindow}
                  onChange={(e) =>
                    updateSettings(['api', 'rateLimitWindow'], parseInt(e.target.value))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

