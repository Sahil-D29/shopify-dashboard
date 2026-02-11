"use client";

import type { ReactNode } from 'react';
import { CheckCheck, ChevronLeft, ImageIcon } from 'lucide-react';

import type { WhatsAppTemplate } from '@/lib/types/whatsapp-config';

interface MobilePreviewProps {
  template: WhatsAppTemplate | null;
  variableValues?: Record<string, string>;
}

const whatsappGreen = '#25D366';

// Helper function to get the best matching value for a template variable
const getVariableValue = (
  token: string,
  variableValues: Record<string, string> | undefined,
  template: WhatsAppTemplate | null
): string | null => {
  if (!variableValues || Object.keys(variableValues).length === 0) return null;
  
  // Remove {{ and }} from token to get the key
  const key = token.replace(/^\{\{|\}\}$/g, '').trim();
  
  // Build a list of possible keys to try
  const keysToTry = [
    key,                          // e.g., '1', 'customer.firstname'
    token,                        // e.g., '{{1}}', '{{customer.firstname}}'
    `{{${key}}}`,                // e.g., '{{1}}'
    key.replace(/[{}]/g, ''),    // strip any remaining braces
  ];
  
  // For numeric variables like {{1}}, also try by index in template.variables array
  if (/^\d+$/.test(key) && template?.variables) {
    const index = parseInt(key, 10) - 1; // {{1}} is index 0
    if (index >= 0 && index < template.variables.length) {
      const templateVar = template.variables[index];
      keysToTry.push(templateVar, `{{${templateVar}}}`);
    }
  }

  // Try each key
  for (const tryKey of keysToTry) {
    const value = variableValues[tryKey];
    if (value !== undefined && value !== '' && value !== tryKey && value !== token) {
      return value;
    }
  }
  
  // Try case-insensitive match
  const lowerKey = key.toLowerCase();
  for (const [k, v] of Object.entries(variableValues)) {
    const lowerK = k.replace(/^\{\{|\}\}$/g, '').toLowerCase();
    if (lowerK === lowerKey && v !== '' && v !== k && v !== token) {
      return v;
    }
  }
  
  // Try by index if numeric (fallback for mapped arrays)
  if (/^\d+$/.test(key)) {
    const idx = parseInt(key, 10) - 1;
    const entries = Object.entries(variableValues);
    if (idx >= 0 && idx < entries.length) {
      const [, value] = entries[idx];
      if (value !== '' && !value.includes('{{')) {
        return value;
      }
    }
  }
  
  return null;
};

