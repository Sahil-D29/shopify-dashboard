'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, Copy } from 'lucide-react';
import { TemplateForm, TemplateFormValues } from '@/components/email/TemplateForm';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/useToast';

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function EditEmailTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [initial, setInitial] = useState<TemplateFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/email/templates/${id}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? 'Failed to load template');
        if (cancelled) return;
        const t = data.template;
        setReadOnly(Boolean(t.isGlobal));
        setInitial({
          id: t.id,
          name: t.name,
          description: t.description ?? '',
          category: t.category ?? 'custom',
          subject: t.subject ?? '',
          preheaderText: t.preheaderText ?? '',
          htmlBody: t.htmlBody ?? '',
          tags: Array.isArray(t.tags) ? t.tags : [],
          jsonDesign: t.jsonDesign ?? null,
        });
      } catch (error) {
        toast.error(getErrorMessage(error, 'Unable to load template'));
        router.push('/email/templates');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, router, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!initial) return null;

  if (readOnly) {
    async function handleClone() {
      try {
        const res = await fetch(`/api/email/templates/${initial!.id}/clone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `${initial!.name} (Copy)` }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? 'Failed to clone');
        toast.success('Template cloned — opening editor');
        router.push(`/email/templates/${data.template.id}`);
      } catch (error) {
        toast.error(getErrorMessage(error, 'Failed to clone template'));
      }
    }
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/email/templates">
              <Button type="button" variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{initial.name}</h1>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Built-in</span>
          </div>
          <Button onClick={handleClone} className="gap-2">
            <Copy className="h-4 w-4" />
            Clone to Edit
          </Button>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          This is a built-in template and cannot be edited directly. Clone it to make an editable copy in your store.
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="border-b p-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Subject: </span>
              <span className="text-gray-900">{initial.subject || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Category: </span>
              <span className="text-gray-900">{initial.category}</span>
            </div>
          </div>
          <iframe
            srcDoc={initial.htmlBody || '<p style="padding:24px;color:#999;">Empty body</p>'}
            title="Template preview"
            className="w-full h-[600px] border-0"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    );
  }

  return <TemplateForm mode="edit" initial={initial} />;
}
