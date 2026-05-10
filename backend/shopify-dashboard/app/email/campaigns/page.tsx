'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Users,
  Eye,
  MousePointerClick,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { toast } from 'sonner';

const EMAIL_API = process.env.NEXT_PUBLIC_EMAIL_API || 'http://localhost:5000/api/email';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  channel: string;
  templateId?: string;
  scheduledAt?: string;
  sentAt?: string;
  recipients: number;
  metrics?: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
  };
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-green-100 text-green-700',
  paused: 'bg-orange-100 text-orange-700',
  failed: 'bg-red-100 text-red-700',
};

export default function EmailCampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newChannel, setNewChannel] = useState('email');
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ storeId: 'tsg-api.myshopify.com' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`${EMAIL_API}/campaigns?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchCampaigns();
    fetch(`${EMAIL_API}/templates?storeId=tsg-api.myshopify.com`)
      .then(r => r.json())
      .then(d => setTemplates(d.templates || []))
      .catch(() => {});
  }, [fetchCampaigns]);

  async function handleCreate() {
    if (!newName.trim() || !newSubject.trim()) {
      toast.error('Name and subject are required');
      return;
    }
    try {
      const res = await fetch(`${EMAIL_API}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          subject: newSubject,
          channel: newChannel,
          templateId: selectedTemplate || undefined,
          storeId: 'tsg-api.myshopify.com',
        }),
      });
      if (res.ok) {
        toast.success('Campaign created!');
        setShowCreateForm(false);
        setNewName('');
        setNewSubject('');
        setSelectedTemplate('');
        fetchCampaigns();
      }
    } catch {
      toast.error('Failed to create campaign');
    }
  }

  async function handleSend(id: string) {
    try {
      const res = await fetch(`${EMAIL_API}/campaigns/${id}/send`, { method: 'POST' });
      if (res.ok) {
        toast.success('Campaign is being sent!');
        fetchCampaigns();
      }
    } catch {
      toast.error('Failed to send campaign');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this campaign?')) return;
    try {
      const res = await fetch(`${EMAIL_API}/campaigns/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Campaign deleted');
        fetchCampaigns();
      }
    } catch {
      toast.error('Failed to delete campaign');
    }
  }

  const filtered = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.85) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="relative flex flex-col gap-4 px-8 py-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 text-white">
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <Send className="h-8 w-8" />
                Email Campaigns
              </h1>
              <p className="text-sm text-blue-100">Create and manage email campaigns</p>
            </div>
            <Button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-white text-blue-700 hover:bg-blue-50">
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">New Email Campaign</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Campaign Name *</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Summer Sale 2025" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Subject Line *</label>
                <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="e.g., Don't miss our biggest sale!" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Channel</label>
                <select value={newChannel} onChange={(e) => setNewChannel(e.target.value)} className="w-full bg-white border rounded-md px-3 py-2 text-sm">
                  <option value="email">Email Only</option>
                  <option value="whatsapp">WhatsApp Only</option>
                  <option value="mixed">Email + WhatsApp</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Template</label>
                <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} className="w-full bg-white border rounded-md px-3 py-2 text-sm">
                  <option value="">Select template...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} className="bg-blue-600 text-white hover:bg-blue-700">Create Campaign</Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns..." className="pl-9" />
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {['all', 'draft', 'scheduled', 'sent', 'sending'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 text-xs rounded-md transition-colors capitalize', statusFilter === s ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500')}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Campaign List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Send className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium text-gray-700">No campaigns found</p>
              <p className="text-sm">Create your first email campaign to get started</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{c.name}</h3>
                      <Badge className={cn('rounded-full px-3 py-1 text-xs font-semibold capitalize', STATUS_STYLES[c.status] || 'bg-gray-100 text-gray-700')}>
                        {c.status}
                      </Badge>
                      <Badge className="bg-indigo-100 text-indigo-700 text-xs capitalize">{c.channel}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.status === 'draft' && (
                        <Button size="sm" onClick={() => handleSend(c.id)} className="bg-green-600 text-white hover:bg-green-700">
                          <Play className="h-4 w-4 mr-1" /> Send
                        </Button>
                      )}
                      {c.status === 'sent' && (
                        <Button size="sm" variant="outline" onClick={() => router.push(`/email/analytics?campaign=${c.id}`)}>
                          <Eye className="h-4 w-4 mr-1" /> Analytics
                        </Button>
                      )}
                      <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 mb-3">Subject: {c.subject}</p>

                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {c.recipients || 0} recipients</span>
                    {c.metrics && (
                      <>
                        <span className="flex items-center gap-1"><Send className="h-4 w-4" /> {c.metrics.sent} sent</span>
                        <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {c.metrics.opened} opened</span>
                        <span className="flex items-center gap-1"><MousePointerClick className="h-4 w-4" /> {c.metrics.clicked} clicked</span>
                      </>
                    )}
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
