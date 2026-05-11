'use client';

import { useState, FormEvent, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, ArrowLeft, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/hooks/useToast';

export interface TemplateFormValues {
  id?: string;
  name: string;
  description: string;
  category: string;
  subject: string;
  preheaderText: string;
  htmlBody: string;
  tags: string[];
}

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'welcome', label: 'Welcome' },
  { value: 'abandoned_cart', label: 'Abandoned Cart' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'winback', label: 'Win-Back' },
  { value: 'notification', label: 'Notification' },
  { value: 'post_purchase', label: 'Post-Purchase' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'custom', label: 'Custom' },
];

const DEFAULT_STARTER_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Email</title></head>
<body style="margin:0;padding:24px;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
    <h1 style="color:#1a1a2e;margin:0 0 16px;">Hi {{first_name}},</h1>
    <p style="color:#555;line-height:1.6;">
      Your message goes here. Use merge tags like {{shop_name}} and {{first_name}}
      to personalize.
    </p>
    <p style="text-align:center;margin-top:32px;">
      <a href="{{shop_url}}"
         style="background:#e94560;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;">
        Call to Action
      </a>
    </p>
  </div>
</body>
</html>`;

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

interface TemplateFormProps {
  mode: 'create' | 'edit';
  initial?: Partial<TemplateFormValues>;
}

export function TemplateForm({ mode, initial }: TemplateFormProps) {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'custom');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [preheaderText, setPreheaderText] = useState(initial?.preheaderText ?? '');
  const [htmlBody, setHtmlBody] = useState(initial?.htmlBody ?? DEFAULT_STARTER_HTML);
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(', '));
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const previewSrcDoc = useMemo(
    () => htmlBody || '<p style="padding:24px;color:#999;">Empty body</p>',
    [htmlBody],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      category,
      subject,
      preheaderText,
      htmlBody,
      tags,
    };

    setSaving(true);
    try {
      const url =
        mode === 'create'
          ? '/api/email/templates'
          : `/api/email/templates/${initial?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to save template');

      toast.success(mode === 'create' ? 'Template created' : 'Template updated');
      router.push('/email/templates');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save template'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/email/templates">
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'create' ? 'New Email Template' : 'Edit Template'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPreview(true)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Template'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Welcome Email"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="welcome, onboarding"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Welcome to {{shop_name}}!"
              />
            </div>
            <div>
              <Label htmlFor="preheader">Preheader Text</Label>
              <Input
                id="preheader"
                value={preheaderText}
                onChange={e => setPreheaderText(e.target.value)}
                placeholder="Shown after the subject in most inboxes"
              />
            </div>
            <div className="text-xs text-gray-500">
              Use merge tags like <code className="bg-gray-100 px-1 rounded">{'{{first_name}}'}</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">{'{{shop_name}}'}</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">{'{{shop_url}}'}</code>.
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 h-full">
            <Label htmlFor="htmlBody">HTML Body</Label>
            <textarea
              id="htmlBody"
              value={htmlBody}
              onChange={e => setHtmlBody(e.target.value)}
              className="w-full h-[520px] rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {showPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Preview</h3>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close preview"
              >
                &times;
              </button>
            </div>
            <div className="overflow-auto max-h-[80vh]">
              <iframe
                srcDoc={previewSrcDoc}
                title="Email Preview"
                className="w-full h-[600px] border-0"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
