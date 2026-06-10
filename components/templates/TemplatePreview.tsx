import React from 'react';
import { ExternalLink, Phone, Reply, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { TemplateButton } from '@/lib/types/template';

interface Props {
  header?: { type: string; content: string };
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
  sampleValues: Record<string, string>;
}

/** Render WhatsApp markdown (*bold* _italic_ ~strike~ ```mono```) as React nodes. */
function formatWhatsApp(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[^`]+```)/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('```')) nodes.push(<code key={key++} className="font-mono bg-black/5 rounded px-1">{token.slice(3, -3)}</code>);
    else if (token.startsWith('*')) nodes.push(<strong key={key++}>{token.slice(1, -1)}</strong>);
    else if (token.startsWith('_')) nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    else if (token.startsWith('~')) nodes.push(<s key={key++}>{token.slice(1, -1)}</s>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

const WA_GREEN = '#00a884';

export default function TemplatePreview({ header, body, footer, buttons, sampleValues }: Props) {
  const fill = (text: string): string =>
    text.replace(/\{\{(\w+)\}\}/g, (_m, varName) => sampleValues[varName] || _m);

  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const ctaButtons = (buttons ?? []).filter(b => b.type === 'URL' || b.type === 'PHONE_NUMBER');
  const quickReplies = (buttons ?? []).filter(b => b.type === 'QUICK_REPLY');

  const mediaIcon =
    header?.type === 'VIDEO' ? <Video className="w-7 h-7" /> :
    header?.type === 'DOCUMENT' ? <FileText className="w-7 h-7" /> :
    <ImageIcon className="w-7 h-7" />;

  return (
    <div
      className="rounded-xl p-4 shadow-inner"
      style={{
        backgroundColor: '#efeae2',
        backgroundImage:
          'radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
        backgroundPosition: '0 0, 11px 11px',
      }}
    >
      {/* Incoming message bubble */}
      <div className="relative max-w-[85%]">
        {/* little tail */}
        <div className="absolute -left-1.5 top-0 w-3 h-3 overflow-hidden">
          <div className="w-3 h-3 bg-white rotate-45 origin-top-left" />
        </div>

        <div className="bg-white rounded-lg rounded-tl-none shadow-sm text-[14.5px] leading-snug text-[#111b21] overflow-hidden">
          {/* Media header */}
          {header && header.type !== 'TEXT' && (
            <div className="h-32 bg-gray-200 text-gray-500 flex flex-col items-center justify-center gap-1">
              {mediaIcon}
              <span className="text-xs">{header.type.charAt(0) + header.type.slice(1).toLowerCase()}</span>
            </div>
          )}

          <div className="px-2.5 pt-2 pb-1.5">
            {/* Text header */}
            {header?.type === 'TEXT' && header.content && (
              <div className="font-bold mb-1">{formatWhatsApp(fill(header.content))}</div>
            )}

            {/* Body */}
            <div className="whitespace-pre-wrap break-words">
              {body ? formatWhatsApp(fill(body)) : <span className="text-gray-400">Your message will appear here…</span>}
            </div>

            {/* Footer */}
            {footer && <div className="mt-1.5 text-[12.5px] text-[#667781]">{fill(footer)}</div>}

            {/* Timestamp */}
            <div className="flex justify-end mt-0.5">
              <span className="text-[11px] text-[#667781]">{now}</span>
            </div>
          </div>

          {/* CTA buttons (URL / phone) live inside the bubble, divided */}
          {ctaButtons.length > 0 && (
            <div className="border-t border-gray-100">
              {ctaButtons.map((btn, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center gap-2 py-2.5 text-[14px] font-medium border-t first:border-t-0 border-gray-100"
                  style={{ color: WA_GREEN }}
                >
                  {btn.type === 'URL' ? <ExternalLink className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  {btn.text || (btn.type === 'URL' ? 'Visit' : 'Call')}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick-reply buttons render as separate full-width pills below the bubble */}
      {quickReplies.length > 0 && (
        <div className="mt-1.5 space-y-1.5 max-w-[85%]">
          {quickReplies.map((btn, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-2 bg-white rounded-lg py-2.5 text-[14px] font-medium shadow-sm"
              style={{ color: WA_GREEN }}
            >
              <Reply className="w-4 h-4" />
              {btn.text || 'Quick reply'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
