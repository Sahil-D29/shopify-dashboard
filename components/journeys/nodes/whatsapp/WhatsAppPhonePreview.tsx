"use client";

import { Badge } from "@/components/ui/badge";
import { MobilePreview } from "@/components/journeys/MobilePreview";
import type { WhatsAppBodyField, WhatsAppTemplate } from "@/lib/types/whatsapp-config";
import { useMemo } from "react";

interface WhatsAppPhonePreviewProps {
  template: WhatsAppTemplate | null;
  bodyFields: WhatsAppBodyField[];
  variables: Record<string, string>;
}

export function WhatsAppPhonePreview({ template, bodyFields, variables }: WhatsAppPhonePreviewProps) {
  const combinedBody = useMemo(() => {
    if (bodyFields.length) {
      return bodyFields.map(field => field.value?.trim()).filter(Boolean).join("\n\n");
    }
    return template?.body ?? template?.content ?? "";
  }, [bodyFields, template]);

  const previewTemplate = useMemo<WhatsAppTemplate | null>(() => {
    if (!template) return null;
    return {
      ...template,
      body: combinedBody,
      content: combinedBody,
    };
  }, [combinedBody, template]);

  const plainVariables = useMemo(() => {
    return Object.entries(variables).reduce<Record<string, string>>((acc, [key, value]) => {
      const stripped = key.replace(/^\{\{|\}\}$/g, "");
      acc[stripped] = value;
      return acc;
    }, {});
  }, [variables]);

  return (
    <div className="space-y-3">
      {previewTemplate ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Live Preview</p>
            <h4 className="text-lg font-semibold text-[#3A3028]">{previewTemplate.name}</h4>
            <p className="text-xs text-[#8B7F76]">
              {previewTemplate.category} • {previewTemplate.language.toUpperCase()}
            </p>
          </div>
          <Badge className="rounded-full bg-[#F5F3EE] text-[11px] font-semibold uppercase tracking-wide text-[#B7791F]">
            {previewTemplate.status}
          </Badge>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#E8E4DE] bg-white px-3 py-4 text-center text-sm text-[#8B7F76]">
          Select a template and map variables to preview the WhatsApp experience.
        </div>
      )}

      {/* Improved container with better spacing for the premium phone mockup */}
      <div className="rounded-3xl border border-[#E8E4DE] bg-[#F8F7F5] p-6 md:p-8">
        <MobilePreview template={previewTemplate} variableValues={plainVariables} />
      </div>
    </div>
  );
}


