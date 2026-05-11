'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { Plus, Loader2, Globe, ShieldCheck, ShieldAlert, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';

interface Domain {
  id: string;
  storeId: string;
  name: string;
  region: string;
  resendDomainId: string | null;
  status: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'FAILED';
  isDefault: boolean;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  VERIFIED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
  NOT_STARTED: 'bg-gray-100 text-gray-600',
};

const STATUS_LABELS: Record<string, string> = {
  VERIFIED: 'Verified',
  PENDING: 'Pending DNS',
  FAILED: 'Verification Failed',
  NOT_STARTED: 'Not Started',
};

const REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'eu-west-1', label: 'EU West (Ireland)' },
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
];

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function EmailDomainsPage() {
  const toast = useToast();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [resendConfigured, setResendConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('us-east-1');
  const [addBusy, setAddBusy] = useState(false);

  const fetchDomains = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email/domains', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setDomains(Array.isArray(data.domains) ? data.domains : []);
      setResendConfigured(Boolean(data.resendConfigured));
      if (!res.ok && !data?.domains) {
        throw new Error(data?.error ?? 'Failed to load domains');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load domains'));
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchDomains();
  }, [fetchDomains]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddBusy(true);
    try {
      const res = await fetch('/api/email/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim().toLowerCase(), region: newRegion }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to add domain');
      toast.success('Domain added. Now copy the DNS records into your domain registrar.');
      setAddOpen(false);
      setNewName('');
      void fetchDomains();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to add domain'));
    } finally {
      setAddBusy(false);
    }
  }

  function StatusIcon({ status }: { status: Domain['status'] }) {
    if (status === 'VERIFIED') return <ShieldCheck className="h-4 w-4 text-green-600" />;
    if (status === 'FAILED') return <ShieldAlert className="h-4 w-4 text-red-600" />;
    return <Clock className="h-4 w-4 text-yellow-600" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sending Domains</h1>
          <p className="mt-1 text-sm text-gray-500">
            Add and verify the domains you send email from. Required to send actual emails.
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="gap-2"
          disabled={!resendConfigured}
        >
          <Plus className="h-4 w-4" />
          Add Domain
        </Button>
      </div>

      {!resendConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-900 space-y-2">
            <p className="font-semibold">Resend is not configured</p>
            <p>
              To add and verify sending domains, sign up at{' '}
              <a
                href="https://resend.com"
                target="_blank"
                rel="noreferrer noopener"
                className="underline font-medium"
              >
                resend.com
              </a>{' '}
              (free for 3,000 emails/month), copy your API key, and add it to your Render
              environment as{' '}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded">RESEND_API_KEY</code>. Then
              redeploy and reload this page.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : domains.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Globe className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="mb-2">No sending domains yet.</p>
            <p className="text-sm">
              Add a domain like <code>mail.yourstore.com</code>, then paste the DNS records into
              your domain registrar.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Region
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Default
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Added
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {domains.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <Link
                      href={`/email/domains/${d.id}`}
                      className="text-gray-900 hover:text-indigo-600 font-medium"
                    >
                      {d.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
                        STATUS_COLORS[d.status] ?? 'bg-gray-100 text-gray-600',
                      )}
                    >
                      <StatusIcon status={d.status} />
                      {STATUS_LABELS[d.status] ?? d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{d.region}</td>
                  <td className="px-4 py-3 text-sm">
                    {d.isDefault ? (
                      <span className="text-indigo-600 font-medium">Default</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {addOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !addBusy && setAddOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg mb-4">Add Sending Domain</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <Label htmlFor="domain">Domain *</Label>
                <Input
                  id="domain"
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="mail.example.com"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Use a subdomain like <code>mail.yourstore.com</code> so it doesn't affect your
                  main domain's mail.
                </p>
              </div>
              <div>
                <Label htmlFor="region">Region</Label>
                <select
                  id="region"
                  value={newRegion}
                  onChange={e => setNewRegion(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {REGIONS.map(r => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                  disabled={addBusy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addBusy} className="gap-2">
                  {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {addBusy ? 'Adding…' : 'Add Domain'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
