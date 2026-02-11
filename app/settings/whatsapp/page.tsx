'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, Phone, ShieldCheck, RefreshCcw } from 'lucide-react';
import { WhatsAppConfig, WhatsAppConfigManager } from '@/lib/whatsapp-config';

interface TestConnectionResponse {
  success: boolean;
  phoneNumber?: string;
  error?: string;
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function WhatsAppSettingsPage() {
  const [config, setConfig] = useState<WhatsAppConfig>({
    wabaId: '',
    phoneNumberId: '',
    accessToken: '',
    appId: '',
    appSecret: '',
    isVerified: false,
    configuredAt: 0,
  });
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<null | { success: boolean; message: string }>(null);

  useEffect(() => {
    const existing = WhatsAppConfigManager.getConfig();
    if (existing) setConfig(existing);
  }, []);

  const onChange = (field: keyof WhatsAppConfig, value: WhatsAppConfig[typeof field]) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/whatsapp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wabaId: config.wabaId,
          phoneNumberId: config.phoneNumberId,
          accessToken: config.accessToken,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as TestConnectionResponse | undefined;
      if (res.ok && data?.success) {
        setTestResult({
          success: true,
          message: `Connection successful! Connected to: ${data.phoneNumber || 'N/A'}`,
        });
        onChange('connectedPhoneNumber', data?.phoneNumber ?? '');
        onChange('isVerified', true);
      } else {
        setTestResult({
          success: false,
          message: data?.error ?? 'Invalid credentials',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: getErrorMessage(error, 'Connection failed'),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      WhatsAppConfigManager.saveConfig(config);
      setTestResult({ success: true, message: 'Configuration saved successfully.' });
    } catch (error) {
      setTestResult({
        success: false,
        message: getErrorMessage(error, 'Failed to save configuration'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('Reset WhatsApp configuration?')) return;
    WhatsAppConfigManager.clearConfig();
    setConfig({
      wabaId: '',
      phoneNumberId: '',
      accessToken: '',
      appId: '',
      appSecret: '',
      isVerified: false,
      configuredAt: 0,
    });
    setTestResult(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp Settings</h1>
          <p className="text-muted-foreground">Configure WhatsApp Business API credentials</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
          <CardDescription>Enter your verified WhatsApp Business credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wabaId">Business Account ID (WABA ID)</Label>
              <Input id="wabaId" placeholder="854321680362580" value={config.wabaId} onChange={e => onChange('wabaId', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumberId">Phone Number ID</Label>
              <Input id="phoneNumberId" placeholder="901548389701354" value={config.phoneNumberId} onChange={e => onChange('phoneNumberId', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessToken">Access Token</Label>
            <div className="relative">
              <Input id="accessToken" type={showAccessToken ? 'text' : 'password'} placeholder="EAAG..." value={config.accessToken} onChange={e => onChange('accessToken', e.target.value)} className="pr-10" />
              <button type="button" onClick={() => setShowAccessToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appId">Meta App ID</Label>
              <Input id="appId" placeholder="2044883972927043" value={config.appId} onChange={e => onChange('appId', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appSecret">Meta App Secret</Label>
              <div className="relative">
                <Input id="appSecret" type={showAppSecret ? 'text' : 'password'} placeholder="********" value={config.appSecret} onChange={e => onChange('appSecret', e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setShowAppSecret(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showAppSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-md border ${testResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              {testResult.success ? <ShieldCheck className="h-4 w-4" /> : <RefreshCcw className="h-4 w-4" />}
              <span className="text-sm">{testResult.message}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleTest} variant="outline" disabled={testing}>
              {testing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...</>) : (<><Phone className="mr-2 h-4 w-4" /> Test Connection</>)}
            </Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : 'Save Configuration'}</Button>
            <Button onClick={handleReset} variant="destructive">Reset</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Help</CardTitle>
          <CardDescription>Use permanent tokens; webhook setup is not required for this feature.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>After saving, you can manage templates via the Templates section in the sidebar.</p>
        </CardContent>
      </Card>
    </div>
  );
}


