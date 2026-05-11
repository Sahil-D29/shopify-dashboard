'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Eye, Copy, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';

interface EmailTemplate {
  id: string;
  storeId: string | null;
  name: string;
  description: string | null;
  category: string;
  subject: string;
  preheaderText: string;
  htmlBody: string;
  isGlobal: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  welcome: 'Welcome',
  abandoned_cart: 'Abandoned Cart',
  transactional: 'Transactional',
  promotional: 'Promotional',
  winback: 'Win-Back',
  notification: 'Notification',
  post_purchase: 'Post-Purchase',
  newsletter: 'Newsletter',
  custom: 'Custom',
};

const CATEGORY_COLORS: Record<string, string> = {
  welcome: 'bg-green-100 text-green-700',
  abandoned_cart: 'bg-orange-100 text-orange-700',
  transactional: 'bg-blue-100 text-blue-700',
  promotional: 'bg-red-100 text-red-700',
  winback: 'bg-purple-100 text-purple-700',
  notification: 'bg-yellow-100 text-yellow-700',
  post_purchase: 'bg-teal-100 text-teal-700',
  newsletter: 'bg-indigo-100 text-indigo-700',
  custom: 'bg-gray-100 text-gray-700',
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function EmailTemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email/templates', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data?.templates) {
        throw new Error(data?.error ?? 'Failed to load templates');
      }
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load templates'));
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  async function handleClone(template: EmailTemplate) {
    setBusyId(template.id);
    try {
      const res = await fetch(`/api/email/templates/${template.id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${template.name} (Copy)` }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to clone template');
      toast.success('Template cloned');
      void fetchTemplates();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to clone template'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(template: EmailTemplate) {
    if (template.isGlobal) {
      toast.warning('Built-in templates cannot be deleted');
      return;
    }
    if (!window.confirm(`Delete "${template.name}"?`)) return;
    setBusyId(template.id);
    try {
      const res = await fetch(`/api/email/templates/${template.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to delete template');
      toast.success('Template deleted');
      void fetchTemplates();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete template'));
    } finally {
      setBusyId(null);
    }
  }

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];
  const filtered = filter === 'all' ? templates : templates.filter(t => t.category === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            {loading ? 'Loading…' : `${templates.length} template${templates.length === 1 ? '' : 's'} available`}
          </p>
        </div>
        <Link href="/email/templates/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
              filter === cat
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
            )}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="h-48 bg-gray-100 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-5 bg-gray-100 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
          <p className="text-gray-500 mb-4">
            {templates.length === 0
              ? 'No email templates yet. Create your first one to get started.'
              : 'No templates in this category.'}
          </p>
          {templates.length === 0 && (
            <Link href="/email/templates/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Template
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(template => (
            <div
              key={template.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => setPreviewHtml(template.htmlBody || '<p style="padding:24px;color:#999;">No content yet</p>')}
                className="block w-full h-48 bg-gray-50 border-b border-gray-200 relative cursor-pointer group"
              >
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                  <div className="text-center">
                    <Eye className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    Click to Preview
                  </div>
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
              </button>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <h3 className="font-semibold text-gray-900 line-clamp-1">{template.name}</h3>
                  {template.isGlobal && (
                    <span className="shrink-0 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                      Built-in
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2 min-h-[2.5rem]">
                  {template.description || 'No description'}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'text-xs px-2.5 py-0.5 rounded-full font-medium',
                      CATEGORY_COLORS[template.category] ?? CATEGORY_COLORS.custom,
                    )}
                  >
                    {CATEGORY_LABELS[template.category] ?? template.category}
                  </span>
                  <div className="flex gap-1">
                    {!template.isGlobal && (
                      <Link href={`/email/templates/${template.id}`}>
                        <button
                          className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </Link>
                    )}
                    <button
                      onClick={() => handleClone(template)}
                      disabled={busyId === template.id}
                      className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                      aria-label="Clone"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    {!template.isGlobal && (
                      <button
                        onClick={() => handleDelete(template)}
                        disabled={busyId === template.id}
                        className="p-1.5 rounded text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewHtml && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPreviewHtml(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Template Preview</h3>
              <button
                onClick={() => setPreviewHtml(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close preview"
              >
                &times;
              </button>
            </div>
            <div className="overflow-auto max-h-[80vh]">
              <iframe
                srcDoc={previewHtml}
                title="Email Preview"
                className="w-full h-[600px] border-0"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
