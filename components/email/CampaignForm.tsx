'use client';

import { useState, useEffect, FormEvent, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Save,
  ArrowLeft,
  Eye,
  Loader2,
  Send as SendIcon,
  FlaskConical,
  Clock,
  Zap,
  Mail,
  LayoutGrid,
  Code2,
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

export interface CampaignFormValues {
  id?: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  preheaderText: string;
  htmlBody: string;
  jsonDesign?: unknown;
  audienceMode: 'ALL_SUBSCRIBERS' | 'SEGMENTS';
  scheduleType: 'IMMEDIATE' | 'SCHEDULED';
  scheduledAt: string; // ISO string for datetime-local
  abTestEnabled: boolean;
  abTestPercent: number;
  abTestVariantSubject: string;
  abTestWinnerMetric: 'OPEN_RATE' | 'CLICK_RATE';
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  preheaderText: string;
  htmlBody: string;
  jsonDesign?: unknown;
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

interface VerifiedDomain {
  id: string;
  name: string;
  isDefault: boolean;
}

const DEFAULT_HTML_BODY = `<!DOCTYPE html>
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

interface Props {
  mode: 'create' | 'edit';
  initial?: Partial<CampaignFormValues>;
  campaignStatus?: string;
}

export function CampaignForm({ mode, initial, campaignStatus }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(initial?.name ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [fromName, setFromName] = useState(initial?.fromName ?? '');
  const [fromEmail, setFromEmail] = useState(initial?.fromEmail ?? '');
  const [replyTo, setReplyTo] = useState(initial?.replyTo ?? '');
  const [preheaderText, setPreheaderText] = useState(initial?.preheaderText ?? '');

  // Block-editor state
  const initialDoc = useMemo<EmailDocument>(() => {
    const parsed = parseEmailDocument(initial?.jsonDesign);
    if (parsed) return parsed;
    return makeStarterDocument();
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
    initial?.htmlBody ??
      (parseEmailDocument(initial?.jsonDesign)
        ? compileEmailDocument(initialDoc)
        : DEFAULT_HTML_BODY),
  );

  useEffect(() => {
    if (editorMode === 'visual') {
      setHtmlBody(compileEmailDocument(doc));
    }
  }, [doc, editorMode]);

  function switchToHtmlMode() {
    setHtmlBody(compileEmailDocument(doc));
    setEditorMode('html');
  }

  function switchToVisualMode() {
    if (
      htmlBody.trim() !== compileEmailDocument(doc).trim() &&
      !window.confirm(
        'Switching back to Visual mode will discard direct HTML edits and re-render from blocks. Continue?',
      )
    ) {
      return;
    }
    setEditorMode('visual');
  }

  const [audienceMode, setAudienceMode] = useState<CampaignFormValues['audienceMode']>(
    initial?.audienceMode ?? 'ALL_SUBSCRIBERS',
  );
  const [scheduleType, setScheduleType] = useState<CampaignFormValues['scheduleType']>(
    initial?.scheduleType ?? 'IMMEDIATE',
  );
  const [scheduledAt, setScheduledAt] = useState(initial?.scheduledAt ?? '');
  const [abTestEnabled, setAbTestEnabled] = useState(initial?.abTestEnabled ?? false);
  const [abTestPercent, setAbTestPercent] = useState(initial?.abTestPercent ?? 20);
  const [abTestVariantSubject, setAbTestVariantSubject] = useState(
    initial?.abTestVariantSubject ?? '',
  );
  const [abTestWinnerMetric, setAbTestWinnerMetric] = useState<'OPEN_RATE' | 'CLICK_RATE'>(
    initial?.abTestWinnerMetric ?? 'OPEN_RATE',
  );

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [domains, setDomains] = useState<VerifiedDomain[]>([]);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Load templates, domains, subscriber count
  useEffect(() => {
    void (async () => {
      try {
        const [tplRes, domRes, subRes] = await Promise.all([
          fetch('/api/email/templates', { cache: 'no-store' }),
          fetch('/api/email/domains', { cache: 'no-store' }),
          fetch('/api/email/subscribers?status=SUBSCRIBED&limit=1', { cache: 'no-store' }),
        ]);
        const tplData = await tplRes.json().catch(() => ({}));
        const domData = await domRes.json().catch(() => ({}));
        const subData = await subRes.json().catch(() => ({}));
        setTemplates(Array.isArray(tplData.templates) ? tplData.templates : []);
        setDomains(
          (Array.isArray(domData.domains) ? domData.domains : []).filter(
            (d: any) => d.status === 'VERIFIED',
          ),
        );
        setSubscriberCount(subData?.counts?.SUBSCRIBED ?? subData?.total ?? null);
      } catch (error) {
        console.warn('[CampaignForm] failed to load helpers:', error);
      }
    })();
  }, []);

  function applyTemplate(templateId: string) {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;
    if (htmlBody && htmlBody !== DEFAULT_HTML_BODY) {
      if (
        !window.confirm(
          'Loading this template will replace the current email design. Continue?',
        )
      )
        return;
    }
    const parsedTpl = parseEmailDocument(tpl.jsonDesign);
    if (parsedTpl) {
      // Template has a structured design — load it into the block editor
      setDoc(parsedTpl);
      setHtmlBody(compileEmailDocument(parsedTpl));
      setEditorMode('visual');
    } else {
      // Template is HTML-only — switch to HTML mode and load its body
      setHtmlBody(tpl.htmlBody);
      setEditorMode('html');
    }
    if (!subject) setSubject(tpl.subject);
    if (!preheaderText) setPreheaderText(tpl.preheaderText);
    toast.success(`Loaded template: ${tpl.name}`);
  }

  async function buildPayload(): Promise<any> {
    const compiledHtml = editorMode === 'visual' ? compileEmailDocument(doc) : htmlBody;
    return {
      name: name.trim(),
      subject: subject.trim(),
      fromName: fromName.trim(),
      fromEmail: fromEmail.trim(),
      replyTo: replyTo.trim() || null,
      preheaderText: preheaderText.trim() || null,
      htmlBody: compiledHtml,
      jsonDesign: editorMode === 'visual' ? doc : null,
      audienceMode,
      segmentIds: [],
      scheduleType,
      scheduledAt:
        scheduleType === 'SCHEDULED' && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : null,
      abTestEnabled,
      abTestPercent,
      abTestVariantSubject: abTestVariantSubject.trim() || null,
      abTestWinnerMetric,
    };
  }

  async function persist(): Promise<{ id: string } | null> {
    setSaving(true);
    try {
      const url =
        mode === 'create' ? '/api/email/campaigns' : `/api/email/campaigns/${initial?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const payload = await buildPayload();
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to save');
      return { id: data.campaign?.id ?? initial?.id ?? '' };
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save'));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e?: FormEvent) {
    e?.preventDefault();
    const saved = await persist();
    if (saved) {
      toast.success(mode === 'create' ? 'Campaign saved as draft' : 'Campaign updated');
      if (mode === 'create') router.push(`/email/campaigns/${saved.id}`);
      else router.refresh();
    }
  }

  async function handleSendNow() {
    if (!window.confirm(
      `Send this campaign to ${subscriberCount ?? 'all subscribed'} subscribers now? This cannot be undone.`,
    ))
      return;
    setSending(true);
    try {
      const saved = await persist();
      if (!saved) return;
      const res = await fetch(`/api/email/campaigns/${saved.id}/send`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to send');
      toast.success(
        `Campaign sent: ${data.sentCount} delivered, ${data.failedCount} failed`,
      );
      router.push(`/email/campaigns/${saved.id}`);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to send campaign'));
    } finally {
      setSending(false);
    }
  }

  async function handleSendTest() {
    if (!testEmail.trim()) {
      toast.warning('Enter a test email address');
      return;
    }
    setTesting(true);
    try {
      const saved = await persist();
      if (!saved) return;
      const res = await fetch(`/api/email/campaigns/${saved.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to send test');
      toast.success(`Test email sent to ${testEmail.trim()}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to send test'));
    } finally {
      setTesting(false);
    }
  }

  const previewSrcDoc = useMemo(
    () => htmlBody || '<p style="padding:24px;color:#999;">Empty body</p>',
    [htmlBody],
  );

  const isLocked =
    campaignStatus === 'SENDING' ||
    campaignStatus === 'COMPLETED' ||
    campaignStatus === 'CANCELLED';

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/email/campaigns">
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'create' ? 'New Campaign' : `Edit Campaign`}
          </h1>
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
          <Button type="submit" disabled={saving || isLocked} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Draft'}
          </Button>
          {!isLocked && scheduleType === 'IMMEDIATE' && (
            <Button
              type="button"
              onClick={handleSendNow}
              disabled={sending || saving}
              className="gap-2"
              variant="default"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
              {sending ? 'Sending…' : 'Send Now'}
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
          before you can send. You can still save as draft.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Email Details</h2>
            <div>
              <Label htmlFor="name">Campaign Name (internal) *</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="July Newsletter"
                required
                disabled={isLocked}
              />
            </div>
            <div>
              <Label htmlFor="subject">Subject Line *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Don't miss our summer sale, {{first_name}}!"
                required
                disabled={isLocked}
              />
            </div>
            <div>
              <Label htmlFor="preheader">Preheader Text</Label>
              <Input
                id="preheader"
                value={preheaderText}
                onChange={e => setPreheaderText(e.target.value)}
                placeholder="Shown after the subject line in most inboxes"
                disabled={isLocked}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fromName">From Name *</Label>
                <Input
                  id="fromName"
                  value={fromName}
                  onChange={e => setFromName(e.target.value)}
                  placeholder="Your Store"
                  required
                  disabled={isLocked}
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
                    disabled={isLocked}
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
                    disabled={isLocked}
                  />
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="replyTo">Reply-To (optional)</Label>
              <Input
                id="replyTo"
                type="email"
                value={replyTo}
                onChange={e => setReplyTo(e.target.value)}
                placeholder="support@yourdomain.com"
                disabled={isLocked}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-3 py-2 border-b bg-gray-50 flex-wrap">
              <CampaignModeTab
                active={editorMode === 'visual'}
                onClick={() => !isLocked && switchToVisualMode()}
                icon={LayoutGrid}
                label="Visual Blocks"
              />
              <CampaignModeTab
                active={editorMode === 'html'}
                onClick={() => !isLocked && switchToHtmlMode()}
                icon={Code2}
                label="HTML Code"
              />
              {templates.length > 0 && (
                <select
                  className="ml-auto text-xs rounded border border-gray-200 px-2 py-1 bg-white"
                  defaultValue=""
                  onChange={e => {
                    if (e.target.value) {
                      applyTemplate(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  disabled={isLocked}
                >
                  <option value="">Load from template…</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
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
                  disabled={isLocked}
                />
                <p className="text-xs text-amber-600">
                  ⚠️ HTML mode discards the visual block design on save. Switch back to
                  Visual to keep blocks.
                </p>
                <div className="text-xs text-gray-500">
                  Merge tags: <code className="bg-gray-100 px-1 rounded">{'{{first_name}}'}</code>{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{shop_name}}'}</code>{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{shop_url}}'}</code>{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{{unsubscribe_url}}'}</code>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Audience
            </h2>
            <div className="text-sm">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={audienceMode === 'ALL_SUBSCRIBERS'}
                  onChange={() => setAudienceMode('ALL_SUBSCRIBERS')}
                  className="mt-1"
                  disabled={isLocked}
                />
                <div>
                  <div className="font-medium text-gray-900">All subscribed</div>
                  <div className="text-xs text-gray-500">
                    {subscriberCount !== null
                      ? `${subscriberCount.toLocaleString()} subscriber${subscriberCount === 1 ? '' : 's'}`
                      : 'Loading…'}
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Schedule
            </h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button
                type="button"
                onClick={() => setScheduleType('IMMEDIATE')}
                disabled={isLocked}
                className={cn(
                  'border rounded-lg p-3 text-left transition-colors',
                  scheduleType === 'IMMEDIATE'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                    : 'border-gray-200 bg-white hover:bg-gray-50',
                )}
              >
                <Zap className="h-4 w-4 mb-1" />
                <div className="font-medium">Send Now</div>
                <div className="text-xs opacity-70">Immediate</div>
              </button>
              <button
                type="button"
                onClick={() => setScheduleType('SCHEDULED')}
                disabled={isLocked}
                className={cn(
                  'border rounded-lg p-3 text-left transition-colors',
                  scheduleType === 'SCHEDULED'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                    : 'border-gray-200 bg-white hover:bg-gray-50',
                )}
              >
                <Clock className="h-4 w-4 mb-1" />
                <div className="font-medium">Schedule</div>
                <div className="text-xs opacity-70">Pick date/time</div>
              </button>
            </div>
            {scheduleType === 'SCHEDULED' && (
              <div>
                <Label htmlFor="scheduledAt">Send at *</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  required
                  disabled={isLocked}
                />
                <p className="text-xs text-gray-500 mt-1">
                  In your local timezone. The cron runs every minute and picks up due campaigns.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              A/B Test (optional)
            </h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={abTestEnabled}
                onChange={e => setAbTestEnabled(e.target.checked)}
                disabled={isLocked}
              />
              <span className="text-sm font-medium text-gray-700">Test subject lines</span>
            </label>
            {abTestEnabled && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="variantBSubject">Variant B Subject</Label>
                  <Input
                    id="variantBSubject"
                    value={abTestVariantSubject}
                    onChange={e => setAbTestVariantSubject(e.target.value)}
                    placeholder="Alternative subject line"
                    disabled={isLocked}
                  />
                </div>
                <div>
                  <Label htmlFor="abPercent">% of audience for variant B</Label>
                  <Input
                    id="abPercent"
                    type="number"
                    min={1}
                    max={50}
                    value={abTestPercent}
                    onChange={e => setAbTestPercent(Number(e.target.value))}
                    disabled={isLocked}
                  />
                </div>
                <div>
                  <Label htmlFor="winnerMetric">Winner Metric</Label>
                  <select
                    id="winnerMetric"
                    value={abTestWinnerMetric}
                    onChange={e =>
                      setAbTestWinnerMetric(e.target.value as 'OPEN_RATE' | 'CLICK_RATE')
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    disabled={isLocked}
                  >
                    <option value="OPEN_RATE">Open Rate</option>
                    <option value="CLICK_RATE">Click Rate</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Send Test</h2>
            <Input
              type="email"
              placeholder="your@email.com"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              disabled={isLocked}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleSendTest}
              disabled={testing || saving || isLocked}
              className="w-full gap-2"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
              {testing ? 'Sending…' : 'Send Test Email'}
            </Button>
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
              <div>
                <h3 className="font-semibold">Preview</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Subject: <strong>{subject || '(empty)'}</strong>
                </p>
              </div>
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
                title="Campaign Preview"
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

function CampaignModeTab({
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