const formatSegments = (
  text: string,
  variableValues?: Record<string, string>,
  template?: WhatsAppTemplate | null
): ReactNode[] => {
  const segments: ReactNode[] = [];
  // Match all variable patterns and formatting
  const regex = /(\{\{[^}]+\}\}|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\n)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushPlain = (content: string) => {
    if (!content) return;
    segments.push(content);
  };

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushPlain(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token === '\n') {
      segments.push(<br key={`br-${segments.length}`} />);
    } else if (/^\{\{[^}]+\}\}$/.test(token)) {
      // Match any variable pattern: {{1}}, {{customer.firstname}}, {{order.number}}, etc.
      const value = getVariableValue(token, variableValues, template ?? null);
      
      if (value) {
        // Show the actual value - styled to indicate it's a replaced variable
        segments.push(
          <span 
            key={`var-${segments.length}`}
            className="text-[#25D366] font-medium"
          >
            {value}
          </span>
        );
      } else {
        // Show placeholder with styling when no value
        segments.push(
          <span
            key={`var-${segments.length}`}
            className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700"
          >
            {token}
          </span>
        );
      }
    } else if (token.startsWith('**')) {
      segments.push(
        <strong key={`strong-${segments.length}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*')) {
      segments.push(
        <strong key={`bold-${segments.length}`} className="font-semibold">
          {token.slice(1, -1)}
        </strong>
      );
    } else if (token.startsWith('_')) {
      segments.push(
        <em key={`italic-${segments.length}`} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    pushPlain(text.slice(lastIndex));
  }

  return segments;
};

export function MobilePreview({ template, variableValues }: MobilePreviewProps) {
  const body = template?.body ?? template?.content ?? '';

  if (!template) {
    return (
      <div className="mx-auto flex items-center justify-center">
        {/* Empty state with premium phone frame styling */}
        <div className="relative rounded-[28px] border-[12px] border-[#1a1a1a] bg-[#1a1a1a] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
          <div className="flex h-[520px] w-[280px] items-center justify-center rounded-[16px] bg-[#ece5dd]">
            <p className="w-3/4 text-center text-sm text-gray-500">
              Select a template to preview how it renders in WhatsApp.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex items-center justify-center">
      {/* Modern smartphone frame with premium styling - tall, realistic proportions */}
      <div className="relative w-[280px]">
        {/* Outer phone frame - premium dark bezel with depth and inner shadow */}
        <div className="relative rounded-[28px] border-[12px] border-[#1a1a1a] bg-[#1a1a1a] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.1)]">
          {/* Inner screen area with proper aspect ratio (tall, modern phone ~9:19.5) */}
          <div className="relative overflow-hidden rounded-[16px] bg-[#ece5dd] w-full" style={{ aspectRatio: '9/19.5', minHeight: '520px' }}>
            {/* Notch/Dynamic Island area */}
            <div className="relative h-[32px] bg-[#1a1a1a]">
              <div className="absolute left-1/2 top-[6px] h-[5px] w-[140px] -translate-x-1/2 rounded-full bg-[#2a2a2a]" />
              <div className="absolute right-5 top-[8px] h-[4px] w-[4px] rounded-full bg-[#3a3a3a]" />
            </div>

            {/* WhatsApp header bar */}
            <div className="relative bg-white">
              <div 
                className="flex items-center gap-3 rounded-t-[12px] px-5 py-3.5 shadow-sm" 
                style={{ backgroundColor: whatsappGreen }}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition-opacity hover:bg-white/30">
                  <ChevronLeft className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold leading-tight text-white truncate">{template.name}</div>
                  <div className="text-[12px] text-white/90 leading-tight">WhatsApp Business</div>
                </div>
                <div className="h-9 w-9 flex-shrink-0 rounded-full bg-white/20" />
              </div>
            </div>

            {/* Message content area with proper spacing */}
            <div className="space-y-5 px-5 py-6 min-h-[400px]">
              {/* Media header */}
              {template.header?.type === 'IMAGE' ? (
                <div className="flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-gray-200 shadow-sm">
                  <ImageIcon className="h-12 w-12 text-gray-400" />
                </div>
              ) : template.header?.type === 'TEXT' ? (
                <div className="rounded-2xl bg-white px-5 py-4 text-[15px] font-semibold leading-relaxed text-gray-800 shadow-sm">
                  {template.header.content}
                </div>
              ) : null}

              {/* Message bubble with improved styling */}
              <div className="flex flex-col gap-3">
                <div className="max-w-[82%] self-start rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm">
                  <div className="text-[15px] leading-relaxed text-gray-800">
                    {formatSegments(body, variableValues, template)}
                  </div>
                  <div className="mt-2.5 flex items-center justify-end gap-1.5 text-[11px] text-gray-500">
                    <span>12:45</span>
                    <CheckCheck className="h-3.5 w-3.5 text-[#34B7F1]" />
                  </div>
                </div>
              </div>

              {/* Footer */}
              {template.footer ? (
                <div className="max-w-[70%] rounded-2xl bg-white px-4 py-2.5 text-[12px] leading-relaxed text-gray-600 shadow-sm">
                  {template.footer}
                </div>
              ) : null}

              {/* Action buttons with improved styling */}
              {template.buttons?.length ? (
                <div className="flex flex-col gap-3 pt-2">
                  {template.buttons.map((button, idx) => (
                    <button
                      key={idx}
                      className="w-full rounded-full bg-white py-3.5 text-[13px] font-medium uppercase tracking-wide text-[#25D366] shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                    >
                      {button.text || button.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Bottom navigation bar */}
            <div className="h-[50px] rounded-b-[12px] bg-[#f0f0f0] border-t border-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}


