import { TemplateButton } from '@/lib/types/template';

interface Props {
  header?: { type: string; content: string };
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
  sampleValues: Record<string, string>;
}

export default function TemplatePreview({ header, body, footer, buttons, sampleValues }: Props) {
  const fillVariables = (text: string): string => {
    return text.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
      return sampleValues[varName] || _match;
    });
  };

  return (
    <div className="w-full max-w-sm rounded-xl border bg-white p-4 shadow-sm">
      {/* WhatsApp Header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-emerald-100" />
        <div>
          <div className="text-sm font-semibold">Your Business</div>
          <div className="text-xs text-muted-foreground">Business Account</div>
        </div>
      </div>

      {/* Message Bubble */}
      <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-950">
        {/* Header */}
        {header?.content && (
          <div className="mb-2 font-medium">
            {header.type === 'TEXT' ? (
              <>{fillVariables(header.content)}</>
            ) : (
              <span className="italic text-emerald-700">{header.type} Preview</span>
            )}
          </div>
        )}

        {/* Body */}
        <div className="whitespace-pre-line">{fillVariables(body) || 'Your message will appear here...'}</div>

        {/* Footer */}
        {footer && (
          <div className="mt-2 text-xs text-emerald-700">{footer}</div>
        )}

        {/* Buttons */}
        {buttons && buttons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {buttons.map((btn, idx) => (
              <button key={idx} className="rounded-full border px-3 py-1 text-xs font-medium">
                {btn.text || 'Button'}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-3 text-[10px] text-emerald-700">
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}


