"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ImageOff, MessageCircleWarning } from "lucide-react";
import type { TemplateButton, WhatsAppTemplate } from "@/lib/types/whatsapp-config";
import { useMemo, type ReactElement } from "react";

import { countTemplateCharacters, renderTemplateWithVariables } from "@/lib/whatsapp/template-utils";

export interface MessagePreviewProps {
  template?: WhatsAppTemplate | null;
  variablePreview: Record<string, string>;
  mediaUrl?: string;
  useDynamicMedia?: boolean;
  className?: string;
}

const MAX_WHATSAPP_CHARACTERS = 1024;

function renderButtons(buttons?: TemplateButton[]): ReactElement | null {
  if (!buttons?.length) return null;
  return (
    <div className="mt-4 space-y-2">
      {buttons.map(button => (
        <button
          key={button.id}
          type="button"
          className={cn(
            "w-full rounded-xl border px-4 py-2 text-left text-sm font-medium transition",
            button.type === "quick_reply"
              ? "border-[#D4A574] bg-[#FDF6ED] text-[#8F5F27] hover:bg-[#F6E6CF]"
              : "border-[#E8E4DE] bg-white text-[#4A4139] hover:bg-[#F5F3EE]",
          )}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}

export function MessagePreview({
  template,
  variablePreview,
  mediaUrl,
  useDynamicMedia,
  className,
}: MessagePreviewProps) {
  const resolvedMessage = useMemo(
    () => renderTemplateWithVariables(template, variablePreview),
    [template, variablePreview],
  );

  const characterCount = useMemo(() => countTemplateCharacters(template, variablePreview), [template, variablePreview]);
  const exceedsLimit = characterCount > MAX_WHATSAPP_CHARACTERS;

  return (
    <section className={cn("space-y-4", className)}>
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Step 6</p>
        <h3 className="text-lg font-semibold text-[#4A4139]">Preview &amp; Test</h3>
        <p className="text-sm text-[#8B7F76]">
          Review the final message exactly as customers will receive it. Variables are replaced with sample data based on your mappings.
        </p>
      </header>

      <div className="rounded-3xl border border-[#E8E4DE] bg-[#F5F3EE] p-6 shadow-inner">
        <div className="mx-auto flex max-w-md flex-col gap-4 rounded-3xl bg-[#DCF5D1] px-4 py-5 text-[#2F5130]">
          {template?.hasMediaHeader ? (
            <div className="relative overflow-hidden rounded-2xl border border-[#BFD8B4] bg-[#EEF7EA]">
              {mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl} alt={template.name} className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-[#6A8A62]">
                  <ImageOff className="h-8 w-8" />
                  {useDynamicMedia ? (
                    <span>Dynamic media will be inserted at send time.</span>
                  ) : (
                    <span>No media selected.</span>
                  )}
                </div>
              )}
            </div>
          ) : null}

          <div className="whitespace-pre-line text-sm leading-relaxed">{resolvedMessage || "Select a template and configure variables to preview the message."}</div>

          {template?.hasButtons ? renderButtons(template.buttons) : null}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-[#4A4139]">
        <span>
          <Badge className="rounded-full bg-[#F5F3EE] px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">
            Characters
          </Badge>{" "}
          {characterCount} / {MAX_WHATSAPP_CHARACTERS}
        </span>
        {exceedsLimit ? (
          <span className="flex items-center gap-2 text-xs text-[#C15D3B]">
            <MessageCircleWarning className="h-4 w-4" />
            Message exceeds WhatsApp limit. Shorten the content before proceeding.
          </span>
        ) : (
          <span className="text-xs text-[#8B7F76]">Within the allowed message length.</span>
        )}
      </div>
    </section>
  );
}


