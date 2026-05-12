'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Save,
  ArrowLeft,
  Loader2,
  Eye,
  LayoutGrid,
  Code2,
  Pause,
  Play,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/hooks/useToast';
import { cn } from '@/lib/utils';
import { BlockEditor } from '@/components/email/BlockEditor';
import {
  type EmailDocument,
  createEmptyDocument,
  createBlock,
} from '@/lib/email/blocks/types';
import { compileEmailDocument, parseEmailDocument } from '@/lib/email/blocks/compile';

export interface CrossSellFormValues {
  id?: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  sourceProductIds: string[];
  targetProductIds: string[];
  emailDelayHours: number;
  subject: string;
  fromName: string;
  fromEmail: string;
  htmlBody: string;
  jsonDesign?: unknown;
}

interface VerifiedDomain {
  id: string;
  name: string;
  isDefault: boolean;
  status: string;
}

function makeStarterDocument(): EmailDocument {
  const doc = createEmptyDocument();
  doc.blocks = [
    createBlock('heading'),
    createBlock('text'),
    createBlock('button'),
    createBlock('divider'),
    createBlock('footer'),
  ];
  return doc;
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

interface Props {
  mode: 'create' | 'edit';
  initial?: Partial<CrossSellFormValues>;
  onDelete?: () => Promise<void>;
}

export function CrossSellForm({ mode, initial, onDelete }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED' | 'DRAFT'>(
    initial?.status ?? 'DRAFT',
  );
  const [sourceText, setSourceText] = useState(
    (initial?.sourceProductIds ?? []).join('\n'),
  );
  const [targetText, setTargetText] = useState(
    (initial?.targetProductIds ?? []).join('\n'),
  );
  const [emailDelayHours, setEmailDelayHours] = useState<number>(
    initial?.emailDelayHours ?? 24,
  );
  const [subject, setSubject] = useState(
    initial?.subject ?? 'You might also love these',
  );
  const [fromName, setFromName] = useState(initial?.fromName ?? '');
  const [fromEmail, setFromEmail] = useState(initial?.fromEmail ?? '');
  const [domains, setDomains] = useState<VerifiedDomain[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const initialDoc = useMemo<EmailDocument>(() => {
    const parsed = parseEmailDocument(initial?.jsonDesign);
    return parsed ?? makeStarterDocument();
  }, [initial?.jsonDesign]);
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>(() =>
    parseEmailDocument(initial?.jsonDesign)
      ? 'visual'
      : initial?.htmlBody
        ? 'html'
        : 'visual',
  );
  const [doc, setDoc] = useState<EmailDocument>(initialDoc);
  const [htmlBody, setHtmlBody] = useState(
    initial?.htmlBody ?? compileEmailDocument(initialDoc),
  );

  useEffect(() => {
    if (editorMode === 'visual') setHtmlBody(compileEmailDocument(doc));
  }, [doc, editorMode]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/email/domains', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        setDomains(
          (Array.isArray(data.domains) ? data.domains : []).filter(
            (d: any) => d.status === 'VERIFIED',
          ),
        );
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function parseIds(text: string): string[] {
    return text
      .split(/[\n,]/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!fromName.trim()) {
      toast.error('From Name is required');
      return;
    }
    if (!fromEmail.trim()) {
      toast.error('From Email is required');
      return;
    }
    setSaving(true);
    try {
      const compiledHtml = editorMode === 'visual' ? compileEmailDocument(doc) : htmlBody;
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        sourceProductIds: parseIds(sourceText),
        targetProductIds: parseIds(targetText),
        emailDelayHours: Number.isFinite(emailDelayHours) ? emailDelayHours : 24,
        subject: subject.trim(),
        fromName: fromName.trim(),
        fromEmail: fromEmail.trim(),
        htmlBody: compiledHtml,
        jsonDesign: editorMode === 'visual' ? doc : null,
      };
      const url =
        mode === 'create'
          ? '/api/email/cross-sell'
          : `/api/email/cross-sell/${initial?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to save');
      toast.success(mode === 'create' ? 'Rule created' : 'Rule updated');
      if (mode === 'create') {
        router.push(`/email/cross-sell/${data.rule.id}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save rule'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    const next = status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setStatus(next);
    if (mode === 'edit' && initial?.id) {
      try {
        const res = await fetch(`/api/email/cross-sell/${initial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? 'Failed to update');
        toast.success(next === 'ACTIVE' ? 'Rule activated' : 'Rule paused');
      } catch (error) {
        toast.error(getErrorMessage(error, 'Failed to toggle status'));
        setStatus(status); // revert
      }
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm('Delete this cross-sell rule? Existing scheduled emails will still send.'))
      return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const previewSrcDoc = useMemo(
    () => htmlBody || '<p style="padding:24px;color:#999;">Empty body</p>',
    [htmlBody],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/email/cross-sell">
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'create' ? 'New Cross-Sell Rule' : 'Edit Rule'}
          </h1>
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              status === 'ACTIVE'
                ? 'bg-green-100 text-green-700'
                : status === 'PAUSED'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-600',
            )}
          >
            {status}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPreview(true)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          {mode === 'edit' && (
            <Button
              type="button"
              variant="outline"
              onClick={handleToggleStatus}
              className="gap-2"
            >
              {status === 'ACTIVE' ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {status === 'ACTIVE' ? 'Pause' : 'Activate'}
            </Button>
          )}
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Rule'}
          </Button>
          {mode === 'edit' && onDelete && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2 text-red-600 hover:text-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          )}
        </div>
      </div>

      {domains.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          <strong>No verified sending domains.</strong> Add and verify a domain in{' '}
          <Link href="/email/domains" className="underline font-medium">
            Sending Domains
          </Link>{' '}
          before activating this rule.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Trigger</h2>
            <div>
              <Label htmlFor="name">Rule Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Post-purchase recommendations"
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
              <Label htmlFor="sourceText">Source Product IDs</Label>
              <textarea
                id="sourceText"
                value={sourceText}
                onChange={e => setSourceText(e.target.value)}
                rows={4}
                placeholder="One product ID per line. Leave empty to match any order."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-xs text-gray-500 mt-1">
                Trigger when a customer buys one of these products. Empty = trigger on any order.
              </p>
            </div>
            <div>
              <Label htmlFor="targetText">Target Product IDs (recommendations)</Label>
              <textarea
                id="targetText"
                value={targetText}
                onChange={e => setTargetText(e.target.value)}
                rows={4}
                placeholder="One product ID per line"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-xs text-gray-500 mt-1">
                Products to recommend in the email body. Reference them in your email template
                with merge tags or hardcoded blocks.
              </p>
            </div>
            <div>
              <Label htmlFor="delay">Email Delay (hours after order) *</Label>
              <Input
                id="delay"
                type="number"
                min={0}
                max={720}
                value={emailDelayHours}
                onChange={e => setEmailDelayHours(Number(e.target.value) || 0)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Wait this long after the order before sending. 24 hours is common.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Sender</h2>
            <div>
              <Label htmlFor="fromName">From Name *</Label>
              <Input
                id="fromName"
                value={fromName}
                onChange={e => setFromName(e.target.value)}
                placeholder="Your Store"
                required
              />
            </div>
            <div>
              <Label htmlFor="fromEmail">From Email *</Label>
              {domains.length > 0 ? (
                <select
                  id="fromEmail"
                  value={fromEmail}
                  onChange={e => setFromEmail(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="">Select…</option>
                  {domains.map(d => (
                    <option key={d.id} value={`hello@${d.name}`}>
                      hello@{d.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="fromEmail"
                  type="email"
                  value={fromEmail}
                  onChange={e => setFromEmail(e.target.value)}
                  placeholder="hello@yourdomain.com"
                  required
                />
              )}
            </div>
            <div>
              <Label htmlFor="subject">Subject Line *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="You might also love these, {{first_name}}"
                required
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-3 py-2 border-b bg-gray-50">
              <ModeTab
                active={editorMode === 'visual'}
                onClick={() => {
                  if (
                    htmlBody.trim() !== compileEmailDocument(doc).trim() &&
                    !window.confirm('Discard HTML edits and re-render from blocks?')
                  )
                    return;
                  setEditorMode('visual');
                }}
                icon={LayoutGrid}
                label="Visual Blocks"
              />
              <ModeTab
                active={editorMode === 'html'}
                onClick={() => {
                  setHtmlBody(compileEmailDocument(doc));
                  setEditorMode('html');
                }}
                icon={Code2}
                label="HTML Code"
              />
            </div>
            {editorMode === 'visual' ? (
              <div className="p-4">
                <BlockEditor value={doc} onChange={setDoc} />
              </div>
            ) : (
              <div className="p-4 space-y-2">
                <textarea
                  value={htmlBody}
                  onChange={e => setHtmlBody(e.target.value)}
                  className="w-full h-[420px] rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  spellCheck={false}
                />
                <p className="text-xs text-amber-600">
                  ⚠️ Saving in HTML mode discards the block design.
                </p>
              </div>
            )}
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
              >
                &times;
              </button>
            </div>
            <div className="overflow-auto max-h-[80vh]">
              <iframe
                srcDoc={previewSrcDoc}
                title="Preview"
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

function ModeTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
        active
          ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
          : 'text-gray-500 hover:text-gray-700',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
