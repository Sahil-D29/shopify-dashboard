'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Plus,
  Search,
  Copy,
  Trash2,
  Edit3,
  Eye,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';

const EMAIL_API = process.env.NEXT_PUBLIC_EMAIL_API || 'http://localhost:5000/api/email';

const CATEGORIES = [
  'all', 'custom', 'welcome', 'abandoned_cart', 'transactional',
  'promotional', 'winback', 'notification', 'post_purchase', 'newsletter',
];

const CATEGORY_COLORS: Record<string, string> = {
  custom: 'bg-gray-100 text-gray-700',
  welcome: 'bg-green-100 text-green-700',
  abandoned_cart: 'bg-amber-100 text-amber-700',
  transactional: 'bg-blue-100 text-blue-700',
  promotional: 'bg-pink-100 text-pink-700',
  winback: 'bg-purple-100 text-purple-700',
  notification: 'bg-cyan-100 text-cyan-700',
  post_purchase: 'bg-indigo-100 text-indigo-700',
  newsletter: 'bg-orange-100 text-orange-700',
};

interface Template {
  id: string;
  name: string;
  subject: string;
  category: string;
  previewUrl?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ storeId: 'tsg-api.myshopify.com' });
      if (category !== 'all') params.set('category', category);
      if (search) params.set('search', search);

      const res = await fetch(`${EMAIL_API}/templates?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  async function handleClone(id: string) {
    try {
      const res = await fetch(`${EMAIL_API}/templates/${id}/clone`, { method: 'POST' });
      if (res.ok) {
        toast.success('Template cloned!');
        fetchTemplates();
      }
    } catch {
      toast.error('Failed to clone template');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await fetch(`${EMAIL_API}/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Template deleted');
        fetchTemplates();
      }
    } catch {
      toast.error('Failed to delete template');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-600 via-pink-700 to-fuchsia-800 shadow-xl">
          <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.85) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="relative flex flex-col gap-4 px-8 py-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 text-white">
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <FileText className="h-8 w-8" />
                Email Templates
              </h1>
              <p className="text-sm text-rose-100">Design and manage your email templates</p>
            </div>
            <Button
              onClick={() => router.push('/email/builder')}
              className="bg-white text-pink-700 hover:bg-pink-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-full transition-colors capitalize border',
                    category === cat
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {cat === 'all' ? 'All' : cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Template Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600" />
          </div>
        ) : templates.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium text-gray-700">No templates found</p>
              <p className="text-sm mb-4">Create your first email template to get started</p>
              <Button onClick={() => router.push('/email/builder')} className="bg-blue-600 text-white hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((t) => (
              <div
                key={t.id}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                {/* Preview Area */}
                <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative">
                  {t.previewUrl ? (
                    <img src={t.previewUrl} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <Mail className="h-16 w-16 text-gray-300" />
                  )}
                  {t.isDefault && (
                    <Badge className="absolute top-3 left-3 bg-blue-600 text-white text-xs">Default</Badge>
                  )}
                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <Button
                      size="sm"
                      onClick={() => router.push(`/email/builder/${t.id}`)}
                      className="bg-white text-gray-900 hover:bg-gray-100"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleClone(t.id)}
                      className="bg-white/90 hover:bg-white"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Clone
                    </Button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 truncate">{t.name}</h3>
                    <Badge className={cn('text-xs capitalize', CATEGORY_COLORS[t.category] || 'bg-gray-100 text-gray-700')}>
                      {t.category.replace('_', ' ')}
                    </Badge>
                  </div>
                  {t.subject && (
                    <p className="text-sm text-gray-500 truncate">Subject: {t.subject}</p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      {new Date(t.updatedAt || t.createdAt).toLocaleDateString()}
                    </span>
                    {!t.isDefault && (
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
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
