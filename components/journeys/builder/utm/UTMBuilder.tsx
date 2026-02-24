'use client';

import { useCallback, useMemo, useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface UTMParams {
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
}

interface UTMBuilderProps {
  /** Auto-populate utm_campaign from the journey name */
  journeyName?: string;
  /** Called when the generated URL changes */
  onUrlChange?: (url: string, params: UTMParams) => void;
  className?: string;
}

const DEFAULT_PARAMS: UTMParams = {
  baseUrl: '',
  source: 'whatsapp',
  medium: 'message',
  campaign: '',
  content: '',
  term: '',
};

export function UTMBuilder({ journeyName, onUrlChange, className }: UTMBuilderProps) {
  const [params, setParams] = useState<UTMParams>({
    ...DEFAULT_PARAMS,
    campaign: journeyName
      ? journeyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : '',
  });
  const [copied, setCopied] = useState(false);

  const generatedUrl = useMemo(() => {
    if (!params.baseUrl.trim()) return '';
    try {
      const base = params.baseUrl.startsWith('http') ? params.baseUrl : `https://${params.baseUrl}`;
      const url = new URL(base);
      if (params.source) url.searchParams.set('utm_source', params.source);
      if (params.medium) url.searchParams.set('utm_medium', params.medium);
      if (params.campaign) url.searchParams.set('utm_campaign', params.campaign);
      if (params.content) url.searchParams.set('utm_content', params.content);
      if (params.term) url.searchParams.set('utm_term', params.term);
      return url.toString();
    } catch {
      return '';
    }
  }, [params]);

  const handleChange = useCallback(
    (field: keyof UTMParams, value: string) => {
      setParams(prev => {
        const next = { ...prev, [field]: value };
        return next;
      });
    },
    [],
  );

  // Notify parent when URL changes
  useMemo(() => {
    onUrlChange?.(generatedUrl, params);
  }, [generatedUrl, params, onUrlChange]);

  const handleCopy = useCallback(async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, [generatedUrl]);

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-indigo-500" />
        <h4 className="text-sm font-semibold text-[#4A4139]">UTM Link Builder</h4>
      </div>

      <p className="text-xs text-[#8B7F76]">
        Build tracked URLs with UTM parameters for WhatsApp messages. Paste the generated link into your template button URL.
      </p>

      {/* Fields */}
      <div className="space-y-2">
        <FieldRow label="Landing URL" required>
          <Input
            placeholder="https://yourstore.com/products/sale"
            value={params.baseUrl}
            onChange={e => handleChange('baseUrl', e.target.value)}
            className="h-8 text-xs"
          />
        </FieldRow>

        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Source">
            <Input
              placeholder="whatsapp"
              value={params.source}
              onChange={e => handleChange('source', e.target.value)}
              className="h-8 text-xs"
            />
          </FieldRow>
          <FieldRow label="Medium">
            <Input
              placeholder="message"
              value={params.medium}
              onChange={e => handleChange('medium', e.target.value)}
              className="h-8 text-xs"
            />
          </FieldRow>
        </div>

        <FieldRow label="Campaign">
          <Input
            placeholder="spring-sale-2025"
            value={params.campaign}
            onChange={e => handleChange('campaign', e.target.value)}
            className="h-8 text-xs"
          />
        </FieldRow>

        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Content" optional>
            <Input
              placeholder="hero-banner"
              value={params.content}
              onChange={e => handleChange('content', e.target.value)}
              className="h-8 text-xs"
            />
          </FieldRow>
          <FieldRow label="Term" optional>
            <Input
              placeholder="discount"
              value={params.term}
              onChange={e => handleChange('term', e.target.value)}
              className="h-8 text-xs"
            />
          </FieldRow>
        </div>
      </div>

      {/* Generated URL preview */}
      {generatedUrl ? (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 break-all text-xs font-medium text-indigo-700">
              {generatedUrl}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 shrink-0 gap-1 px-2 text-xs text-indigo-600 hover:bg-indigo-100"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-2.5 text-center text-[11px] italic text-slate-400">
          Enter a landing URL above to generate your tracked link
        </div>
      )}
    </div>
  );
}

/* ── Small field layout helper ── */

function FieldRow({
  label,
  required,
  optional,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1 text-[11px] font-medium text-[#6B5E54]">
        {label}
        {required && <span className="text-red-400">*</span>}
        {optional && <span className="text-slate-400">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
