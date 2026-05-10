'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  RefreshCw,
  Shield,
  Mail,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

const EMAIL_API = process.env.NEXT_PUBLIC_EMAIL_API || 'http://localhost:5000/api/email';

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  priority?: number;
}

interface Domain {
  id: string;
  domain: string;
  status: string;
  dnsRecords: DnsRecord[];
  verifiedAt?: string;
  createdAt: string;
}

export default function DomainSettingsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  const fetchDomains = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${EMAIL_API}/domains?storeId=tsg-api.myshopify.com`);
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains || []);
      }
    } catch (err) {
      console.error('Failed to fetch domains:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  async function handleAdd() {
    if (!newDomain.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${EMAIL_API}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain, storeId: 'tsg-api.myshopify.com' }),
      });
      if (res.ok) {
        toast.success('Domain added! Configure the DNS records below.');
        setNewDomain('');
        fetchDomains();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add domain');
      }
    } catch {
      toast.error('Failed to add domain');
    } finally {
      setAdding(false);
    }
  }

  async function handleVerify(domainId: string) {
    setVerifying(domainId);
    try {
      const res = await fetch(`${EMAIL_API}/domains/${domainId}/verify`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.verified) {
          toast.success('Domain verified successfully!');
        } else {
          toast.error('DNS records not yet propagated. Try again in a few minutes.');
        }
        fetchDomains();
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setVerifying(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-700 to-fuchsia-800 shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.85) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="relative flex flex-col gap-4 px-8 py-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 text-white">
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <Globe className="h-8 w-8" />
                Domain Settings
              </h1>
              <p className="text-sm text-violet-100">Configure your sending domains with SPF, DKIM, and DMARC records</p>
            </div>
          </div>
        </div>

        {/* Add Domain */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Sending Domain</h2>
          <div className="flex gap-3">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="e.g., mail.yourdomain.com"
              className="flex-1"
            />
            <Button onClick={handleAdd} disabled={adding || !newDomain.trim()} className="bg-blue-600 text-white hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              {adding ? 'Adding...' : 'Add Domain'}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Enter the subdomain you want to send emails from. We recommend using a subdomain like mail.yourdomain.com.
          </p>
        </div>

        {/* Domain List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        ) : domains.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Globe className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium text-gray-700">No domains configured</p>
              <p className="text-sm">Add a sending domain above to get started</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {domains.map((domain) => (
              <div key={domain.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                {/* Domain Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    {statusIcon(domain.status)}
                    <div>
                      <h3 className="font-semibold text-gray-900">{domain.domain}</h3>
                      <p className="text-xs text-gray-500">
                        Added {new Date(domain.createdAt).toLocaleDateString()}
                        {domain.verifiedAt && ` • Verified ${new Date(domain.verifiedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Badge className={cn('rounded-full px-3 py-1 text-xs font-semibold capitalize', statusColor(domain.status))}>
                      {domain.status}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVerify(domain.id)}
                    disabled={verifying === domain.id || domain.status === 'verified'}
                  >
                    <RefreshCw className={cn('h-4 w-4 mr-2', verifying === domain.id && 'animate-spin')} />
                    {domain.status === 'verified' ? 'Verified' : 'Verify DNS'}
                  </Button>
                </div>

                {/* DNS Records */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span>Add these DNS records to your domain registrar (GoDaddy, Cloudflare, Namecheap, etc.)</span>
                  </div>

                  {domain.dnsRecords?.map((record, idx) => (
                    <div key={idx} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <Badge className="bg-blue-100 text-blue-700 text-xs font-mono">{record.type}</Badge>
                          {record.type === 'TXT' && record.value.startsWith('v=spf') && (
                            <span className="text-xs text-gray-500">SPF</span>
                          )}
                          {record.type === 'TXT' && record.value.startsWith('v=DKIM') && (
                            <span className="text-xs text-gray-500">DKIM</span>
                          )}
                          {record.type === 'TXT' && record.value.startsWith('v=DMARC') && (
                            <span className="text-xs text-gray-500">DMARC</span>
                          )}
                          {record.type === 'CNAME' && (
                            <span className="text-xs text-gray-500">DKIM</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 w-16">Name:</span>
                          <code className="flex-1 text-xs bg-white rounded px-2 py-1 border font-mono text-gray-800 truncate">
                            {record.name}
                          </code>
                          <button onClick={() => copyToClipboard(record.name)} className="text-gray-400 hover:text-gray-600">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 w-16">Value:</span>
                          <code className="flex-1 text-xs bg-white rounded px-2 py-1 border font-mono text-gray-800 truncate">
                            {record.value}
                          </code>
                          <button onClick={() => copyToClipboard(record.value)} className="text-gray-400 hover:text-gray-600">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                        {record.priority != null && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500 w-16">Priority:</span>
                            <code className="text-xs bg-white rounded px-2 py-1 border font-mono text-gray-800">{record.priority}</code>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
